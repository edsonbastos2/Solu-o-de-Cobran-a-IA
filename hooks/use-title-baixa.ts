'use client';

import { useCallback, useState } from 'react';

import { fetchWithAuth } from '@/lib/api';
import { FinancialTitlePatch } from '@/lib/types';

export function useTitleBaixaActions(tenantId: string | null, onSuccess?: () => void) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setbulkBusy] = useState(false);

  const patch = useCallback(
    async (titleId: string, payload: FinancialTitlePatch): Promise<boolean> => {
      setBusyId(titleId);
      try {
        const res = await fetchWithAuth(`/api/financial-titles/${titleId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, tenant_id: tenantId || undefined })
        });
        const data = await res.json().catch(() => null) as Record<string, unknown> | null;
        if (!res.ok) {
          alert((typeof data?.error === 'string' ? data.error : null) || 'Erro ao realizar a operação no título.');
          return false;
        }
        onSuccess?.();
        return true;
      } catch (err: unknown) {
        alert('Erro ao conectar com o servidor: ' + (err instanceof Error ? err.message : 'erro desconhecido'));
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [tenantId, onSuccess]
  );

  const baixaTotal = useCallback((titleId: string) => patch(titleId, { status: 'paid' }), [patch]);

  const baixaParcial = useCallback(
    (titleId: string, paidAmount: number) => patch(titleId, { status: 'partial', paid_amount: paidAmount }),
    [patch]
  );

  const cancelar = useCallback((titleId: string) => patch(titleId, { status: 'cancelled' }), [patch]);

  const baixaTotalEmMassa = useCallback(
    async (ids: string[]): Promise<void> => {
      setbulkBusy(true);
      const failures: { id: string; error: string }[] = [];
      try {
        for (const id of ids) {
          try {
            const res = await fetchWithAuth(`/api/financial-titles/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'paid', tenant_id: tenantId || undefined })
            });
            const data = await res.json().catch(() => null) as Record<string, unknown> | null;
            if (!res.ok) {
              failures.push({ id, error: (typeof data?.error === 'string' ? data.error : null) || 'Erro ao realizar a baixa total.' });
            }
          } catch (err: unknown) {
            failures.push({ id, error: err instanceof Error ? err.message : 'Erro de conexão.' });
          }
        }
      } finally {
        setbulkBusy(false);
      }
      if (failures.length > 0) {
        alert(`Concluído com ${failures.length} falha(s). ${failures[0].error}`);
      }
      onSuccess?.();
    },
    [tenantId, onSuccess]
  );

  return { busyId, bulkBusy, baixaTotal, baixaParcial, cancelar, baixaTotalEmMassa };
}