import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer, getSupabaseServerWithAdminFallback } from '@/lib/supabase-server';
import { calculateUpdatedValue } from '@/lib/finance';
import { requireUser, serverError } from '@/lib/api-auth';
import { validateFields } from '@/lib/api-validate';

export async function GET(req: NextRequest) {
  try {
    const r = await requireUser(req);
    if ('response' in r) return r.response;

    const supabase = await getSupabaseServerWithAdminFallback(req);
    if (!supabase) {
      return NextResponse.json({ cases: [], totalPages: 1, total: 0 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10')));
    const search = (searchParams.get('search') || '').slice(0, 100);
    const status = (searchParams.get('status') || '').slice(0, 50);

    const offset = (page - 1) * limit;

    let query = supabase.from('cases').select('*', { count: 'exact' });

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
      return serverError('cases GET error', error);
    }

    const casesWithRecalculatedValue = (cases || []).map((c: any) => {
      const recalculated = calculateUpdatedValue(Number(c.original_value) || 0, new Date(c.due_date));
      return {
        ...c,
        updated_value: recalculated > Number(c.original_value) ? recalculated : Number(c.updated_value || c.original_value)
      };
    });

    const total = count || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    return NextResponse.json({ cases: casesWithRecalculatedValue, totalPages, total, page });
  } catch (err) {
    return serverError('cases GET exception', err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const r = await requireUser(req);
    if ('response' in r) return r.response;
    const { ctx } = r;

    const supabase = getSupabaseServer(req);
    if (!supabase) {
      return NextResponse.json({ error: 'Servidor não configurado.' }, { status: 500 });
    }

    const body = await req.json();
    const err = validateFields(body, [
      { name: 'name', type: 'string' },
      { name: 'phone', type: 'string' },
      { name: 'original_value', type: 'number' },
      { name: 'due_date', type: 'string' }
    ]);
    if (err) return err;

    const {
      name, phone, original_value, due_date,
      max_discount_margin, debtor_email, debtor_document, debtor_address, user_id
    } = body;

    // Somente superadmin pode designar caso para outro usuário
    const targetUserId = (ctx.isSuperAdmin && user_id) ? user_id : ctx.userId;

    const origVal = Number(original_value);
    if (origVal <= 0) {
      return NextResponse.json({ error: 'Valor deve ser maior que zero.' }, { status: 400 });
    }
    const discountMargin = typeof max_discount_margin === 'number' ? Math.min(100, Math.max(0, max_discount_margin)) : 10;

    const updatedVal = calculateUpdatedValue(origVal, new Date(due_date));
    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 13) {
      return NextResponse.json({ error: 'Telefone inválido.' }, { status: 400 });
    }

    const { data: newCase, error } = await supabase
      .from('cases')
      .insert({
        name: String(name).trim().slice(0, 200),
        phone: cleanPhone,
        original_value: origVal,
        updated_value: updatedVal,
        due_date,
        max_discount_margin: discountMargin,
        status: 'not_started',
        debtor_email: typeof debtor_email === 'string' ? debtor_email.trim() || null : null,
        debtor_document: typeof debtor_document === 'string' ? debtor_document.trim() || null : null,
        debtor_address: typeof debtor_address === 'string' ? debtor_address.trim() || null : null,
        user_id: targetUserId || null
      })
      .select('*')
      .single();

    if (error) {
      return serverError('cases POST insert error', error);
    }

    return NextResponse.json({ ok: true, case: newCase }, { status: 201 });
  } catch (err) {
    return serverError('cases POST exception', err);
  }
}