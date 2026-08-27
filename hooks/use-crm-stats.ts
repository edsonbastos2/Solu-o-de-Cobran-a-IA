'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import type { CrmStats } from '@/lib/types';

interface CrmStatsResponse {
  stats: CrmStats;
}

export interface UseCrmStatsOptions {
  tenantId?: string | null;
}

export function useCrmStats(options: UseCrmStatsOptions = {}) {
  const { tenantId } = options;
  const { data, error, isLoading } = useSWR<CrmStatsResponse>(
    `/api/crm/stats${tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : ''}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    stats: data?.stats ?? null,
    isLoading,
    error,
  };
}
