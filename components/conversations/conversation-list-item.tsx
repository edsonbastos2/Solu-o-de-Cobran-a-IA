'use client';

import { MessageCircle, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ConversationListItem } from '@/lib/types';
import { cn, formatCurrency } from '@/lib/utils';

const AVATAR_PALETTE = [
  'bg-emerald-100 text-emerald-700',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-teal-100 text-teal-700',
] as const;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getAvatarColor(name: string): string {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function getRelativeTime(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
}

function getControllerIndicator(item: ConversationListItem): { label: string; className: string } {
  if (item.controller === 'ai') {
    return { label: '🤖 IA', className: 'text-emerald-700' };
  }
  if (item.currentOperator) {
    return { label: `👤 ${item.currentOperator.name}`, className: 'text-sky-700' };
  }
  return { label: 'Sem responsável', className: 'text-gray-400' };
}

export interface ConversationItemProps {
  item: ConversationListItem;
  selected: boolean;
  onSelect: (caseId: string) => void;
  /** id do elemento usado pela lista para aria-activedescendant. */
  optionId?: string;
  /** Destaque "Nova atribuição" — derivado pelo consumidor (atribuída a mim + não lida + último evento TRANSFERRED). */
  isNewAssignment?: boolean;
}

export function ConversationItem({
  item,
  selected,
  onSelect,
  optionId,
  isNewAssignment = false,
}: ConversationItemProps) {
  const controller = getControllerIndicator(item);
  const timestamp = item.lastMessage?.created_at ?? item.case.created_at;

  return (
    <div
      id={optionId ?? `conversation-option-${item.case.id}`}
      data-testid={`conversation-item-${item.case.id}`}
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      onClick={() => onSelect(item.case.id)}
      className={cn(
        'flex w-full cursor-pointer items-start gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-gray-50',
        selected && 'bg-emerald-50 hover:bg-emerald-50'
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
          getAvatarColor(item.case.name)
        )}
      >
        {getInitials(item.case.name)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium text-gray-900">{item.case.name}</span>
          <time className="shrink-0 text-xs text-gray-400">{getRelativeTime(timestamp)}</time>
        </div>

        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="line-clamp-1 min-w-0 flex-1 text-sm text-gray-500">
            {item.lastMessage?.content ?? 'Sem mensagens'}
          </p>
          {item.unreadCount > 0 && (
            <span
              aria-label={`${item.unreadCount} mensagens não lidas`}
              className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold leading-4 text-white"
            >
              {item.unreadCount}
            </span>
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {item.channel && (
            <span className="inline-flex items-center text-gray-500">
              {item.channel === 'whatsapp' ? (
                <MessageCircle className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              ) : (
                <Send className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
              )}
              <span className="sr-only">{item.channel === 'whatsapp' ? 'WhatsApp' : 'Telegram'}</span>
            </span>
          )}
          <span className="font-medium text-gray-700">{formatCurrency(item.case.updated_value)}</span>
          <span className="text-gray-300" aria-hidden="true">
            •
          </span>
          <span className={controller.className}>{controller.label}</span>
          {isNewAssignment && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
              Nova atribuição
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
