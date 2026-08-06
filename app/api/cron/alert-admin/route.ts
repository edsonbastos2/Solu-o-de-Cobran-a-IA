import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { recordAuditAction } from '@/lib/audit';

// Função simulada para envio de e-mail ao administrador
async function sendAdminEmail(caseId: string, caseName: string, hours: number) {
  console.log(`[MOCK EMAIL SENT] Caso ${caseId.substring(0, 8)} inativo há ${Math.floor(hours)}h`);
}

export async function GET(req: NextRequest) {
  // CRON_SECRET é OBRIGATÓRIO.
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
    console.error('Admin Alert Cron Error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
