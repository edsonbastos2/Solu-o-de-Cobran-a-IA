import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { resolveChannelByWebhookSecret } from '@/lib/channels/registry';
import { processInboundEvent, type InboundResult } from '@/lib/channels/inbound';
import { resolveWebhookTenant } from '@/lib/webhook-tenant';
import { recordAuditAction } from '@/lib/audit';
import { rateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

interface TelegramFrom {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramMessage {
  message_id: number;
  from: TelegramFrom;
  chat: { id: number; type: string };
  text?: string;
  date: number;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: {
    id: string;
    from: TelegramFrom;
    message?: { message_id: number; chat: { id: number; type: string } };
    data?: string;
  };
  my_chat_member?: {
    chat: { id: number };
    from: TelegramFrom;
    old_chat_member: { status: string };
    new_chat_member: { status: string };
  };
}

function inboundResponse(result: InboundResult) {
  if (result.reason === 'duplicated') {
    return NextResponse.json({ ok: true, duplicated: true });
  }
  if (result.reason) {
    return NextResponse.json({ ok: true, reason: result.reason });
  }
  return NextResponse.json({ ok: true });
}

// Mensagens do bot para o fluxo de vinculação (ADR-002) — em pt-BR e sem
// revelar qual condição do token falhou (prevenção de enumeração).
const LINK_TOKEN_INVALID_MESSAGE =
  'Link de vinculação inválido ou expirado. Solicite um novo link ao operador.';
const LINK_ALREADY_BOUND_MESSAGE =
  'Esta conta do Telegram já está vinculada a outro cadastro. Entre em contato com o operador para regularizar.';
const LINK_CONFIRMATION_MESSAGE =
  'Obrigado! Seu Telegram foi vinculado com sucesso. Em breve entraremos em contato.';

function linkBotReply(chatId: string, text: string) {
  return NextResponse.json({ ok: true, method: 'sendMessage', chat_id: chatId, text });
}

interface LinkTokenRow {
  id: string;
  client_id: string;
  expires_at: string;
  used_at: string | null;
}

/** /start <token opaco>: valida o token, vincula o chat_id ao cliente e invalida o token. */
async function handleChannelLinkStart(
  database: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  tenantId: string,
  payload: string,
  chatId: string,
  from: TelegramFrom
): Promise<NextResponse> {
  if (!payload || payload.length > 128) {
    return linkBotReply(chatId, LINK_TOKEN_INVALID_MESSAGE);
  }

  const tokenHash = createHash('sha256').update(payload).digest('hex');
  const { data: tokenRow, error: tokenError } = await database
    .from('channel_link_tokens')
    .select('id, client_id, expires_at, used_at')
    .eq('tenant_id', tenantId)
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (tokenError) {
    logger.error('Falha ao buscar token de vinculação', { tenantId }, { error: tokenError.message });
    throw tokenError;
  }
  const token = tokenRow as LinkTokenRow | null;
  if (!token || token.used_at || new Date(token.expires_at).getTime() <= Date.now()) {
    return linkBotReply(chatId, LINK_TOKEN_INVALID_MESSAGE);
  }

  // Conflito: chat_id já vinculado a outro cliente do tenant (identificador
  // estável — nunca consulta por username).
  const { data: existingBinding } = await database
    .from('client_channels')
    .select('client_id')
    .eq('tenant_id', tenantId)
    .eq('channel', 'telegram')
    .eq('external_id', chatId)
    .maybeSingle();
  if (existingBinding && existingBinding.client_id !== token.client_id) {
    await recordAuditAction(database, {
      tenantId,
      entityType: 'client',
      entityId: token.client_id,
      actorUserId: null,
      action: 'CLIENT_CHANNEL_LINK_CONFLICT',
      metadata: { channel: 'telegram', external_id_length: chatId.length },
    });
    return linkBotReply(chatId, LINK_ALREADY_BOUND_MESSAGE);
  }

  // Invalidação atômica do token (uso único): UPDATE condicional — a segunda
  // execução concorrente afeta 0 linhas e não vincula duas vezes.
  const { data: claimed, error: claimError } = await database
    .from('channel_link_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', token.id)
    .is('used_at', null)
    .select('id');
  if (claimError) {
    logger.error('Falha ao invalidar token de vinculação', { tenantId }, { error: claimError.message });
    throw claimError;
  }
  if (!claimed || claimed.length === 0) {
    return linkBotReply(chatId, LINK_TOKEN_INVALID_MESSAGE);
  }

  const { error: upsertError } = await database.from('client_channels').upsert(
    {
      tenant_id: tenantId,
      client_id: token.client_id,
      channel: 'telegram',
      external_id: chatId,
      username: from.username ?? null,
      verified_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id,client_id,channel' }
  );
  if (upsertError) {
    if (upsertError.code === '23505') {
      // Corrida: chat_id vinculado a outro cliente entre a checagem e o upsert.
      await recordAuditAction(database, {
        tenantId,
        entityType: 'client',
        entityId: token.client_id,
        actorUserId: null,
        action: 'CLIENT_CHANNEL_LINK_CONFLICT',
        metadata: { channel: 'telegram', external_id_length: chatId.length },
      });
      return linkBotReply(chatId, LINK_ALREADY_BOUND_MESSAGE);
    }
    logger.error('Falha ao vincular canal do cliente', { tenantId }, { error: upsertError.message });
    throw upsertError;
  }

  await recordAuditAction(database, {
    tenantId,
    entityType: 'client',
    entityId: token.client_id,
    actorUserId: null,
    action: 'CLIENT_CHANNEL_LINKED',
    metadata: { channel: 'telegram', external_id_length: chatId.length },
  });

  return linkBotReply(chatId, LINK_CONFIRMATION_MESSAGE);
}

export async function POST(req: NextRequest) {
  try {
    const incomingSecret = req.headers.get('x-telegram-bot-api-secret-token');
    if (!incomingSecret) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type inválido' }, { status: 415 });
    }

    const body: TelegramUpdate = await req.json();

    // Usuário bloqueou/desbloqueou o bot: apenas log estruturado.
    if (body.my_chat_member) {
      logger.info('Telegram my_chat_member', undefined, {
        chatId: String(body.my_chat_member.chat?.id ?? ''),
        fromId: body.my_chat_member.from?.id ?? null,
        oldStatus: body.my_chat_member.old_chat_member?.status,
        newStatus: body.my_chat_member.new_chat_member?.status,
      });
      return NextResponse.json({ ok: true });
    }

    const msg = body.message
      || (body.callback_query?.message
        ? {
            ...body.callback_query.message,
            text: body.callback_query.data,
            from: body.callback_query.from,
          }
        : null);

    if (!msg || !msg.text || !msg.from) {
      return NextResponse.json({ ok: true });
    }

    const chatId = String(msg.chat.id);
    const text = String(msg.text).slice(0, 4000);

    const database = getSupabaseAdmin();
    if (!database) {
      return NextResponse.json({ ok: true });
    }

    // Auth (ADR-005): secret por tenant em channel_configs; fallback demo com
    // WEBHOOK_SECRET global + TELEGRAM_BOT_TOKEN env.
    let tenantId: string | null = null;
    const resolved = await resolveChannelByWebhookSecret(database, incomingSecret);
    if (resolved) {
      tenantId = resolved.tenantId;
    } else {
      const globalSecret = process.env.WEBHOOK_SECRET;
      if (!globalSecret || incomingSecret !== globalSecret || !process.env.TELEGRAM_BOT_TOKEN) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
      }
      tenantId = await resolveWebhookTenant(database, { botToken: process.env.TELEGRAM_BOT_TOKEN });
      if (!tenantId) {
        return NextResponse.json({ ok: true, ignored: 'tenant_unresolved' });
      }
    }

    if (text.startsWith('/start ')) {
      const startPayload = text.replace('/start ', '').trim();

      // /start case_<base64> legado (transição): vincula telegram_chat_id ao
      // caso, scoped ao tenant autenticado pelo webhook.
      if (startPayload.includes('case_')) {
        try {
          const decoded = Buffer.from(startPayload, 'base64').toString('utf-8');
          if (decoded.startsWith('case_')) {
            const caseId = decoded.replace('case_', '');
            const { error } = await database
              .from('cases')
              .update({ telegram_chat_id: chatId })
              .eq('id', caseId)
              .eq('tenant_id', tenantId);

            if (!error) {
              return NextResponse.json({
                ok: true,
                method: 'sendMessage',
                chat_id: chatId,
                text: 'Obrigado! Sua conversa foi vinculada ao caso. Em breve entraremos em contato.'
              });
            }
          }
        } catch {}
        return NextResponse.json({ ok: true });
      }

      // /start <token opaco> — fluxo de vinculação seguro (ADR-002).
      // Rate limit por chat_id (anti-força bruta de tokens): acima do limite,
      // responde ok silencioso para não revelar a regra ao remetente.
      if (!(await rateLimit(`telegram-link-start:${tenantId}:${chatId}`, 5, 60_000))) {
        return NextResponse.json({ ok: true });
      }
      return await handleChannelLinkStart(database, tenantId, startPayload, chatId, msg.from);
    }

    const result = await processInboundEvent(database, {
      tenantId,
      channel: 'telegram',
      externalId: chatId,
      content: text,
      externalMessageId: `tg:${chatId}:${msg.message_id}`,
      eventId: `tg:${body.update_id}`,
      metadata: {
        update_id: body.update_id,
        chat_id: chatId,
        chat_type: msg.chat.type,
        from_id: msg.from.id,
        username: msg.from.username ?? null,
      },
    });

    return inboundResponse(result);
  } catch (error) {
    logger.error('Telegram Webhook Error', undefined, { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// GET: used by Telegram to verify webhook URL
export async function GET() {
  return NextResponse.json({ ok: true, description: 'Telegram Bot Webhook' });
}
