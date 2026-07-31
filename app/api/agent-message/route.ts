import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

export async function POST(req: NextRequest) {
  try {
    const { caseId, message } = await req.json();

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
    }

    if (!supabase) {
      return NextResponse.json({ error: "Supabase não configurado." }, { status: 500 });
    }

    // 1. Fetch case
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .single();

    if (caseError || !caseData) {
      return NextResponse.json({ error: "Caso não encontrado." }, { status: 404 });
    }

    // 2. Save human agent message in Supabase
    const { error: insertError } = await supabase.from('messages').insert({
      case_id: caseId,
      role: 'human',
      content: message.trim()
    });

    if (insertError) {
      throw insertError;
    }

    // 3. Send message to WhatsApp via Z-API
    if (caseData.phone) {
      await sendWhatsAppMessage(caseData.phone, message.trim(), caseData.user_id);
    }

    // 4. Set case status to needs_attention (human takeover) if it was in_negotiation or not_started
    if (caseData.status === 'in_negotiation' || caseData.status === 'not_started') {
      await supabase.from('cases').update({ status: 'needs_attention' }).eq('id', caseId);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Agent Message Error:', error);
    return NextResponse.json({ error: error.message || 'Erro ao enviar mensagem' }, { status: 500 });
  }
}
