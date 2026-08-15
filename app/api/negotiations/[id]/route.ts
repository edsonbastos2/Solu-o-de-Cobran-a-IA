import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext, requireRole, serverError } from '@/lib/api-auth';
import { recordAuditAction } from '@/lib/audit';
import { NegotiationStatus, NegotiationWithRelations } from '@/lib/types';

const NEGOTIATION_SELECT = `
  *,
  clients (id, name, document),
  cases (id, name, status)
`;

const STATUSES: NegotiationStatus[] = ['open', 'accepted', 'expired', 'fulfilled', 'defaulted'];

const ACTIONS: Partial<Record<string, { from: NegotiationStatus[]; to: NegotiationStatus }>> = {
  accept: { from: ['open'], to: 'accepted' },
  fulfill: { from: ['accepted'], to: 'fulfilled' },
  default: { from: ['accepted'], to: 'defaulted' },
  expire: { from: ['open', 'accepted'], to: 'expired' },
};

function allowedTransitionsFor(status: NegotiationStatus): NegotiationStatus[] {
  const allowed: NegotiationStatus[] = [status];
  for (const action of Object.values(ACTIONS)) {
    if (action && action.from.includes(status)) allowed.push(action.to);
  }
  return allowed;
}

function actionLabel(from: NegotiationStatus, to: NegotiationStatus): string {
  if (to === 'accepted') return 'NEGOTIATION_ACCEPTED';
  if (to === 'fulfilled') return 'NEGOTIATION_FULFILLED';
  if (to === 'defaulted') return 'NEGOTIATION_DEFAULTED';
  if (to === 'expired') return 'NEGOTIATION_EXPIRED';
  return 'NEGOTIATION_STATUS_CHANGE';
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const tenant = await requireTenantContext(req, searchParams.get('tenant_id'));
  if ('response' in tenant) return tenant.response;

  try {
    const { ctx } = tenant;
    const { data: negotiation, error } = await ctx.supabase
      .from('negotiations')
      .select(NEGOTIATION_SELECT)
      .eq('id', id)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();

    if (error) return serverError('negotiation GET error', error);
    if (!negotiation) return NextResponse.json({ error: 'Acordo não encontrado ou acesso negado.' }, { status: 404 });

    return NextResponse.json({ negotiation: negotiation as NegotiationWithRelations });
  } catch (error) {
    return serverError('negotiation GET exception', error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const body = await req.json().catch(() => null);
  const requestedTenantId = searchParams.get('tenant_id')
    || (typeof body?.tenant_id === 'string' ? body.tenant_id : null);
  const tenant = await requireRole(req, 'gestor', requestedTenantId);
  if ('response' in tenant) return tenant.response;

  try {
    const { ctx } = tenant;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 });
    }

    const fields = Object.keys(body).filter((field) => field !== 'tenant_id');
    const allowed = ['status', 'action'];
    if (fields.some((field) => !allowed.includes(field))) {
      return NextResponse.json({ error: 'Campo não permitido para atualização do acordo.' }, { status: 400 });
    }
    if (fields.length === 0) return NextResponse.json({ error: 'Nenhum campo para atualizar.' }, { status: 400 });
    if (!('action' in body) && !('status' in body)) {
      return NextResponse.json({ error: 'Informe action (accept, fulfill, default, expire) ou status.' }, { status: 400 });
    }

    const { data: before, error: beforeError } = await ctx.supabase
      .from('negotiations')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();
    if (beforeError) return serverError('negotiations PATCH lookup error', beforeError);
    if (!before) return NextResponse.json({ error: 'Acordo não encontrado ou acesso negado.' }, { status: 404 });

    const beforeStatus = before.status as NegotiationStatus;
    let next: NegotiationStatus | null = null;

    if ('action' in body) {
      const action = ACTIONS[body.action as string];
      if (!action) {
        return NextResponse.json({ error: 'Ação inválida. Use accept, fulfill, default ou expire.' }, { status: 400 });
      }
      if (!action.from.includes(beforeStatus)) {
        return NextResponse.json({ error: `Transição inválida: não é possível aplicar ${body.action} a partir do status ${beforeStatus}.` }, { status: 400 });
      }
      next = action.to;
    } else {
      const requested = body.status as string;
      if (!STATUSES.includes(requested as NegotiationStatus)) {
        return NextResponse.json({ error: 'Status inválido.' }, { status: 400 });
      }
      const requestedStatus = requested as NegotiationStatus;
      if (!allowedTransitionsFor(beforeStatus).includes(requestedStatus)) {
        return NextResponse.json({ error: `Transição de status inválida: ${beforeStatus} para ${requestedStatus}.` }, { status: 400 });
      }
      next = requestedStatus;
    }

    const update: Record<string, unknown> = { status: next };
    if (next === 'accepted' && !before.accepted_at) update.accepted_at = new Date().toISOString();

    const { data: updated, error } = await ctx.supabase
      .from('negotiations')
      .update(update)
      .eq('id', id)
      .eq('tenant_id', ctx.tenantId)
      .select(NEGOTIATION_SELECT)
      .single();
    if (error) return serverError('negotiations PATCH update error', error);

    await recordAuditAction(ctx.supabase, {
      tenantId: ctx.tenantId,
      entityType: 'negotiation',
      entityId: id,
      caseId: before.case_id || undefined,
      actorUserId: ctx.userId,
      action: actionLabel(beforeStatus, next),
      before,
      after: updated,
      metadata: { changed_fields: fields },
    });

    return NextResponse.json({ ok: true, negotiation: updated as NegotiationWithRelations });
  } catch (error) {
    return serverError('negotiations PATCH exception', error);
  }
}