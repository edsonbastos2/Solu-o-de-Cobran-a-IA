import { SupabaseClient } from '@supabase/supabase-js';
import { getDaysOverdue } from '@/lib/finance';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Heurística de Propensão ao Pagamento
// ---------------------------------------------------------------------------
// O score varia em [0, 1] e combina fatores observáveis do caso:
//
//   propensity = clamp((100 + Σ componentes) / 100, 0, 1)
//
// Componentes:
//   1. DIAS DE ATRASO            [-40, 0]   quanto maior o atraso, menor a propensão
//      - 0-30d         0 pts
//      - 31-90d      -10 pts
//      - 91-180d     -20 pts
//      - >180d       -40 pts
//   2. HISTÓRICO DE PAGAMENTO    [0, +30]   títulos pagos anteriores do mesmo cliente
//      (+10 por título, máx 30)
//   3. RESPOSTAS ANTERIORES      [0, +15]   engajamento do devedor nas mensagens
//      (+5 por resposta do devedor, máx 15)
//   4. ACORDOS ANTERIORES        [0, +20]   negociações anteriores aceitas do cliente
//      (+10 por acordo, máx 20)
//   5. ESTÁGIO ATUAL             [0, +10]   em negociação ativa ganha +10 (sinal de interesse)
//   6. REGRESSÃO                [-15, 0]    casos anteriores encerrados sem acordo
//      (-15 por caso closed sem acordo, máx -15)
//
// Os pesos são documentados aqui para calibração futura. O score NÃO substitui
// julgamento humano — é um sinal auxiliar de priorização.
// ---------------------------------------------------------------------------

const MAX_SCORE = 1;
const MIN_SCORE = 0;

export interface PropensityFactors {
  daysOverdue: number;
  daysOverduePoints: number;
  paidTitles: number;
  paymentHistoryPoints: number;
  priorResponses: number;
  responsePoints: number;
  priorAgreements: number;
  agreementPoints: number;
  closedWithoutAgreement: number;
  stagePoints: number;
  regressionPoints: number;
  total: number;
}

export interface PropensityResult {
  caseId: string;
  score: number;
  updatedAt: string;
  factors: PropensityFactors;
}

interface CaseRow {
  id: string;
  tenant_id: string;
  status: string;
  name?: string;
  phone?: string;
  due_date: string;
  financial_title_id?: string | null;
}

/** Resolve o client_id do caso via financial_title. */
async function resolveClientId(client: SupabaseClient, caseRow: CaseRow): Promise<string | null> {
  if (!caseRow.financial_title_id) return null;
  const { data, error } = await client
    .from('financial_titles')
    .select('client_id')
    .eq('id', caseRow.financial_title_id)
    .maybeSingle();
  if (error || !data?.client_id) return null;
  return data.client_id;
}

/** Desconta pontos conforme o atraso (componente dominante). */
function daysOverdueComponent(daysOverdue: number): number {
  if (daysOverdue <= 30) return 0;
  if (daysOverdue <= 90) return -10;
  if (daysOverdue <= 180) return -20;
  return -40;
}

function clamp(value: number): number {
  return Math.max(MIN_SCORE, Math.min(MAX_SCORE, value));
}

/**
 * Calcula o propensity score (0-1) de um caso ativo e o persiste nas colunas
 * `cases.propensity_score` / `cases.propensity_updated_at`.
 */
export async function calculatePropensityScore(
  caseId: string,
  context: { client: SupabaseClient }
): Promise<PropensityResult> {
  const { client } = context;
  const factors = await collectFactors(caseId, client);

  const raw = 100 + factors.daysOverduePoints + factors.paymentHistoryPoints + factors.responsePoints
    + factors.agreementPoints + factors.stagePoints + factors.regressionPoints;
  const score = clamp(raw / 100);
  const updatedAt = new Date().toISOString();

  const { error } = await client
    .from('cases')
    .update({ propensity_score: score, propensity_updated_at: updatedAt })
    .eq('id', caseId);
  if (error) {
    logger.error('Falha ao persistir propensity_score', undefined, { caseId, error: error.message });
  }

  return { caseId, score, updatedAt, factors };
}

async function collectFactors(caseId: string, client: SupabaseClient): Promise<PropensityFactors> {
  const { data: caseRow, error: caseError } = await client
    .from('cases')
    .select('id, tenant_id, status, name, phone, due_date, financial_title_id')
    .eq('id', caseId)
    .maybeSingle();
  if (caseError || !caseRow) {
    logger.warn('Caso não encontrado para score de propensão', undefined, { caseId, error: caseError?.message });
    return emptyFactors();
  }

  const daysOverdue = getDaysOverdue(caseRow.due_date);
  const daysOverduePoints = daysOverdueComponent(daysOverdue);
  const clientId = await resolveClientId(client, caseRow);

  // 1. Histórico de pagamento do cliente (títulos pagos no tenant)
  const paidTitles = await countPaidTitles(client, caseRow.tenant_id, clientId);
  const paymentHistoryPoints = Math.min(30, paidTitles * 10);

  // 2. Mensagens trocadas (respostas do devedor)
  const { data: messages, error: msgError } = await client
    .from('messages')
    .select('role')
    .eq('case_id', caseId);
  if (msgError) logger.warn('Erro ao ler mensagens para propensão', undefined, { caseId, error: msgError.message });
  const priorResponses = (messages || []).filter((m: { role: string }) => m.role === 'user').length;
  const responsePoints = Math.min(15, priorResponses * 5);

  // 3. Acordos anteriores do mesmo cliente
  const priorAgreements = await countAgreements(client, caseRow.tenant_id, clientId);
  const agreementPoints = Math.min(20, priorAgreements * 10);

  // 4. Estágio atual incentiva propensão (engajamento ativo)
  const stagePoints = caseRow.status === 'in_negotiation' ? 10 : 0;

  // 5. Regressão: casos anteriores do cliente encerrados sem acordo
  const closedWithoutAgreement = await countClosedWithoutAgreement(client, caseRow.tenant_id, caseRow.id, clientId);
  const regressionPoints = Math.max(-15, closedWithoutAgreement * -15);

  const total = daysOverduePoints + paymentHistoryPoints + responsePoints + agreementPoints + stagePoints + regressionPoints;

  return {
    daysOverdue,
    daysOverduePoints,
    paidTitles,
    paymentHistoryPoints,
    priorResponses,
    responsePoints,
    priorAgreements,
    agreementPoints,
    closedWithoutAgreement,
    stagePoints,
    regressionPoints,
    total,
  };
}

async function countPaidTitles(client: SupabaseClient, tenantId: string, clientId: string | null): Promise<number> {
  if (!clientId) return 0;
  const { count, error } = await client
    .from('financial_titles')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .in('status', ['paid', 'settled', 'recovered']);
  if (error) {
    logger.warn('Erro ao consultar histórico de pagamento', undefined, { tenantId, error: error.message });
    return 0;
  }
  return count || 0;
}

async function countAgreements(client: SupabaseClient, tenantId: string, clientId: string | null): Promise<number> {
  if (!clientId) return 0;
  const { count, error } = await client
    .from('negotiations')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .not('accepted_at', 'is', null);
  if (error) {
    logger.warn('Erro ao consultar acordos anteriores', undefined, { tenantId, error: error.message });
    return 0;
  }
  return count || 0;
}

async function countClosedWithoutAgreement(
  client: SupabaseClient,
  tenantId: string,
  excludeCaseId: string,
  clientId: string | null
): Promise<number> {
  if (!clientId) return 0;
  // Títulos do mesmo cliente (histórico de casos anteriores)
  const { data: titles, error: titlesError } = await client
    .from('financial_titles')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId);
  if (titlesError) {
    logger.warn('Erro ao consultar títulos do cliente para propensão', undefined, { tenantId, error: titlesError.message });
    return 0;
  }
  if (!titles || titles.length === 0) return 0;
  const titleIds = titles.map((t: { id: string }) => t.id);

  const { count, error } = await client
    .from('cases')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'closed')
    .neq('id', excludeCaseId)
    .in('financial_title_id', titleIds);
  if (error) {
    logger.warn('Erro ao consultar casos encerrados para propensão', undefined, { tenantId, error: error.message });
    return 0;
  }
  return count || 0;
}

function emptyFactors(): PropensityFactors {
  return {
    daysOverdue: 0,
    daysOverduePoints: 0,
    paidTitles: 0,
    paymentHistoryPoints: 0,
    priorResponses: 0,
    responsePoints: 0,
    priorAgreements: 0,
    agreementPoints: 0,
    closedWithoutAgreement: 0,
    stagePoints: 0,
    regressionPoints: 0,
    total: 0,
  };
}