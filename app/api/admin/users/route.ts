import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireSuperAdmin, serverError } from '@/lib/api-auth';
import { validateFields } from '@/lib/api-validate';
import { auditAdminAction } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const r = await requireSuperAdmin(req);
    if ('response' in r) return r.response;

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin não configurado.' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10')));

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabaseAdmin
      .from('profiles')
      .select('id, email, name, phone, is_super_admin, ai_provider, ai_model, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      return serverError('admin/users GET error', error);
    }

    return NextResponse.json({
      profiles: data,
      count: count || 0,
      totalPages: Math.ceil((count || 0) / limit)
    });
  } catch (err) {
    return serverError('admin/users GET exception', err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const r = await requireSuperAdmin(req);
    if ('response' in r) return r.response;

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin não configurado.' }, { status: 500 });
    }

    const body = await req.json();
    const err = validateFields(body, [
      { name: 'email', type: 'string' },
      { name: 'password', type: 'string' }
    ]);
    if (err) return err;

    // Validação básica de email e senha forte
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return NextResponse.json({ error: 'Email inválido.' }, { status: 400 });
    }
    if (typeof body.password !== 'string' || body.password.length < 8) {
      return NextResponse.json({ error: 'A senha deve ter no mínimo 8 caracteres.' }, { status: 400 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true
    });

    if (authError) {
      return NextResponse.json({ error: 'Não foi possível criar o usuário.' }, { status: 400 });
    }

    const userId = authData.user.id;

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        name: typeof body.name === 'string' ? body.name : null,
        phone: typeof body.phone === 'string' ? body.phone : null,
        is_super_admin: !!body.is_super_admin
      })
      .eq('id', userId);

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return serverError('admin/users POST profile error', profileError);
    }

    await auditAdminAction({
      actorUserId: r.ctx.userId,
      action: 'ADMIN_CREATE_USER',
      details: `Criou usuário ${body.email}`,
      targetUserId: userId
    });
    return NextResponse.json({ success: true, user: { id: userId, email: body.email } }, { status: 201 });
  } catch (err) {
    return serverError('admin/users POST exception', err);
  }
}