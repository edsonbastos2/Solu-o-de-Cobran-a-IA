import { describe, expect, it, vi } from 'vitest';
import {
  deriveConversationPermissions,
  isAIPaused,
  listConversations,
  markConversationRead,
  recordAIHandoff,
  resolveController,
  returnConversationToAI,
  takeOverConversation,
  transferConversation,
} from './conversation-service';

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

type QueryResult = { data: unknown; error?: unknown };

interface MockDb {
  from: (table: string) => Record<string, unknown>;
  calls: { table: string; method: string; args: unknown[] }[];
}

/**
 * Mock do cliente Supabase: cada `from(table)` consome o próximo resultado da
 * fila daquela tabela. Registra todas as chamadas para asserções.
 */
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
  controller: 'ai',
  conversation_version: 2,
  assigned_user_id: null as string | null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
};

function detailQueue(overrides: Partial<Record<string, QueryResult[]>> = {}): Record<string, QueryResult[]> {
  return {
    negotiations: [{ data: null }],
    messages: [{ data: [] }],
    conversation_events: [{ data: [] }],
    conversation_reads: [{ data: null }],
    tenant_members: [{ data: [] }, { data: [] }],
    ...overrides,
  };
}

describe('isAIPaused', () => {
  it('pausa quando humano conduz explicitamente', () => {
    expect(isAIPaused({ controller: 'human', status: 'in_negotiation' })).toBe(true);
  });

  it('não pausa quando IA conduz explicitamente', () => {
    expect(isAIPaused({ controller: 'ai', status: 'in_negotiation' })).toBe(false);
  });

  it('caso legado sem controller pausa com needs_attention', () => {
    expect(isAIPaused({ controller: null, status: 'needs_attention' })).toBe(true);
  });

  it('caso legado sem controller não pausa em in_negotiation', () => {
    expect(isAIPaused({ controller: null, status: 'in_negotiation' })).toBe(false);
  });
});

describe('resolveController', () => {
  it('deriva human para legado needs_attention', () => {
    expect(resolveController({ controller: null, status: 'needs_attention' })).toBe('human');
  });

  it('deriva ai para legado em negociação', () => {
    expect(resolveController({ controller: undefined, status: 'in_negotiation' })).toBe('ai');
  });
});

describe('deriveConversationPermissions', () => {
  it('operador atribuído pode enviar e devolver, mas não transferir', () => {
    const p = deriveConversationPermissions('operador', { isAssignedToMe: true, controller: 'human' });
    expect(p.canSend).toBe(true);
    expect(p.canReturnToAI).toBe(true);
    expect(p.canTransfer).toBe(false);
    expect(p.canComplete).toBe(false);
  });

  it('operador não atribuído não pode enviar', () => {
    const p = deriveConversationPermissions('operador', { isAssignedToMe: false, controller: 'human' });
    expect(p.canSend).toBe(false);
  });

  it('gestor transfere mas não completa', () => {
    const p = deriveConversationPermissions('gestor', { isAssignedToMe: false, controller: 'human' });
    expect(p.canTransfer).toBe(true);
    expect(p.canComplete).toBe(false);
  });

  it('admin completa', () => {
    const p = deriveConversationPermissions('admin', { isAssignedToMe: false, controller: 'ai' });
    expect(p.canComplete).toBe(true);
  });
});

describe('takeOverConversation', () => {
  it('assume a conversa: seta controller human, incrementa versão e grava evento', async () => {
    const detail = { ...baseCase, controller: 'human', assigned_user_id: OPERATOR, conversation_version: 3, financial_titles: null };
    const db = createDbMock({
      cases: [
        { data: { ...baseCase } },
        { data: { ...baseCase, controller: 'human', assigned_user_id: OPERATOR, conversation_version: 3 } },
        { data: detail },
      ],
      conversation_events: [{ data: null }, { data: [] }],
      audit_logs: [{ data: null }],
      ...detailQueue({ conversation_events: [{ data: null }, { data: [] }] }),
    });

    const result = await takeOverConversation(db as never, TENANT, OPERATOR, 'operador', CASE_ID, 2);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.conversation.case.controller).toBe('human');
      expect(result.conversation.conversationVersion).toBe(3);
    }
    const updateCall = db.calls.find((c) => c.table === 'cases' && c.method === 'update');
    expect(updateCall?.args[0]).toMatchObject({ controller: 'human', assigned_user_id: OPERATOR });
    const versionFilter = db.calls.find((c) => c.table === 'cases' && c.method === 'eq' && c.args[0] === 'conversation_version');
    expect(versionFilter?.args[1]).toBe(2);
    const eventInsert = db.calls.find((c) => c.table === 'conversation_events' && c.method === 'insert');
    expect(eventInsert?.args[0]).toMatchObject({ type: 'HUMAN_TAKEOVER', performed_by: OPERATOR });
  });

  it('retorna VERSION_CONFLICT quando a versão não corresponde', async () => {
    const db = createDbMock({
      cases: [{ data: { ...baseCase } }, { data: null }],
    });
    const result = await takeOverConversation(db as never, TENANT, OPERATOR, 'operador', CASE_ID, 99);
    expect(result).toEqual({ ok: false, error_code: 'VERSION_CONFLICT' });
  });

  it('retorna NOT_FOUND quando o caso não existe no tenant', async () => {
    const db = createDbMock({ cases: [{ data: null }] });
    const result = await takeOverConversation(db as never, TENANT, OPERATOR, 'operador', CASE_ID, 2);
    expect(result).toEqual({ ok: false, error_code: 'NOT_FOUND' });
  });
});

describe('recordAIHandoff', () => {
  it('seta controller human, incrementa versão e grava evento sem performed_by quando IA conduzia explicitamente', async () => {
    const db = createDbMock({
      cases: [
        { data: { ...baseCase, controller: 'ai', conversation_version: 4 } },
        { data: { ...baseCase, controller: 'human', conversation_version: 5 } },
      ],
      conversation_events: [{ data: null }],
      audit_logs: [{ data: null }],
    });

    await recordAIHandoff(db as never, TENANT, CASE_ID);

    const updateCall = db.calls.find((c) => c.table === 'cases' && c.method === 'update');
    expect(updateCall?.args[0]).toMatchObject({ controller: 'human', conversation_version: 5 });
    const eventInsert = db.calls.find((c) => c.table === 'conversation_events' && c.method === 'insert');
    expect(eventInsert?.args[0]).toMatchObject({ type: 'HUMAN_TAKEOVER', performed_by: null });
  });

  it('não escreve nada quando um humano já conduz a conversa', async () => {
    const db = createDbMock({
      cases: [{ data: { ...baseCase, controller: 'human' } }],
    });

    await recordAIHandoff(db as never, TENANT, CASE_ID);

    expect(db.calls.some((c) => c.table === 'cases' && c.method === 'update')).toBe(false);
  });
});

describe('returnConversationToAI', () => {
  it('devolve para IA: limpa responsável, seta controller ai e grava evento', async () => {
    const detail = { ...baseCase, controller: 'ai', assigned_user_id: null, financial_titles: null };
    const db = createDbMock({
      cases: [
        { data: { ...baseCase, controller: 'human', assigned_user_id: OPERATOR } },
        { data: { ...baseCase, controller: 'ai', assigned_user_id: null, conversation_version: 3 } },
        { data: detail },
      ],
      conversation_events: [{ data: null }, { data: [] }],
      audit_logs: [{ data: null }],
      ...detailQueue({ conversation_events: [{ data: null }, { data: [] }] }),
    });

    const result = await returnConversationToAI(db as never, TENANT, OPERATOR, 'operador', CASE_ID, 2);

    expect(result.ok).toBe(true);
    const updateCall = db.calls.find((c) => c.table === 'cases' && c.method === 'update');
    expect(updateCall?.args[0]).toMatchObject({ controller: 'ai', assigned_user_id: null });
    const eventInsert = db.calls.find((c) => c.table === 'conversation_events' && c.method === 'insert');
    expect(eventInsert?.args[0]).toMatchObject({ type: 'RETURNED_TO_AI' });
  });

  it('bloqueia devolução quando a IA já conduz (sem permissão de envio)', async () => {
    const db = createDbMock({
      cases: [{ data: { ...baseCase, controller: 'ai', assigned_user_id: null } }],
    });
    const result = await returnConversationToAI(db as never, TENANT, OPERATOR, 'operador', CASE_ID, 2);
    expect(result).toEqual({ ok: false, error_code: 'FORBIDDEN' });
  });
});

describe('transferConversation', () => {
  it('bloqueia operador sem permissão de transferência', async () => {
    const db = createDbMock({});
    const result = await transferConversation(db as never, TENANT, OPERATOR, 'operador', CASE_ID, {
      toOperatorId: 'user-2',
      expectedVersion: 2,
    });
    expect(result).toEqual({ ok: false, error_code: 'FORBIDDEN' });
    expect(db.calls.length).toBe(0);
  });

  it('retorna INVALID_OPERATOR quando o destinatário não é membro ativo do tenant', async () => {
    const db = createDbMock({
      cases: [{ data: { ...baseCase, controller: 'human', assigned_user_id: OPERATOR } }],
      tenant_members: [{ data: null }],
    });
    const result = await transferConversation(db as never, TENANT, OPERATOR, 'gestor', CASE_ID, {
      toOperatorId: 'user-2',
      expectedVersion: 2,
    });
    expect(result).toEqual({ ok: false, error_code: 'INVALID_OPERATOR' });
  });

  it('transfere com sucesso mantendo humano como condutor e gravando evento com payload', async () => {
    const detail = { ...baseCase, controller: 'human', assigned_user_id: 'user-2', conversation_version: 3, financial_titles: null };
    const db = createDbMock({
      cases: [
        { data: { ...baseCase, controller: 'human', assigned_user_id: OPERATOR } },
        { data: { ...baseCase, controller: 'human', assigned_user_id: 'user-2', conversation_version: 3 } },
        { data: detail },
      ],
      profiles: [{ data: [{ id: 'user-2', name: 'Maria Souza' }] }],
      audit_logs: [{ data: null }],
      ...detailQueue({
        conversation_events: [{ data: null }, { data: [] }],
        tenant_members: [
          { data: { user_id: 'user-2', role: 'operador', status: 'active' } },
          { data: [{ user_id: 'user-2', role: 'operador' }] },
          { data: [{ user_id: 'user-2', role: 'operador' }] },
        ],
      }),
    });

    const result = await transferConversation(db as never, TENANT, OPERATOR, 'gestor', CASE_ID, {
      toOperatorId: 'user-2',
      reason: 'Cliente solicitou negociação especial',
      expectedVersion: 2,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.conversation.case.assigned_user_id).toBe('user-2');
      expect(result.conversation.currentOperator?.name).toBe('Maria Souza');
    }
    const updateCall = db.calls.find((c) => c.table === 'cases' && c.method === 'update');
    expect(updateCall?.args[0]).toMatchObject({ controller: 'human', assigned_user_id: 'user-2' });
    const eventInsert = db.calls.find((c) => c.table === 'conversation_events' && c.method === 'insert');
    expect(eventInsert?.args[0]).toMatchObject({
      type: 'TRANSFERRED',
      payload: {
        fromOperatorId: OPERATOR,
        toOperatorId: 'user-2',
        reason: 'Cliente solicitou negociação especial',
      },
    });
  });
});

describe('listConversations', () => {
  it('filtro unread retorna apenas conversas com mensagens do devedor não lidas', async () => {
    const db = createDbMock({
      cases: [{ data: [{ ...baseCase, id: 'case-1' }, { ...baseCase, id: 'case-2', name: 'Maria' }] }],
      messages: [
        {
          data: [
            { case_id: 'case-1', role: 'user', content: 'Consigo pagar metade', created_at: '2026-08-18T10:00:00Z', send_status: 'received' },
            { case_id: 'case-1', role: 'ai', content: 'Entendi', created_at: '2026-08-18T10:01:00Z', send_status: 'sent' },
            { case_id: 'case-2', role: 'ai', content: 'Olá Maria', created_at: '2026-08-17T09:00:00Z', send_status: 'sent' },
          ],
        },
      ],
      conversation_reads: [{ data: [{ case_id: 'case-1', last_read_at: '2026-08-17T00:00:00Z' }] }],
      tenant_members: [{ data: [] }],
    });

    const result = await listConversations(db as never, TENANT, OPERATOR, { filter: 'unread' });

    expect(result.total).toBe(1);
    expect(result.conversations[0].case.id).toBe('case-1');
    expect(result.conversations[0].unreadCount).toBe(1);
    expect(result.conversations[0].waitingFor).toBe('debtor');
  });

  it('sem registro de leitura todas as mensagens do devedor ficam não lidas', async () => {
    const db = createDbMock({
      cases: [{ data: [{ ...baseCase }] }],
      messages: [{ data: [{ case_id: CASE_ID, role: 'user', content: 'Olá', created_at: '2026-08-18T10:00:00Z', send_status: 'received' }] }],
      conversation_reads: [{ data: null }],
      tenant_members: [{ data: [] }],
    });

    const result = await listConversations(db as never, TENANT, OPERATOR, { filter: 'unread' });

    expect(result.total).toBe(1);
    expect(result.conversations[0].unreadCount).toBe(1);
    expect(result.conversations[0].waitingFor).toBe('operator');
  });

  it('busca por conteúdo de mensagem encontra a conversa correspondente', async () => {
    const db = createDbMock({
      contracts: [{ data: [] }],
      messages: [
        { data: [{ case_id: CASE_ID }] },
        { data: [] },
      ],
      cases: [
        { data: [] },
        { data: [{ ...baseCase }] },
      ],
      conversation_reads: [{ data: null }],
      tenant_members: [{ data: [] }],
    });

    const result = await listConversations(db as never, TENANT, OPERATOR, { search: 'parcela' });

    expect(result.total).toBe(1);
    expect(result.conversations[0].case.id).toBe(CASE_ID);
    const inCall = db.calls.find((c) => c.table === 'cases' && c.method === 'in');
    expect(inCall?.args[0]).toBe('id');
    expect(inCall?.args[1]).toEqual([CASE_ID]);
  });

  it('anexa lastEventType com o evento mais recente de conversation_events por caso', async () => {
    const db = createDbMock({
      cases: [{ data: [{ ...baseCase }] }],
      messages: [{ data: [] }],
      conversation_reads: [{ data: null }],
      tenant_members: [{ data: [] }],
      conversation_events: [
        {
          data: [
            { case_id: CASE_ID, type: 'TRANSFERRED', created_at: '2026-08-19T10:00:00Z' },
            { case_id: CASE_ID, type: 'HUMAN_TAKEOVER', created_at: '2026-08-18T10:00:00Z' },
          ],
        },
      ],
    });

    const result = await listConversations(db as never, TENANT, OPERATOR, {});

    expect(result.conversations[0].lastEventType).toBe('TRANSFERRED');
  });

  it('lastEventType é null quando não há eventos para o caso', async () => {
    const db = createDbMock({
      cases: [{ data: [{ ...baseCase }] }],
      messages: [{ data: [] }],
      conversation_reads: [{ data: null }],
      tenant_members: [{ data: [] }],
      conversation_events: [{ data: [] }],
    });

    const result = await listConversations(db as never, TENANT, OPERATOR, {});

    expect(result.conversations[0].lastEventType).toBeNull();
  });
});

describe('markConversationRead', () => {
  it('faz upsert com onConflict de tenant, caso e usuário', async () => {
    const db = createDbMock({ conversation_reads: [{ data: null }] });
    const ok = await markConversationRead(db as never, TENANT, OPERATOR, CASE_ID);
    expect(ok).toBe(true);
    const upsert = db.calls.find((c) => c.table === 'conversation_reads' && c.method === 'upsert');
    expect(upsert?.args[0]).toMatchObject({ tenant_id: TENANT, case_id: CASE_ID, user_id: OPERATOR });
    expect(upsert?.args[1]).toMatchObject({ onConflict: 'tenant_id,case_id,user_id' });
  });

  it('retorna false em erro de escrita', async () => {
    const db = createDbMock({ conversation_reads: [{ data: null, error: { message: 'boom' } }] });
    const ok = await markConversationRead(db as never, TENANT, OPERATOR, CASE_ID);
    expect(ok).toBe(false);
  });
});
