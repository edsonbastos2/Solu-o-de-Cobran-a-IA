import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerWithAdminFallback } from '@/lib/supabase-server';
import { requireSuperAdmin, serverError } from '@/lib/api-auth';

/** Lista tenants ativos para o seletor do super-admin. */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireSuperAdmin(req);
    if ('response' in auth) return auth.response;

    const supabase = await getSupabaseServerWithAdminFallback(req);
    if (!supabase) {
      return NextResponse.json({ error: 'Servidor não configurado.' }, { status: 500 });
    }

    const { data, error } = await supabase
      .from('tenants')
      .select('id, name, status')
      .eq('status', 'active')
      .order('name', { ascending: true });

    if (error) return serverError('tenants GET query error', error);

    return NextResponse.json({ tenants: data || [] });
  } catch (error: unknown) {
    return serverError('tenants GET exception', error);
  }
}
