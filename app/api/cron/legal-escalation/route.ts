import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getCollectionStage } from '@/lib/finance';
import { recordAuditAction } from '@/lib/audit';
import { resolveCaseClientId } from '@/lib/channels/message-service';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Dias computados dentro do estágio 'especializada' antes de escalar a jurídico.
const DEFAULT_ESCALATION_DAYS = 60;

type EscalableCase = {
  id: string;
  tenant_id: string;
  status: string;
  created_at: string;
  max_discount_margin: number | null;
  financial_title_id: string | null;
  debtor_id: string | null;
  financial_titles?: Array<{ id: string; due_date: string; current_value: number | null; original_value: number | null; contract_id: string | null }> | null;
};

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.error('CRON_SECRET não configurado. Bloqueando cron de escalonamento jurídico.');
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
    const escalationDays = Number.parseInt(process.env.DEFAULT_LEGAL_ESCALATION_DAYS || String(DEFAULT_ESCALATION_DAYS), 10) || DEFAULT_ESCALATION_DAYS;
    const created: string[] = [];

    // ------------------------------------------------------------------
    // 1) Casos ainda ativos com estágio 'especializada'
    // ------------------------------------------------------------------
    const { data: cases, error: casesError } = await supabase
      .from('cases')
      .select(`
        id, tenant_id, status, created_at, max_discount_margin, financial_title_id, debtor_id,
        financial_titles ( id, due_date, current_value, original_value, contract_id )
      `)
      .not('status', 'in', '("closed","settled","recovered","cancelled")');
    if (casesError) throw casesError;

    // Casos que já possuem processo jurídico aberto.
    const openPerCase = new Set<string>();
    const { data: existingProcesses, error: existingError } = await supabase
      .from('legal_processes')
      .select('id, case_id')
      .neq('status', 'closed');
    if (existingError) throw existingError;
    for (const lp of (existingProcesses || [])) {
      if (lp.case_id) openPerCase.add(lp.case_id);
    }

    // Casos com acordo ativo/aceito — não devem escalar.
    const agreementPerCase = new Set<string>();
    const { data: activeNegotiations, error: negsError } = await supabase
      .from('negotiations')
      .select('case_id, status')
      .in('status', ['open', 'accepted', 'pending']);
    if (negsError) throw negsError;
    for (const n of (activeNegotiations || [])) {
      if (n.case_id) agreementPerCase.add(n.case_id);
    }

    for (const c of (cases || []) as EscalableCase[]) {
      if (openPerCase.has(c.id)) continue;
      if (agreementPerCase.has(c.id)) continue;

      const title = c.financial_titles?.[0];
      if (!title?.due_date) continue;

      // cases não possui coluna client_id: resolve por debtor_id ou título.
      const clientId = await resolveCaseClientId(supabase, c.tenant_id, c);
      if (!clientId) continue;

      const stage = getCollectionStage(title.due_date, Number(c.max_discount_margin) || 10, c.status);

      // Determina há quanto tempo o caso está no estágio 'especializada'.
      let daysInSpecialized = stage.diasAtraso - 180; // especializada inicia após 180 dias
      if (stage.id === 'especializada' && c.status === 'needs_attention') {
        // Encaminhado a atendimento humano/supervisão: usa a idade do caso como proxy.
        const created = new Date(c.created_at);
        const now = new Date();
        daysInSpecialized = Math.max(0, Math.floor((now.getTime() - created.getTime()) / 86400000));
      }

      if (stage.id !== 'especializada' || daysInSpecialized < escalationDays) continue;

      const { data: createdProcess, error: createError } = await supabase
        .from('legal_processes')
        .insert({
          tenant_id: c.tenant_id,
          case_id: c.id,
          client_id: clientId,
          contract_id: title.contract_id,
          financial_title_id: title.id,
          process_type: 'cobranca',
          status: 'open',
          metadata: { source: 'auto_escalation', escalation_days: escalationDays, days_in_specialized: daysInSpecialized },
        })
        .select('id')
        .single();
      if (createError) {
        logger.warn('[cron/legal-escalation] insert failed', { caseId: c.id }, { error: createError.message });
        continue;
      }
      openPerCase.add(c.id);
      created.push(c.id);
      await recordAuditAction(supabase, {
        tenantId: c.tenant_id,
        entityType: 'legal_process',
        entityId: createdProcess.id,
        caseId: c.id,
        actorUserId: null,
        action: 'LEGAL_PROCESS_AUTO_CREATED',
        metadata: { source: 'cron', escalation_days: escalationDays, days_in_specialized: daysInSpecialized, process_type: 'cobranca' },
      }).catch((e) => logger.warn('[cron/legal-escalation] audit insert failed', undefined, { error: e instanceof Error ? e.message : String(e) }));
    }

    return NextResponse.json({ ok: true, created: created.length, escalation_days: escalationDays });
  } catch (error: unknown) {
    logger.error('[cron/legal-escalation] exception', undefined, { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}