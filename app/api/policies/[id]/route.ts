import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext, serverError } from '@/lib/api-auth';
import { validateFields } from '@/lib/api-validate';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const tenantContext = await requireTenantContext(req, new URL(req.url).searchParams.get('tenant_id'));
    if ('response' in tenantContext) return tenantContext.response;
    const { supabase, tenantId } = tenantContext.ctx;

    const validation = validateFields(body, [{ name: 'name', type: 'string' }]);
    if (validation) return validation;

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

    return NextResponse.json({ success: true, policy: data });
  } catch (error: unknown) {
    return serverError('policies PUT exception', error);
  }
}