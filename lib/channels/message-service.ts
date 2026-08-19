import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../logger';
import { getChannel } from './registry';
import type { ChannelId, SendOutcome } from './types';

export interface SendCaseMessageParams {
  caseId: string;
  content: string;
  database: SupabaseClient;
  tenantId: string;
  senderRole?: 'ai' | 'human';
  /**
   * Id de uma row de messages pré-persistida pelo chamador (send_status
   * 'pending'). Quando informado, o resultado do envio (channel,
   * send_status, external_message_id, sent_at, status_error) é aplicado via
   * UPDATE nessa row em vez de um novo INSERT — garante exatamente uma row
   * por mensagem. Sem persistMessageId, mantém o comportamento de INSERT.
   */
  persistMessageId?: string;
}

export interface SendClientMessageParams {
  clientId: string;
  content: string;
  database: SupabaseClient;
  tenantId: string;
}

export type MessageDispatchResult = {
  status: 'sent' | 'failed' | 'skipped';
  channel?: ChannelId;
  error?: string;
};

const OPEN_CASE_STATUSES = ['not_started', 'in_negotiation', 'needs_attention'];

interface CaseRow {
  id: string;
  tenant_id: string | null;
  debtor_id: string | null;
  financial_title_id: string | null;
  phone: string | null;
  telegram_chat_id: string | null;
  active_channel: ChannelId | null;
}

/** Campos de cases suficientes para resolver o cliente vinculado ao caso. */
export interface CaseClientRef {
  debtor_id: string | null;
  financial_title_id: string | null;
}

interface CaseDestination {
  channel: ChannelId;
  externalId: string;
}

const CASE_COLUMNS = 'id, tenant_id, debtor_id, financial_title_id, phone, telegram_chat_id, active_channel';

/** Limite de títulos consultados para montar o filtro de casos por cliente. */
const CLIENT_CASE_TITLE_LIMIT = 200;

/**
 * Resolve o clientId do caso: `cases` não possui coluna client_id — o vínculo
 * é feito por debtor_id (clients.id) ou pelo título financeiro do caso
 * (padrão canônico de lib/propensity.ts).
 */
export async function resolveCaseClientId(
  database: SupabaseClient,
  tenantId: string,
  caseRow: CaseClientRef
): Promise<string | null> {
  if (caseRow.debtor_id) {
    const { data: client, error } = await database
      .from('clients')
      .select('id')
      .eq('id', caseRow.debtor_id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) {
      logger.warn(
        'Falha ao validar devedor do caso',
        { tenantId },
        { error: error.message, debtorId: caseRow.debtor_id }
      );
    } else if (client?.id) {
      return client.id;
    }
  }
  if (caseRow.financial_title_id) {
    const { data: title, error } = await database
      .from('financial_titles')
      .select('client_id')
      .eq('id', caseRow.financial_title_id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) {
      logger.warn(
        'Falha ao resolver cliente via título financeiro do caso',
        { tenantId },
        { error: error.message, financialTitleId: caseRow.financial_title_id }
      );
      return null;
    }
    return title?.client_id ?? null;
  }
  return null;
}

/**
 * Monta o filtro PostgREST (.or) que casa os casos de um cliente: debtor_id
 * direto ou financial_title_id entre os títulos do cliente. Lança erro apenas
 * em falha de consulta aos títulos.
 */
export async function buildClientCaseFilter(
  database: SupabaseClient,
  tenantId: string,
  clientId: string
): Promise<string> {
  const { data: titles, error, count } = await database
    .from('financial_titles')
    .select('id', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(CLIENT_CASE_TITLE_LIMIT);
  if (error) {
    throw new Error(`Falha ao buscar títulos do cliente: ${error.message}`);
  }
  if ((count ?? 0) > CLIENT_CASE_TITLE_LIMIT) {
    // Não falha o fluxo, mas o filtro de casos pode ficar incompleto.
    logger.warn(
      'Cliente com mais títulos financeiros que o limite consultado',
      { tenantId, clientId },
      { totalTitles: count, limit: CLIENT_CASE_TITLE_LIMIT }
    );
  }
  const conditions = [`debtor_id.eq.${clientId}`];
  for (const title of titles ?? []) {
    conditions.push(`financial_title_id.eq.${title.id}`);
  }
  return conditions.join(',');
}

/**
 * Resolução de destino (task 5, requisito 2):
 * (a) cases.active_channel → client_channels do cliente do caso;
 * (b) fallback legado: cases.telegram_chat_id (telegram) ou cases.phone (whatsapp);
 * (c) sem destino → null (skipped).
 */
async function resolveCaseDestination(
  database: SupabaseClient,
  tenantId: string,
  caseRow: CaseRow
): Promise<CaseDestination | null> {
  if (caseRow.active_channel) {
    const clientId = await resolveCaseClientId(database, tenantId, caseRow);
    if (clientId) {
      const { data: clientChannel } = await database
        .from('client_channels')
        .select('external_id')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .eq('channel', caseRow.active_channel)
        .maybeSingle();
      if (clientChannel?.external_id) {
        return { channel: caseRow.active_channel, externalId: clientChannel.external_id };
      }
    }
  }
  if (caseRow.telegram_chat_id && caseRow.telegram_chat_id.replace(/\D/g, '')) {
    return { channel: 'telegram', externalId: caseRow.telegram_chat_id };
  }
  if (caseRow.phone && caseRow.phone.replace(/\D/g, '')) {
    return { channel: 'whatsapp', externalId: caseRow.phone };
  }
  return null;
}

interface DispatchResult {
  outcome: SendOutcome | null;
  error?: string;
}

async function dispatchMessage(
  database: SupabaseClient,
  tenantId: string,
  channel: ChannelId,
  externalId: string,
  content: string
): Promise<DispatchResult> {
  const resolved = await getChannel(database, tenantId, channel);
  if (!resolved) {
    return { outcome: null, error: 'Canal não configurado ou desabilitado' };
  }
  const outcome = await resolved.channel.sendMessage(resolved.ctx, { externalId }, content);
  return { outcome };
}

interface PersistMessageParams {
  tenantId: string;
  caseId: string | null;
  role: 'ai' | 'human';
  content: string;
  channel: ChannelId;
  outcome: SendOutcome | null;
  error?: string;
  /** Id de row pré-persistida pelo chamador: UPDATE do resultado em vez de INSERT. */
  messageId?: string;
}

/**
 * Persiste a mensagem com o resultado do envio; falhas de persistência não
 * mascaram o envio (requisito 8). Com messageId, aplica o resultado via
 * UPDATE na row pré-persistida (send_status 'pending') do chamador —
 * exatamente uma row por mensagem; sem messageId, INSERT (comportamento
 * legado).
 */
async function persistMessage(database: SupabaseClient, params: PersistMessageParams): Promise<void> {
  const sent = params.outcome?.status === 'sent';
  const externalMessageId =
    params.outcome?.status === 'sent' && params.outcome.externalMessageId
      ? params.outcome.externalMessageId
      : null;
  const statusError = params.outcome?.status === 'failed' ? params.outcome.error : (params.error ?? null);
  const sendStatus = sent ? 'sent' : 'failed';
  const sentAt = sent ? new Date().toISOString() : null;
  try {
    if (params.messageId) {
      const { error } = await database
        .from('messages')
        .update({
          channel: params.channel,
          external_message_id: externalMessageId,
          send_status: sendStatus,
          status_error: statusError,
          sent_at: sentAt,
        })
        .eq('id', params.messageId)
        .eq('tenant_id', params.tenantId);
      if (error) {
        logger.error(
          'Falha ao atualizar mensagem pré-persistida com o resultado do envio',
          { tenantId: params.tenantId, caseId: params.caseId },
          { error: error.message, messageId: params.messageId, channel: params.channel, sendStatus }
        );
      }
      return;
    }
    const { error } = await database.from('messages').insert({
      tenant_id: params.tenantId,
      case_id: params.caseId,
      role: params.role,
      content: params.content,
      channel: params.channel,
      external_message_id: externalMessageId,
      send_status: sendStatus,
      status_error: statusError,
      sent_at: sentAt,
    });
    if (error) {
      logger.error(
        'Falha ao persistir mensagem enviada',
        { tenantId: params.tenantId, caseId: params.caseId },
        { error: error.message, channel: params.channel, sendStatus }
      );
    }
  } catch (error) {
    logger.error(
      'Exceção ao persistir mensagem enviada',
      { tenantId: params.tenantId, caseId: params.caseId },
      { error: error instanceof Error ? error.message : String(error), channel: params.channel }
    );
  }
}

/**
 * Atualiza a row pré-persistida quando não houve envio externo (skipped —
 * conversa apenas pela UI) ou o caso não foi encontrado. Falhas de update
 * não interrompem o fluxo do chamador.
 */
async function updatePersistedMessage(
  database: SupabaseClient,
  tenantId: string,
  messageId: string,
  fields: Record<string, unknown>
): Promise<void> {
  try {
    const { error } = await database
      .from('messages')
      .update(fields)
      .eq('id', messageId)
      .eq('tenant_id', tenantId);
    if (error) {
      logger.error(
        'Falha ao atualizar mensagem pré-persistida',
        { tenantId },
        { error: error.message, messageId, fields: Object.keys(fields) }
      );
    }
  } catch (error) {
    logger.error(
      'Exceção ao atualizar mensagem pré-persistida',
      { tenantId },
      { error: error instanceof Error ? error.message : String(error), messageId }
    );
  }
}

function logDispatch(
  level: 'info' | 'warn',
  tenantId: string,
  caseId: string | null,
  channel: ChannelId,
  sendStatus: string,
  error?: string
): void {
  const context = { tenantId, caseId };
  const meta: Record<string, unknown> = { channel, sendStatus };
  if (error) meta.error = error;
  logger[level](sendStatus === 'sent' ? 'channel_message_sent' : 'channel_message_failed', context, meta);
}

export async function sendCaseMessage(params: SendCaseMessageParams): Promise<MessageDispatchResult> {
  const { caseId, content, database, tenantId, persistMessageId } = params;
  const role = params.senderRole ?? 'ai';

  // Filtro por tenant mesmo com client admin (defesa em profundidade contra
  // acesso cross-tenant quando o chamador passa o client service-role).
  const { data: caseRow, error: caseError } = await database
    .from('cases')
    .select(CASE_COLUMNS)
    .eq('id', caseId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (caseError || !caseRow) {
    logger.error('Caso não encontrado para envio de mensagem', { tenantId, caseId }, { error: caseError?.message });
    if (persistMessageId) {
      await updatePersistedMessage(database, tenantId, persistMessageId, {
        send_status: 'failed',
        status_error: 'Caso não encontrado',
      });
    }
    return { status: 'failed', error: 'Caso não encontrado' };
  }

  const destination = await resolveCaseDestination(database, tenantId, caseRow as CaseRow);
  if (!destination) {
    logger.info('Envio de mensagem ignorado: caso sem destino de canal', { tenantId, caseId });
    if (persistMessageId) {
      // Sem destino externo: a row pré-persistida permanece como histórico da
      // conversa (sem canal), equivalente ao insert legado sem canal.
      await updatePersistedMessage(database, tenantId, persistMessageId, { send_status: null });
    }
    return { status: 'skipped' };
  }

  const { outcome, error } = await dispatchMessage(database, tenantId, destination.channel, destination.externalId, content);

  await persistMessage(database, {
    tenantId,
    caseId,
    role,
    content,
    channel: destination.channel,
    outcome,
    error,
    messageId: persistMessageId,
  });

  if (!outcome) {
    logDispatch('warn', tenantId, caseId, destination.channel, 'failed', error);
    return { status: 'failed', channel: destination.channel, error };
  }
  if (outcome.status === 'sent') {
    logDispatch('info', tenantId, caseId, destination.channel, 'sent');
    return { status: 'sent', channel: destination.channel };
  }
  logDispatch('warn', tenantId, caseId, destination.channel, 'failed', outcome.error);
  return { status: 'failed', channel: destination.channel, error: outcome.error };
}

export async function sendClientMessage(params: SendClientMessageParams): Promise<MessageDispatchResult> {
  const { clientId, content, database, tenantId } = params;

  // Casos do cliente: debtor_id direto ou via títulos financeiros
  // (cases não possui coluna client_id).
  let caseRow: { id: string } | null = null;
  try {
    const caseFilter = await buildClientCaseFilter(database, tenantId, clientId);
    const { data, error } = await database
      .from('cases')
      .select('id')
      .eq('tenant_id', tenantId)
      .or(caseFilter)
      .in('status', OPEN_CASE_STATUSES)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      logger.error('Falha ao buscar caso aberto do cliente', { tenantId, clientId }, { error: error.message });
      return { status: 'failed', error: 'Falha ao buscar caso aberto do cliente' };
    }
    caseRow = data;
  } catch (error) {
    logger.error(
      'Falha ao buscar caso aberto do cliente',
      { tenantId, clientId },
      { error: error instanceof Error ? error.message : String(error) }
    );
    return { status: 'failed', error: 'Falha ao buscar caso aberto do cliente' };
  }

  if (caseRow) {
    const caseResult = await sendCaseMessage({ caseId: caseRow.id, content, database, tenantId, senderRole: 'ai' });
    if (caseResult.status !== 'skipped') return caseResult;
  }

  const { data: clientChannel, error: clientChannelError } = await database
    .from('client_channels')
    .select('external_id')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .eq('channel', 'whatsapp')
    .maybeSingle();
  if (clientChannelError) {
    logger.error('Falha ao buscar canal whatsapp do cliente', { tenantId, clientId }, { error: clientChannelError.message });
    return { status: 'failed', error: 'Falha ao buscar canal whatsapp do cliente' };
  }

  let externalId: string | null = clientChannel?.external_id ?? null;
  if (!externalId) {
    const { data: client, error: clientError } = await database
      .from('clients')
      .select('phone')
      .eq('id', clientId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (clientError) {
      logger.error('Falha ao buscar telefone do cliente', { tenantId, clientId }, { error: clientError.message });
      return { status: 'failed', error: 'Falha ao buscar telefone do cliente' };
    }
    externalId = client?.phone && client.phone.replace(/\D/g, '') ? client.phone : null;
  }

  if (!externalId) {
    logger.info('Envio de mensagem ignorado: cliente sem destino de canal', { tenantId, clientId });
    return { status: 'skipped' };
  }

  const { outcome, error } = await dispatchMessage(database, tenantId, 'whatsapp', externalId, content);

  await persistMessage(database, {
    tenantId,
    caseId: caseRow?.id ?? null,
    role: 'ai',
    content,
    channel: 'whatsapp',
    outcome,
    error,
  });

  if (!outcome) {
    logDispatch('warn', tenantId, caseRow?.id ?? null, 'whatsapp', 'failed', error);
    return { status: 'failed', channel: 'whatsapp', error };
  }
  if (outcome.status === 'sent') {
    logDispatch('info', tenantId, caseRow?.id ?? null, 'whatsapp', 'sent');
    return { status: 'sent', channel: 'whatsapp' };
  }
  logDispatch('warn', tenantId, caseRow?.id ?? null, 'whatsapp', 'failed', outcome.error);
  return { status: 'failed', channel: 'whatsapp', error: outcome.error };
}
