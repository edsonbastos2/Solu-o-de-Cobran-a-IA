'use client';

import { useDroppable } from '@dnd-kit/core';
import type { CrmStage, CrmStageMeta } from '@/lib/crm/stages';
import type { CrmBoardCase, CrmBoardColumn } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CrmCaseCard } from './crm-case-card';

export interface CrmColumnProps {
  meta: CrmStageMeta;
  column: CrmBoardColumn;
  tenantPath?: string;
  onMoveCase: (move: {
    caseId: string;
    caseNumber: string;
    fromStage: CrmStage;
    toStage: CrmStage;
  }) => void;
  onLoadMore: (stage: CrmStage) => void;
  onOpenDetails: (caseData: CrmBoardCase) => void;
  onTransfer: (caseData: CrmBoardCase) => void;
}

export function CrmColumn({
  meta,
  column,
  tenantPath,
  onMoveCase,
  onLoadMore,
  onOpenDetails,
  onTransfer,
}: CrmColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: meta.id });
  const isException = meta.kind === 'exception';

  return (
    <section
      ref={setNodeRef}
      data-stage={meta.id}
      data-kind={meta.kind}
      data-testid={`crm-column-${meta.id}`}
      aria-label={`${meta.label}: ${column.total} caso${column.total === 1 ? '' : 's'}`}
      className={cn(
        'flex h-full w-[260px] shrink-0 flex-col rounded-xl border sm:w-[280px]',
        isException ? 'border-amber-200 bg-amber-50/60' : 'border-gray-200 bg-gray-50/60',
        isOver && 'ring-2 ring-emerald-400'
      )}
    >
      <header
        data-testid={`crm-column-header-${meta.id}`}
        className={cn(
          'flex items-center justify-between gap-2 rounded-t-xl border-b px-3 py-2',
          isException
            ? 'border-amber-200 bg-amber-100/70 text-amber-900'
            : 'border-gray-200 bg-white text-gray-700'
        )}
      >
        <h2 className="truncate text-xs font-semibold uppercase tracking-wide">{meta.label}</h2>
        <span
          data-testid={`crm-column-count-${meta.id}`}
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
            isException ? 'bg-amber-200 text-amber-900' : 'bg-gray-100 text-gray-600'
          )}
        >
          {column.total}
        </span>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {column.cases.map((caseData) => (
          <CrmCaseCard
            key={caseData.id}
            caseData={caseData}
            stage={meta.id}
            tenantPath={tenantPath}
            onMoveCase={onMoveCase}
            onOpenDetails={onOpenDetails}
            onTransfer={onTransfer}
          />
        ))}

        {column.cases.length === 0 && (
          <p
            data-testid={`crm-column-empty-${meta.id}`}
            className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-400"
          >
            Nenhum caso nesta etapa
          </p>
        )}

        {column.page < column.totalPages && (
          <button
            type="button"
            data-testid={`crm-load-more-${meta.id}`}
            onClick={() => onLoadMore(meta.id)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            Carregar mais
          </button>
        )}
      </div>
    </section>
  );
}
