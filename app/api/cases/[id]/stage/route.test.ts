import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/api-auth', () => ({
  requireTenantContext: vi.fn(),
  serverError: vi.fn((_msg: string, err?: unknown) =>
    NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  ),
  ROLE_RANK: { owner: 4, admin: 3, gestor: 2, operador: 1 },
}));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/lib/crm/stage-service', () => ({
  moveCaseStage: vi.fn(),
}));

import { PATCH } from './route';
import { requireTenantContext } from '@/lib/api-auth';
import { moveCaseStage } from '@/lib/crm/stage-service';

function fakeReq(body: unknown) {
  return { url: 'http://localhost/api/x', json: async () => body, headers: new Map() } as never;
}

const CTX = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  role: 'operador' as const,
  supabase: {} as never,
};

const PARAMS = (id: string) => ({ params: Promise.resolve({ id }) });

describe('PATCH /api/cases/[id]/stage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireTenantContext).mockResolvedValue({ ctx: CTX } as never);
  });

  it('retorna 400 sem stageId', async () => {
    const res = await PATCH(fakeReq({}), PARAMS('case-1'));
    expect(res.status).toBe(400);
    expect(moveCaseStage).not.toHaveBeenCalled();
  });

  it('retorna 200 com o caso atualizado no sucesso', async () => {
    vi.mocked(moveCaseStage).mockResolvedValue({ ok: true, case: { id: 'case-1', crm_stage: 'ESCALADO' } as never });
    const res = await PATCH(fakeReq({ stageId: 'ESCALADO' }), PARAMS('case-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.case.crm_stage).toBe('ESCALADO');
    expect(moveCaseStage).toHaveBeenCalledWith(CTX.supabase, CTX, 'case-1', {
      stageId: 'ESCALADO',
      expectedStageId: undefined,
      reason: undefined,
    });
  });

  it('mapeia VALIDATION_ERROR para 400', async () => {
    vi.mocked(moveCaseStage).mockResolvedValue({ ok: false, error_code: 'VALIDATION_ERROR', message: 'Etapa inválida.' });
    const res = await PATCH(fakeReq({ stageId: 'FECHADO' }), PARAMS('case-1'));
    expect(res.status).toBe(400);
  });

  it('mapeia FORBIDDEN para 403', async () => {
    vi.mocked(moveCaseStage).mockResolvedValue({
      ok: false,
      error_code: 'FORBIDDEN',
      message: 'Permissão insuficiente para mover a etapa deste caso.',
    });
    const res = await PATCH(fakeReq({ stageId: 'ESCALADO' }), PARAMS('case-1'));
    expect(res.status).toBe(403);
  });

  it('mapeia NOT_FOUND para 404', async () => {
    vi.mocked(moveCaseStage).mockResolvedValue({
      ok: false,
      error_code: 'NOT_FOUND',
      message: 'Caso não encontrado ou acesso negado.',
    });
    const res = await PATCH(fakeReq({ stageId: 'ESCALADO' }), PARAMS('case-1'));
    expect(res.status).toBe(404);
  });

  it('mapeia STAGE_CONFLICT para 409 incluindo a etapa atual', async () => {
    vi.mocked(moveCaseStage).mockResolvedValue({
      ok: false,
      error_code: 'STAGE_CONFLICT',
      message: 'A etapa do caso foi alterada por outro operador.',
      currentStage: 'EM_NEGOCIACAO',
    });
    const res = await PATCH(fakeReq({ stageId: 'ESCALADO', expectedStageId: 'NOVO' }), PARAMS('case-1'));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.currentStage).toBe('EM_NEGOCIACAO');
    expect(body.code).toBe('STAGE_CONFLICT');
  });

  it('mapeia INVALID_TRANSITION para 422', async () => {
    vi.mocked(moveCaseStage).mockResolvedValue({
      ok: false,
      error_code: 'INVALID_TRANSITION',
      message: 'Transição de etapa inválida.',
    });
    const res = await PATCH(fakeReq({ stageId: 'NOVO' }), PARAMS('case-1'));
    expect(res.status).toBe(422);
  });
});
