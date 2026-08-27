'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRightLeft, Eye, MessageCircle, MoreHorizontal } from 'lucide-react';
import { CRM_STAGE_META, canTransition } from '@/lib/crm/stages';
import type { CrmStage } from '@/lib/crm/stages';
import type { CrmBoardCase } from '@/lib/types';

export interface CrmCardActionsProps {
  caseData: CrmBoardCase;
  stage: CrmStage;
  tenantPath?: string;
  onMoveToStage: (toStage: CrmStage) => void;
  onTransfer: () => void;
}

export function CrmCardActions({
  caseData,
  stage,
  tenantPath,
  onMoveToStage,
  onTransfer,
}: CrmCardActionsProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('button, a')?.focus();
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const destinations = CRM_STAGE_META.filter((meta) => canTransition(stage, meta.id));
  const tenantSuffix = tenantPath ? `&${tenantPath.replace(/^\?/, '')}` : '';
  const conversationHref = `/conversations?case=${caseData.id}${tenantSuffix}`;
  const detailsHref = `/cases/${caseData.id}${tenantPath ?? ''}`;

  const closeMenu = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div
      ref={containerRef}
      className="relative shrink-0"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        data-testid={`crm-card-actions-${caseData.id}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Ações do caso ${caseData.caseNumber}`}
        onClick={() => setOpen((current) => !current)}
        className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Ações do caso ${caseData.caseNumber}`}
          data-testid={`crm-card-menu-${caseData.id}`}
          className="absolute right-0 top-8 z-20 w-56 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg"
        >
          <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Mover para etapa
          </p>
          {destinations.length === 0 ? (
            <p
              data-testid={`crm-move-unavailable-${caseData.id}`}
              className="px-2.5 py-1.5 text-xs text-gray-400"
            >
              Nenhuma etapa disponível
            </p>
          ) : (
            destinations.map((meta) => (
              <button
                key={meta.id}
                type="button"
                role="menuitem"
                data-testid={`crm-move-to-${meta.id}`}
                onClick={() => {
                  closeMenu();
                  onMoveToStage(meta.id);
                }}
                className="block w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                {meta.label}
              </button>
            ))
          )}

          <div className="my-1 border-t border-gray-100" />

          <button
            type="button"
            role="menuitem"
            data-testid={`crm-card-action-transfer-${caseData.id}`}
            onClick={() => {
              closeMenu();
              onTransfer();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <ArrowRightLeft className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
            Transferir
          </button>

          <Link
            role="menuitem"
            data-testid={`crm-card-action-conversation-${caseData.id}`}
            href={conversationHref}
            onClick={closeMenu}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <MessageCircle className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            Abrir conversa
          </Link>

          <Link
            role="menuitem"
            data-testid={`crm-card-action-details-${caseData.id}`}
            href={detailsHref}
            onClick={closeMenu}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <Eye className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
            Abrir detalhes
          </Link>
        </div>
      )}
    </div>
  );
}
