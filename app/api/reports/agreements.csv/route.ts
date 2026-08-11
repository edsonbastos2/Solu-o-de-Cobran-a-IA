import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext, serverError } from '@/lib/api-auth';
import { NegotiationStatus } from '@/lib/types';
import { buildCsv, csvNumber, csvDate } from '@/lib/reports';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NEGOTIATION_STATUSES: NegotiationStatus[] = ['open', 'accepted', 'expired', 'fulfilled', 'defaulted'];

const STATUS_LABEL: Record<NegotiationStatus, string> = {
  open: 'Em aberto',
  accepted: 'Aceito',
  expired: 'Expirado',
  fulfilled: 'Quitado',
  defaulted: 'Em descumprimento',
};

type AgreementRow = {
  id: string;
  status: NegotiationStatus;
  original_value: number | null;
  proposed_value: number | null;
  agreed_value: number | null;
  discount_percent: number | null;
  installment_count: number | null;
  expires_at: string | null;
  accepted_at: string | null;
  created_at: string | null;
  clients?: Array<{ name: string | null; document: string | null }> | null;
  cases?: Array<{ name: string | null }> | null;
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantContext = await requireTenantContext(req, searchParams.get('tenant_id'));
    if ('response' in tenantContext) return tenantContext.response;
    const { supabase, tenantId } = tenantContext.ctx;

    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const status = searchParams.get('status');

    if (from && Number.isNaN(new Date(from).getTime())) {
      return NextResponse.json({ error: 'Parâmetro "from" inválido.' }, { status: 400 });
    }
    if (to && Number.isNaN(new Date(to).getTime())) {
      return NextResponse.json({ error: 'Parâmetro "to" inválido.' }, { status: 400 });
    }
    if (status && status !== 'all' && !NEGOTIATION_STATUSES.includes(status as NegotiationStatus)) {
      return NextResponse.json({ error: 'Parâmetro "status" inválido.' }, { status: 400 });
    }

    let query = supabase
      .from('negotiations')
      .select(`
        id, status, original_value, proposed_value, agreed_value,
        discount_percent, installment_count, expires_at, accepted_at, created_at,
        clients ( name, document ),
        cases ( name )
      `)
      .eq('tenant_id', tenantId);

    if (status && status !== 'all') query = query.eq('status', status);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    const { data, error } = await query.order('created_at', { ascending: false }).limit(5000);
    if (error) throw error;

    const rows: unknown[][] = [
      ['Cliente', 'Caso', 'Status', 'Valor original', 'Proposta', 'Aceito', 'Desconto (%)', 'Parcelas', 'Criado em', 'Expira em', 'Aceito em'],
    ];

    for (const n of (data ?? []) as AgreementRow[]) {
      rows.push([
        n.clients?.[0]?.name || n.cases?.[0]?.name || '—',
        n.cases?.[0]?.name || '—',
        STATUS_LABEL[n.status] || n.status,
        csvNumber(n.original_value),
        csvNumber(n.proposed_value),
        csvNumber(n.agreed_value),
        typeof n.discount_percent === 'number' ? String(n.discount_percent) : '',
        n.installment_count ?? '',
        csvDate(n.created_at),
        csvDate(n.expires_at),
        csvDate(n.accepted_at),
      ]);
    }

    return buildCsv(rows);
  } catch (error: unknown) {
    logger.error('[reports/agreements] exception', undefined, { error: error instanceof Error ? error.message : String(error) });
    return serverError('reports/agreements exception', error);
  }
}