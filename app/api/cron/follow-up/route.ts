import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendCaseMessage } from '@/lib/channels/message-service';
import { recordAuditAction } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { getActiveQuarantine } from '@/lib/quarantine';

type FollowUpCase = {
  id: string;
  name?: string | null;
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
    logger.error('CRON_SECRET não configurado. Bloqueando endpoint de cron.');
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
        logger.error('Erro ao buscar mensagens do caso', { tenantId: c.tenant_id }, { caseId: c.id, error: lastMessageError.message });
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
            // GUARD DE QUARENTENA (tarefa 11): casos sob quarentena ativa
            // (approved/permanent_block, nao expirada) NAO recebem follow-up
            // automatizado. Mantem conformidade com pedido de nao contato
            // (CDC Art. 42 § único) e bloqueio por litigio/falecimento.
            const quarantine = await getActiveQuarantine(supabase, c.id, c.tenant_id);
            if (quarantine) {
              logger.info('[cron/follow-up] caso em quarentena, skip', { tenantId: c.tenant_id, caseId: c.id }, { quarantineStatus: quarantine.status, reason: quarantine.reason });
              continue;
            }

            const firstName = (c.name || '').split(' ')[0] || 'cliente';
            const followUpText = `Olá, ${firstName}! Tudo bem? Estou passando para lembrar da nossa proposta. Podemos continuar a negociação? Qualquer dúvida estou à disposição.`;

            if (lastMessage.content !== followUpText) {
              const sendResult = await sendCaseMessage({
                caseId: c.id,
                content: followUpText,
                database: supabase,
                tenantId: c.tenant_id,
                senderRole: 'ai',
              }).catch(err => {
                logger.error('Erro ao enviar follow-up', { tenantId: c.tenant_id, caseId: c.id }, { error: err instanceof Error ? err.message : String(err) });
                return null;
              });

              // Sem destino de canal (ou falha de envio inesperada): mantém o
              // registro no histórico, como no fluxo legado.
              if (!sendResult || sendResult.status === 'skipped') {
                await supabase.from('messages').insert({
                  tenant_id: c.tenant_id,
                  case_id: c.id,
                  role: 'ai',
                  content: followUpText
                });
              }

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
    logger.error('Cron follow-up error', undefined, { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
