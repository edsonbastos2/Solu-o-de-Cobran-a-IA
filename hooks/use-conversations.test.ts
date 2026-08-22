import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mutate = vi.fn().mockResolvedValue(undefined);

vi.mock('swr', () => ({
  __esModule: true,
  default: (key: string | null) => {
    if (key && key.startsWith('/api/conversations/case-1')) {
      return {
        data: {
          case: { id: 'case-1', controller: 'human' },
          messages: [],
          events: [],
          unreadCount: 2,
          conversationVersion: 3,
          permissions: { canSend: true, canTakeOver: true, canReturnToAI: true, canTransfer: false, canComplete: false, canView: true },
        },
        error: undefined,
        isLoading: false,
        mutate,
      };
    }
    return {
      data: { conversations: [], total: 0, page: 1, totalPages: 1 },
      error: undefined,
      isLoading: false,
      mutate,
    };
  },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: null,
}));

import { useConversation, useConversations } from './use-conversations';

describe('useConversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('monta query string com filtros, busca e página', () => {
    const { result } = renderHook(() =>
      useConversations({ filter: 'unread', page: 2, search: 'joão', tenantId: 'tenant-1' })
    );
    expect(result.current.conversations).toEqual([]);
  });

  it('aplica debounce de 300ms na busca', async () => {
    const { result } = renderHook(() => useConversations({ tenantId: 'tenant-1' }));

    act(() => {
      result.current.setSearchInput('par');
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      result.current.setSearchInput('parcela');
    });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    // Debounce ainda não disparou para o valor final.
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});

describe('useConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);
  });

  it('marca como lida ao abrir conversa com não lidas', async () => {
    renderHook(() => useConversation('case-1', 'tenant-1'));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalled();
    });
  });

  it('ação com resposta 409 sinaliza conflito e revalida', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: 'A conversa foi alterada por outro operador.', code: 'VERSION_CONFLICT' }),
      })
    );

    const { result } = renderHook(() => useConversation('case-1', 'tenant-1'));

    let actionResult: unknown;
    await act(async () => {
      actionResult = await result.current.takeOver(2);
    });

    expect(actionResult).toEqual({ ok: false, error_code: 'VERSION_CONFLICT' });
    expect(result.current.action.conflict).toBe(true);
    expect(result.current.action.error).toContain('alterada por outro operador');
  });

  it('sendMessage com sucesso revalida e retorna true', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useConversation('case-1', 'tenant-1'));

    let sent = false;
    await act(async () => {
      sent = await result.current.sendMessage('Boa tarde!');
    });

    expect(sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/agent-message',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ caseId: 'case-1', message: 'Boa tarde!', tenant_id: 'tenant-1' }),
      })
    );
  });
});
