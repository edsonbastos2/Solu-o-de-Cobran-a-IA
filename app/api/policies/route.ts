import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { requireTenantContext, requireRole, serverError } from '@/lib/api-auth';
import { validateFields } from '@/lib/api-validate';
import { recordAuditAction } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!getSupabaseServer(req)) {
      return NextResponse.json({ policies: [], count: 0, totalPages: 1 });
    }

    const tenantContext = await requireTenantContext(req, searchParams.get('tenant_id'));
    if ('response' in tenantContext) return tenantContext.response;
    const { supabase, tenantId } = tenantContext.ctx;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const query = supabase
      .from('collection_policies')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (searchParams.get('active') === 'true') query.eq('active', true);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) return serverError('policies GET query error', error);

    return NextResponse.json({ 
      policies: data || [], 
      count: count || 0, 
      totalPages: Math.ceil((count || 0) / limit) 
    });
  } catch (error: unknown) {
    return serverError('policies GET exception', error);
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!getSupabaseServer(req)) return NextResponse.json({ error: 'Supabase não configurado' }, { status: 500 });

    const tenantContext = await requireRole(req, 'admin', new URL(req.url).searchParams.get('tenant_id'));
    if ('response' in tenantContext) return tenantContext.response;
    const { supabase, tenantId, userId } = tenantContext.ctx;

    const body = await req.json();
    const validation = validateFields(body, [{ name: 'name', type: 'string' }]);
    if (validation) return validation;

    const { data, error } = await supabase
      .from('collection_policies')
      .insert({ ...body, tenant_id: tenantId, user_id: userId })
      .select()
      .single();

    if (error) return serverError('policies POST insert error', error);

    await recordAuditAction(supabase, {
      tenantId, entityType: 'policy', entityId: data.id,
      actorUserId: userId, action: 'POLICY_CREATED', after: data,
      metadata: { source: 'manual' },
    }).catch(() => {});

    return NextResponse.json({ success: true, policy: data }, { status: 201 });
  } catch (error: unknown) {
    return serverError('policies POST exception', error);
  }
}
