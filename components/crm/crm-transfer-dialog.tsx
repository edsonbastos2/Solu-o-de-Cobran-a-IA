'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';

export interface CrmTransferDialogProps {
  open: boolean;
  caseId: string | null;
  caseNumber: string;
  operators: { id: string; name: string }[];
  currentUserId?: string | null;
  currentOperatorName?: string | null;
  expectedVersion: number | null;
  tenantId?: string | null;
  onClose: () => void;
  onUpdate: () => void;
}

const REASON_MAX_LENGTH = 500;

export function CrmTransferDialog({
  open,
  caseId,
  caseNumber,
  operators,
  currentUserId,
  currentOperatorName,
  expectedVersion,
  tenantId,
  onClose,
  onUpdate,
}: CrmTransferDialogProps) {
  const [toOperatorId, setToOperatorId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (!open) return;
    setToOperatorId('');
    setReason('');
    setError(null);
    setSubmitting(false);
    selectRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const availableOperators = operators.filter((operator) => operator.id !== currentUserId);
  const canConfirm = Boolean(toOperatorId) && expectedVersion !== null && !submitting;

  const handleConfirm = async () => {
    if (!caseId || !toOperatorId || expectedVersion === null || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const query = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
      const res = await fetchWithAuth(`/api/conversations/${caseId}/transfer${query}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toOperatorId,
          reason: reason.trim() || undefined,
          expectedVersion,
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? `Não foi possível transferir o caso ${caseNumber}.`);
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
      onUpdate();
      onClose();
    } catch {
      setError('Falha de conexão. Tente novamente.');
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Transferir caso"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-900">Transferir caso</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <p className="text-xs text-gray-500">
            Caso <span className="font-medium text-gray-700">{caseNumber}</span> · Responsável
            atual:{' '}
            <span className="font-medium text-gray-700">
              {currentOperatorName ?? 'Ninguém atribuído'}
            </span>
          </p>

          <div>
            <label htmlFor="crm-transfer-operator" className="mb-1 block text-xs font-medium text-gray-600">
              Transferir para
            </label>
            <select
              id="crm-transfer-operator"
              data-testid="crm-transfer-operator"
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
            <label htmlFor="crm-transfer-reason" className="mb-1 block text-xs font-medium text-gray-600">
              Motivo (opcional)
            </label>
            <textarea
              id="crm-transfer-reason"
              data-testid="crm-transfer-reason"
              rows={2}
              value={reason}
              maxLength={REASON_MAX_LENGTH}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex.: caso exige alçada de gestor"
              className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {expectedVersion === null && (
            <p className="text-xs text-gray-400">Carregando dados do caso...</p>
          )}

          {error && (
            <p role="alert" data-testid="crm-transfer-error" className="text-xs font-medium text-red-600">
              {error}
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
            data-testid="crm-transfer-confirm"
            disabled={!canConfirm}
            onClick={() => void handleConfirm()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            Transferir
          </button>
        </div>
      </div>
    </div>
  );
}
