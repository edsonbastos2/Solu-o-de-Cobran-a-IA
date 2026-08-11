import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { recordAuditAction } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  // CRON_SECRET é OBRIGATÓRIO.
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
    // 1. Buscar todos os casos em negociação
    const { data: cases, error: casesError } = await supabase
      .from('cases')
      .select('*')
      .eq('status', 'in_negotiation')
      .not('tenant_id', 'is', null);

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
        logger.error('Erro ao buscar mensagens do caso', { tenantId: c.tenant_id }, { caseId: c.id, error: messagesError.message });
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
        
        // 5. Criar notificação in-app para o operador/tenant
        await createNotification(supabase, {
          tenantId: c.tenant_id,
          userId: c.user_id || null,
          type: 'warning',
          title: 'Caso parado há mais de 48h',
          body: `${c.name} está sem interação há ${Math.floor(hoursSinceLastInteraction)}h.`,
          relatedCaseId: c.id,
        });
        
        // 6. Atualizar o status do caso para requerer atenção humana
        await supabase
          .from('cases')
          .update({ status: 'needs_attention' })
          .eq('id', c.id)
          .eq('tenant_id', c.tenant_id);

        await recordAuditAction(supabase, {
          tenantId: c.tenant_id,
          entityType: 'case',
          entityId: c.id,
          caseId: c.id,
          actorUserId: c.user_id || null,
          action: 'STATUS_CHANGE',
          before: c,
          after: { ...c, status: 'needs_attention' },
          metadata: { source: 'cron-alert-admin' },
        });

        alertedCases.push(c.id);
      }
    }

    return NextResponse.json({ ok: true, alerted: alertedCases });
  } catch (error: any) {
    logger.error('Admin Alert Cron Error', undefined, { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
