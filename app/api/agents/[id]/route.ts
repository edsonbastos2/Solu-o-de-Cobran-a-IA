import { NextRequest, NextResponse } from 'next/server';
import { requireRole, serverError } from '@/lib/api-auth';
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

    // Captura estado anterior para auditoria
    const { data: before } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const {
      name,
      role_type,
      icon,
      color,
      description,
      system_prompt,
      model,
      temperature,
      max_discount,
      tone,
      is_active
    } = body;

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (name !== undefined) updateData.name = name;
    if (role_type !== undefined) updateData.role_type = role_type;
    if (icon !== undefined) updateData.icon = icon;
    if (color !== undefined) updateData.color = color;
    if (description !== undefined) updateData.description = description;
    if (system_prompt !== undefined) updateData.system_prompt = system_prompt;
    if (model !== undefined) updateData.model = model;
    if (temperature !== undefined) updateData.temperature = Number(temperature);
    if (max_discount !== undefined) updateData.max_discount = Number(max_discount);
    if (tone !== undefined) updateData.tone = tone;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await supabase
      .from('agents')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) return serverError('agents PUT update error', error);

    await recordAuditAction(supabase, {
      tenantId, entityType: 'agent', entityId: id,
      actorUserId: userId, actorRole: role,
      action: 'AGENT_UPDATED', before, after: data,
      metadata: { source: 'manual' },
    }).catch(() => {});

    return NextResponse.json({ agent: data });
  } catch (error: unknown) {
    return serverError('agents PUT exception', error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const tenantContext = await requireRole(req, 'admin', new URL(req.url).searchParams.get('tenant_id'));
    if ('response' in tenantContext) return tenantContext.response;
    const { supabase, tenantId, userId, role } = tenantContext.ctx;

    const { data: before } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const { error } = await supabase
      .from('agents')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) return serverError('agents DELETE error', error);

    await recordAuditAction(supabase, {
      tenantId, entityType: 'agent', entityId: id,
      actorUserId: userId, actorRole: role,
      action: 'AGENT_DELETED', before,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return serverError('agents DELETE exception', error);
  }
}