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
    const search = (searchParams.get('search') || '').slice(0, 100).trim();

    if (!getSupabaseServer(req)) {
      return NextResponse.json({ clients: [], count: 0, totalPages: 1 });
    }

    const tenantContext = await requireTenantContext(req, searchParams.get('tenant_id'));
    if ('response' in tenantContext) return tenantContext.response;
    const { supabase, tenantId } = tenantContext.ctx;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('clients')
      .select('*, client_channels (id, channel, username, verified_at)', { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (search) {
      const term = `%${search}%`;
      query = query.or(`name.ilike.${term},document.ilike.${term}`);
    }

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantContext = await requireRole(req, 'gestor', body?.tenant_id ?? new URL(req.url).searchParams.get('tenant_id'));
    if ('response' in tenantContext) return tenantContext.response;
    const { supabase, tenantId, userId, role } = tenantContext.ctx;

    const validation = validateFields(body, [
      { name: 'name', type: 'string' },
      { name: 'document', type: 'string' },
    ]);
    if (validation) return validation;

    const insert: Record<string, unknown> = {
      tenant_id: tenantId,
      user_id: userId,
      name: body.name.trim(),
      document: body.document.trim(),
    };
    if (body.address) insert.address = body.address;
    if (body.phone) insert.phone = body.phone;
    if (body.email) insert.email = body.email;

    const { data: client, error } = await supabase
      .from('clients')
      .insert(insert)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Já existe um cliente com este documento ou email no sistema.' }, { status: 409 });
      }
      return serverError('clients POST insert error', error);
    }

    await recordAuditAction(supabase, {
      tenantId,
      entityType: 'client',
      entityId: client.id,
      actorUserId: userId,
      actorRole: role,
      action: 'CLIENT_CREATED',
      after: client,
    });

    return NextResponse.json({ client }, { status: 201 });
  } catch (error: unknown) {
    return serverError('clients POST exception', error);
  }
}
