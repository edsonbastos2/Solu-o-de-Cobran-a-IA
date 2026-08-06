import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext, serverError } from '@/lib/api-auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const tenant = await requireTenantContext(req, searchParams.get('tenant_id'));
  if ('response' in tenant) return tenant.response;

  try {
    const { data, error } = await tenant.ctx.supabase
      .from('contracts')
      .select('*, clients(*), collection_policies(*)')
      .eq('id', id)
      .eq('tenant_id', tenant.ctx.tenantId)
      .maybeSingle();

    if (error) return serverError('contract detail query error', error);
    if (!data) return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 });

    return NextResponse.json({ contract: data });
  } catch (error) {
    return serverError('contract detail exception', error);
  }
}
