'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher, fetchWithAuth } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { canTransition } from '@/lib/crm/stages';
import type { CrmPriority, CrmStage } from '@/lib/crm/stages';
import type { CrmBoardColumn } from '@/lib/types';

export interface CrmBoardFilters {
  search: string;
  operator: string;
  priority: 'all' | CrmPriority;
}

export const EMPTY_CRM_FILTERS: CrmBoardFilters = { search: '', operator: 'all', priority: 'all' };

export type CrmMoveErrorCode =
  | 'INVALID_TRANSITION'
  | 'STAGE_CONFLICT'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'INTERNAL_ERROR';

export interface CrmMoveError {
  error_code: CrmMoveErrorCode;
  message: string;
  currentStage?: CrmStage;
}

export interface CrmMoveOptions {
  reason?: string;
}

interface CrmBoardResponse {
  columns: CrmBoardColumn[];
}

export interface UseCrmBoardOptions {
  tenantId?: string | null;
}

const SEARCH_DEBOUNCE_MS = 300;
const REALTIME_DEBOUNCE_MS = 500;

function moveCaseBetweenColumns(
  data: CrmBoardResponse | undefined,
  caseId: string,
  fromStage: CrmStage,
  toStage: CrmStage
): CrmBoardResponse | undefined {
  if (!data) return data;
  const origin = data.columns.find((column) => column.stage === fromStage);
  const moving = origin?.cases.find((item) => item.id === caseId);
  if (!moving) return data;
  return {
    columns: data.columns.map((column) => {
      if (column.stage === fromStage) {
        return {
          ...column,
          total: Math.max(0, column.total - 1),
          cases: column.cases.filter((item) => item.id !== caseId),
        };
      }
      if (column.stage === toStage) {
        return { ...column, total: column.total + 1, cases: [...column.cases, moving] };
      }
      return column;
    }),
  };
}

export function useCrmBoard(options: UseCrmBoardOptions = {}) {
  const { tenantId } = options;
  const [filters, setFiltersState] = useState<CrmBoardFilters>(EMPTY_CRM_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (filters.operator && filters.operator !== 'all') params.set('operator', filters.operator);
    if (filters.priority !== 'all') params.set('priority', filters.priority);
    if (tenantId) params.set('tenant_id', tenantId);
    const query = params.toString();
    return query ? `?${query}` : '';
  }, [debouncedSearch, filters.operator, filters.priority, tenantId]);

  const { data, error, isLoading, mutate } = useSWR<CrmBoardResponse>(
    `/api/crm/board${queryString}`,
    fetcher,
    { keepPreviousData: true, revalidateOnFocus: false }
  );

  const setFilters = useCallback((update: Partial<CrmBoardFilters>) => {
    setFiltersState((current) => ({ ...current, ...update }));
  }, []);

  const loadMore = useCallback(
    async (stage: CrmStage) => {
      await mutate(
        async (currentData: CrmBoardResponse | undefined) => {
          const column = currentData?.columns.find((item) => item.stage === stage);
          if (!currentData || !column || column.page >= column.totalPages) return currentData;
          const params = new URLSearchParams(queryString.replace(/^\?/, ''));
          params.set('stage', stage);
          params.set('page', String(column.page + 1));
          const res = await fetchWithAuth(`/api/crm/board?${params.toString()}`);
          if (!res.ok) return currentData;
          const payload = (await res.json().catch(() => null)) as CrmBoardResponse | null;
          const nextColumn = payload?.columns.find((item) => item.stage === stage);
          if (!nextColumn) return currentData;
          return {
            columns: currentData.columns.map((item) =>
              item.stage === stage
                ? { ...nextColumn, cases: [...column.cases, ...nextColumn.cases] }
                : item
            ),
          };
        },
        { revalidate: false }
      );
    },
    [mutate, queryString]
  );

  const moveCase = useCallback(
    async (
      caseId: string,
      caseNumber: string,
      fromStage: CrmStage,
      toStage: CrmStage,
      opts?: CrmMoveOptions
    ): Promise<CrmMoveError | null> => {
      if (!canTransition(fromStage, toStage)) {
        return {
          error_code: 'INVALID_TRANSITION',
          message: `O caso ${caseNumber} não pode ir de ${fromStage} para ${toStage}.`,
        };
      }
      const failureRef: { current: CrmMoveError | null } = { current: null };
      try {
        await mutate(
          async (currentData: CrmBoardResponse | undefined) => {
            const res = await fetchWithAuth(`/api/cases/${caseId}/stage`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                stageId: toStage,
                expectedStageId: fromStage,
                ...(opts?.reason ? { reason: opts.reason } : {}),
              }),
            });
            if (!res.ok) {
              const payload = (await res.json().catch(() => ({}))) as {
                error?: string;
                code?: string;
                error_code?: string;
                currentStage?: CrmStage;
              };
              failureRef.current = {
                error_code: (payload.code ?? payload.error_code ?? 'INTERNAL_ERROR') as CrmMoveErrorCode,
                message: payload.error ?? `Não foi possível mover o caso ${caseNumber}.`,
                ...(payload.currentStage ? { currentStage: payload.currentStage } : {}),
              };
              throw new Error(payload.error ?? `Não foi possível mover o caso ${caseNumber}.`);
            }
            return moveCaseBetweenColumns(currentData, caseId, fromStage, toStage);
          },
          {
            optimisticData: (currentData: CrmBoardResponse | undefined): CrmBoardResponse =>
              moveCaseBetweenColumns(currentData, caseId, fromStage, toStage) ??
              currentData ?? { columns: [] },
            rollbackOnError: true,
            revalidate: false,
          }
        );
        return null;
      } catch {
        const failure: CrmMoveError | null = failureRef.current;
        if (failure?.error_code === 'STAGE_CONFLICT') {
          await mutate();
        }
        return (
          failure ?? { error_code: 'NETWORK_ERROR', message: 'Falha de conexão. Tente novamente.' }
        );
      }
    },
    [mutate]
  );

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = client
      .channel('realtime-crm-board')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'cases' }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => mutate(), REALTIME_DEBOUNCE_MS);
      })
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void client.removeChannel(channel);
    };
  }, [mutate]);

  const refresh = useCallback(() => mutate(), [mutate]);

  return {
    columns: data?.columns ?? [],
    isLoading,
    error,
    filters,
    setFilters,
    loadMore,
    moveCase,
    refresh,
  };
}
