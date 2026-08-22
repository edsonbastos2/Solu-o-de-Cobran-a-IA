'use client';

import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { useConversation } from '@/hooks/use-conversations';
import type { ClientChannel } from '@/lib/types';

export interface ConversationSummaryCardProps {
  caseId: string;
  tenantId: string | null;
  status: string;
  isUpdatingStatus: boolean;
  onUpdateStatus: (status: string) => void;
  canManageCase: boolean;
  clientChannels: ClientChannel[];
  activeChannel: 'whatsapp' | 'telegram' | null | undefined;
  activeChannelLabel: string;
  isUpdatingChannel: boolean;
  onUpdateActiveChannel: (channel: 'whatsapp' | 'telegram' | null) => void;
}

/**
 * Card "Conversa": resumo (condutor, responsável, não lidas, última mensagem)
 * + CTA para a Central de Conversas. Consome `useConversation` (task 07) —
 * sem duplicar fetch de mensagens. Também hospeda os seletores de canal ativo
 * e status do caso, que antes viviam no cabeçalho do chat inline removido.
 */
export function ConversationSummaryCard({
  caseId,
  tenantId,
  status,
  isUpdatingStatus,
  onUpdateStatus,
  canManageCase,
  clientChannels,
  activeChannel,
  activeChannelLabel,
  isUpdatingChannel,
  onUpdateActiveChannel,
}: ConversationSummaryCardProps) {
  const { conversation, isLoading } = useConversation(caseId, tenantId);
  const controller = conversation
    ? conversation.case.controller === 'human' || conversation.case.controller === 'ai'
      ? conversation.case.controller
      : conversation.case.status === 'needs_attention'
        ? 'human'
        : 'ai'
    : null;
  const lastMessage = conversation?.messages[conversation.messages.length - 1] ?? null;
  const conversationHref = `/conversations?case=${caseId}${tenantId ? `&tenant_id=${encodeURIComponent(tenantId)}` : ''}`;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
        <MessageCircle className="w-4 h-4 text-emerald-600" />
        Conversa
      </h3>

      <div className="space-y-3 text-sm">
        {isLoading || !conversation ? (
          <div className="space-y-2" aria-hidden="true">
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Condutor</span>
              <span className={`text-xs font-semibold ${controller === 'ai' ? 'text-emerald-700' : 'text-sky-700'}`}>
                {controller === 'ai' ? '🤖 IA de Cobrança' : `👤 ${conversation.currentOperator?.name ?? 'Sem responsável'}`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Não lidas</span>
              {conversation.unreadCount > 0 ? (
                <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
                  {conversation.unreadCount}
                </span>
              ) : (
                <span className="text-xs font-medium text-slate-400">0</span>
              )}
            </div>
            {lastMessage && (
              <div>
                <span className="text-xs text-slate-400 block mb-0.5">Última mensagem</span>
                <p className="text-xs text-slate-600 line-clamp-2">{lastMessage.content}</p>
              </div>
            )}
          </>
        )}

        <Link
          href={conversationHref}
          data-testid="open-conversation-cta"
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Abrir conversa
        </Link>

        <div className="space-y-2 border-t border-slate-100 pt-3">
          {canManageCase && clientChannels.length > 0 && (
            <div>
              <label htmlFor="case-active-channel" className="text-[11px] text-slate-400 block mb-1">
                Canal ativo: {activeChannelLabel}
              </label>
              <select
                id="case-active-channel"
                value={activeChannel ?? ''}
                disabled={isUpdatingChannel}
                onChange={(e) => onUpdateActiveChannel((e.target.value || null) as 'whatsapp' | 'telegram' | null)}
                data-testid="active-channel-select"
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
              >
                <option value="">Automático (telefone do caso)</option>
                {clientChannels.map((c) => (
                  <option key={c.id} value={c.channel}>
                    {c.channel === 'telegram' ? `Telegram${c.username ? ` (@${c.username})` : ''}` : 'WhatsApp'}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="case-status" className="text-[11px] text-slate-400 block mb-1">
              Status do caso
            </label>
            <select
              id="case-status"
              value={status}
              disabled={isUpdatingStatus}
              onChange={(e) => onUpdateStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
            >
              <option value="not_started">Não Iniciado</option>
              <option value="in_negotiation">Em Negociação</option>
              <option value="needs_attention">Requer Atenção</option>
              <option value="closed">Acordo Fechado</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
