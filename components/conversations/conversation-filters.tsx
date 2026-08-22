'use client';

import { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import type { ConversationFilter } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Aproximação de uma "linha" de scroll, para normalizar deltaMode=DOM_DELTA_LINE (Firefox). */
const WHEEL_LINE_HEIGHT = 16;

/**
 * Converte a roda vertical do mouse em scroll horizontal na régua de chips.
 *
 * Nenhum navegador faz isso sozinho (só com Shift pressionado), e o listener
 * precisa ser nativo e não-passivo: o `onWheel` do React é registrado como
 * passive no root, então um `preventDefault()` lá dentro é ignorado.
 */
function useWheelToHorizontalScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleWheel = (event: WheelEvent) => {
      // Ctrl+roda é zoom do navegador; trackpad com deltaX já rola na horizontal.
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 0) return;

      const delta =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? event.deltaY * WHEEL_LINE_HEIGHT
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? event.deltaY * el.clientWidth
            : event.deltaY;

      const next = Math.max(0, Math.min(maxScroll, el.scrollLeft + delta));
      // Já na ponta: deixa o evento seguir para o scroller de cima em vez de travá-lo.
      if (next === el.scrollLeft) return;

      event.preventDefault();
      el.scrollLeft = next;
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  return ref;
}

export const CONVERSATION_FILTER_LABELS: Record<ConversationFilter, string> = {
  all: 'Todas',
  unread: 'Não lidas',
  ai: 'IA conduzindo',
  human: 'Atendimento humano',
  waiting_debtor: 'Aguardando devedor',
  waiting_operator: 'Aguardando operador',
  negotiating: 'Em negociação',
  closed: 'Finalizadas',
  mine: 'Minhas conversas',
};

const FILTER_KEYS = Object.keys(CONVERSATION_FILTER_LABELS) as ConversationFilter[];

export interface ConversationFiltersProps {
  filter: ConversationFilter;
  onFilterChange: (filter: ConversationFilter) => void;
  search: string;
  onSearchChange: (search: string) => void;
  showAssignee: boolean;
  assignee?: string;
  onAssigneeChange?: (assignee: string) => void;
  operators: { id: string; name: string; role: string }[];
}

export function ConversationFilters({
  filter,
  onFilterChange,
  search,
  onSearchChange,
  showAssignee,
  assignee,
  onAssigneeChange,
  operators,
}: ConversationFiltersProps) {
  const chipsRef = useWheelToHorizontalScroll<HTMLDivElement>();

  return (
    <div className="flex flex-col gap-2 border-b border-gray-100 bg-white px-4 py-2.5">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        />
        <input
          type="search"
          aria-label="Buscar conversas"
          placeholder="Buscar por nome ou mensagem..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* Linha única com scroll horizontal: em coluna de ~320px os 9 chips
          quebravam em 5 linhas e comiam ~150px da altura útil da lista. */}
      <div
        ref={chipsRef}
        role="group"
        aria-label="Filtros de conversa"
        data-testid="conversation-filter-chips"
        className="-mx-1 flex gap-1.5 overflow-x-auto overscroll-x-contain px-1 pb-1 [scrollbar-width:thin]"
      >
        {FILTER_KEYS.map((key) => {
          const isActive = filter === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={isActive}
              onClick={() => onFilterChange(key)}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                isActive
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              {CONVERSATION_FILTER_LABELS[key]}
            </button>
          );
        })}
      </div>

      {showAssignee && (
        <div>
          <label htmlFor="conversation-assignee-filter" className="sr-only">
            Filtrar por responsável
          </label>
          <select
            id="conversation-assignee-filter"
            value={assignee ?? ''}
            onChange={(event) => onAssigneeChange?.(event.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">Todos os responsáveis</option>
            {operators.map((operator) => (
              <option key={operator.id} value={operator.id}>
                {operator.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
