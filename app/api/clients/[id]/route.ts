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

    const validation = validateFields(body, [
      { name: 'name', type: 'string' },
      { name: 'email', type: 'string' },
      { name: 'phone', type: 'string' }
    ]);
    if (validation) return validation;

    const { data, error } = await supabase
      .from('clients')
      .update({
        name: body.name,
        email: body.email,
        phone: body.phone
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) return serverError('clients PUT update error', error);

    return NextResponse.json({ client: data });
  } catch (error: unknown) {
    return serverError('clients PUT exception', error);
  }
}