import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CrmBoardCase, CrmBoardColumn } from '@/lib/types';

const mocks = vi.hoisted(() => {
  const realtime = { callback: null as (() => void) | null };
  const channel = {
    on: vi.fn((_event: string, _config: unknown, callback: () => void) => {
      realtime.callback = callback;
      return channel;
    }),
    subscribe: vi.fn(() => channel),
  };
  return {
    keys: [] as (string | null)[],
    data: undefined as { columns: CrmBoardColumn[] } | undefined,
    mutate: vi.fn(),
    fetchWithAuth: vi.fn(),
    removeChannel: vi.fn(),
    supabaseEnabled: true,
    channel,
    realtime,
  };
});

vi.mock('swr', () => ({
  __esModule: true,
  default: (key: string | null) => {
    mocks.keys.push(key);
    return { data: mocks.data, error: undefined, isLoading: false, mutate: mocks.mutate };
  },
}));

vi.mock('@/lib/api', () => ({
  fetcher: vi.fn(),
  fetchWithAuth: (...args: unknown[]) => mocks.fetchWithAuth(...args),
}));

vi.mock('@/lib/supabase', () => ({
  get supabase() {
    return mocks.supabaseEnabled
      ? { channel: () => mocks.channel, removeChannel: mocks.removeChannel }
      : null;
  },
}));

import { useCrmBoard } from './use-crm-board';

function makeCase(id: string, caseNumber: string): CrmBoardCase {
  return {
    id,
    caseNumber,
    clientName: `Cliente ${id}`,
    clientDocumentMasked: '***.***.***-**',
    currentValue: 1000,
    dueDate: '2026-01-10',
    lastContactAt: null,
    controller: 'ai',
    priority: 'media',
    assignee: null,
  };
}

const CASE_A = makeCase('case-a', '0001/2026');
const CASE_B = makeCase('case-b', '0002/2026');

function makeBoard(): { columns: CrmBoardColumn[] } {
  return {
    columns: [
      { stage: 'NOVO', total: 2, page: 1, totalPages: 2, cases: [CASE_A, CASE_B] },
      { stage: 'EM_CONTATO', total: 0, page: 1, totalPages: 1, cases: [] },
      { stage: 'ENCERRADO', total: 1, page: 1, totalPages: 1, cases: [makeCase('case-c', '0003/2026')] },
    ],
  };
}

function revalidateCallCount(): number {
  return mocks.mutate.mock.calls.filter((call) => call.length === 0).length;
}

describe('useCrmBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mocks.keys.length = 0;
    mocks.data = undefined;
    mocks.realtime.callback = null;
    mocks.supabaseEnabled = true;
    mocks.mutate.mockImplementation(
      async (
        fn: unknown,
        options?: { optimisticData?: (data: unknown) => unknown; rollbackOnError?: boolean }
      ) => {
        if (typeof fn !== 'function') return undefined;
        const before = mocks.data;
        if (options?.optimisticData) mocks.data = options.optimisticData(before) as typeof mocks.data;
        try {
          const result = await (fn as (data: unknown) => unknown)(before);
          mocks.data = result as typeof mocks.data;
          return result;
        } catch (e) {
          if (options?.rollbackOnError) mocks.data = before;
          throw e;
        }
      }
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('busca o board em /api/crm/board sem filtros por padrão', () => {
    renderHook(() => useCrmBoard());
    expect(mocks.keys[mocks.keys.length - 1]).toBe('/api/crm/board');
  });

  it('filtros alterados geram nova chave SWR com query params (busca com debounce)', () => {
    const { result } = renderHook(() => useCrmBoard());

    act(() => {
      result.current.setFilters({ search: 'maria' });
    });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(mocks.keys[mocks.keys.length - 1]).toBe('/api/crm/board');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(mocks.keys[mocks.keys.length - 1]).toBe('/api/crm/board?search=maria');

    act(() => {
      result.current.setFilters({ operator: 'unassigned', priority: 'alta' });
    });
    expect(mocks.keys[mocks.keys.length - 1]).toBe(
      '/api/crm/board?search=maria&operator=unassigned&priority=alta'
    );
  });

  it('inclui tenant_id na chave quando informado', () => {
    renderHook(() => useCrmBoard({ tenantId: 'tenant-1' }));
    expect(mocks.keys[mocks.keys.length - 1]).toBe('/api/crm/board?tenant_id=tenant-1');
  });

  it('moveCase com sucesso: migra o card entre colunas no cache e chama PATCH com expectedStageId', async () => {
    mocks.data = makeBoard();
    mocks.fetchWithAuth.mockResolvedValue({ ok: true, json: async () => ({ case: { id: 'case-a' } }) });

    const { result } = renderHook(() => useCrmBoard());

    let moveResult: unknown = null;
    await act(async () => {
      moveResult = await result.current.moveCase('case-a', '0001/2026', 'NOVO', 'EM_CONTATO');
    });

    expect(moveResult).toBeNull();
    expect(mocks.fetchWithAuth).toHaveBeenCalledWith(
      '/api/cases/case-a/stage',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ stageId: 'EM_CONTATO', expectedStageId: 'NOVO' }),
      })
    );

    const columns = mocks.data?.columns ?? [];
    const novo = columns.find((c) => c.stage === 'NOVO');
    const emContato = columns.find((c) => c.stage === 'EM_CONTATO');
    expect(novo?.cases.map((c) => c.id)).toEqual(['case-b']);
    expect(novo?.total).toBe(1);
    expect(emContato?.cases.map((c) => c.id)).toEqual(['case-a']);
    expect(emContato?.total).toBe(1);
  });

  it('moveCase com 409: faz rollback do cache, revalida e expõe a etapa atual', async () => {
    mocks.data = makeBoard();
    mocks.fetchWithAuth.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: 'O caso foi movido por outro operador.',
        code: 'STAGE_CONFLICT',
        currentStage: 'EM_NEGOCIACAO',
      }),
    });

    const { result } = renderHook(() => useCrmBoard());
    const original = JSON.parse(JSON.stringify(mocks.data));

    let moveResult: { error_code: string; message: string; currentStage?: string } | null = null;
    await act(async () => {
      moveResult = await result.current.moveCase('case-a', '0001/2026', 'NOVO', 'EM_CONTATO');
    });

    expect(moveResult).toEqual({
      error_code: 'STAGE_CONFLICT',
      message: 'O caso foi movido por outro operador.',
      currentStage: 'EM_NEGOCIACAO',
    });
    expect(mocks.data).toEqual(original);
    expect(revalidateCallCount()).toBe(1);
  });

  it('moveCase com transição inválida bloqueia o PATCH antes de qualquer requisição', async () => {
    mocks.data = makeBoard();
    const { result } = renderHook(() => useCrmBoard());

    const moveResult: { value: { error_code: string } | null } = { value: null };
    await act(async () => {
      moveResult.value = await result.current.moveCase('case-a', '0001/2026', 'ENCERRADO', 'NOVO');
    });

    expect(moveResult.value?.error_code).toBe('INVALID_TRANSITION');
    expect(mocks.fetchWithAuth).not.toHaveBeenCalled();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it('loadMore pagina apenas a coluna indicada e anexa os novos casos', async () => {
    mocks.data = makeBoard();
    const nextPageCase = makeCase('case-d', '0004/2026');
    mocks.fetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({
        columns: [{ stage: 'NOVO', total: 2, page: 2, totalPages: 2, cases: [nextPageCase] }],
      }),
    });

    const { result } = renderHook(() => useCrmBoard());

    await act(async () => {
      await result.current.loadMore('NOVO');
    });

    expect(mocks.fetchWithAuth).toHaveBeenCalledWith('/api/crm/board?stage=NOVO&page=2');

    const columns = mocks.data?.columns ?? [];
    const novo = columns.find((c) => c.stage === 'NOVO');
    const emContato = columns.find((c) => c.stage === 'EM_CONTATO');
    expect(novo?.page).toBe(2);
    expect(novo?.cases.map((c) => c.id)).toEqual(['case-a', 'case-b', 'case-d']);
    expect(emContato?.cases).toEqual([]);
  });

  it('evento realtime de UPDATE revalida o board com debounce', () => {
    const { unmount } = renderHook(() => useCrmBoard());
    expect(mocks.realtime.callback).not.toBeNull();

    act(() => {
      mocks.realtime.callback?.();
    });
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(revalidateCallCount()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(revalidateCallCount()).toBe(1);

    unmount();
    expect(mocks.removeChannel).toHaveBeenCalled();
  });

  it('realtime não é assinado quando o client Supabase não existe (modo demo)', () => {
    mocks.supabaseEnabled = false;
    const { unmount } = renderHook(() => useCrmBoard());
    unmount();
    expect(mocks.channel.subscribe).not.toHaveBeenCalled();
    mocks.supabaseEnabled = true;
  });

  it('retorna colunas vazias e filtros padrão quando não há dados em cache', () => {
    mocks.data = undefined;
    const { result } = renderHook(() => useCrmBoard());
    expect(result.current.columns).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.filters).toEqual({ search: '', operator: 'all', priority: 'all' });
  });
});
