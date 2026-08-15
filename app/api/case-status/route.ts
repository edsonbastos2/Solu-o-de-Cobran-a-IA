import { NextRequest, NextResponse } from 'next/server';
import { requireRole, serverError } from '@/lib/api-auth';
import { recordAuditAction } from '@/lib/audit';

const STATUSES = new Set(['not_started', 'in_negotiation', 'needs_attention', 'closed']);
const TRANSITIONS: Record<string, Set<string>> = {
  not_started: new Set(['not_started', 'in_negotiation', 'needs_attention', 'closed']),
  in_negotiation: new Set(['in_negotiation', 'needs_attention', 'closed']),
  needs_attention: new Set(['needs_attention', 'in_negotiation', 'closed']),
  closed: new Set(['closed']),
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const caseId = body?.caseId;
  const status = body?.status;

  if (typeof caseId !== 'string' || typeof status !== 'string' || !STATUSES.has(status)) {
    return NextResponse.json({ error: 'Caso e status válidos são obrigatórios.' }, { status: 400 });
  }

  const tenant = await requireRole(req, 'gestor', body?.tenant_id);
  if ('response' in tenant) return tenant.response;

  try {
    const { ctx } = tenant;
    const { data: before, error: lookupError } = await ctx.supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();
    if (lookupError) return serverError('case status lookup error', lookupError);
    if (!before) return NextResponse.json({ error: 'Caso não encontrado ou acesso negado.' }, { status: 404 });
    if (!TRANSITIONS[before.status]?.has(status)) {
      return NextResponse.json({ error: `Transição de status inválida: ${before.status} para ${status}.` }, { status: 400 });
    }

    const { data: updatedCase, error } = await ctx.supabase
      .from('cases')
      .update({ status })
      .eq('id', caseId)
      .eq('tenant_id', ctx.tenantId)
      .select('*')
      .single();
    if (error) return serverError('case status update error', error);

    await recordAuditAction(ctx.supabase, {
      tenantId: ctx.tenantId,
      entityType: 'case',
      entityId: caseId,
      caseId,
      actorUserId: ctx.userId,
      action: status === 'closed' ? 'CASE_CLOSED' : 'STATUS_CHANGE',
      before,
      after: updatedCase,
      metadata: { source: 'case-status' },
    });

    return NextResponse.json({ ok: true, status });
  } catch (error) {
    return serverError('case status exception', error);
  }
}
