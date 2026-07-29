import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { caseId, status } = await req.json();

    if (!caseId || !status) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    if (!supabase) {
      return NextResponse.json({ error: "Supabase não configurado." }, { status: 500 });
    }

    const { error } = await supabase
      .from('cases')
      .update({ status })
      .eq('id', caseId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true, status });
  } catch (error: any) {
    console.error('Case status update error:', error);
    return NextResponse.json({ error: error.message || 'Erro ao atualizar status' }, { status: 500 });
  }
}
