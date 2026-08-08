'use client';

import { useCallback, useState } from 'react';

import { fetchWithAuth } from '@/lib/api';

export type NegotiationAction = 'accept' | 'fulfill';

export function useNegotiationActions(tenantId: string | null, onSuccess?: () => void) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleTransition = useCallback(
    async (negotiationId: string, action: NegotiationAction) => {
      setUpdatingId(negotiationId);
      try {
        const res = await fetchWithAuth(`/api/negotiations/${negotiationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, tenant_id: tenantId || undefined })
        });
        const resData = await res.json();
        if (!res.ok) {
          alert(resData.error || 'Erro ao atualizar o acordo');
        } else {
          onSuccess?.();
        }
      } catch (err: unknown) {
        alert('Erro ao atualizar o acordo: ' + (err instanceof Error ? err.message : 'erro desconhecido'));
      } finally {
        setUpdatingId(null);
      }
    },
    [tenantId, onSuccess]
  );

  return { updatingId, handleTransition };
}