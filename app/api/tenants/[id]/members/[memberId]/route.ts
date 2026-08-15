import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireRole, serverError } from '@/lib/api-auth';
import { recordAuditAction } from '@/lib/audit';
import { isInvitableRole } from '@/lib/team-invite';
import { logger } from '@/lib/logger';

interface TargetMemberRow {
  id: string;
  user_id: string;
  role: string;
  status: string;
  can_configure_ai: boolean;
}

async function loadTargetMember(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  tenantId: string,
  memberId: string
): Promise<{ data: TargetMemberRow | null; error: unknown }> {
  const { data, error } = await admin
    .from('tenant_members')
    .select('id, user_id, role, status, can_configure_ai')
    .eq('id', memberId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return { data: data as TargetMemberRow | null, error };
}

// PATCH /api/tenants/[id]/members/[memberId] — altera papel e/ou canConfigureAI.
// requireRole('admin') — a linha do owner é imune, checada explicitamente
// abaixo (não depende de RLS — ver ADR-002).
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await context.params;
    const r = await requireRole(req, 'admin', id);
    if ('response' in r) return r.response;
    const { ctx } = r;
    const tenantId = ctx.tenantId;

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Supabase admin não configurado.' }, { status: 500 });
    }

    const { data: target, error: targetError } = await loadTargetMember(admin, tenantId, memberId);
    if (targetError) return serverError('tenants/[id]/members/[memberId] PATCH lookup error', targetError);
    if (!target) {
      return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 });
    }
    if (target.role === 'owner') {
      return NextResponse.json(
        { error: 'O owner do tenant é imune a alteração, mesmo por um admin.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const update: Record<string, unknown> = {};

    if (body.role !== undefined) {
      if (body.role === 'owner') {
        return NextResponse.json(
          { error: 'Não é possível promover um membro a owner por esta rota.' },
          { status: 400 }
        );
      }
      if (!isInvitableRole(body.role)) {
        return NextResponse.json(
          { error: 'Papel inválido. Use admin, gestor ou operador.' },
          { status: 400 }
        );
      }
      update.role = body.role;
    }

    if (body.canConfigureAI !== undefined) {
      if (typeof body.canConfigureAI !== 'boolean') {
        return NextResponse.json({ error: 'canConfigureAI deve ser booleano.' }, { status: 400 });
      }
      update.can_configure_ai = body.canConfigureAI;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar.' }, { status: 400 });
    }

    const { data: updated, error: updateError } = await admin
      .from('tenant_members')
      .update(update)
      .eq('id', memberId)
      .eq('tenant_id', tenantId)
      .select('id, user_id, role, status, can_configure_ai')
      .maybeSingle();

    if (updateError) return serverError('tenants/[id]/members/[memberId] PATCH update error', updateError);

    await recordAuditAction(admin, {
      tenantId,
      entityType: 'tenant_member',
      entityId: memberId,
      actorUserId: ctx.userId,
      actorRole: ctx.role,
      action: 'TEAM_MEMBER_UPDATED',
      before: { role: target.role, can_configure_ai: target.can_configure_ai },
      after: {
        role: updated?.role ?? target.role,
        can_configure_ai: updated?.can_configure_ai ?? target.can_configure_ai,
      },
      metadata: { userId: target.user_id },
    });

    return NextResponse.json({
      success: true,
      member: updated
        ? {
            id: updated.id,
            userId: updated.user_id,
            role: updated.role,
            status: updated.status,
            canConfigureAI: updated.can_configure_ai === true,
          }
        : null,
    });
  } catch (err) {
    return serverError('tenants/[id]/members/[memberId] PATCH exception', err);
  }
}

// DELETE /api/tenants/[id]/members/[memberId] — remove um membro.
// requireRole('admin'). Se o alvo for 'pending', também limpa a linha órfã
// de auth.users para liberar o e-mail para um convite futuro (ver ADR-003).
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await context.params;
    const r = await requireRole(req, 'admin', id);
    if ('response' in r) return r.response;
    const { ctx } = r;
    const tenantId = ctx.tenantId;

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Supabase admin não configurado.' }, { status: 500 });
    }

    const { data: target, error: targetError } = await loadTargetMember(admin, tenantId, memberId);
    if (targetError) return serverError('tenants/[id]/members/[memberId] DELETE lookup error', targetError);
    if (!target) {
      return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 });
    }
    if (target.role === 'owner') {
      return NextResponse.json(
        { error: 'O owner do tenant não pode ser removido.' },
        { status: 403 }
      );
    }

    const { error: deleteError } = await admin
      .from('tenant_members')
      .delete()
      .eq('id', memberId)
      .eq('tenant_id', tenantId);
    if (deleteError) return serverError('tenants/[id]/members/[memberId] DELETE error', deleteError);

    if (target.status === 'pending') {
      const { error: authDeleteError } = await admin.auth.admin.deleteUser(target.user_id);
      if (authDeleteError) {
        // Não falha a requisição por isso (a linha tenant_members já foi
        // removida); registra para que a limpeza órfã seja investigada.
        logger.warn(
          'tenants/[id]/members/[memberId] DELETE: falha ao excluir auth.users órfão',
          { tenantId },
          { userId: target.user_id, error: authDeleteError.message }
        );
      }
    }

    await recordAuditAction(admin, {
      tenantId,
      entityType: 'tenant_member',
      entityId: memberId,
      actorUserId: ctx.userId,
      actorRole: ctx.role,
      action: 'TEAM_MEMBER_REMOVED',
      before: { role: target.role, status: target.status },
      metadata: { userId: target.user_id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError('tenants/[id]/members/[memberId] DELETE exception', err);
  }
}
