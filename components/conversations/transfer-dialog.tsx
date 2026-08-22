'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import type { ConversationActionResult } from '@/lib/types';
import type { ConversationActionState } from './takeover-bar';

export interface TransferDialogProps {
  open: boolean;
  onClose: () => void;
  currentOperatorName?: string | null;
  operators: { id: string; name: string; role: string }[];
  currentUserId?: string | null;
  conversationVersion: number;
  actionState: ConversationActionState;
  onTransfer: (input: { toOperatorId: string; reason?: string; expectedVersion: number }) => Promise<ConversationActionResult | null>;
}

const REASON_MAX_LENGTH = 500;

export function TransferDialog({
  open,
  onClose,
  currentOperatorName,
  operators,
  currentUserId,
  conversationVersion,
  actionState,
  onTransfer,
}: TransferDialogProps) {
  const [toOperatorId, setToOperatorId] = useState('');
  const [reason, setReason] = useState('');
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (!open) return;
    setToOperatorId('');
    setReason('');
    selectRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const availableOperators = operators.filter((operator) => operator.id !== currentUserId);
  const canConfirm = toOperatorId.length > 0 && !actionState.loading;

  const handleConfirm = async () => {
    if (!toOperatorId) return;
    const result = await onTransfer({
      toOperatorId,
      reason: reason.trim() || undefined,
      expectedVersion: conversationVersion,
    });
    if (result?.ok) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Transferir conversa"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-900">Transferir conversa</h3>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <p className="text-xs text-gray-500">
            Responsável atual: <span className="font-medium text-gray-700">{currentOperatorName ?? 'Ninguém atribuído'}</span>
          </p>

          <div>
            <label htmlFor="transfer-operator" className="mb-1 block text-xs font-medium text-gray-600">
              Transferir para
            </label>
            <select
              id="transfer-operator"
              ref={selectRef}
              value={toOperatorId}
              onChange={(event) => setToOperatorId(event.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">Selecione um operador...</option>
              {availableOperators.map((operator) => (
                <option key={operator.id} value={operator.id}>
                  {operator.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="transfer-reason" className="mb-1 block text-xs font-medium text-gray-600">
              Motivo (opcional)
            </label>
            <textarea
              id="transfer-reason"
              rows={2}
              value={reason}
              maxLength={REASON_MAX_LENGTH}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex.: caso exige alçada de gestor"
              className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {actionState.conflict && (
            <p role="alert" data-testid="transfer-conflict" className="text-xs font-medium text-amber-700">
              Esta conversa foi alterada por outro operador. Feche e tente novamente.
            </p>
          )}
          {actionState.error && !actionState.conflict && (
            <p role="alert" data-testid="transfer-error" className="text-xs font-medium text-red-600">
              {actionState.error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            data-testid="transfer-confirm"
            disabled={!canConfirm}
            onClick={() => void handleConfirm()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {actionState.loading && <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            Transferir
          </button>
        </div>
      </div>
    </div>
  );
}
