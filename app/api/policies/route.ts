import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getTenantAccess } from '@/lib/tenant';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedUserId = searchParams.get('userId') || req.headers.get('x-user-id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!supabase) {
      return NextResponse.json({ policies: [], count: 0, totalPages: 1 });
    }

    const { userId, isSuperAdmin } = await getTenantAccess(requestedUserId);

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('collection_policies')
      .select('*', { count: 'exact' });

    if (!isSuperAdmin) {
      if (userId) {
        query = query.or(`user_id.eq.${userId},user_id.is.null`);
      } else {
        query = query.is('user_id', null);
      }
    }

    const { data, error, count } = await query
      .order('name', { ascending: true })
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
