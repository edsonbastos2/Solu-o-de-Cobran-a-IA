'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, MessageSquare, RefreshCw } from 'lucide-react';
import type { ConversationActionResult, ConversationDetailResponse } from '@/lib/types';
import { ChatHeader } from './chat-header';
import { MessageList } from './message-list';
import { MessageComposer } from './message-composer';
import { TakeoverBar, type ConversationActionState } from './takeover-bar';
import { TransferDialog } from './transfer-dialog';

export interface ChatWindowProps {
  conversation: ConversationDetailResponse | null;
  isLoading: boolean;
  error?: string | null;
  onRetry?: () => void;
  sending: boolean;
  sendError: string | null;
  onSendMessage: (message: string) => Promise<boolean>;
  actionState: ConversationActionState;
  onTakeOver: (expectedVersion: number) => Promise<ConversationActionResult | null>;
  onReturnToAI: (expectedVersion: number) => Promise<ConversationActionResult | null>;
  onTransfer: (input: { toOperatorId: string; reason?: string; expectedVersion: number }) => Promise<ConversationActionResult | null>;
  currentUserId?: string | null;
  onBack?: () => void;
  onToggleInfo?: () => void;
}

/** Condutor efetivo — casos legados (controller NULL) derivam do status (mesma regra de lib/conversation-service.ts). */
function resolveController(caseData: { controller?: string | null; status: string }): 'ai' | 'human' {
  if (caseData.controller === 'ai' || caseData.controller === 'human') return caseData.controller;
  return caseData.status === 'needs_attention' ? 'human' : 'ai';
}

function ChatWindowSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex h-full flex-col">
      <span className="sr-only">Carregando conversa</span>
      <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3" aria-hidden="true">
        <div className="h-9 w-9 animate-pulse rounded-full bg-gray-200" />
        <div className="space-y-1.5">
          <div className="h-3.5 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
        </div>
      </div>
      <div className="flex-1 space-y-3 p-4" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <div key={index} className={`h-10 w-2/5 animate-pulse rounded-2xl bg-gray-200 ${index % 2 ? 'ml-auto' : ''}`} />
        ))}
      </div>
    </div>
  );
}

export function ChatWindow({
  conversation,
  isLoading,
  error,
  onRetry,
  sending,
  sendError,
  onSendMessage,
  actionState,
  onTakeOver,
  onReturnToAI,
  onTransfer,
  currentUserId,
  onBack,
  onToggleInfo,
}: ChatWindowProps) {
  const [transferOpen, setTransferOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const messageCount = conversation?.messages.length ?? 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isNearBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messageCount]);

  if (isLoading) {
    return <ChatWindowSkeleton />;
  }

  if (error) {
    return (
      <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <AlertCircle className="h-8 w-8 text-red-500" aria-hidden="true" />
        <p className="text-sm text-gray-600">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Tentar novamente
          </button>
        )}
      </div>
    );
  }

  if (!conversation) {
    return (
      <div data-testid="chat-window-placeholder" className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-gray-400">
        <MessageSquare className="h-10 w-10 text-gray-300" aria-hidden="true" />
        <p className="text-sm font-medium text-gray-500">Selecione uma conversa</p>
      </div>
    );
  }

  const controller = resolveController(conversation.case);
  const isMine = conversation.currentOperator?.id === currentUserId;
  const lastMessage = conversation.messages[conversation.messages.length - 1];
  const isAIThinking = controller === 'ai' && lastMessage?.role === 'user';

  return (
    <div className="flex h-full flex-col">
      <ChatHeader
        caseData={conversation.case}
        channel={conversation.case.active_channel}
        onBack={onBack}
        onToggleInfo={onToggleInfo}
      />

      <TakeoverBar
        controller={controller}
        currentOperatorName={conversation.currentOperator?.name}
        isMine={isMine}
        canTakeOver={conversation.permissions.canTakeOver}
        canReturnToAI={conversation.permissions.canReturnToAI}
        canTransfer={conversation.permissions.canTransfer}
        conversationVersion={conversation.conversationVersion}
        actionState={actionState}
        onTakeOver={onTakeOver}
        onReturnToAI={onReturnToAI}
        onOpenTransfer={() => setTransferOpen(true)}
      />

      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-gray-50/60">
        <MessageList
          messages={conversation.messages}
          events={conversation.events}
          debtorName={conversation.case.name}
          operatorName={conversation.currentOperator?.name}
          resolveOperatorName={(id) => conversation.operators.find((operator) => operator.id === id)?.name ?? 'Operador removido'}
          isAIThinking={isAIThinking}
        />
      </div>

      <MessageComposer
        disabled={!conversation.permissions.canSend}
        disabledReason={
          !conversation.permissions.canSend
            ? controller === 'ai'
              ? 'Assuma a conversa para enviar mensagens.'
              : 'Você não tem permissão para enviar mensagens nesta conversa.'
            : undefined
        }
        sending={sending}
        error={sendError}
        onSend={onSendMessage}
      />

      <TransferDialog
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        currentOperatorName={conversation.currentOperator?.name}
        operators={conversation.operators}
        currentUserId={currentUserId}
        conversationVersion={conversation.conversationVersion}
        actionState={actionState}
        onTransfer={onTransfer}
      />
    </div>
  );
}
