import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CrmStats } from '@/lib/types';

const mocks = vi.hoisted(() => ({ keys: [] as (string | null)[] }));

vi.mock('swr', () => ({
  __esModule: true,
  default: (key: string | null) => {
    mocks.keys.push(key);
    return {
      data: {
        stats: {
          totalCases: 10,
          negotiating: 4,
          awaitingPayment: 2,
          negotiationsCreated: 8,
          negotiationsAccepted: 3,
          promises: 2,
          paymentsConfirmed: 1,
          recoveredValue: 1500.5,
        } satisfies CrmStats,
      },
      error: undefined,
      isLoading: false,
    };
  },
}));

vi.mock('@/lib/api', () => ({
  fetcher: vi.fn(),
}));

import { useCrmStats } from './use-crm-stats';

describe('useCrmStats', () => {
  it('busca /api/crm/stats e expõe os indicadores', () => {
    const { result } = renderHook(() => useCrmStats());

    expect(mocks.keys[mocks.keys.length - 1]).toBe('/api/crm/stats');
    expect(result.current.stats?.totalCases).toBe(10);
    expect(result.current.stats?.recoveredValue).toBe(1500.5);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it('inclui tenant_id na chave quando informado', () => {
    renderHook(() => useCrmStats({ tenantId: 'tenant-1' }));
    expect(mocks.keys[mocks.keys.length - 1]).toBe('/api/crm/stats?tenant_id=tenant-1');
  });
});
