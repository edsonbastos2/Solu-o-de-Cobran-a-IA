import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSupabaseServer } from '@/lib/supabase-server';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = getSupabaseServer(req);
    if (!supabase) return NextResponse.json({ error: 'Não configurado' }, { status: 500 });
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single();
    if (!profile?.is_super_admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin não configurado. Verifique a variável SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
    }

    const { id } = await params;
    const { name, phone, is_super_admin, password } = await req.json();

    if (password) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
        password
      });
      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        name: name !== undefined ? name : undefined,
        phone: phone !== undefined ? phone : undefined,
        is_super_admin: is_super_admin !== undefined ? is_super_admin : undefined
      })
      .eq('id', id);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = getSupabaseServer(req);
    if (!supabase) return NextResponse.json({ error: 'Não configurado' }, { status: 500 });
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single();
    if (!profile?.is_super_admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin não configurado. Verifique a variável SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
    }

    const { id } = await params;

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
