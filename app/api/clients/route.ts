import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { requireTenantContext, serverError } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!getSupabaseServer(req)) {
      return NextResponse.json({ clients: [], count: 0, totalPages: 1 });
    }

    const tenantContext = await requireTenantContext(req, searchParams.get('tenant_id'));
    if ('response' in tenantContext) return tenantContext.response;
    const { supabase, tenantId } = tenantContext.ctx;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const query = supabase
      .from('clients')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId);

    const { data, error, count } = await query
      .order('name', { ascending: true })
      .range(from, to);

    if (error) return serverError('clients GET query error', error);

    return NextResponse.json({ 
      clients: data || [], 
      count: count || 0, 
      totalPages: Math.ceil((count || 0) / limit) 
    });
  } catch (error: unknown) {
    return serverError('clients GET exception', error);
  }
}
