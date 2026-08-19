import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { normalizeIncomingPhone, processInboundEvent, type InboundResult } from '@/lib/channels/inbound';
import { resolveWebhookTenant } from '@/lib/webhook-tenant';
import { logger } from '@/lib/logger';

function inboundResponse(result: InboundResult) {
  if (result.reason === 'duplicated') {
    return NextResponse.json({ ok: true, duplicated: true });
  }
  if (result.reason) {
    return NextResponse.json({ ok: true, reason: result.reason });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  try {
    // 1. Verificação de segredo do webhook (header X-Webhook-Secret)
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error('WEBHOOK_SECRET não configurado. Bloqueando webhook.');
      return NextResponse.json({ error: 'Servidor mal configurado' }, { status: 503 });
    }
    const incomingSecret = req.headers.get('x-webhook-secret');
    if (!incomingSecret || incomingSecret !== webhookSecret) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // 2. Validar Content-Type
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type inválido' }, { status: 415 });
    }

    const body = await req.json();

    // Ignora mensagens enviadas pelo próprio bot
    if (body.fromMe) {
      return NextResponse.json({ ok: true });
    }

    const text = body.text?.message || (typeof body.text === 'string' ? body.text : null);
    const from = body.phone;

    if (!text || !from) {
      return NextResponse.json({ ok: true });
    }

    // 3. Limita tamanho da mensagem recebida (evita payload gigante)
    const content = String(text).slice(0, 4000);

    const externalId = normalizeIncomingPhone(from);
    if (!externalId) {
      logger.warn('Telefone inválido, ignorando', undefined, { from });
      return NextResponse.json({ ok: true });
    }

    const database = getSupabaseAdmin();
    if (!database) {
      logger.error('Supabase admin não configurado.');
      return NextResponse.json({ ok: true });
    }

    const tenantId = await resolveWebhookTenant(database, { instanceId: body.instanceId });
    if (!tenantId) {
      logger.warn('[webhook/whatsapp] tenant não resolvido', undefined, { instanceId: body.instanceId || null });
      return NextResponse.json({ ok: true, ignored: 'tenant_unresolved' });
    }

    // 4. Idempotência Z-API: messageId/id como PK do evento.
    const providerMessageId = body.messageId || body.id || null;
    const eventId = providerMessageId
      ? String(providerMessageId)
      : body.instanceId != null && body.chatId != null
        ? `${body.instanceId}|${body.chatId}`
        : `wa:${externalId}:${Date.now()}`;

    const result = await processInboundEvent(database, {
      tenantId,
      channel: 'whatsapp',
      externalId,
      content,
      externalMessageId: providerMessageId ? String(providerMessageId) : undefined,
      eventId,
      metadata: body,
    });

    return inboundResponse(result);
  } catch (error) {
    logger.error('Z-API Webhook Error', undefined, { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
