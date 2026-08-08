'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { FinancialTitleWithEligibility } from '@/lib/types';
import { formatCurrency, formatCurrencyInput, parseCurrency } from '@/lib/utils';

interface PartialPaymentModalProps {
  title: FinancialTitleWithEligibility | null;
  busy: boolean;
  onConfirm: (amount: number) => void;
  onClose: () => void;
}

export function PartialPaymentModal({ title, busy, onConfirm, onClose }: PartialPaymentModalProps) {
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRaw('');
    setError(null);
  }, [title]);

  if (!title) return null;

  const remaining = title.current_value != null ? Number(title.current_value) : Number(title.original_value);

  const handleConfirm = () => {
    const amount = parseCurrency(raw);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Informe um valor maior que zero.');
      return;
    }
    if (amount > remaining) {
      setError(`O valor não pode ultrapassar o saldo de ${formatCurrency(remaining)}.`);
      return;
    }
    setError(null);
    onConfirm(amount);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Baixa parcial — Parcela {title.installment_number}</h2>
          <button onClick={onClose} aria-label="Fechar" className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm text-slate-500">
            Saldo pendente: <span className="font-semibold text-slate-900">{formatCurrency(remaining)}</span>
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="partial-amount" className="text-sm text-slate-500">Valor do pagamento parcial</label>
            <input
              id="partial-amount"
              inputMode="decimal"
              value={raw}
              onChange={(e) => setRaw(formatCurrencyInput(e.target.value))}
              placeholder="R$ 0,00"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {busy ? 'Salvando...' : 'Salvar baixa parcial'}
          </button>
        </div>
      </div>
    </div>
  );
}