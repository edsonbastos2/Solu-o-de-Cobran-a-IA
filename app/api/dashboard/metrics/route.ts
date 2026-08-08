import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { requireTenantContext, serverError } from '@/lib/api-auth';
import { getDaysOverdue, getCollectionStage } from '@/lib/finance';
import type { CollectionStage, DashboardMetrics } from '@/lib/types';

/**
 * GET /api/dashboard/metrics
 *
 * Métricas do dashboard baseadas nos status REAIS de `cases`
 * ('not_started' | 'in_negotiation' | 'needs_attention' | 'closed').
 * NUNCA usar os status legados 'in_progress'/'paid'/'agreed' em queries de cases —
 * 'paid' só é válido para financial_titles.status (requisito de recovered_amount).
 */

const AGING_BUCKET_ORDER = ['0-30', '31-90', '91-180', '180+'] as const;
const STAGE_ORDER: CollectionStage[] = ['preventiva', 'amigavel', 'negocial', 'especializada'];

const round2 = (n: number) => Math.round(n * 100) / 100;

interface CaseMetricRow {
  id: string;
  status: string;
  created_at: string | null;
  due_date: string;
  updated_value: number | null;
  original_value: number | null;
  max_discount_margin: number | null;
  telegram_chat_id: string | null;
}

/** Shape completo zerado — demo mode e fallback nunca retornam NaN/campos ausentes. */
function emptyMetrics(): DashboardMetrics {
  return {
    total_cases: 0,
    active_cases: 0,
    recovered_amount: 0,
    pending_amount: 0,
    success_rate: 0,
    aging_buckets: AGING_BUCKET_ORDER.map((bucket) => ({ bucket, count: 0, amount: 0 })),
    stage_distribution: STAGE_ORDER.map((stage) => ({ stage, count: 0, amount: 0 })),
    channel_distribution: [],
    avg_resolution_days: 0,
    payment_status_pie: [],
    contracts_by_month_bar: [],
    paymentStatus: [{ name: 'Sem dados', value: 1 }],
    contractsByMonth: [],
  };
}

export async function GET(req: NextRequest) {
  try {
    // Demo mode: sem Supabase configurado, devolve zeros consistentes.
    if (!getSupabaseServer(req)) {
      return NextResponse.json(emptyMetrics());
    }

    const { searchParams } = new URL(req.url);
    const tenantContext = await requireTenantContext(req, searchParams.get('tenant_id'));
    if ('response' in tenantContext) return tenantContext.response;
    const { supabase, tenantId } = tenantContext.ctx;

    // ------------------------------------------------------------------
    // Cases (fonte de verdade para funil, aging, estágio, canal e prazos)
    // telegram_chat_id pode não existir se a migration que a adiciona não
    // foi aplicada — nesse caso refazemos a query sem a coluna.
    // ------------------------------------------------------------------
    let cases: CaseMetricRow[];
    const withChannel = await supabase
      .from('cases')
      .select('id, status, created_at, due_date, updated_value, original_value, max_discount_margin, telegram_chat_id')
      .eq('tenant_id', tenantId);

    if (withChannel.error && /telegram_chat_id/i.test(withChannel.error.message ?? '')) {
      const fallback = await supabase
        .from('cases')
        .select('id, status, created_at, due_date, updated_value, original_value, max_discount_margin')
        .eq('tenant_id', tenantId);
      if (fallback.error) throw fallback.error;
      cases = ((fallback.data ?? []) as Omit<CaseMetricRow, 'telegram_chat_id'>[]).map((c) => ({
        ...c,
        telegram_chat_id: null,
      }));
    } else {
      if (withChannel.error) throw withChannel.error;
      cases = (withChannel.data ?? []) as CaseMetricRow[];
    }

    // Status reais de cases: closed = encerrado; demais = ativos.
    const total_cases = cases.length;
    const closedCases = cases.filter((c) => c.status === 'closed');
    const activeCaseRows = cases.filter((c) => c.status !== 'closed');
    const active_cases = activeCaseRows.length;

    const valueOf = (c: CaseMetricRow): number =>
      Number(c.updated_value ?? c.original_value ?? 0) || 0;

    const pending_amount = round2(activeCaseRows.reduce((acc, c) => acc + valueOf(c), 0));

    // Placeholder até negotiations existir (task 2): closed / total.
    const success_rate = total_cases > 0 ? Math.round((closedCases.length / total_cases) * 100) : 0;

    // ------------------------------------------------------------------
    // recovered_amount: financial_titles pagos (status='paid' E paid_at preenchido)
    // ------------------------------------------------------------------
    const { data: paidTitles, error: titlesError } = await supabase
      .from('financial_titles')
      .select('current_value, original_value, metadata')
      .eq('tenant_id', tenantId)
      .eq('status', 'paid')
      .not('paid_at', 'is', null);
    if (titlesError) throw titlesError;

    const recovered_amount = round2(
      (paidTitles ?? []).reduce((acc: number, t: {
        current_value: number | null;
        original_value: number | null;
        metadata: Record<string, unknown> | null;
      }) => {
        const paymentMeta = t.metadata?.payment as Record<string, unknown> | undefined;
        const totalPaid = typeof paymentMeta?.total === 'number' && paymentMeta.total > 0
          ? Number(paymentMeta.total)
          : undefined;
        const lastAmount = typeof paymentMeta?.amount === 'number' && paymentMeta.amount > 0
          ? Number(paymentMeta.amount)
          : undefined;
        const fallbackAmount = Number(t.current_value) > 0 ? Number(t.current_value) : (Number(t.original_value ?? 0) || 0);
        const paidAmount = totalPaid ?? lastAmount ?? fallbackAmount;
        return acc + paidAmount;
      }, 0)
    );

    // ------------------------------------------------------------------
    // Aging por bucket — apenas casos ATIVOS e vencidos (dias > 0).
    // Casos não vencidos aparecem em stage_distribution como 'preventiva'.
    // ------------------------------------------------------------------
    const agingMap = new Map<string, { count: number; amount: number }>(
      AGING_BUCKET_ORDER.map((b) => [b, { count: 0, amount: 0 }])
    );
    for (const c of activeCaseRows) {
      const days = getDaysOverdue(c.due_date);
      if (days <= 0) continue;
      const bucket = days <= 30 ? '0-30' : days <= 90 ? '31-90' : days <= 180 ? '91-180' : '180+';
      const entry = agingMap.get(bucket)!;
      entry.count += 1;
      entry.amount += valueOf(c);
    }
    const aging_buckets = AGING_BUCKET_ORDER.map((bucket) => {
      const entry = agingMap.get(bucket)!;
      return { bucket, count: entry.count, amount: round2(entry.amount) };
    });

    // ------------------------------------------------------------------
    // Distribuição por estágio do funil (casos ativos) via getCollectionStage
    // ------------------------------------------------------------------
    const stageMap = new Map<CollectionStage, { count: number; amount: number }>(
      STAGE_ORDER.map((s) => [s, { count: 0, amount: 0 }])
    );
    for (const c of activeCaseRows) {
      const stage = getCollectionStage(c.due_date, Number(c.max_discount_margin ?? 10) || 10, c.status);
      const entry = stageMap.get(stage.id)!;
      entry.count += 1;
      entry.amount += valueOf(c);
    }
    const stage_distribution = STAGE_ORDER.map((stage) => {
      const entry = stageMap.get(stage)!;
      return { stage, count: entry.count, amount: round2(entry.amount) };
    });

    // ------------------------------------------------------------------
    // Distribuição por canal de mensageria.
    // Não existe coluna `channel` em cases/messages — o canal é derivado de
    // cases.telegram_chat_id (mesma heurística de lib/agent.ts: Telegram se
    // vinculado, senão WhatsApp).
    // ------------------------------------------------------------------
    const channelMap = new Map<string, number>();
    for (const c of cases) {
      const channel = c.telegram_chat_id ? 'telegram' : 'whatsapp';
      channelMap.set(channel, (channelMap.get(channel) ?? 0) + 1);
    }
    const channel_distribution = [...channelMap.entries()]
      .map(([channel, count]) => ({ channel, count }))
      .sort((a, b) => b.count - a.count);

    // ------------------------------------------------------------------
    // Tempo médio de resolução: cases não tem updated_at, então usamos o
    // primeiro audit_logs com action='CASE_CLOSED' como data de fechamento.
    // Casos closed sem evento de auditoria são ignorados do cálculo.
    // ------------------------------------------------------------------
    let avg_resolution_days = 0;
    if (closedCases.length > 0) {
      const { data: closeEvents, error: auditError } = await supabase
        .from('audit_logs')
        .select('case_id, created_at')
        .eq('tenant_id', tenantId)
        .eq('action', 'CASE_CLOSED')
        .in('case_id', closedCases.map((c) => c.id))
        .order('created_at', { ascending: true });
      if (auditError) throw auditError;

      const firstCloseAt = new Map<string, number>();
      for (const ev of (closeEvents ?? []) as { case_id: string | null; created_at: string | null }[]) {
        if (!ev.case_id || !ev.created_at || firstCloseAt.has(ev.case_id)) continue;
        const ts = new Date(ev.created_at).getTime();
        if (!isNaN(ts)) firstCloseAt.set(ev.case_id, ts);
      }

      let totalDays = 0;
      let counted = 0;
      for (const c of closedCases) {
        const closedAt = firstCloseAt.get(c.id);
        if (!closedAt || !c.created_at) continue;
        const createdAt = new Date(c.created_at).getTime();
        if (isNaN(createdAt) || closedAt < createdAt) continue;
        totalDays += (closedAt - createdAt) / 86_400_000;
        counted += 1;
      }
      avg_resolution_days = counted > 0 ? Math.round((totalDays / counted) * 10) / 10 : 0;
    }

    // ------------------------------------------------------------------
    // Gráficos legados (consumidos por components/dashboard-charts.tsx)
    // ------------------------------------------------------------------
    const statusLabels: Array<[status: string, name: string]> = [
      ['closed', 'Resolvidos'],
      ['in_negotiation', 'Em Negociação'],
      ['needs_attention', 'Requer Atenção'],
      ['not_started', 'Não Iniciados'],
    ];
    const payment_status_pie = statusLabels
      .map(([status, name]) => ({ name, value: cases.filter((c) => c.status === status).length }))
      .filter((item) => item.value > 0);
    // Legado: mantém o fallback 'Sem dados' para o gráfico de pizza não ficar vazio.
    const paymentStatus = payment_status_pie.length > 0 ? payment_status_pie : [{ name: 'Sem dados', value: 1 }];

    const monthMap = new Map<string, { count: number; sortKey: number }>();
    for (const c of cases) {
      const date = new Date(c.created_at ?? Date.now());
      if (isNaN(date.getTime())) continue;
      const label = `${date.toLocaleString('pt-BR', { month: 'short' })} ${date.getFullYear()}`;
      const sortKey = date.getFullYear() * 100 + date.getMonth();
      const entry = monthMap.get(label) ?? { count: 0, sortKey };
      entry.count += 1;
      monthMap.set(label, entry);
    }
    const sortedMonths = [...monthMap.entries()].sort((a, b) => a[1].sortKey - b[1].sortKey);
    const contracts_by_month_bar = sortedMonths.map(([month, e]) => ({ month, count: e.count }));
    const contractsByMonth = sortedMonths.map(([name, e]) => ({ name, Novas: e.count }));

    const metrics: DashboardMetrics = {
      total_cases,
      active_cases,
      recovered_amount,
      pending_amount,
      success_rate,
      aging_buckets,
      stage_distribution,
      channel_distribution,
      avg_resolution_days,
      payment_status_pie,
      contracts_by_month_bar,
      paymentStatus,
      contractsByMonth,
    };

    return NextResponse.json(metrics);
  } catch (error: unknown) {
    return serverError('dashboard metrics exception', error);
  }
}
