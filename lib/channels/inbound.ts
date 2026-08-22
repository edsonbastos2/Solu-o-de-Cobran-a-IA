import type { SupabaseClient } from '@supabase/supabase-js';
import { processChat } from '../agent';
import { recordAuditAction } from '../audit';
import { logger } from '../logger';
import { rateLimit } from '../rate-limit';
import { isAIPaused } from '../conversation-service';
import { buildClientCaseFilter } from './message-service';
import type { InboundEvent } from './types';

export interface InboundResult {
  ok: boolean;
  reason?: string;
}

const ELIGIBLE_CASE_STATUSES = ['not_started', 'in_negotiation', 'needs_attention'];

interface EligibleCaseRow {
  id: string;
  status: string;
  controller: import('@/lib/types').ConversationController | null;
  user_id: string | null;
}

/** Normaliza telefone para dígitos sem o prefixo 55 do Brasil (10 ou 11 dígitos). */
export function normalizeIncomingPhone(phone?: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.substring(2);
  }
  if (digits.length !== 10 && digits.length !== 11) return null;
  return digits;
}

async function resolveClientByChannel(
  database: SupabaseClient,
  event: InboundEvent
): Promise<string | null> {
  const externalIds =
    event.channel === 'whatsapp' ? [event.externalId, `55${event.externalId}`] : [event.externalId];
  const { data, error } = await database
    .from('client_channels')
    .select('client_id')
    .eq('tenant_id', event.tenantId)
    .eq('channel', event.channel)
    .in('external_id', externalIds)
    .limit(1);
  if (error) {
    logger.error(
      'Falha ao resolver cliente por client_channels',
      { tenantId: event.tenantId },
      { error: error.message, channel: event.channel }
    );
    return null;
  }
  return data && data.length > 0 ? data[0].client_id : null;
}

function eligibleCaseQuery(database: SupabaseClient, event: InboundEvent) {
  return database
    .from('cases')
    .select('id, status, controller, user_id')
    .eq('tenant_id', event.tenantId)
    .in('status', ELIGIBLE_CASE_STATUSES)
    .order('created_at', { ascending: false })
    .limit(1);
}

async function findEligibleCaseByClient(
  database: SupabaseClient,
  event: InboundEvent,
  clientId: string
): Promise<EligibleCaseRow | null> {
  // cases não possui coluna client_id: casa por debtor_id direto ou pelos
  // títulos financeiros do cliente (filtro .or montado pelo helper).
  let caseFilter: string;
  try {
    caseFilter = await buildClientCaseFilter(database, event.tenantId, clientId);
  } catch (error) {
    logger.error(
      'Falha ao buscar caso elegível do cliente',
      { tenantId: event.tenantId },
      { error: error instanceof Error ? error.message : String(error), clientId }
    );
    return null;
  }
  const { data, error } = await eligibleCaseQuery(database, event)
    .or(caseFilter)
    .maybeSingle();
  if (error) {
    logger.error(
      'Falha ao buscar caso elegível do cliente',
      { tenantId: event.tenantId },
      { error: error.message, clientId }
    );
    return null;
  }
  return (data as EligibleCaseRow) ?? null;
}

/** Fallback legado (pré client_channels): telegram_chat_id (Telegram) ou phone (WhatsApp). */
async function findEligibleCaseLegacy(
  database: SupabaseClient,
  event: InboundEvent
): Promise<EligibleCaseRow | null> {
  let query = eligibleCaseQuery(database, event);
  if (event.channel === 'telegram') {
    query = query.eq('telegram_chat_id', event.externalId);
  } else {
    const digits = normalizeIncomingPhone(event.externalId) ?? event.externalId.replace(/\D/g, '');
    query = query.or(`phone.eq.${digits},phone.eq.55${digits}`);
  }
  const { data, error } = await query.maybeSingle();
  if (error) {
    logger.error(
      'Falha ao buscar caso elegível pelo identificador legado',
      { tenantId: event.tenantId },
      { error: error.message, channel: event.channel }
    );
    return null;
  }
  return (data as EligibleCaseRow) ?? null;
}

/**
 * Processamento unificado de eventos recebidos (webhooks WhatsApp/Telegram):
 * idempotência, resolução canal → cliente → caso elegível (ADR-002, com
 * fallback legado), registro da mensagem recebida, needs_attention sem IA,
 * rate limit 5/60s por chat e disparo do pipeline de IA.
 */
export async function processInboundEvent(
  database: SupabaseClient,
  event: InboundEvent
): Promise<InboundResult> {
  // Idempotência: PK dedicada em webhook_events; 23505 = reentrega duplicada.
  const { error: eventError } = await database
    .from('webhook_events')
    .insert({ id: event.eventId, payload: event.metadata });
  if (eventError) {
    if (eventError.code === '23505') return { ok: true, reason: 'duplicated' };
    throw eventError;
  }

  // Resolução de cliente por client_channels.external_id, com fallback legado.
  const clientId = await resolveClientByChannel(database, event);
  let caseRow = clientId ? await findEligibleCaseByClient(database, event, clientId) : null;
  if (!caseRow) {
    caseRow = await findEligibleCaseLegacy(database, event);
  }
  if (!caseRow) {
    return { ok: true, reason: 'no_eligible_case' };
  }

  // Registra a mensagem recebida com canal e status.
  const { error: messageError } = await database.from('messages').insert({
    tenant_id: event.tenantId,
    case_id: caseRow.id,
    role: 'user',
    content: event.content,
    channel: event.channel,
    external_message_id: event.externalMessageId ?? null,
    send_status: 'received',
  });
  if (messageError) {
    if (messageError.code === '23505') return { ok: true, reason: 'duplicated' };
    throw messageError;
  }

  // Evento de conversa: mensagem do devedor recebida (timeline/auditoria).
  const { error: eventInsertError } = await database.from('conversation_events').insert({
    tenant_id: event.tenantId,
    case_id: caseRow.id,
    type: 'MESSAGE_RECEIVED',
    performed_by: null,
    payload: { channel: event.channel, content_length: event.content.length },
  });
  if (eventInsertError) {
    logger.warn(
      'Falha ao registrar evento de mensagem recebida',
      { tenantId: event.tenantId },
      { error: eventInsertError.message, caseId: caseRow.id }
    );
  }

  // IA pausada (humano conduz, ou legado needs_attention): apenas registra
  // mensagem + evento + auditoria, sem disparar o pipeline de IA.
  if (isAIPaused(caseRow)) {
    await recordAuditAction(database, {
      tenantId: event.tenantId,
      entityType: 'message',
      entityId: caseRow.id,
      caseId: caseRow.id,
      actorUserId: caseRow.user_id || null,
      action: 'EXTERNAL_MESSAGE_RECEIVED',
      metadata: { channel: event.channel, content_length: event.content.length, ai_paused: true },
    });
    return { ok: true, reason: 'ai_paused' };
  }

  // Rate limit 5/60s por chat — excedido responde ok ao provedor (sem 429).
  const rateLimitKey = `${event.channel}:${event.externalId}`;
  if (!(await rateLimit(rateLimitKey, 5, 60_000))) {
    logger.warn(
      'Rate limit de mensagem recebida excedido',
      { tenantId: event.tenantId },
      { channel: event.channel, externalId: event.externalId }
    );
    return { ok: true, reason: 'rate_limited' };
  }

  // Pipeline de IA — a mensagem do devedor já foi persistida acima.
  await processChat(caseRow.id, event.content, database, event.tenantId, {
    persistUserMessage: false,
  });

  return { ok: true };
}
