import { describe, expect, it, vi } from 'vitest';
import { getBoard, getStats, maskDocument } from './board-service';
import type { TenantContext } from '@/lib/api-auth';
import { CRM_STAGE_META } from './stages';

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

type QueryResult = { data?: unknown; count?: number | null; error?: unknown };

interface MockDb {
  from: (table: string) => Record<string, unknown>;
  calls: { table: string; method: string; args: unknown[] }[];
}

function createDbMock(queue: Record<string, QueryResult[]>): MockDb {
  const indexes: Record<string, number> = {};
  const calls: { table: string; method: string; args: unknown[] }[] = [];

  const record = (table: string, method: string, args: unknown[]) => {
    calls.push({ table, method, args });
  };

  const build = (table: string) => {
    const idx = indexes[table] ?? 0;
    indexes[table] = idx + 1;
    const result: QueryResult = queue[table]?.[idx] ?? { data: null, count: null, error: null };
    const chain: Record<string, unknown> = {};
    const passthrough = (method: string) => {
      chain[method] = (...args: unknown[]) => {
        record(table, method, args);
        return chain;
      };
    };
    for (const method of ['select', 'eq', 'neq', 'in', 'ilike', 'or', 'is', 'not', 'order', 'limit', 'range', 'onConflict', 'update', 'insert', 'upsert']) {
      passthrough(method);
    }
    chain['maybeSingle'] = () => {
      record(table, 'maybeSingle', []);
      return Promise.resolve(result);
    };
    chain['single'] = () => {
      record(table, 'single', []);
      return Promise.resolve(result);
    };
    chain['then'] = (onFulfilled?: (r: QueryResult) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected);
    return chain;
  };

  return { from: build, calls };
}

const TENANT = 'tenant-1';
const OPERATOR = 'user-1';
const OTHER_OPERATOR = 'user-2';
const CASE_ID = 'aaaaaaaa-1111-2222-3333-444444444444';

function tenantCtx(overrides: Partial<TenantContext> = {}): TenantContext {
  return {
    userId: OPERATOR,
    isSuperAdmin: false,
    currentTenantId: TENANT,
    tenantId: TENANT,
    role: 'operador',
    canConfigureAI: false,
    supabase: {} as never,
    ...overrides,
  };
}

const emptyBoardQueue = (columns = 11): Record<string, QueryResult[]> => ({
  cases: Array.from({ length: columns }, () => ({ data: [], count: 0 })),
});

const boardRow = {
  id: CASE_ID,
  name: 'João Silva',
  original_value: 1000,
  updated_value: 1200,
  due_date: '2099-01-01',
  controller: 'ai',
  priority: 'alta',
  assigned_user_id: OTHER_OPERATOR,
  debtor_document: null,
  financial_titles: [{ contracts: { clients: { name: 'João Silva', document: '123.456.789-12' } } }],
};

describe('maskDocument', () => {
  it('mascara CPF mantendo apenas os 2 últimos dígitos', () => {
    expect(maskDocument('123.456.789-12')).toBe('***.***.***-12');
  });

  it('mascara CNPJ mantendo apenas os 2 últimos dígitos', () => {
    expect(maskDocument('11.222.333/0001-44')).toBe('**.***.***/****-44');
  });

  it('retorna vazio sem documento', () => {
    expect(maskDocument(null)).toBe('');
    expect(maskDocument(undefined)).toBe('');
  });
});

describe('getBoard', () => {
  it('sem stage retorna as 11 colunas do CRM_STAGE_META com primeiro lote e page 1', async () => {
    const db = createDbMock(emptyBoardQueue());
    const { columns } = await getBoard(db as never, tenantCtx({ role: 'gestor' }), {});

    expect(columns).toHaveLength(11);
    expect(columns.map((c) => c.stage)).toEqual(CRM_STAGE_META.map((m) => m.id));
    expect(columns.every((c) => c.page === 1)).toBe(true);
    expect(columns.every((c) => c.total === 0 && c.cases.length === 0)).toBe(true);
  });

  it('operador recebe apenas casos atribuídos a si em todas as colunas', async () => {
    const db = createDbMock(emptyBoardQueue());
    await getBoard(db as never, tenantCtx({ role: 'operador' }), { operator: 'all' });

    const assignedFilters = db.calls.filter(
      (c) => c.table === 'cases' && c.method === 'eq' && c.args[0] === 'assigned_user_id'
    );
    expect(assignedFilters).toHaveLength(11);
    expect(assignedFilters.every((c) => c.args[1] === OPERATOR)).toBe(true);
  });

  it('gestor recebe todos os casos do tenant sem filtro de responsável', async () => {
    const db = createDbMock(emptyBoardQueue());
    await getBoard(db as never, tenantCtx({ role: 'gestor' }), {});

    expect(
      db.calls.filter((c) => c.table === 'cases' && c.method === 'eq' && c.args[0] === 'assigned_user_id')
    ).toHaveLength(0);
  });

  it('gestor com operator=unassigned filtra casos sem responsável', async () => {
    const db = createDbMock({ cases: [{ data: [], count: 0 }] });
    await getBoard(db as never, tenantCtx({ role: 'gestor' }), { stage: 'NOVO', operator: 'unassigned' });

    const isFilter = db.calls.find(
      (c) => c.table === 'cases' && c.method === 'is' && c.args[0] === 'assigned_user_id'
    );
    expect(isFilter?.args).toEqual(['assigned_user_id', null]);
  });

  it('gestor com operator=userId filtra pelo responsável indicado', async () => {
    const db = createDbMock({ cases: [{ data: [], count: 0 }] });
    await getBoard(db as never, tenantCtx({ role: 'gestor' }), { stage: 'NOVO', operator: OTHER_OPERATOR });

    const assignedFilter = db.calls.find(
      (c) => c.table === 'cases' && c.method === 'eq' && c.args[0] === 'assigned_user_id'
    );
    expect(assignedFilter?.args).toEqual(['assigned_user_id', OTHER_OPERATOR]);
  });

  it('search aplica ilike por nome, documento e id do caso', async () => {
    const db = createDbMock({ cases: [{ data: [boardRow], count: 1 }] });
    const { columns } = await getBoard(db as never, tenantCtx({ role: 'gestor' }), {
      stage: 'NOVO',
      search: 'João',
    });

    const orFilter = db.calls.find((c) => c.table === 'cases' && c.method === 'or');
    expect(orFilter?.args[0]).toContain('name.ilike.%João%');
    expect(orFilter?.args[0]).toContain('debtor_document.ilike.%João%');
    expect(orFilter?.args[0]).toContain('id.ilike.%João%');
    expect(columns[0].cases).toHaveLength(1);
  });

  it('priority=alta aplica filtro server-side e retorna apenas casos de prioridade alta', async () => {
    const db = createDbMock({ cases: [{ data: [boardRow], count: 1 }] });
    const { columns } = await getBoard(db as never, tenantCtx({ role: 'gestor' }), {
      stage: 'NOVO',
      priority: 'alta',
    });

    const priorityFilter = db.calls.find(
      (c) => c.table === 'cases' && c.method === 'eq' && c.args[0] === 'priority'
    );
    expect(priorityFilter?.args).toEqual(['priority', 'alta']);
    expect(columns[0].cases).toHaveLength(1);
    expect(columns[0].cases[0].priority).toBe('alta');
  });

  it('stage=EM_NEGOCIACAO&page=2 retorna apenas a coluna indicada na segunda página', async () => {
    const db = createDbMock({ cases: [{ data: [], count: 7 }] });
    const { columns } = await getBoard(db as never, tenantCtx({ role: 'gestor' }), {
      stage: 'EM_NEGOCIACAO',
      page: 2,
      limit: 5,
    });

    expect(columns).toHaveLength(1);
    expect(columns[0].stage).toBe('EM_NEGOCIACAO');
    expect(columns[0].page).toBe(2);
    expect(columns[0].total).toBe(7);
    expect(columns[0].totalPages).toBe(2);

    const rangeCall = db.calls.find((c) => c.table === 'cases' && c.method === 'range');
    expect(rangeCall?.args).toEqual([5, 9]);
  });

  it('monta o CrmBoardCase completo com documento mascarado, último contato e responsável', async () => {
    const db = createDbMock({
      cases: [{ data: [boardRow], count: 1 }],
      messages: [{ data: [{ case_id: CASE_ID, created_at: '2026-08-01T10:00:00Z' }] }],
      tenant_members: [{ data: [{ user_id: OTHER_OPERATOR }] }],
      profiles: [{ data: [{ id: OTHER_OPERATOR, name: 'Maria Souza' }] }],
    });
    const { columns } = await getBoard(db as never, tenantCtx({ role: 'gestor' }), { stage: 'NOVO' });

    const boardCase = columns[0].cases[0];
    expect(boardCase.id).toBe(CASE_ID);
    expect(boardCase.caseNumber).toBe(`#${CASE_ID.slice(0, 8)}`);
    expect(boardCase.clientName).toBe('João Silva');
    expect(boardCase.clientDocumentMasked).toBe('***.***.***-12');
    expect(boardCase.currentValue).toBe(1200);
    expect(boardCase.dueDate).toBe('2099-01-01');
    expect(boardCase.lastContactAt).toBe('2026-08-01T10:00:00Z');
    expect(boardCase.controller).toBe('ai');
    expect(boardCase.priority).toBe('alta');
    expect(boardCase.assignee).toEqual({ id: OTHER_OPERATOR, name: 'Maria Souza' });
  });

  it('prioridade e condutor ausentes caem em media e null', async () => {
    const db = createDbMock({
      cases: [
        {
          data: [{ ...boardRow, priority: null, controller: null, assigned_user_id: null, financial_titles: null, debtor_document: '987.654.321-99' }],
          count: 1,
        },
      ],
      messages: [{ data: [] }],
    });
    const { columns } = await getBoard(db as never, tenantCtx({ role: 'gestor' }), { stage: 'NOVO' });

    const boardCase = columns[0].cases[0];
    expect(boardCase.priority).toBe('media');
    expect(boardCase.controller).toBeNull();
    expect(boardCase.assignee).toBeNull();
    expect(boardCase.lastContactAt).toBeNull();
    expect(boardCase.clientDocumentMasked).toBe('***.***.***-99');
  });

  it('filtra por tenant_id em todas as consultas', async () => {
    const db = createDbMock({
      cases: [{ data: [boardRow], count: 1 }],
      messages: [{ data: [] }],
      tenant_members: [{ data: [] }],
    });
    await getBoard(db as never, tenantCtx({ role: 'gestor' }), { stage: 'NOVO' });

    const queriesWithTenant = db.calls.filter(
      (c) => c.method === 'eq' && c.args[0] === 'tenant_id' && c.args[1] === TENANT
    );
    const tablesQueried = new Set(db.calls.map((c) => c.table));
    expect([...tablesQueried].sort()).toEqual(['cases', 'messages', 'tenant_members']);
    expect(queriesWithTenant).toHaveLength(3);
  });
});

describe('getStats', () => {
  const caseRows = [
    { id: 'case-1', crm_stage: 'NOVO' },
    { id: 'case-2', crm_stage: 'EM_NEGOCIACAO' },
    { id: 'case-3', crm_stage: 'EM_NEGOCIACAO' },
    { id: 'case-4', crm_stage: 'AGUARDANDO_PAGAMENTO' },
    { id: 'case-5', crm_stage: 'PAGAMENTO_CONFIRMADO' },
  ];

  const negotiationRows = [
    { status: 'open', agreed_value: null },
    { status: 'accepted', agreed_value: 500 },
    { status: 'fulfilled', agreed_value: 250 },
    { status: 'expired', agreed_value: 100 },
  ];

  it('computa os 8 indicadores do escopo do tenant', async () => {
    const db = createDbMock({
      cases: [{ data: caseRows }],
      negotiations: [{ data: negotiationRows }],
    });
    const stats = await getStats(db as never, tenantCtx({ role: 'gestor' }));

    expect(stats).toEqual({
      totalCases: 5,
      negotiating: 2,
      awaitingPayment: 1,
      negotiationsCreated: 4,
      negotiationsAccepted: 2,
      promises: 1,
      paymentsConfirmed: 1,
      recoveredValue: 750,
    });

    const negotiationIn = db.calls.find(
      (c) => c.table === 'negotiations' && c.method === 'in' && c.args[0] === 'case_id'
    );
    expect(negotiationIn?.args[1]).toEqual(caseRows.map((r) => r.id));
  });

  it('operador computa indicadores apenas dos próprios casos', async () => {
    const db = createDbMock({
      cases: [{ data: [caseRows[1]] }],
      negotiations: [{ data: [{ status: 'accepted', agreed_value: 500 }] }],
    });
    const stats = await getStats(db as never, tenantCtx({ role: 'operador' }));

    expect(stats.totalCases).toBe(1);
    expect(stats.negotiating).toBe(1);
    expect(stats.negotiationsAccepted).toBe(1);
    expect(stats.recoveredValue).toBe(500);

    const assignedFilter = db.calls.find(
      (c) => c.table === 'cases' && c.method === 'eq' && c.args[0] === 'assigned_user_id'
    );
    expect(assignedFilter?.args).toEqual(['assigned_user_id', OPERATOR]);
  });

  it('sem casos no escopo retorna indicadores zerados sem consultar negociações', async () => {
    const db = createDbMock({ cases: [{ data: [] }] });
    const stats = await getStats(db as never, tenantCtx({ role: 'gestor' }));

    expect(stats).toEqual({
      totalCases: 0,
      negotiating: 0,
      awaitingPayment: 0,
      negotiationsCreated: 0,
      negotiationsAccepted: 0,
      promises: 0,
      paymentsConfirmed: 0,
      recoveredValue: 0,
    });
    expect(db.calls.some((c) => c.table === 'negotiations')).toBe(false);
  });

  it('filtra por tenant_id em casos e negociações', async () => {
    const db = createDbMock({
      cases: [{ data: caseRows }],
      negotiations: [{ data: negotiationRows }],
    });
    await getStats(db as never, tenantCtx({ role: 'gestor' }));

    const tenantFilters = db.calls.filter(
      (c) => c.method === 'eq' && c.args[0] === 'tenant_id' && c.args[1] === TENANT
    );
    const tablesQueried = new Set(db.calls.map((c) => c.table));
    expect([...tablesQueried].sort()).toEqual(['cases', 'negotiations']);
    expect(tenantFilters).toHaveLength(2);
  });
});
