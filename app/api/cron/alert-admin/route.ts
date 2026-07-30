import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Função simulada para envio de e-mail ao administrador
async function sendAdminEmail(caseId: string, caseName: string, hours: number) {
  // Em um ambiente real, você integraria com SendGrid, Resend, AWS SES, etc.
  console.log(`[MOCK EMAIL SENT] Para: admin@escritorio.com`);
  console.log(`[MOCK EMAIL SENT] Assunto: Alerta de Inatividade - Caso #${caseId.substring(0, 8)}`);
  console.log(`[MOCK EMAIL SENT] Corpo: O devedor ${caseName} (Caso #${caseId.substring(0, 8)}) não responde há mais de ${Math.floor(hours)} horas. O caso foi movido para 'Requer Atenção'.`);
}

export async function GET(req: NextRequest) {
  // Proteção básica para a rota (ex: Vercel Cron)
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  if (!supabase) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 500 });
  }

  try {
    // 1. Buscar todos os casos em negociação
    const { data: cases, error: casesError } = await supabase
      .from('cases')
      .select('*')
      .eq('status', 'in_negotiation');

    if (casesError) throw casesError;

    const alertedCases = [];

    for (const c of cases || []) {
      // 2. Buscar todas as mensagens do caso para verificar a última do usuário
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('case_id', c.id)
        .order('created_at', { ascending: false });

      if (messagesError) {
        console.error(`Erro ao buscar mensagens do caso ${c.id}:`, messagesError);
        continue;
      }

      // 3. Encontrar a última interação do usuário (devedor)
      const lastUserMessage = messages?.find((m: any) => m.role === 'user');
      
      // Se não houver mensagem do usuário, considera a data de criação do caso
      const lastInteractionTime = lastUserMessage ? lastUserMessage.created_at : c.created_at;

      const messageTime = new Date(lastInteractionTime).getTime();
      const currentTime = new Date().getTime();
      const hoursSinceLastInteraction = (currentTime - messageTime) / (1000 * 60 * 60);

      // 4. Se a última interação tem mais de 48h
      if (hoursSinceLastInteraction >= 48) {
        
        // 5. Enviar notificação por e-mail para o admin
        await sendAdminEmail(c.id, c.name, hoursSinceLastInteraction);
        
        // 6. Atualizar o status do caso para requerer atenção humana
        await supabase
          .from('cases')
          .update({ status: 'needs_attention' })
          .eq('id', c.id);

        alertedCases.push(c.id);
      }
    }

    return NextResponse.json({ ok: true, alerted: alertedCases });
  } catch (error: any) {
    console.error('Admin Alert Cron Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
