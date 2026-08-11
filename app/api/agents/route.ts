import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { requireTenantContext, requireRole, serverError } from '@/lib/api-auth';
import { DEFAULT_AGENTS, AgentConfig } from '@/lib/multi-agent';
import { recordAuditAction } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!getSupabaseServer(req)) {
      return NextResponse.json({ agents: [], count: 0, totalPages: 1 });
    }

    const tenantContext = await requireTenantContext(req, searchParams.get('tenant_id'));
    if ('response' in tenantContext) return tenantContext.response;
    const { supabase, tenantId } = tenantContext.ctx;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const query = supabase
      .from('agents')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) return serverError('agents GET query error', error);

    return NextResponse.json({ 
      agents: data || [], 
      count: count || 0, 
      totalPages: Math.ceil((count || 0) / limit) 
    });
} catch (error: unknown) {
    return serverError('agents GET exception', error);
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!getSupabaseServer(req)) {
      return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 500 });
    }

    const tenantContext = await requireRole(req, 'admin', new URL(req.url).searchParams.get('tenant_id'));
    if ('response' in tenantContext) return tenantContext.response;
    const { supabase, tenantId, userId } = tenantContext.ctx;

    const body = await req.json();

    if (body?.action === 'reset_defaults') {
      const rows = DEFAULT_AGENTS.map((agent: AgentConfig) => ({
        name: agent.name,
        role_type: agent.role_type,
        icon: agent.icon,
        color: agent.color,
        description: agent.description,
        system_prompt: agent.system_prompt,
        model: agent.model,
        temperature: agent.temperature,
        max_discount: agent.max_discount,
        tone: agent.tone,
        is_active: agent.is_active,
        tenant_id: tenantId,
        user_id: userId
      }));
      const { data: inserted, error } = await supabase
        .from('agents')
        .insert(rows)
        .select('id, name');
      if (error) return serverError('agents POST reset_defaults error', error);
      await recordAuditAction(supabase, {
        tenantId, entityType: 'agent', entityId: 'batch',
        actorUserId: userId, action: 'AGENTS_RESET_DEFAULTS',
        metadata: { source: 'manual', count: rows.length, ids: (inserted || []).map((r: { id: string }) => r.id) },
      }).catch(() => {});
      return NextResponse.json({ success: true, count: rows.length }, { status: 201 });
    }

    const {
      name,
      role_type,
      system_prompt,
      model,
      temperature,
      max_discount,
      tone,
      is_active,
      icon,
      color,
      description
    } = body || {};

    if (!name || !role_type || !system_prompt) {
      return NextResponse.json({ error: 'name, role_type e system_prompt são obrigatórios.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('agents')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        name,
        role_type,
        system_prompt,
        model: model || 'deepseek-v4-flash',
        temperature: temperature !== undefined ? Number(temperature) : 0.2,
        max_discount: max_discount !== undefined ? Number(max_discount) : 10,
        tone: tone || 'negociador',
        is_active: is_active !== undefined ? Boolean(is_active) : true,
        icon: icon || 'Bot',
        color: color || 'bg-indigo-600',
        description: description || ''
      })
      .select()
      .single();

    if (error) return serverError('agents POST insert error', error);

    await recordAuditAction(supabase, {
      tenantId, entityType: 'agent', entityId: data.id,
      actorUserId: userId, action: 'AGENT_CREATED',
      after: data,
    }).catch(() => {});

    return NextResponse.json({ success: true, agent: data }, { status: 201 });
  } catch (error: unknown) {
    return serverError('agents POST exception', error);
  }
}
