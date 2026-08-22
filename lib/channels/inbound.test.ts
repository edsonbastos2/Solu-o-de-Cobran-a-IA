import { beforeEach, describe, expect, it, vi } from 'vitest';
import { processInboundEvent } from './inbound';
import { processChat } from '../agent';
import { rateLimit } from '../rate-limit';
import { recordAuditAction } from '../audit';

vi.mock('../agent', () => ({
  processChat: vi.fn().mockResolvedValue({ text: '', newStatus: null, stage: null }),
}));
vi.mock('../rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue(true),
}));
vi.mock('../audit', () => ({
  recordAuditAction: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('./message-service', () => ({
  buildClientCaseFilter: vi.fn().mockResolvedValue('debtor_id.eq.client-1'),
}));

type QueryResult = { data: unknown; error?: unknown };

function createDbMock(queue: Record<string, QueryResult[]>) {
  const indexes: Record<string, number> = {};
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const build = (table: string) => {
    const idx = indexes[table] ?? 0;
    indexes[table] = idx + 1;
    const result: QueryResult = queue[table]?.[idx] ?? { data: null, error: null };
    const chain: Record<string, unknown> = {};
    const passthrough = (method: string) => {
      chain[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return chain;
      };
    };
    for (const method of ['select', 'eq', 'neq', 'in', 'ilike', 'or', 'is', 'not', 'order', 'limit', 'range', 'onConflict', 'update', 'insert', 'upsert']) {
      passthrough(method);
    }
    chain['maybeSingle'] = () => Promise.resolve(result);
    chain['single'] = () => Promise.resolve(result);
    chain['then'] = (onFulfilled?: (r: QueryResult) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected);
    return chain;
  };
  return { from: build, calls };
}

const event = {
  eventId: 'evt-1',
  channel: 'whatsapp' as const,
  externalId: '11999999999',
  externalMessageId: 'ext-1',
  content: 'Consigo pagar metade esse mês',
  tenantId: 'tenant-1',
  metadata: {},
};

function baseQueue(caseRow: Record<string, unknown>): Record<string, QueryResult[]> {
  return {
    webhook_events: [{ data: null }],
    client_channels: [{ data: [{ client_id: 'client-1' }] }],
    cases: [{ data: caseRow }],
    messages: [{ data: null }],
    conversation_events: [{ data: null }],
  };
}

describe('processInboundEvent — condutor explícito', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('humano conduz: persiste mensagem e evento, sem chamar a IA', async () => {
    const db = createDbMock(baseQueue({ id: 'case-1', status: 'in_negotiation', controller: 'human', user_id: null }));

    const result = await processInboundEvent(db as never, event);

    expect(result).toEqual({ ok: true, reason: 'ai_paused' });
    expect(processChat).not.toHaveBeenCalled();
    const msgInsert = db.calls.find((c) => c.table === 'messages' && c.method === 'insert');
    expect(msgInsert?.args[0]).toMatchObject({ role: 'user', case_id: 'case-1', send_status: 'received' });
    const evtInsert = db.calls.find((c) => c.table === 'conversation_events' && c.method === 'insert');
    expect(evtInsert?.args[0]).toMatchObject({ type: 'MESSAGE_RECEIVED' });
    expect(recordAuditAction).toHaveBeenCalled();
  });

  it('IA conduz: dispara o pipeline de IA normalmente', async () => {
    const db = createDbMock(baseQueue({ id: 'case-1', status: 'in_negotiation', controller: 'ai', user_id: null }));

    const result = await processInboundEvent(db as never, event);

    expect(result).toEqual({ ok: true });
    expect(processChat).toHaveBeenCalledWith('case-1', event.content, db, 'tenant-1', { persistUserMessage: false });
  });

  it('caso legado sem controller pausa com needs_attention (comportamento preservado)', async () => {
    const db = createDbMock(baseQueue({ id: 'case-1', status: 'needs_attention', controller: null, user_id: null }));

    const result = await processInboundEvent(db as never, event);

    expect(result).toEqual({ ok: true, reason: 'ai_paused' });
    expect(processChat).not.toHaveBeenCalled();
  });

  it('caso legado sem controller em negociação dispara a IA (comportamento preservado)', async () => {
    const db = createDbMock(baseQueue({ id: 'case-1', status: 'in_negotiation', controller: null, user_id: null }));

    const result = await processInboundEvent(db as never, event);

    expect(result).toEqual({ ok: true });
    expect(processChat).toHaveBeenCalled();
  });

  it('respeita rate limit antes de acionar a IA', async () => {
    vi.mocked(rateLimit).mockResolvedValueOnce(false);
    const db = createDbMock(baseQueue({ id: 'case-1', status: 'in_negotiation', controller: 'ai', user_id: null }));

    const result = await processInboundEvent(db as never, event);

    expect(result).toEqual({ ok: true, reason: 'rate_limited' });
    expect(processChat).not.toHaveBeenCalled();
  });
});
