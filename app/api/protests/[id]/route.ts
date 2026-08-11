import { NextRequest, NextResponse } from 'next/server';
import { requireRole, serverError } from '@/lib/api-auth';
import { recordAuditAction } from '@/lib/audit';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ProtestStatus = 'pending_notification' | 'notified' | 'requested' | 'completed' | 'cancelled';

const ALLOWED_TRANSITIONS: Partial<Record<ProtestStatus, ProtestStatus[]>> = {
  pending_notification: ['notified', 'cancelled', 'requested'],
  notified: ['requested', 'cancelled'],
  requested: ['completed', 'cancelled'],
  completed: ['cancelled'],
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => null);
    const requestedTenantId = searchParams.get('tenant_id')
      || (typeof body?.tenant_id === 'string' ? body.tenant_id : null);

    const tenantContext = await requireRole(req, 'admin', requestedTenantId);
    if ('response' in tenantContext) return tenantContext.response;
    const { supabase, tenantId, userId } = tenantContext.ctx;

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 });
    }

    const allowed = ['status', 'provider', 'external_reference', 'metadata'];
    if (Object.keys(body).some((k) => k !== 'tenant_id' && !allowed.includes(k))) {
      return NextResponse.json({ error: 'Campo não permitido para atualização do protesto.' }, { status: 400 });
    }

    const { data: current, error: lookupError } = await supabase
      .from('protests')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!current) {
      return NextResponse.json({ error: 'Protesto não encontrado ou não pertence ao tenant.' }, { status: 404 });
    }

    const update: Record<string, unknown> = {};
    const nextStatus = body.status as unknown;

    if (typeof nextStatus === 'string') {
      if (!ALLOWED_TRANSITIONS[nextStatus as ProtestStatus] && nextStatus !== current.status) {
        return NextResponse.json({ error: 'Status de protesto inválido.' }, { status: 400 });
      }
      if (nextStatus !== current.status) {
        const from = current.status as ProtestStatus;
        const allowedNext = ALLOWED_TRANSITIONS[from] || [];
        if (!allowedNext.includes(nextStatus as ProtestStatus)) {
          return NextResponse.json(
            { error: `Transição inválida: ${from} → ${String(nextStatus)}.` },
            { status: 409 }
          );
        }
        update.status = nextStatus;
        if (nextStatus === 'notified' && !current.notified_at) update.notified_at = new Date().toISOString();
        if (nextStatus === 'requested') update.requested_at = new Date().toISOString();
        if (nextStatus === 'completed') update.completed_at = new Date().toISOString();
        if (nextStatus === 'cancelled') update.cancelled_at = new Date().toISOString();
      }
    }

    if (body.provider !== undefined && typeof body.provider === 'string') {
      update.provider = body.provider.trim().toLowerCase() || null;
    }
    if (body.external_reference !== undefined && typeof body.external_reference === 'string') {
      update.external_reference = body.external_reference.trim() || null;
    }
    if (body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)) {
      update.metadata = { ...(current.metadata || {}), ...body.metadata };
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: true, protest: current });
    }

    const { data: updated, error: updateError } = await supabase
      .from('protests')
      .update(update)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();
    if (updateError) throw updateError;

    await recordAuditAction(supabase, {
      tenantId,
      entityType: 'protest',
      entityId: id,
      actorUserId: userId,
      action: 'PROTEST_STATUS_CHANGE',
      before: current,
      after: updated,
      metadata: { status_from: current.status, status_to: updated.status },
    });

    return NextResponse.json({ ok: true, protest: updated });
  } catch (error: unknown) {
    logger.error('[protests PATCH] exception', undefined, { error: error instanceof Error ? error.message : String(error) });
    return serverError('protests PATCH exception', error);
  }
}