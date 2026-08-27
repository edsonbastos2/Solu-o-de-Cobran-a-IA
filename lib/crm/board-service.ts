import { SupabaseClient } from '@supabase/supabase-js';
import { ROLE_RANK, TenantContext } from '@/lib/api-auth';
import { calculateUpdatedValue } from '@/lib/finance';
import { CrmBoardCase, CrmBoardColumn, CrmStats } from '@/lib/types';
import { CRM_PRIORITIES, CRM_STAGE_META, CrmPriority, CrmStage } from './stages';

const BOARD_CASE_SELECT = `
  id, name, original_value, updated_value, due_date,
  controller, priority, assigned_user_id, debtor_document,
  financial_titles (
    contracts (
      clients (name, document)
    )
  )
`;

export interface BoardParams {
  search?: string;
  operator?: string;
  priority?: string;
  stage?: CrmStage;
  page?: number;
  limit?: number;
}

interface BoardCaseRow {
  id: string;
  name: string;
  original_value: number;
  updated_value: number | null;
  due_date: string;
  controller: 'ai' | 'human' | null;
  priority: CrmPriority | null;
  assigned_user_id: string | null;
  debtor_document: string | null;
  financial_titles?: unknown;
}

function sanitizeSearch(term: string): string {
  return term.replace(/[%_,()]/g, ' ').trim();
}

export function maskDocument(document: string | null | undefined): string {
  if (!document) return '';
  const chars = [...document];
  let digitsKept = 0;
  for (let i = chars.length - 1; i >= 0; i--) {
    if (/\d/.test(chars[i])) {
      if (digitsKept < 2) digitsKept++;
      else chars[i] = '*';
    }
  }
  return chars.join('');
}

function firstClient(row: BoardCaseRow): { name: string; document: string } | null {
  const title = Array.isArray(row.financial_titles) ? row.financial_titles[0] : row.financial_titles;
  const contract = (title as { contracts?: unknown } | null | undefined)?.contracts;
  const contractRow = Array.isArray(contract) ? contract[0] : contract;
  const client = (contractRow as { clients?: unknown } | null | undefined)?.clients;
  const clientRow = Array.isArray(client) ? client[0] : client;
  return (clientRow as { name: string; document: string } | null | undefined) ?? null;
}

function toBoardCase(
  row: BoardCaseRow,
  lastContactByCase: Map<string, string>,
  operatorNames: Map<string, string>
): CrmBoardCase {
  const client = firstClient(row);
  const recalculated = calculateUpdatedValue(Number(row.original_value) || 0, new Date(row.due_date));
  const currentValue =
    recalculated > Number(row.original_value)
      ? recalculated
      : Number(row.updated_value || row.original_value);
  return {
    id: row.id,
    caseNumber: `#${row.id.slice(0, 8)}`,
    clientName: client?.name ?? row.name,
    clientDocumentMasked: maskDocument(client?.document ?? row.debtor_document),
    currentValue,
    dueDate: row.due_date,
    lastContactAt: lastContactByCase.get(row.id) ?? null,
    controller: row.controller ?? null,
    priority: (row.priority ?? 'media') as CrmPriority,
    assignee: row.assigned_user_id
      ? { id: row.assigned_user_id, name: operatorNames.get(row.assigned_user_id) ?? 'Operador' }
      : null,
  };
}

async function fetchLastContactByCase(
  db: SupabaseClient,
  tenantId: string,
  caseIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (caseIds.length === 0) return map;
  const { data, error } = await db
    .from('messages')
    .select('case_id, created_at')
    .eq('tenant_id', tenantId)
    .in('case_id', caseIds);
  if (error) throw error;
  for (const message of (data ?? []) as { case_id: string; created_at: string }[]) {
    const current = map.get(message.case_id);
    if (!current || new Date(message.created_at) > new Date(current)) {
      map.set(message.case_id, message.created_at);
    }
  }
  return map;
}

async function fetchOperatorNames(
  db: SupabaseClient,
  tenantId: string,
  userIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return map;

  const { data: members, error } = await db
    .from('tenant_members')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .in('user_id', unique);
  if (error) throw error;

  const memberIds = ((members ?? []) as { user_id: string }[]).map((m) => m.user_id);
  if (memberIds.length === 0) return map;

  const { data: profiles, error: profilesError } = await db
    .from('profiles')
    .select('id, name')
    .in('id', memberIds);
  if (profilesError) throw profilesError;

  for (const profile of (profiles ?? []) as { id: string; name: string }[]) {
    map.set(profile.id, profile.name);
  }
  return map;
}

function isOperatorScope(ctx: TenantContext): boolean {
  return ROLE_RANK[ctx.role] < ROLE_RANK.gestor && !ctx.isSuperAdmin;
}

export async function getBoard(
  db: SupabaseClient,
  ctx: TenantContext,
  params: BoardParams
): Promise<{ columns: CrmBoardColumn[] }> {
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const stageRequested = Boolean(params.stage);
  const page = stageRequested ? Math.max(1, params.page ?? 1) : 1;
  const offset = (page - 1) * limit;
  const stages: CrmStage[] = stageRequested
    ? [params.stage as CrmStage]
    : CRM_STAGE_META.map((meta) => meta.id);
  const search = sanitizeSearch(params.search ?? '');
  const priority =
    params.priority && (CRM_PRIORITIES as readonly string[]).includes(params.priority)
      ? params.priority
      : null;
  const operatorScope = isOperatorScope(ctx);

  const columns: CrmBoardColumn[] = [];
  const rowsByColumn: BoardCaseRow[][] = [];

  for (const stage of stages) {
    let query = db
      .from('cases')
      .select(BOARD_CASE_SELECT, { count: 'exact' })
      .eq('tenant_id', ctx.tenantId)
      .eq('crm_stage', stage);

    if (operatorScope) {
      query = query.eq('assigned_user_id', ctx.userId);
    } else if (params.operator === 'unassigned') {
      query = query.is('assigned_user_id', null);
    } else if (params.operator && params.operator !== 'all') {
      query = query.eq('assigned_user_id', params.operator);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,debtor_document.ilike.%${search}%,id.ilike.%${search}%`);
    }
    if (priority) {
      query = query.eq('priority', priority);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;

    const caseRows = (data ?? []) as BoardCaseRow[];
    const total = count ?? caseRows.length;
    columns.push({ stage, total, page, totalPages: Math.ceil(total / limit) || 1, cases: [] });
    rowsByColumn.push(caseRows);
  }

  const allRows = rowsByColumn.flat();
  if (allRows.length === 0) return { columns };

  const [lastContactByCase, operatorNames] = await Promise.all([
    fetchLastContactByCase(db, ctx.tenantId, allRows.map((row) => row.id)),
    fetchOperatorNames(
      db,
      ctx.tenantId,
      allRows.map((row) => row.assigned_user_id ?? '').filter(Boolean)
    ),
  ]);

  columns.forEach((column, index) => {
    column.cases = rowsByColumn[index].map((row) => toBoardCase(row, lastContactByCase, operatorNames));
  });

  return { columns };
}

export async function getStats(db: SupabaseClient, ctx: TenantContext): Promise<CrmStats> {
  let caseQuery = db.from('cases').select('id, crm_stage').eq('tenant_id', ctx.tenantId);
  if (isOperatorScope(ctx)) {
    caseQuery = caseQuery.eq('assigned_user_id', ctx.userId);
  }
  const { data: caseRows, error } = await caseQuery;
  if (error) throw error;

  const rows = (caseRows ?? []) as { id: string; crm_stage: CrmStage | null }[];
  const countStage = (stage: CrmStage) =>
    rows.filter((row) => (row.crm_stage ?? 'NOVO') === stage).length;

  const stats: CrmStats = {
    totalCases: rows.length,
    negotiating: countStage('EM_NEGOCIACAO'),
    awaitingPayment: countStage('AGUARDANDO_PAGAMENTO'),
    negotiationsCreated: 0,
    negotiationsAccepted: 0,
    promises: countStage('AGUARDANDO_PAGAMENTO'),
    paymentsConfirmed: countStage('PAGAMENTO_CONFIRMADO'),
    recoveredValue: 0,
  };

  if (rows.length === 0) return stats;

  const { data: negotiations, error: negotiationsError } = await db
    .from('negotiations')
    .select('status, agreed_value')
    .eq('tenant_id', ctx.tenantId)
    .in('case_id', rows.map((row) => row.id));
  if (negotiationsError) throw negotiationsError;

  for (const negotiation of (negotiations ?? []) as { status: string; agreed_value: number | null }[]) {
    stats.negotiationsCreated += 1;
    if (negotiation.status === 'accepted' || negotiation.status === 'fulfilled') {
      stats.negotiationsAccepted += 1;
      stats.recoveredValue += Number(negotiation.agreed_value) || 0;
    }
  }

  return stats;
}
