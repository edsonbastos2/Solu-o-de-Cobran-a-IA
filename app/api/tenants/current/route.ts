import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerWithAdminFallback } from '@/lib/supabase-server';
import { requireSuperAdmin, serverError } from '@/lib/api-auth';
import { validateFields } from '@/lib/api-validate';

/** Persiste o tenant corrente do super-admin (profiles.current_tenant_id). */
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireSuperAdmin(req);
    if ('response' in auth) return auth.response;

    const supabase = await getSupabaseServerWithAdminFallback(req);
    if (!supabase) {
      return NextResponse.json({ error: 'Servidor não configurado.' }, { status: 500 });
    }

    const body = await req.json().catch(() => null);
    const invalid = validateFields(body, [{ name: 'tenant_id', type: 'uuid' }]);
    if (invalid) return invalid;

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', body.tenant_id)
      .eq('status', 'active')
      .maybeSingle();

    if (tenantError) return serverError('tenants current PUT tenant query error', tenantError);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado.', code: 'TENANT_NOT_FOUND' }, { status: 404 });
    }

    const { error } = await supabase
      .from('profiles')
      .update({ current_tenant_id: tenant.id })
      .eq('id', auth.ctx.userId);

    if (error) return serverError('tenants current PUT update error', error);

    return NextResponse.json({ success: true, tenant_id: tenant.id });
  } catch (error: unknown) {
    return serverError('tenants current PUT exception', error);
  }
}
