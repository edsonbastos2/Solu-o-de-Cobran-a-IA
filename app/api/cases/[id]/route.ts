import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCollectionStage, calculateUpdatedValue } from '@/lib/finance';
import { getTenantAccess } from '@/lib/tenant';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const requestedUserId = searchParams.get('userId') || req.headers.get('x-user-id');

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 500 });
    }

    const { userId, isSuperAdmin } = await getTenantAccess(requestedUserId);

    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('*')
      .eq('id', id)
      .single();

    if (caseError || !caseData) {
      return NextResponse.json({ error: 'Caso não encontrado' }, { status: 404 });
    }

    // Tenant Isolation Check
    if (userId && !isSuperAdmin && caseData.user_id && caseData.user_id !== userId) {
      return NextResponse.json({ error: 'Acesso negado. Este caso pertence a outra empresa.' }, { status: 403 });
    }

    // Recalculate value
    const recalculated = calculateUpdatedValue(Number(caseData.original_value) || 0, new Date(caseData.due_date));
    const currentUpdatedValue = recalculated > Number(caseData.original_value) ? recalculated : Number(caseData.updated_value || caseData.original_value);

    // Fetch messages
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('case_id', id)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
    }

    // Get stage info
    const stage = getCollectionStage(
      caseData.due_date,
      caseData.max_discount_margin,
      caseData.status
    );

    return NextResponse.json({
      case: {
        ...caseData,
        updated_value: currentUpdatedValue
      },
      messages: messages || [],
      stage
    });
  } catch (error: any) {
    console.error('Error fetching case details:', error);
    return NextResponse.json({ error: error.message || 'Erro ao carregar detalhes do caso' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const requestedUserId = searchParams.get('userId') || req.headers.get('x-user-id');

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 500 });
    }

    const { userId, isSuperAdmin } = await getTenantAccess(requestedUserId);

    // Check ownership first
    const { data: caseData } = await supabase.from('cases').select('user_id').eq('id', id).single();
    if (caseData && userId && !isSuperAdmin && caseData.user_id && caseData.user_id !== userId) {
      return NextResponse.json({ error: 'Acesso negado. Ação não permitida em caso de outro tenant.' }, { status: 403 });
    }

    const body = await req.json();

    const { data: updatedCase, error } = await supabase
      .from('cases')
      .update(body)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true, case: updatedCase });
  } catch (error: any) {
    console.error('Error updating case:', error);
    return NextResponse.json({ error: error.message || 'Erro ao atualizar caso' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const requestedUserId = searchParams.get('userId') || req.headers.get('x-user-id');

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 500 });
    }

    const { userId, isSuperAdmin } = await getTenantAccess(requestedUserId);

    // Check ownership first
    const { data: caseData } = await supabase.from('cases').select('user_id').eq('id', id).single();
    if (caseData && userId && !isSuperAdmin && caseData.user_id && caseData.user_id !== userId) {
      return NextResponse.json({ error: 'Acesso negado. Ação não permitida em caso de outro tenant.' }, { status: 403 });
    }

    // Delete messages first
    await supabase.from('messages').delete().eq('case_id', id);

    const { error } = await supabase
      .from('cases')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error deleting case:', error);
    return NextResponse.json({ error: error.message || 'Erro ao excluir caso' }, { status: 500 });
  }
}
