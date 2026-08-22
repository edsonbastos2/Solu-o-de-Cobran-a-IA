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
  listConversations: vi.fn().mockResolvedValue({ conversations: [], total: 0, page: 1, totalPages: 0 }),
  getConversation: vi.fn().mockResolvedValue(null),
}));

import { GET } from './route';
import { requireTenantContext } from '@/lib/api-auth';
import { listConversations } from '@/lib/conversation-service';

function fakeReq(url: string) {
  return { url, json: async () => ({}), headers: new Map() } as never;
}

const CTX = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  role: 'operador' as const,
  supabase: {} as never,
};

describe('GET /api/conversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireTenantContext).mockResolvedValue({ ctx: CTX } as never);
  });

  it('retorna 400 para filtro inválido', async () => {
    const res = await GET(fakeReq('http://localhost/api/conversations?filter=qualquer'));
    expect(res.status).toBe(400);
  });

  it('repassa filtros válidos ao service', async () => {
    await GET(fakeReq('http://localhost/api/conversations?page=2&limit=50&filter=unread&search=jo%C3%A3o'));
    expect(listConversations).toHaveBeenCalledWith(
      CTX.supabase,
      'tenant-1',
      'user-1',
      expect.objectContaining({ page: 2, limit: 50, filter: 'unread', search: 'joão' })
    );
  });

  it('ignora filtro por responsável para operador', async () => {
    await GET(fakeReq('http://localhost/api/conversations?assignee=user-2'));
    expect(listConversations).toHaveBeenCalledWith(
      CTX.supabase,
      'tenant-1',
      'user-1',
      expect.not.objectContaining({ assignee: expect.anything() })
    );
  });

  it('permite filtro por responsável para gestor', async () => {
    vi.mocked(requireTenantContext).mockResolvedValue({ ctx: { ...CTX, role: 'gestor' } } as never);
    await GET(fakeReq('http://localhost/api/conversations?assignee=user-2'));
    expect(listConversations).toHaveBeenCalledWith(
      CTX.supabase,
      'tenant-1',
      'user-1',
      expect.objectContaining({ assignee: 'user-2' })
    );
  });
});
