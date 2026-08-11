import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { processChat } from '@/lib/agent';
import { rateLimit } from '@/lib/rate-limit';
import { resolveWebhookTenant } from '@/lib/webhook-tenant';
import { recordAuditAction } from '@/lib/audit';
import { logger } from '@/lib/logger';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; first_name?: string; last_name?: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
    date: number;
  };
  callback_query?: {
    id: string;
    from: { id: number; first_name?: string };
    message?: { chat: { id: number } };
    data?: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json({ error: 'Servidor mal configurado' }, { status: 503 });
    }
    const incomingSecret = req.headers.get('x-telegram-bot-api-secret-token');
    if (incomingSecret !== webhookSecret) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type inválido' }, { status: 415 });
    }

    const body: TelegramUpdate = await req.json();
    const msg = body.message || (body.callback_query?.message ? { ...body.callback_query.message, text: body.callback_query.data, from: body.callback_query.from } : null);

    if (!msg || !msg.text || !msg.from) {
      return NextResponse.json({ ok: true });
    }

    const chatId = String(msg.chat.id);
    const text = String(msg.text).slice(0, 4000);

    // Handle /start command with deep link (case ID)
    if (text.startsWith('/start ') && text.includes('case_')) {
      const base64Payload = text.replace('/start ', '').trim();
      try {
        const decoded = Buffer.from(base64Payload, 'base64').toString('utf-8');
        if (decoded.startsWith('case_')) {
           const caseId = decoded.replace('case_', '');
           const supabaseAdmin = getSupabaseAdmin();
           const botToken = process.env.TELEGRAM_BOT_TOKEN;
           if (supabaseAdmin && botToken) {
             const tenantId = await resolveWebhookTenant(supabaseAdmin, { caseId, botToken });
             if (!tenantId) return NextResponse.json({ ok: true });
             const { error } = await supabaseAdmin
               .from('cases')
                .update({ telegram_chat_id: chatId })
                .eq('id', caseId)
                .eq('tenant_id', tenantId);

             if (!error) {
              return NextResponse.json({ ok: true, method: 'sendMessage', chat_id: chatId, text: 'Obrigado! Sua conversa foi vinculada ao caso. Em breve entraremos em contato.' });
            }
          }
        }
      } catch {}
      return NextResponse.json({ ok: true });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ ok: true });
    }

    const tenantId = await resolveWebhookTenant(supabaseAdmin, {
      botToken: process.env.TELEGRAM_BOT_TOKEN,
    });
    if (!tenantId) return NextResponse.json({ ok: true, ignored: 'tenant_unresolved' });

    // Idempotency check
    const eventId = `tg:${body.update_id}`;
    const { data: existing } = await supabaseAdmin
      .from('webhook_events')
      .select('id')
      .eq('id', eventId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ ok: true, duplicated: true });
    }
    const { error: eventError } = await supabaseAdmin.from('webhook_events').insert({ id: eventId, payload: body });
    if (eventError?.code === '23505') return NextResponse.json({ ok: true, duplicated: true });
    if (eventError) throw eventError;

    // Match case by telegram_chat_id
    const { data: cases, error: casesError } = await supabaseAdmin
      .from('cases')
      .select('*')
      .eq('telegram_chat_id', chatId)
      .eq('tenant_id', tenantId)
      .or('status.eq.not_started,status.eq.in_negotiation,status.eq.needs_attention')
      .order('created_at', { ascending: false })
      .limit(1);

    if (casesError || !cases || cases.length === 0) {
      return NextResponse.json({ ok: true });
    }

    const currentCase = cases[0];

    if (currentCase.status === 'needs_attention') {
      await supabaseAdmin.from('messages').insert({
        tenant_id: tenantId,
        case_id: currentCase.id,
        role: 'user',
        content: text
      });
      await recordAuditAction(supabaseAdmin, {
        tenantId,
        entityType: 'message',
        entityId: currentCase.id,
        caseId: currentCase.id,
        actorUserId: currentCase.user_id || null,
        action: 'EXTERNAL_MESSAGE_RECEIVED',
        metadata: { channel: 'telegram', content_length: text.length },
      });
      return NextResponse.json({ ok: true });
    }

    const rlKey = `tg:${chatId}`;
    if (!(await rateLimit(rlKey, 5, 60_000))) {
      logger.warn('Rate limit Telegram webhook excedido', undefined, { chatId });
      return NextResponse.json({ ok: true, rateLimited: true });
    }

    const result = await processChat(currentCase.id, text, supabaseAdmin, tenantId);

    return NextResponse.json({ ok: true, newStatus: result.newStatus });
  } catch (error) {
    logger.error('Telegram Webhook Error', undefined, { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// GET: used by Telegram to verify webhook URL
export async function GET() {
  return NextResponse.json({ ok: true, description: 'Telegram Bot Webhook' });
}
