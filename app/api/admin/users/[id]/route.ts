import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin não configurado' }, { status: 500 });
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
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin não configurado' }, { status: 500 });
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
