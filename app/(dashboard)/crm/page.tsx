'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useActiveTenant } from '@/hooks/use-active-tenant';
import { useCrmBoard } from '@/hooks/use-crm-board';
import type { CrmBoardFilters } from '@/hooks/use-crm-board';
import { useCrmStats } from '@/hooks/use-crm-stats';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { fetcher } from '@/lib/api';
import type { ConversationDetailResponse, CrmBoardCase } from '@/lib/types';
import { CrmBoard } from '@/components/crm/crm-board';
import type { CrmMoveRequest } from '@/components/crm/crm-board';
import { CrmFilters } from '@/components/crm/crm-filters';
import { CrmStatsPanel } from '@/components/crm/crm-stats';
import { CrmTransferDialog } from '@/components/crm/crm-transfer-dialog';

const ROLE_RANK: Record<string, number> = { owner: 4, admin: 3, gestor: 2, operador: 1 };

const TOAST_DURATION_MS = 5000;
const SKELETON_COLUMNS = 5;

export default function CrmPage() {
  const router = useRouter();
  const { user, role, tenantId, tenantPath, tenantQuery, needsTenantSelection } = useActiveTenant();
  const canFilterByOperator = Boolean(role && (ROLE_RANK[role] ?? 0) >= ROLE_RANK.gestor);

  const { members } = useTeamMembers(tenantId, tenantQuery);
  const operators = useMemo(
    () =>
      members
        .filter((member) => member.status === 'active')
        .map((member) => ({ id: member.userId, name: member.name ?? member.email ?? 'Sem nome' })),
    [members]
  );

  const { columns, isLoading, error, filters, setFilters, loadMore, moveCase, refresh } = useCrmBoard({
    tenantId,
  });
  const { stats, isLoading: statsLoading } = useCrmStats({ tenantId });

  const [transferTarget, setTransferTarget] = useState<CrmBoardCase | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const { data: conversationData } = useSWR<ConversationDetailResponse>(
    transferTarget ? `/api/conversations/${transferTarget.id}${tenantQuery ? `?${tenantQuery}` : ''}` : null,
    fetcher
  );

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleMoveCase = useCallback(
    async (move: CrmMoveRequest) => {
      const failure = await moveCase(move.caseId, move.caseNumber, move.fromStage, move.toStage);
      if (!failure) return;
      setToast(
        failure.error_code === 'STAGE_CONFLICT'
          ? `Caso ${move.caseNumber} atualizado por outro operador — atualizando`
          : failure.message
      );
    },
    [moveCase]
  );

  const handleFiltersChange = useCallback(
    (next: CrmBoardFilters) => setFilters(next),
    [setFilters]
  );

  const handleTransferUpdate = useCallback(() => {
    setToast(`Caso ${transferTarget?.caseNumber ?? ''} transferido.`);
    void refresh();
  }, [refresh, transferTarget]);

  if (needsTenantSelection) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-8">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-3 h-12 w-12 text-amber-500" aria-hidden="true" />
          <h1 className="text-lg font-bold text-gray-900">Selecione um tenant para continuar</h1>
          <p className="mt-2 text-sm text-gray-500">O CRM de Cobrança exige um tenant ativo para usuários super-admin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden p-2 sm:p-3">
      <h1 className="sr-only">CRM de Cobrança</h1>

      <CrmStatsPanel stats={stats} isLoading={statsLoading} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <CrmFilters
          filters={filters}
          onChange={handleFiltersChange}
          operators={operators}
          canFilterByOperator={canFilterByOperator}
        />

        <div className="min-h-0 flex-1 p-3">
          {error ? (
            <div
              data-testid="crm-board-error"
              className="flex h-full flex-col items-center justify-center gap-3 text-center"
            >
              <AlertCircle className="h-10 w-10 text-red-400" aria-hidden="true" />
              <p className="text-sm font-medium text-gray-700">Não foi possível carregar o board.</p>
              <button
                type="button"
                data-testid="crm-board-retry"
                onClick={() => void refresh()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Tentar novamente
              </button>
            </div>
          ) : isLoading ? (
            <div data-testid="crm-board-skeleton" className="flex h-full gap-3 overflow-hidden">
              {Array.from({ length: SKELETON_COLUMNS }).map((_, index) => (
                <div
                  key={index}
                  className="h-full w-[260px] shrink-0 animate-pulse rounded-xl border border-gray-200 bg-gray-100 sm:w-[280px]"
                />
              ))}
            </div>
          ) : (
            <CrmBoard
              columns={columns}
              tenantPath={tenantPath}
              onMoveCase={(move) => void handleMoveCase(move)}
              onLoadMore={(stage) => void loadMore(stage)}
              onOpenDetails={(caseData) => router.push(`/cases/${caseData.id}${tenantPath ?? ''}`)}
              onTransfer={(caseData) => setTransferTarget(caseData)}
            />
          )}
        </div>
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          data-testid="crm-toast"
          className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-800 shadow-lg"
        >
          {toast}
        </div>
      )}

      <CrmTransferDialog
        open={transferTarget !== null}
        caseId={transferTarget?.id ?? null}
        caseNumber={transferTarget?.caseNumber ?? ''}
        operators={operators}
        currentUserId={user?.id}
        currentOperatorName={transferTarget?.assignee?.name ?? null}
        expectedVersion={conversationData?.conversationVersion ?? null}
        tenantId={tenantId}
        onClose={() => setTransferTarget(null)}
        onUpdate={handleTransferUpdate}
      />
    </div>
  );
}
