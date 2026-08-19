import { NextRequest, NextResponse } from 'next/server';
import { sendCaseMessage } from '@/lib/channels/message-service';
import { requireTenantContext, serverError } from '@/lib/api-auth';
import { recordAuditAction } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const caseId = body?.caseId;
  const message = typeof body?.message === 'string' ? body.message.trim() : '';

  if (typeof caseId !== 'string' || !message) {
    return NextResponse.json({ error: 'Caso e mensagem são obrigatórios.' }, { status: 400 });
  }
  if (message.length > 4000) {
    return NextResponse.json({ error: 'Mensagem excede o limite de 4000 caracteres.' }, { status: 400 });
  }

  const tenant = await requireTenantContext(req, body?.tenant_id);
  if ('response' in tenant) return tenant.response;

  try {
    const { ctx } = tenant;
    const { data: caseData, error: caseError } = await ctx.supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();
    if (caseError) return serverError('agent message case lookup error', caseError);
    if (!caseData) return NextResponse.json({ error: 'Caso não encontrado.' }, { status: 404 });

    // Envio pelo canal ativo (message-service): persiste a mensagem com
    // channel/send_status. Sem destino de canal, grava no histórico sem canal.
    const sendResult = await sendCaseMessage({
      caseId,
      content: message,
      database: ctx.supabase,
      tenantId: ctx.tenantId,
      senderRole: 'human',
    });
    if (sendResult.status === 'skipped') {
      const { error: insertError } = await ctx.supabase.from('messages').insert({
        tenant_id: ctx.tenantId,
        case_id: caseId,
        role: 'human',
        content: message,
      });
      if (insertError) return serverError('agent message insert error', insertError);
    }

    await recordAuditAction(ctx.supabase, {
      tenantId: ctx.tenantId,
      entityType: 'message',
      entityId: caseId,
      caseId,
      actorUserId: ctx.userId,
      action: 'HUMAN_MESSAGE_SENT',
      metadata: { role: 'human', content_length: message.length },
    });

    if (caseData.status === 'in_negotiation' || caseData.status === 'not_started') {
      const { data: updatedCase, error: statusError } = await ctx.supabase
        .from('cases')
        .update({ status: 'needs_attention' })
        .eq('id', caseId)
        .eq('tenant_id', ctx.tenantId)
        .select('*')
        .single();
      if (statusError) return serverError('agent message status error', statusError);
      await recordAuditAction(ctx.supabase, {
        tenantId: ctx.tenantId,
        entityType: 'case',
        entityId: caseId,
        caseId,
        actorUserId: ctx.userId,
        action: 'STATUS_CHANGE',
        before: caseData,
        after: updatedCase,
        metadata: { source: 'human_message' },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError('agent message exception', error);
  }
}
