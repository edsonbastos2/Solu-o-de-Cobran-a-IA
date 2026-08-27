import { describe, expect, it, vi } from 'vitest';
import { moveCaseStage } from './stage-service';
import type { TenantContext } from '@/lib/api-auth';

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

type QueryResult = { data: unknown; error?: unknown };

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
    const result: QueryResult = queue[table]?.[idx] ?? { data: null, error: null };
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
  assigned_user_id: OPERATOR as string | null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
};

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

describe('moveCaseStage', () => {
  it('operador titular move o caso: atualiza crm_stage e status, grava histórico e auditoria', async () => {
    const db = createDbMock({
      cases: [
        { data: { ...baseCase } },
        { data: { ...baseCase, crm_stage: 'ESCALADO', status: 'needs_attention' } },
      ],
      case_stage_history: [{ data: null }],
      audit_logs: [{ data: null }],
    });

    const result = await moveCaseStage(db as never, tenantCtx(), CASE_ID, {
      stageId: 'ESCALADO',
      reason: 'Cliente agressivo no canal',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.case.crm_stage).toBe('ESCALADO');
      expect(result.case.status).toBe('needs_attention');
    }
    const updateCall = db.calls.find((c) => c.table === 'cases' && c.method === 'update');
    expect(updateCall?.args[0]).toMatchObject({ crm_stage: 'ESCALADO', status: 'needs_attention' });
    const stageFilter = db.calls.find((c) => c.table === 'cases' && c.method === 'eq' && c.args[0] === 'crm_stage');
    expect(stageFilter?.args[1]).toBe('EM_NEGOCIACAO');
    const tenantFilter = db.calls.filter(
      (c) => c.table === 'cases' && c.method === 'eq' && c.args[0] === 'tenant_id'
    );
    expect(tenantFilter).toHaveLength(2);
    const historyInsert = db.calls.find((c) => c.table === 'case_stage_history' && c.method === 'insert');
    expect(historyInsert?.args[0]).toMatchObject({
      tenant_id: TENANT,
      case_id: CASE_ID,
      from_stage: 'EM_NEGOCIACAO',
      to_stage: 'ESCALADO',
      changed_by: OPERATOR,
      reason: 'Cliente agressivo no canal',
    });
    const auditInsert = db.calls.find((c) => c.table === 'audit_logs' && c.method === 'insert');
    expect(auditInsert?.args[0]).toMatchObject({
      action: 'CASE_STAGE_CHANGED',
      tenant_id: TENANT,
      case_id: CASE_ID,
      actor_user_id: OPERATOR,
      before_state: { crm_stage: 'EM_NEGOCIACAO', status: 'in_negotiation' },
      after_state: { crm_stage: 'ESCALADO', status: 'needs_attention' },
    });
  });

  it('operador não titular recebe FORBIDDEN sem escrever no caso', async () => {
    const db = createDbMock({
      cases: [{ data: { ...baseCase, assigned_user_id: OTHER_OPERATOR } }],
    });

    const result = await moveCaseStage(db as never, tenantCtx(), CASE_ID, { stageId: 'ESCALADO' });

    expect(result).toEqual({
      ok: false,
      error_code: 'FORBIDDEN',
      message: 'Permissão insuficiente para mover a etapa deste caso.',
    });
    expect(db.calls.some((c) => c.table === 'cases' && c.method === 'update')).toBe(false);
    expect(db.calls.some((c) => c.table === 'case_stage_history' && c.method === 'insert')).toBe(false);
  });

  it('gestor move qualquer caso do tenant', async () => {
    const db = createDbMock({
      cases: [
        { data: { ...baseCase, assigned_user_id: OTHER_OPERATOR } },
        { data: { ...baseCase, assigned_user_id: OTHER_OPERATOR, crm_stage: 'AGUARDANDO_PAGAMENTO' } },
      ],
      case_stage_history: [{ data: null }],
      audit_logs: [{ data: null }],
    });

    const result = await moveCaseStage(db as never, tenantCtx({ role: 'gestor' }), CASE_ID, {
      stageId: 'AGUARDANDO_PAGAMENTO',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.case.crm_stage).toBe('AGUARDANDO_PAGAMENTO');
      expect(result.case.status).toBe('in_negotiation');
    }
  });

  it('transição proibida retorna INVALID_TRANSITION', async () => {
    const db = createDbMock({
      cases: [{ data: { ...baseCase, crm_stage: 'ENCERRADO', status: 'closed' } }],
    });

    const result = await moveCaseStage(db as never, tenantCtx(), CASE_ID, { stageId: 'NOVO' });

    expect(result).toEqual({
      ok: false,
      error_code: 'INVALID_TRANSITION',
      message: 'Transição de etapa inválida: ENCERRADO para NOVO.',
    });
    expect(db.calls.some((c) => c.table === 'cases' && c.method === 'update')).toBe(false);
  });

  it('expectedStageId divergente retorna STAGE_CONFLICT com a etapa atual no payload', async () => {
    const db = createDbMock({
      cases: [{ data: { ...baseCase } }],
    });

    const result = await moveCaseStage(db as never, tenantCtx(), CASE_ID, {
      stageId: 'ESCALADO',
      expectedStageId: 'NOVO',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_code).toBe('STAGE_CONFLICT');
      expect(result.currentStage).toBe('EM_NEGOCIACAO');
    }
    expect(db.calls.some((c) => c.table === 'cases' && c.method === 'update')).toBe(false);
  });

  it('UPDATE condicionado sem linhas afetadas retorna STAGE_CONFLICT com a etapa atual', async () => {
    const db = createDbMock({
      cases: [{ data: { ...baseCase } }, { data: null }],
    });

    const result = await moveCaseStage(db as never, tenantCtx(), CASE_ID, {
      stageId: 'ESCALADO',
      expectedStageId: 'EM_NEGOCIACAO',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_code).toBe('STAGE_CONFLICT');
      expect(result.currentStage).toBe('EM_NEGOCIACAO');
    }
  });

  it('caso inexistente ou de outro tenant retorna NOT_FOUND', async () => {
    const db = createDbMock({ cases: [{ data: null }] });

    const result = await moveCaseStage(db as never, tenantCtx(), CASE_ID, { stageId: 'ESCALADO' });

    expect(result).toEqual({
      ok: false,
      error_code: 'NOT_FOUND',
      message: 'Caso não encontrado ou acesso negado.',
    });
  });

  it('stageId fora do enum retorna VALIDATION_ERROR', async () => {
    const db = createDbMock({
      cases: [{ data: { ...baseCase } }],
    });

    const result = await moveCaseStage(db as never, tenantCtx(), CASE_ID, { stageId: 'FECHADO' });

    expect(result).toEqual({
      ok: false,
      error_code: 'VALIDATION_ERROR',
      message: 'Etapa inválida.',
    });
    expect(db.calls.some((c) => c.table === 'cases' && c.method === 'update')).toBe(false);
  });
});
