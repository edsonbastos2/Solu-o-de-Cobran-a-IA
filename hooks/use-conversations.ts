'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type {
  ConversationActionResult,
  ConversationDetailResponse,
  ConversationFilter,
  ConversationListParams,
  ConversationsListResponse,
} from '@/lib/types';

export interface UseConversationsOptions extends Omit<ConversationListParams, 'tenant_id'> {
  tenantId?: string | null;
}

function buildQueryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

/**
 * Lista de conversas da Central: SWR com filtros, busca com debounce (300ms),
 * paginação e polling de segurança (10s). Realtime revalida via `mutate`.
 */
export function useConversations(options: UseConversationsOptions = {}) {
  const { tenantId, ...params } = options;
  const [searchInput, setSearchInput] = useState(params.search ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(params.search ?? '');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const queryParams = useMemo(
    () =>
      buildQueryString({
        page: params.page ?? 1,
        limit: params.limit ?? 20,
        search: debouncedSearch || undefined,
        filter: params.filter ?? 'all',
        assignee: params.assignee,
        tenant_id: tenantId,
      }),
    [params.page, params.limit, debouncedSearch, params.filter, params.assignee, tenantId]
  );

  const { data, error, isLoading, mutate, isValidating } = useSWR<ConversationsListResponse>(
    tenantId === undefined ? null : `/api/conversations${queryParams}`,
    fetcher,
    { refreshInterval: 10_000, keepPreviousData: true, revalidateOnFocus: false }
  );

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const channel = client.channel(`conversations-list-${tenantId ?? 'all'}`);
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => mutate())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cases' }, () => mutate())
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [tenantId, mutate]);

  const refetch = useCallback(() => mutate(), [mutate]);

  return {
    conversations: data?.conversations ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? params.page ?? 1,
    totalPages: data?.totalPages ?? 1,
    isLoading,
    isValidating,
    error,
    refetch,
    searchInput,
    setSearchInput,
  };
}

export type ConversationActionState = {
  loading: boolean;
  error: string | null;
  conflict: boolean;
};

const IDLE_ACTION: ConversationActionState = { loading: false, error: null, conflict: false };

/**
 * Conversa aberta da Central: SWR (polling 4s + realtime em messages/cases) e
 * ações (enviar, assumir, devolver, transferir, marcar leitura) com estado e
 * tratamento de conflito de versão (409).
 */
export function useConversation(caseId: string | null, tenantId?: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ConversationDetailResponse>(
    caseId ? `/api/conversations/${caseId}${tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : ''}` : null,
    fetcher,
    { refreshInterval: 4_000, revalidateOnFocus: false }
  );

  const [actionState, setActionState] = useState<ConversationActionState>(IDLE_ACTION);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const markedRef = useRef<string | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!client || !caseId) return;
    const channel = client.channel(`conversation-${caseId}`);
    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `case_id=eq.${caseId}` },
        () => mutate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cases', filter: `id=eq.${caseId}` },
        () => mutate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_events', filter: `case_id=eq.${caseId}` },
        () => mutate()
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [caseId, mutate]);

  // Marca como lida ao abrir a conversa quando há não lidas.
  useEffect(() => {
    if (!caseId || !data || data.unreadCount === 0) return;
    if (markedRef.current === `${caseId}:${data.messages.length}`) return;
    markedRef.current = `${caseId}:${data.messages.length}`;
    void fetch(
      `/api/conversations/${caseId}/read${tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : ''}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
    ).then(() => mutate());
  }, [caseId, data, mutate, tenantId]);

  const runAction = useCallback(
    async (
      path: string,
      body: Record<string, unknown>,
      onConflict?: () => void
    ): Promise<ConversationActionResult | null> => {
      setActionState({ loading: true, error: null, conflict: false });
      try {
        const res = await fetch(
          `/api/conversations/${caseId}/${path}${tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : ''}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        );
        if (res.ok) {
          setActionState(IDLE_ACTION);
          await mutate();
          return { ok: true, conversation: (await res.json()) as ConversationDetailResponse };
        }
        const payload = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        const conflict = res.status === 409;
        setActionState({ loading: false, error: payload.error ?? 'Não foi possível concluir a ação.', conflict });
        if (conflict) {
          await mutate();
          onConflict?.();
        }
        return { ok: false, error_code: (payload.code as never) ?? 'INTERNAL_ERROR' };
      } catch {
        setActionState({ loading: false, error: 'Falha de conexão. Tente novamente.', conflict: false });
        return null;
      }
    },
    [caseId, mutate, tenantId]
  );

  const takeOver = useCallback(
    (expectedVersion: number) =>
      runAction('takeover', { expectedVersion, ...(tenantId ? { tenant_id: tenantId } : {}) }),
    [runAction, tenantId]
  );

  const returnToAI = useCallback(
    (expectedVersion: number) =>
      runAction('return-to-ai', { expectedVersion, ...(tenantId ? { tenant_id: tenantId } : {}) }),
    [runAction, tenantId]
  );

  const transfer = useCallback(
    (input: { toOperatorId: string; reason?: string; expectedVersion: number }) =>
      runAction('transfer', { ...input, ...(tenantId ? { tenant_id: tenantId } : {}) }),
    [runAction, tenantId]
  );

  const sendMessage = useCallback(
    async (message: string): Promise<boolean> => {
      if (!caseId || !message.trim()) return false;
      setSending(true);
      setSendError(null);
      try {
        const res = await fetch('/api/agent-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ caseId, message, ...(tenantId ? { tenant_id: tenantId } : {}) }),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as { error?: string };
          setSendError(payload.error ?? 'Não foi possível enviar a mensagem.');
          return false;
        }
        await mutate();
        return true;
      } catch {
        setSendError('Falha de conexão. A mensagem não foi enviada.');
        return false;
      } finally {
        setSending(false);
      }
    },
    [caseId, mutate, tenantId]
  );

  return {
    conversation: data ?? null,
    isLoading,
    error,
    refetch: mutate,
    action: actionState,
    sending,
    sendError,
    sendMessage,
    takeOver,
    returnToAI,
    transfer,
  };
}
