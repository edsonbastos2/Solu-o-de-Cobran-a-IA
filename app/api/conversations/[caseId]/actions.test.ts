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
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/lib/conversation-service', () => ({
  takeOverConversation: vi.fn(),
  returnConversationToAI: vi.fn(),
  transferConversation: vi.fn(),
  markConversationRead: vi.fn().mockResolvedValue(true),
}));

import { POST as takeOver } from './takeover/route';
import { POST as returnToAI } from './return-to-ai/route';
import { POST as transfer } from './transfer/route';
import { POST as read } from './read/route';
import { requireTenantContext } from '@/lib/api-auth';
import { takeOverConversation, transferConversation } from '@/lib/conversation-service';

function fakeReq(body: unknown) {
  return { url: 'http://localhost/api/x', json: async () => body, headers: new Map() } as never;
}

const CTX = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  role: 'operador' as const,
  supabase: {} as never,
};

const PARAMS = (caseId: string) => ({ params: Promise.resolve({ caseId }) });

describe('POST /api/conversations/[caseId]/takeover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireTenantContext).mockResolvedValue({ ctx: CTX } as never);
  });

  it('retorna 400 sem expectedVersion', async () => {
    const res = await takeOver(fakeReq({}), PARAMS('case-1'));
    expect(res.status).toBe(400);
  });

  it('retorna 409 com mensagem acionável em conflito de versão', async () => {
    vi.mocked(takeOverConversation).mockResolvedValue({ ok: false, error_code: 'VERSION_CONFLICT' });
    const res = await takeOver(fakeReq({ expectedVersion: 2 }), PARAMS('case-1'));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('alterada por outro operador');
  });

  it('retorna a conversa atualizada no sucesso', async () => {
    vi.mocked(takeOverConversation).mockResolvedValue({ ok: true, conversation: { case: { id: 'case-1' } } as never });
    const res = await takeOver(fakeReq({ expectedVersion: 2 }), PARAMS('case-1'));
    expect(res.status).toBe(200);
    expect(takeOverConversation).toHaveBeenCalledWith(CTX.supabase, 'tenant-1', 'user-1', 'operador', 'case-1', 2);
  });
});

describe('POST /api/conversations/[caseId]/return-to-ai', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireTenantContext).mockResolvedValue({ ctx: CTX } as never);
  });

  it('retorna 400 sem expectedVersion', async () => {
    const res = await returnToAI(fakeReq({}), PARAMS('case-1'));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/conversations/[caseId]/transfer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireTenantContext).mockResolvedValue({ ctx: { ...CTX, role: 'gestor' } } as never);
  });

  it('retorna 400 sem toOperatorId', async () => {
    const res = await transfer(fakeReq({ expectedVersion: 2 }), PARAMS('case-1'));
    expect(res.status).toBe(400);
  });

  it('retorna 400 com motivo acima de 500 caracteres', async () => {
    const res = await transfer(fakeReq({ toOperatorId: 'user-2', expectedVersion: 2, reason: 'x'.repeat(501) }), PARAMS('case-1'));
    expect(res.status).toBe(400);
  });

  it('retorna 422 para destinatário inválido', async () => {
    vi.mocked(transferConversation).mockResolvedValue({ ok: false, error_code: 'INVALID_OPERATOR' });
    const res = await transfer(fakeReq({ toOperatorId: 'user-2', expectedVersion: 2 }), PARAMS('case-1'));
    expect(res.status).toBe(422);
  });

  it('retorna 403 quando o operador não é titular do caso', async () => {
    vi.mocked(transferConversation).mockResolvedValue({ ok: false, error_code: 'FORBIDDEN' });
    const res = await transfer(fakeReq({ toOperatorId: 'user-2', expectedVersion: 2 }), PARAMS('case-1'));
    expect(res.status).toBe(403);
  });

  it('retorna 200 quando o operador titular transfere', async () => {
    vi.mocked(requireTenantContext).mockResolvedValue({ ctx: CTX } as never);
    vi.mocked(transferConversation).mockResolvedValue({ ok: true, conversation: { case: { id: 'case-1' } } as never });
    const res = await transfer(fakeReq({ toOperatorId: 'user-2', expectedVersion: 2 }), PARAMS('case-1'));
    expect(res.status).toBe(200);
    expect(transferConversation).toHaveBeenCalledWith(CTX.supabase, 'tenant-1', 'user-1', 'operador', 'case-1', {
      toOperatorId: 'user-2',
      reason: undefined,
      expectedVersion: 2,
    });
  });
});

describe('POST /api/conversations/[caseId]/read', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireTenantContext).mockResolvedValue({ ctx: CTX } as never);
  });

  it('retorna ok no sucesso', async () => {
    const res = await read(fakeReq({}), PARAMS('case-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
