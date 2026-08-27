'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CrmStage } from '@/lib/crm/stages';
import type { CrmBoardCase } from '@/lib/types';
import { cn, formatCurrency } from '@/lib/utils';
import { CrmCardActions } from './crm-card-actions';

const PRIORITY_STYLES: Record<CrmBoardCase['priority'], string> = {
  alta: 'bg-red-500',
  media: 'bg-amber-400',
  baixa: 'bg-gray-300',
};

function getRelativeTime(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
}

function formatDueDate(value: string): string {
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  return format(date, 'dd/MM/yyyy');
}

export interface CrmCaseCardContentProps {
  caseData: CrmBoardCase;
}

export function CrmCaseCardContent({ caseData }: CrmCaseCardContentProps) {
  return (
    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex items-center gap-1.5">
        <span
          data-testid={`crm-card-priority-${caseData.id}`}
          aria-label={`Prioridade ${caseData.priority}`}
          className={cn('h-2 w-2 shrink-0 rounded-full', PRIORITY_STYLES[caseData.priority])}
        />
        <span className="truncate text-xs font-semibold text-gray-500">{caseData.caseNumber}</span>
        {caseData.controller && (
          <span
            data-testid={`crm-card-controller-${caseData.id}`}
            className={cn(
              'shrink-0 text-xs font-medium',
              caseData.controller === 'ai' ? 'text-emerald-700' : 'text-sky-700'
            )}
          >
            {caseData.controller === 'ai' ? '🤖 IA' : '👤 Humano'}
          </span>
        )}
      </div>

      <p className="truncate text-sm font-medium text-gray-900">{caseData.clientName}</p>
      <p className="truncate text-xs text-gray-500">{caseData.clientDocumentMasked}</p>

      <div className="flex items-center justify-between gap-2 text-xs">
        <span data-testid={`crm-card-value-${caseData.id}`} className="font-semibold text-gray-900">
          {formatCurrency(caseData.currentValue)}
        </span>
        <span data-testid={`crm-card-due-${caseData.id}`} className="shrink-0 text-gray-500">
          Vence {formatDueDate(caseData.dueDate)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs">
        <span data-testid={`crm-card-last-contact-${caseData.id}`} className="truncate text-gray-400">
          {caseData.lastContactAt ? getRelativeTime(caseData.lastContactAt) : 'Sem contato'}
        </span>
        {caseData.assignee && (
          <span
            data-testid={`crm-card-assignee-${caseData.id}`}
            className="truncate font-medium text-gray-600"
          >
            {caseData.assignee.name}
          </span>
        )}
      </div>
    </div>
  );
}

export interface CrmCaseCardProps {
  caseData: CrmBoardCase;
  stage: CrmStage;
  tenantPath?: string;
  onMoveCase: (move: {
    caseId: string;
    caseNumber: string;
    fromStage: CrmStage;
    toStage: CrmStage;
  }) => void;
  onOpenDetails: (caseData: CrmBoardCase) => void;
  onTransfer: (caseData: CrmBoardCase) => void;
}

export function CrmCaseCard({
  caseData,
  stage,
  tenantPath,
  onMoveCase,
  onOpenDetails,
  onTransfer,
}: CrmCaseCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: caseData.id });

  return (
    <div
      ref={(node: HTMLDivElement | null) => {
        setNodeRef(node);
        setActivatorNodeRef(node);
      }}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      data-testid={`crm-case-card-${caseData.id}`}
      aria-label={`Caso ${caseData.caseNumber}`}
      onClick={() => onOpenDetails(caseData)}
      className={cn(
        'flex cursor-pointer items-start gap-1 rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm transition-colors hover:border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
        isDragging && 'opacity-40'
      )}
    >
      <CrmCaseCardContent caseData={caseData} />
      <CrmCardActions
        caseData={caseData}
        stage={stage}
        tenantPath={tenantPath}
        onMoveToStage={(toStage) =>
          onMoveCase({
            caseId: caseData.id,
            caseNumber: caseData.caseNumber,
            fromStage: stage,
            toStage,
          })
        }
        onTransfer={() => onTransfer(caseData)}
      />
    </div>
  );
}
