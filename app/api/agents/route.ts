import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerWithAdminFallback } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const supabase = await getSupabaseServerWithAdminFallback(req);
    if (!supabase) {
      return NextResponse.json({ agents: [], count: 0, totalPages: 1 });
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('agents')
      .select('*', { count: 'exact' });

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ 
      agents: data || [], 
      count: count || 0, 
      totalPages: Math.ceil((count || 0) / limit) 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
