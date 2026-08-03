import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const supabase = getSupabaseServer(req);
    if (!supabase) {
      return NextResponse.json({ policies: [], count: 0, totalPages: 1 });
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('collection_policies')
      .select('*', { count: 'exact' });

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ 
      policies: data || [], 
      count: count || 0, 
      totalPages: Math.ceil((count || 0) / limit) 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = getSupabaseServer(req);
    if (!supabase) return NextResponse.json({ error: 'Supabase não configurado' }, { status: 500 });

    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('collection_policies')
      .insert({ ...body, user_id: user?.id })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, policy: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
