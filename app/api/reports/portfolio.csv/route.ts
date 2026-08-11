import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext, serverError } from '@/lib/api-auth';
import { getDaysOverdue, getCollectionStage } from '@/lib/finance';
import type { CollectionStage } from '@/lib/types';
import { buildCsv, csvNumber, csvDate, csvEscape } from '@/lib/reports';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STAGES: CollectionStage[] = ['preventiva', 'amigavel', 'negocial', 'especializada'];

type CaseRow = {
  id: string;
  name: string | null;
  status: string;
  due_date: string;
  updated_value: number | null;
  original_value: number | null;
  max_discount_margin: number | null;
  propensity_score: number | null;
  created_at: string | null;
  financial_titles?: Array<{
    installment_number: number | null;
    contracts?: Array<{ contract_number: string | null }> | null;
  }> | null;
};

const STAGE_LABEL: Record<CollectionStage, string> = {
  preventiva: 'Preventiva',
  amigavel: 'Amigável',
  negocial: 'Negocial',
  especializada: 'Especializada',
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantContext = await requireTenantContext(req, searchParams.get('tenant_id'));
    if ('response' in tenantContext) return tenantContext.response;
    const { supabase, tenantId } = tenantContext.ctx;

    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const stage = searchParams.get('stage');
    const status = searchParams.get('status');

    if (from && Number.isNaN(new Date(from).getTime())) {
      return NextResponse.json({ error: 'Parâmetro "from" inválido.' }, { status: 400 });
    }
    if (to && Number.isNaN(new Date(to).getTime())) {
      return NextResponse.json({ error: 'Parâmetro "to" inválido.' }, { status: 400 });
    }
    if (stage && !STAGES.includes(stage as CollectionStage)) {
      return NextResponse.json({ error: 'Parâmetro "stage" inválido.' }, { status: 400 });
    }

    let query = supabase
      .from('cases')
      .select(`
        id, name, status, due_date, updated_value, original_value,
        max_discount_margin, propensity_score, created_at,
        financial_titles ( installment_number, contracts ( contract_number ) )
      `)
      .eq('tenant_id', tenantId);

    if (status && status !== 'all') query = query.eq('status', status);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    const { data, error } = await query.order('created_at', { ascending: false }).limit(5000);
    if (error) throw error;

    const rows: unknown[][] = [
      ['Caso', 'Cliente', 'Valor', 'Vencimento', 'Dias em atraso', 'Estágio', 'Status', 'Propensão'],
    ];

    for (const c of (data ?? []) as CaseRow[]) {
      const daysOverdue = getDaysOverdue(c.due_date);
      const caseStage = getCollectionStage(c.due_date, Number(c.max_discount_margin ?? 10) || 10, c.status);
      const value = Number(c.updated_value ?? c.original_value ?? 0) || 0;

      if (stage && stage !== caseStage.id) continue;

      const firstTitle = c.financial_titles?.[0];
      const contractNumber = firstTitle?.contracts?.[0]?.contract_number || '';
      const caseRef = contractNumber
        ? `#${contractNumber}-${firstTitle?.installment_number ?? ''}`
        : csvEscape(c.id).slice(1, -1);

      rows.push([
        caseRef,
        c.name || '',
        csvNumber(value),
        csvDate(c.due_date),
        daysOverdue > 0 ? String(daysOverdue) : '0',
        STAGE_LABEL[caseStage.id],
        c.status,
        typeof c.propensity_score === 'number' ? String(c.propensity_score) : '',
      ]);
    }

    return buildCsv(rows);
  } catch (error: unknown) {
    logger.error('[reports/portfolio] exception', undefined, { error: error instanceof Error ? error.message : String(error) });
    return serverError('reports/portfolio exception', error);
  }
}