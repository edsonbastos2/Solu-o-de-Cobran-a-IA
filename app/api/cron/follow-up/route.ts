import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendMessage } from '@/lib/messaging';

export async function GET(req: NextRequest) {
  // CRON_SECRET é OBRIGATÓRIO. Configurar em .env.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('CRON_SECRET não configurado. Bloqueando endpoint de cron.');
    return NextResponse.json({ error: 'Servidor mal configurado.' }, { status: 503 });
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 500 });
  }

  try {
    const { data: cases, error: casesError } = await supabase
      .from('cases')
      .select('*')
      .eq('status', 'in_negotiation');

    if (casesError) throw casesError;

    const followUpsSent: string[] = [];

    for (const c of cases || []) {
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

        if (lastMessage.role !== 'user') {
          const messageTime = new Date(lastMessage.created_at).getTime();
          const currentTime = new Date().getTime();
          const hoursSinceLastMessage = (currentTime - messageTime) / (1000 * 60 * 60);

          if (hoursSinceLastMessage >= 24) {
            const firstName = (c.name || '').split(' ')[0] || 'cliente';
            const followUpText = `Olá, ${firstName}! Tudo bem? Estou passando para lembrar da nossa proposta. Podemos continuar a negociação? Qualquer dúvida estou à disposição.`;

            if (lastMessage.content !== followUpText) {
              if (c.phone || c.telegram_chat_id) {
                const destination = c.telegram_chat_id || c.phone;
                await sendMessage(destination, followUpText, c.user_id).catch(err => {
                  console.error(`Erro ao enviar follow-up para ${destination}:`, err);
                });
              }

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
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}