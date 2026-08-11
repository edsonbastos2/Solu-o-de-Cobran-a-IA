import { NextRequest, NextResponse } from 'next/server';
import { requireRole, serverError } from '@/lib/api-auth';
import { recordAuditAction } from '@/lib/audit';

const VALID_STATUSES = ['pending_review', 'approved', 'released', 'permanent_block'];

// Fluxo: pending_review -> approved -> released | permanent_block
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending_review: ['approved', 'released', 'permanent_block'],
  approved: ['released', 'permanent_block'],
  released: ['approved'],
  permanent_block: [],
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const requestedTenantId = new URL(req.url).searchParams.get('tenant_id');
  const tenant = await requireRole(req, 'admin', requestedTenantId);
  if ('response' in tenant) return tenant.response;

  try {
    const { ctx } = tenant;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 });
    }

    const newStatus = typeof body.status === 'string' ? body.status : '';
    if (!VALID_STATUSES.includes(newStatus)) {
      return NextResponse.json({ error: 'Status inválido.' }, { status: 400 });
    }

    const { data: current, error: currentError } = await ctx.supabase
      .from('quarantines')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();
    if (currentError) return serverError('quarantines PATCH lookup error', currentError);
    if (!current) return NextResponse.json({ error: 'Quarentena não encontrada ou acesso negado.' }, { status: 404 });

    const allowed = ALLOWED_TRANSITIONS[current.status] || [];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json({
        error: `Transição de "${current.status}" para "${newStatus}" não permitida.`,
      }, { status: 400 });
    }

    // permanent_block nunca expira; demais podem ter expires_at opcional.
    const update: Record<string, unknown> = {
      status: newStatus,
      reviewed_by: ctx.userId,
      reviewed_at: new Date().toISOString(),
    };
    if (body.expires_at !== undefined) {
      update.expires_at = newStatus === 'permanent_block' ? null : new Date(body.expires_at).toISOString();
    }

    const { data: updated, error } = await ctx.supabase
      .from('quarantines')
      .update(update)
      .eq('id', id)
      .eq('tenant_id', ctx.tenantId)
      .select()
      .single();

    if (error) return serverError('quarantines PATCH update error', error);

    await recordAuditAction(ctx.supabase, {
      tenantId: ctx.tenantId,
      entityType: 'quarantine',
      entityId: id,
      actorUserId: ctx.userId,
      actorRole: ctx.role,
      action: 'QUARANTINE_STATUS_CHANGED',
      before: current,
      after: updated,
      metadata: { from: current.status, to: newStatus },
    });

    return NextResponse.json({ ok: true, quarantine: updated });
  } catch (error) {
    return serverError('quarantines PATCH exception', error);
  }
}