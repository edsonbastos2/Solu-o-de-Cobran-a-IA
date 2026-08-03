import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { calculateUpdatedValue } from '@/lib/finance';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServer(req);
    if (!supabase) {
      return NextResponse.json({ cases: [], totalPages: 1, total: 0 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';

    const offset = (page - 1) * limit;

    let query = supabase
      .from('cases')
      .select('*', { count: 'exact' });

    if (search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`name.ilike.${term},phone.ilike.${term},debtor_document.ilike.${term},debtor_email.ilike.${term}`);
    }

    if (status.trim() && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: cases, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    // Recalculate updated values for fresh display
    const casesWithRecalculatedValue = (cases || []).map((c: any) => {
      const recalculated = calculateUpdatedValue(Number(c.original_value) || 0, new Date(c.due_date));
      return {
        ...c,
        updated_value: recalculated > Number(c.original_value) ? recalculated : Number(c.updated_value || c.original_value)
      };
    });

    const total = count || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    return NextResponse.json({
      cases: casesWithRecalculatedValue,
      totalPages,
      total,
      page
    });
  } catch (error: any) {
    console.error('Error fetching cases:', error);
    return NextResponse.json({ error: error.message || 'Erro ao buscar casos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServer(req);
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 500 });
    }

    const body = await req.json();
    const {
      name,
      phone,
      original_value,
      due_date,
      max_discount_margin,
      debtor_email,
      debtor_document,
      debtor_address,
      user_id
    } = body;

    if (!name || !phone || original_value === undefined || !due_date) {
      return NextResponse.json({ error: 'Preencha os campos obrigatórios: Nome, Telefone, Valor e Data de Vencimento.' }, { status: 400 });
    }

    // Get current user id from auth context to enforce assignment to the logged-in user
    const { data: { user } } = await supabase.auth.getUser();
    
    // For superadmin, they might pass user_id to assign to someone else.
    // If not superadmin, RLS will block inserting for a different user_id anyway.
    const targetUserId = user_id || user?.id;

    const origVal = parseFloat(original_value);
    const discountMargin = max_discount_margin !== undefined && max_discount_margin !== '' ? parseFloat(max_discount_margin) : 10;
    
    // Calculate updated value
    const updatedVal = calculateUpdatedValue(origVal, new Date(due_date));

    const cleanPhone = phone.replace(/\D/g, '');

    const { data: newCase, error } = await supabase
      .from('cases')
      .insert({
        name: name.trim(),
        phone: cleanPhone,
        original_value: origVal,
        updated_value: updatedVal,
        due_date,
        max_discount_margin: discountMargin,
        status: 'not_started',
        debtor_email: debtor_email ? debtor_email.trim() : null,
        debtor_document: debtor_document ? debtor_document.trim() : null,
        debtor_address: debtor_address ? debtor_address.trim() : null,
        user_id: targetUserId || null
      })
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true, case: newCase }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating case:', error);
    return NextResponse.json({ error: error.message || 'Erro ao criar caso' }, { status: 500 });
  }
}
