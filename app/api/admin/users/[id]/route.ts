import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireSuperAdmin, serverError } from '@/lib/api-auth';
import { auditAdminAction } from '@/lib/audit';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const r = await requireSuperAdmin(req);
    if ('response' in r) return r.response;

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin não configurado.' }, { status: 500 });
    }

    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: 'ID inválido.' }, { status: 400 });
    }

    const body = await req.json();
    const { name, phone, is_super_admin, password } = body;

    if (password !== undefined) {
      if (typeof password !== 'string' || password.length < 8) {
        return NextResponse.json({ error: 'A senha deve ter no mínimo 8 caracteres.' }, { status: 400 });
      }
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, { password });
      if (authError) {
        return serverError('admin/users PUT auth error', authError);
      }
    }

    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = typeof name === 'string' ? name.trim() : null;
    if (phone !== undefined) update.phone = typeof phone === 'string' ? phone.trim() : null;
    if (is_super_admin !== undefined) update.is_super_admin = !!is_super_admin;

    if (Object.keys(update).length > 0) {
      const { error: profileError } = await supabaseAdmin.from('profiles').update(update).eq('id', id);
      if (profileError) {
        return serverError('admin/users PUT profile error', profileError);
      }
    }

    await auditAdminAction({
      actorUserId: r.ctx.userId,
      action: 'ADMIN_UPDATE_USER',
      targetUserId: id,
      details: `Atualizou usuário ${id}`
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError('admin/users PUT exception', err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const r = await requireSuperAdmin(req);
    if ('response' in r) return r.response;

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin não configurado.' }, { status: 500 });
    }

    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: 'ID inválido.' }, { status: 400 });
    }

    // Evita auto-exclusão
    const { ctx } = r;
    if (id === ctx.userId) {
      return NextResponse.json({ error: 'Não é possível excluir o próprio usuário.' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) {
      return serverError('admin/users DELETE error', error);
    }

    await auditAdminAction({
      actorUserId: r.ctx.userId,
      action: 'ADMIN_DELETE_USER',
      targetUserId: id,
      details: `Excluiu usuário ${id}`
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError('admin/users DELETE exception', err);
  }
}