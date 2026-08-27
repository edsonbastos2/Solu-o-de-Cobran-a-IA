import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/api-auth', () => ({
  requireTenantContext: vi.fn(),
  requireRole: vi.fn(),
  serverError: vi.fn((_msg: string, err?: unknown) =>
    NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  ),
  ROLE_RANK: { owner: 4, admin: 3, gestor: 2, operador: 1 },
}));
vi.mock('@/lib/audit', () => ({ recordAuditAction: vi.fn() }));
vi.mock('@/lib/channels/message-service', () => ({ resolveCaseClientId: vi.fn() }));

import { GET, PATCH } from './route';
import { requireTenantContext, requireRole } from '@/lib/api-auth';
import { recordAuditAction } from '@/lib/audit';
import type { TenantContext } from '@/lib/api-auth';

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
const CASE_ID = 'case-1';

const baseCase = {
  id: CASE_ID,
  tenant_id: TENANT,
  name: 'João Silva',
  phone: '11999999999',
  original_value: 8500,
  updated_value: 9240,
  due_date: '2026-06-10',
  max_discount_margin: 10,
  status: 'in_negotiation',
  crm_stage: 'EM_NEGOCIACAO',
  priority: 'media',
  controller: 'ai',
  conversation_version: 2,
  assigned_user_id: OPERATOR,
  active_channel: null,
  financial_titles: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
};

function ctx(db: MockDb, role: TenantContext['role'] = 'gestor'): TenantContext {
  return {
    userId: OPERATOR,
    isSuperAdmin: false,
    currentTenantId: TENANT,
    tenantId: TENANT,
    role,
    canConfigureAI: true,
    supabase: db as never,
  };
}

function fakeReq(body?: unknown) {
  return {
    url: `http://localhost/api/cases/${CASE_ID}`,
    json: async () => body,
    headers: new Map(),
  } as never;
}

const PARAMS = { params: Promise.resolve({ id: CASE_ID }) };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PATCH /api/cases/[id] — priority', () => {
  it('gestor atualiza prioridade válida e audita CASE_PRIORITY_CHANGED', async () => {
    const db = createDbMock({
      cases: [{ data: { ...baseCase } }, { data: { ...baseCase, priority: 'alta' } }],
    });
    vi.mocked(requireTenantContext).mockResolvedValue({ ctx: ctx(db) } as never);

    const res = await PATCH(fakeReq({ priority: 'alta' }), PARAMS);

    expect(res.status).toBe(200);
    const updateCall = db.calls.find((c) => c.table === 'cases' && c.method === 'update');
    expect(updateCall?.args[0]).toMatchObject({ priority: 'alta' });
    expect(recordAuditAction).toHaveBeenCalledTimes(1);
    expect(vi.mocked(recordAuditAction).mock.calls[0][1]).toMatchObject({
      action: 'CASE_PRIORITY_CHANGED',
      before: expect.objectContaining({ priority: 'media' }),
      after: expect.objectContaining({ priority: 'alta' }),
      metadata: expect.objectContaining({
        changed_fields: ['priority'],
        priority_old: 'media',
        priority_new: 'alta',
      }),
    });
  });

  it('prioridade inválida retorna 400', async () => {
    const db = createDbMock({ cases: [{ data: { ...baseCase } }] });
    vi.mocked(requireTenantContext).mockResolvedValue({ ctx: ctx(db) } as never);

    const res = await PATCH(fakeReq({ priority: 'urgente' }), PARAMS);

    expect(res.status).toBe(400);
    expect(db.calls.some((c) => c.table === 'cases' && c.method === 'update')).toBe(false);
    expect(recordAuditAction).not.toHaveBeenCalled();
  });

  it('operador altera prioridade de caso atribuído a si', async () => {
    const db = createDbMock({
      cases: [{ data: { ...baseCase, assigned_user_id: OPERATOR } }, { data: { ...baseCase, priority: 'baixa' } }],
    });
    vi.mocked(requireTenantContext).mockResolvedValue({ ctx: ctx(db, 'operador') } as never);

    const res = await PATCH(fakeReq({ priority: 'baixa' }), PARAMS);

    expect(res.status).toBe(200);
    expect(vi.mocked(recordAuditAction).mock.calls[0][1]).toMatchObject({
      action: 'CASE_PRIORITY_CHANGED',
    });
  });

  it('operador não altera prioridade de caso de outro responsável', async () => {
    const db = createDbMock({ cases: [{ data: { ...baseCase, assigned_user_id: 'user-2' } }] });
    vi.mocked(requireTenantContext).mockResolvedValue({ ctx: ctx(db, 'operador') } as never);

    const res = await PATCH(fakeReq({ priority: 'alta' }), PARAMS);

    expect(res.status).toBe(403);
    expect(db.calls.some((c) => c.table === 'cases' && c.method === 'update')).toBe(false);
    expect(recordAuditAction).not.toHaveBeenCalled();
  });

  it('operador não pode alterar outros campos via PATCH', async () => {
    vi.mocked(requireRole).mockResolvedValue({
      response: NextResponse.json({ error: 'Permissão insuficiente para realizar esta ação.' }, { status: 403 }),
    } as never);

    const res = await PATCH(fakeReq({ status: 'closed' }), PARAMS);

    expect(res.status).toBe(403);
    expect(requireRole).toHaveBeenCalled();
    expect(recordAuditAction).not.toHaveBeenCalled();
  });

  it('prioridade junto de outro campo segue a permissão gestor do PATCH', async () => {
    vi.mocked(requireRole).mockResolvedValue({
      response: NextResponse.json({ error: 'Permissão insuficiente para realizar esta ação.' }, { status: 403 }),
    } as never);

    const res = await PATCH(fakeReq({ status: 'closed', priority: 'alta' }), PARAMS);

    expect(res.status).toBe(403);
    expect(requireRole).toHaveBeenCalled();
  });
});

describe('GET /api/cases/[id] — stage_history', () => {
  it('retorna crm_stage, priority e stage_history desc com autor nomeado', async () => {
    const db = createDbMock({
      cases: [{ data: { ...baseCase } }],
      messages: [{ data: [] }],
      audit_logs: [{ data: [] }],
      case_stage_history: [
        {
          data: [
            {
              id: 'h-2',
              case_id: CASE_ID,
              from_stage: 'EM_NEGOCIACAO',
              to_stage: 'AGUARDANDO_PAGAMENTO',
              changed_by: 'user-2',
              reason: 'Promessa registrada',
              created_at: '2026-08-02T00:00:00Z',
              profiles: { name: 'Maria Souza' },
            },
            {
              id: 'h-1',
              case_id: CASE_ID,
              from_stage: null,
              to_stage: 'EM_NEGOCIACAO',
              changed_by: null,
              reason: null,
              created_at: '2026-08-01T00:00:00Z',
              profiles: null,
            },
          ],
        },
      ],
    });
    vi.mocked(requireTenantContext).mockResolvedValue({ ctx: ctx(db) } as never);

    const res = await GET(fakeReq(), PARAMS);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.case.crm_stage).toBe('EM_NEGOCIACAO');
    expect(body.case.priority).toBe('media');
    expect(body.stage_history).toHaveLength(2);
    expect(body.stage_history[0]).toMatchObject({
      id: 'h-2',
      to_stage: 'AGUARDANDO_PAGAMENTO',
      changed_by_name: 'Maria Souza',
    });
    expect(body.stage_history[1]).toMatchObject({
      id: 'h-1',
      from_stage: null,
      changed_by_name: null,
    });

    const historyQuery = db.calls.find((c) => c.table === 'case_stage_history');
    expect(historyQuery).toBeTruthy();
    const orderCall = db.calls.find((c) => c.table === 'case_stage_history' && c.method === 'order');
    expect(orderCall?.args).toEqual(['created_at', { ascending: false }]);
    const tenantFilter = db.calls.find(
      (c) => c.table === 'case_stage_history' && c.method === 'eq' && c.args[0] === 'tenant_id'
    );
    expect(tenantFilter?.args).toEqual(['tenant_id', TENANT]);
  });
});
