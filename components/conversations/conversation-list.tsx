'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import type { ConversationListItem } from '@/lib/types';
import { ConversationItem } from './conversation-list-item';

export interface ConversationListProps {
  items: ConversationListItem[];
  selectedId?: string | null;
  onSelect: (caseId: string) => void;
  isLoading: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Usado para destacar "Nova atribuição": atribuída a mim + não lida + último evento TRANSFERRED. */
  currentUserId?: string | null;
}

function buildOptionId(caseId: string): string {
  return `conversation-option-${caseId}`;
}

function isNewAssignment(item: ConversationListItem, currentUserId?: string | null): boolean {
  return (
    item.controller === 'human' &&
    item.currentOperator?.id === currentUserId &&
    item.unreadCount > 0 &&
    item.lastEventType === 'TRANSFERRED'
  );
}

function ConversationListSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-4 p-4">
      <span className="sr-only">Carregando conversas</span>
      {[0, 1, 2, 3, 4].map((index) => (
        <div key={index} className="flex items-center gap-3" aria-hidden="true">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConversationList({
  items,
  selectedId,
  onSelect,
  isLoading,
  error,
  onRetry,
  currentUserId,
}: ConversationListProps) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    if (items.length === 0) return;
    event.preventDefault();
    const currentIndex = selectedId ? items.findIndex((item) => item.case.id === selectedId) : -1;
    const delta = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex =
      currentIndex === -1
        ? 0
        : Math.min(items.length - 1, Math.max(0, currentIndex + delta));
    if (nextIndex !== currentIndex) {
      onSelect(items[nextIndex].case.id);
    }
  };

  if (isLoading) {
    return <ConversationListSkeleton />;
  }

  if (error) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 px-4 py-10 text-center">
        <AlertCircle className="h-8 w-8 text-red-500" aria-hidden="true" />
        <p className="text-sm text-gray-600">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Tentar novamente
          </button>
        )}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div data-testid="conversations-empty" className="px-4 py-10 text-center text-sm text-gray-500">
        Nenhuma conversa encontrada.
      </div>
    );
  }

  return (
    <div
      role="listbox"
      aria-label="Lista de conversas"
      aria-activedescendant={selectedId ? buildOptionId(selectedId) : undefined}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="focus:outline-none"
    >
      {items.map((item) => (
        <ConversationItem
          key={item.case.id}
          item={item}
          selected={item.case.id === selectedId}
          onSelect={onSelect}
          optionId={buildOptionId(item.case.id)}
          isNewAssignment={isNewAssignment(item, currentUserId)}
        />
      ))}
    </div>
  );
}
