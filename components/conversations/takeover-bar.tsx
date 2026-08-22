'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bot, RefreshCw, UserRound } from 'lucide-react';
import type { ConversationActionResult, ConversationController } from '@/lib/types';

export interface ConversationActionState {
  loading: boolean;
  error: string | null;
  conflict: boolean;
}

export interface TakeoverBarProps {
  controller: ConversationController;
  currentOperatorName?: string | null;
  isMine: boolean;
  canTakeOver: boolean;
  canReturnToAI: boolean;
  canTransfer: boolean;
  conversationVersion: number;
  actionState: ConversationActionState;
  onTakeOver: (expectedVersion: number) => Promise<ConversationActionResult | null>;
  onReturnToAI: (expectedVersion: number) => Promise<ConversationActionResult | null>;
  onOpenTransfer: () => void;
}

type PendingAction = 'takeover' | 'return' | null;

function ConfirmPopover({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  loading,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="mt-1.5 text-sm text-gray-500">{description}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            ref={confirmRef}
            type="button"
            data-testid="takeover-confirm-button"
            disabled={loading}
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TakeoverBar({
  controller,
  currentOperatorName,
  isMine,
  canTakeOver,
  canReturnToAI,
  canTransfer,
  conversationVersion,
  actionState,
  onTakeOver,
  onReturnToAI,
  onOpenTransfer,
}: TakeoverBarProps) {
  const [pending, setPending] = useState<PendingAction>(null);

  const confirmTakeOver = async () => {
    await onTakeOver(conversationVersion);
    setPending(null);
  };

  const confirmReturn = async () => {
    await onReturnToAI(conversationVersion);
    setPending(null);
  };

  return (
    <div
      data-testid="takeover-bar"
      className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2"
    >
      <div className="flex items-center gap-2 text-sm">
        {controller === 'ai' ? (
          <>
            <Bot className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            <span className="font-medium text-gray-700">IA está conduzindo esta conversa</span>
          </>
        ) : (
          <>
            <UserRound className="h-4 w-4 text-sky-600" aria-hidden="true" />
            <span className="font-medium text-gray-700">
              {isMine ? 'Você está conduzindo esta conversa' : `${currentOperatorName ?? 'Um operador'} está conduzindo esta conversa`}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {controller === 'ai' && canTakeOver && (
          <button
            type="button"
            data-testid="takeover-button"
            onClick={() => setPending('takeover')}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            Assumir conversa
          </button>
        )}
        {controller === 'human' && canTransfer && (
          <button
            type="button"
            data-testid="open-transfer-dialog"
            onClick={onOpenTransfer}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Transferir
          </button>
        )}
        {controller === 'human' && canReturnToAI && (
          <button
            type="button"
            data-testid="return-to-ai-button"
            onClick={() => setPending('return')}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Devolver para IA
          </button>
        )}
      </div>

      {actionState.conflict && (
        <div
          role="alert"
          data-testid="version-conflict-banner"
          className="flex w-full items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Esta conversa foi alterada por outro operador. A tela foi atualizada — tente novamente.
        </div>
      )}
      {actionState.error && !actionState.conflict && (
        <div role="alert" data-testid="takeover-action-error" className="w-full text-xs font-medium text-red-600">
          {actionState.error}
        </div>
      )}

      {pending === 'takeover' && (
        <ConfirmPopover
          title="Assumir conversa"
          description="A IA será pausada e você passará a conduzir esta conversa. O devedor não é notificado dessa troca."
          confirmLabel="Assumir"
          loading={actionState.loading}
          onConfirm={confirmTakeOver}
          onCancel={() => setPending(null)}
        />
      )}
      {pending === 'return' && (
        <ConfirmPopover
          title="Devolver para a IA"
          description="A IA voltará a responder automaticamente na próxima mensagem do devedor."
          confirmLabel="Devolver"
          loading={actionState.loading}
          onConfirm={confirmReturn}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
