import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { processChat } from '@/lib/agent';
import { rateLimit } from '@/lib/rate-limit';
import { resolveWebhookTenant } from '@/lib/webhook-tenant';
import { recordAuditAction } from '@/lib/audit';

// Normaliza telefone para dígitos sem o código 55 do Brasil.
function normalizePhone(phone?: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.substring(2);
  }
  // Aceita 10 (fixo) ou 11 (com nono dígito) para BR.
  if (digits.length !== 10 && digits.length !== 11) return null;
  return digits;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Verificação de segredo do webhook (header X-Webhook-Secret)
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('WEBHOOK_SECRET não configurado. Bloqueando webhook.');
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
    const messageText = String(text).slice(0, 4000);

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      console.error('Supabase admin não configurado.');
      return NextResponse.json({ ok: true });
    }

    const tenantId = await resolveWebhookTenant(supabaseAdmin, { instanceId: body.instanceId });
    if (!tenantId) {
      console.warn('[webhook/whatsapp] tenant não resolvido', { instanceId: body.instanceId || null });
      return NextResponse.json({ ok: true, ignored: 'tenant_unresolved' });
    }

    // 4. Idempotência: descarta eventos duplicados do Z-API
    const eventId = body.messageId || body.id || body.instanceId + '|' + body.chatId || null;
    if (eventId) {
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
    }

    // 5. Match de caso por telefone (match exato após normalização)
    const normalized = normalizePhone(from);
    if (!normalized) {
      console.warn('Telefone inválido, ignorando:', from);
      return NextResponse.json({ ok: true });
    }

    const { data: cases, error: casesError } = await supabaseAdmin
      .from('cases')
      .select('*')
      .eq('tenant_id', tenantId)
      .or(`status.eq.not_started,status.eq.in_negotiation,status.eq.needs_attention`)
      .or(`phone.eq.${normalized},phone.eq.55${normalized}`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (casesError || !cases || cases.length === 0) {
      return NextResponse.json({ ok: true });
    }

    const currentCase = cases[0];

    // Se o caso está em intervenção humana, apenas registra a mensagem
    if (currentCase.status === 'needs_attention') {
      await supabaseAdmin.from('messages').insert({
        tenant_id: tenantId,
        case_id: currentCase.id,
        role: 'user',
        content: messageText
      });
      await recordAuditAction(supabaseAdmin, {
        tenantId,
        entityType: 'message',
        entityId: currentCase.id,
        caseId: currentCase.id,
        actorUserId: currentCase.user_id || null,
        action: 'EXTERNAL_MESSAGE_RECEIVED',
        metadata: { channel: 'whatsapp', content_length: messageText.length },
      });
      return NextResponse.json({ ok: true });
    }

    // Dispara a lógica de chat com rate limiting por telefone (evita abuso)
    const rlKey = `wa:${normalized}`;
    if (!rateLimit(rlKey, 5, 60_000)) {
      console.warn('Rate limit webhook excedido para', normalized);
      return NextResponse.json({ ok: true, rateLimited: true });
    }
    const result = await processChat(currentCase.id, messageText, supabaseAdmin, tenantId);

    return NextResponse.json({ ok: true, newStatus: result.newStatus });
  } catch (error) {
    console.error('Z-API Webhook Error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
