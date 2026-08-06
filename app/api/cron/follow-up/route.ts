import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendMessage } from '@/lib/messaging';
import { recordAuditAction } from '@/lib/audit';

type FollowUpCase = {
  id: string;
  name?: string | null;
  phone?: string | null;
  telegram_chat_id?: string | null;
  user_id?: string | null;
  tenant_id: string;
};

type MessageRow = {
  role: string;
  content: string;
  created_at: string;
};

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
    const { data: caseRows, error: casesError } = await supabase
      .from('cases')
      .select('*')
      .eq('status', 'in_negotiation')
      .not('tenant_id', 'is', null);

    if (casesError) throw casesError;
    const cases = (caseRows || []) as FollowUpCase[];

    const followUpsSent: string[] = [];

    for (const c of cases || []) {
        const { data: messageRows, error: lastMessageError } = await supabase
        .from('messages')
        .select('*')
        .eq('case_id', c.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (lastMessageError) {
        console.error(`Erro ao buscar mensagens do caso ${c.id}:`, lastMessageError);
        continue;
      }

      const lastMessageData = (messageRows || []) as MessageRow[];

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
                if (!destination) continue;
                await sendMessage(destination, followUpText, c.user_id ?? undefined).catch(err => {
                  console.error(`Erro ao enviar follow-up para ${destination}:`, err);
                });
              }

              await supabase.from('messages').insert({
                tenant_id: c.tenant_id,
                case_id: c.id,
                role: 'ai',
                content: followUpText
              });

              await recordAuditAction(supabase, {
                tenantId: c.tenant_id,
                entityType: 'message',
                entityId: c.id,
                caseId: c.id,
                actorUserId: c.user_id || null,
                action: 'AI_MESSAGE_SENT',
                metadata: { source: 'cron-follow-up', content_length: followUpText.length },
              });

              followUpsSent.push(c.id);
            }
          }
        }
      }
    }

    return NextResponse.json({ ok: true, followedUp: followUpsSent });
  } catch (error: unknown) {
    console.error('Cron Error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
