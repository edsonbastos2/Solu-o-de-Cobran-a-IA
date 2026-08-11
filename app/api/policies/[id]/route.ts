import { NextRequest, NextResponse } from 'next/server';
import { requireRole, serverError } from '@/lib/api-auth';
import { validateFields } from '@/lib/api-validate';
import { recordAuditAction } from '@/lib/audit';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const tenantContext = await requireRole(req, 'admin', new URL(req.url).searchParams.get('tenant_id'));
    if ('response' in tenantContext) return tenantContext.response;
    const { supabase, tenantId, userId, role } = tenantContext.ctx;

    const validation = validateFields(body, [{ name: 'name', type: 'string' }]);
    if (validation) return validation;

    const { data: before } = await supabase
      .from('collection_policies')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const { data, error } = await supabase
      .from('collection_policies')
      .update({
        name: body.name,
        interest_rate: body.interest_rate !== undefined ? Number(body.interest_rate) : undefined,
        penalty_rate: body.penalty_rate !== undefined ? Number(body.penalty_rate) : undefined,
        monetary_correction_index: body.monetary_correction_index,
        negative_allowed: body.negative_allowed,
        days_to_negative: body.days_to_negative !== undefined ? Number(body.days_to_negative) : undefined,
        protest_allowed: body.protest_allowed,
        days_to_protest: body.days_to_protest !== undefined ? Number(body.days_to_protest) : undefined,
        active: body.active
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) return serverError('policies PUT update error', error);

    await recordAuditAction(supabase, {
      tenantId, entityType: 'policy', entityId: id,
      actorUserId: userId, actorRole: role,
      action: 'POLICY_UPDATED', before, after: data,
      metadata: { source: 'manual' },
    }).catch(() => {});

    return NextResponse.json({ success: true, policy: data });
  } catch (error: unknown) {
    return serverError('policies PUT exception', error);
  }
}