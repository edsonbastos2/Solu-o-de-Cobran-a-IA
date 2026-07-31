import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

export async function GET(req: NextRequest) {
  // Apenas para proteção básica se quiser configurar no Vercel Cron ou outro serviço
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

    const followUpsSent = [];

    for (const c of cases || []) {
      // 2. Buscar a última mensagem do caso
      const { data: lastMessageData, error: lastMessageError } = await supabase
        .from('messages')
        .select('*')
        .eq('case_id', c.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (lastMessageError) {
        console.error(`Erro ao buscar mensagens do caso ${c.id}:`, lastMessageError);
        continue;
      }

      if (lastMessageData && lastMessageData.length > 0) {
        const lastMessage = lastMessageData[0];
        
        // 3. Verificar se a última mensagem não é do usuário (ou seja, foi o bot ou humano que falou por último)
        if (lastMessage.role !== 'user') {
          const messageTime = new Date(lastMessage.created_at).getTime();
          const currentTime = new Date().getTime();
          const hoursSinceLastMessage = (currentTime - messageTime) / (1000 * 60 * 60);

          // 4. Se a última mensagem tem mais de 24h
          if (hoursSinceLastMessage >= 24) {
            const firstName = c.name.split(' ')[0];
            const followUpText = `Olá, ${firstName}! Tudo bem? Estou passando para lembrar da nossa proposta. Podemos continuar a negociação? Qualquer dúvida estou à disposição.`;
            
            // Para não ficar enviando o mesmo follow-up várias vezes se o cron rodar mais de uma vez ao dia,
            // verificamos se a última mensagem já foi esse follow-up
            if (lastMessage.content !== followUpText) {
               // 5. Enviar mensagem via WhatsApp Z-API
               if (c.phone) {
                 await sendWhatsAppMessage(c.phone, followUpText, c.user_id).catch(err => {
                   console.error(`Erro ao enviar WhatsApp follow-up para ${c.phone}:`, err);
                 });
               }

               // 6. Registrar a mensagem enviada no banco de dados
               await supabase.from('messages').insert({
                 case_id: c.id,
                 role: 'ai',
                 content: followUpText
               });

               followUpsSent.push(c.id);
            }
          }
        }
      }
    }

    return NextResponse.json({ ok: true, followedUp: followUpsSent });
  } catch (error: any) {
    console.error('Cron Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
