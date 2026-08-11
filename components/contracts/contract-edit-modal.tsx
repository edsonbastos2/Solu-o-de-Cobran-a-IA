'use client';

import { useState } from 'react';
import { RefreshCw, X, Save, Archive } from 'lucide-react';
import { ContractWithClient } from '@/lib/types';
import { fetchWithAuth } from '@/lib/api';

interface ContractEditModalProps {
  contract: ContractWithClient;
  tenantPath?: string;
  onClose: () => void;
  onSaved: (updated: ContractWithClient) => void;
  onArchived: () => void;
}

export function ContractEditModal({ contract, tenantPath = '', onClose, onSaved, onArchived }: ContractEditModalProps) {
  const [form, setForm] = useState(() => ({
    interest_rate: contract.interest_rate ?? '',
    penalty_rate: contract.penalty_rate ?? '',
    monetary_correction_index: contract.monetary_correction_index ?? '',
    negative_allowed: contract.negative_allowed ?? false,
    protest_allowed: contract.protest_allowed ?? false,
    override_days_to_negative: contract.override_days_to_negative ?? '',
    override_days_to_protest: contract.override_days_to_protest ?? '',
    start_date: contract.start_date ?? '',
    due_date: contract.due_date ?? '',
    forum: contract.forum ?? '',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  const set = (field: string, value: unknown) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/contracts/${contract.id}${tenantPath}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interest_rate: form.interest_rate === '' ? null : Number(form.interest_rate),
          penalty_rate: form.penalty_rate === '' ? null : Number(form.penalty_rate),
          monetary_correction_index: form.monetary_correction_index || null,
          negative_allowed: form.negative_allowed,
          protest_allowed: form.protest_allowed,
          override_days_to_negative: form.override_days_to_negative === '' ? null : Number(form.override_days_to_negative),
          override_days_to_protest: form.override_days_to_protest === '' ? null : Number(form.override_days_to_protest),
          start_date: form.start_date || null,
          due_date: form.due_date || null,
          forum: form.forum || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.contract) {
        setError(data?.error || 'Não foi possível salvar as alterações.');
        return;
      }
      onSaved(data.contract);
    } catch (err) {
      setError('Não foi possível conectar ao servidor.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!window.confirm('Arquivar este contrato? Ele não aparecerá mais na lista de contratos ativos.')) return;
    setArchiving(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/contracts/${contract.id}${tenantPath}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Não foi possível arquivar o contrato.');
        return;
      }
      onArchived();
    } catch (err) {
      setError('Não foi possível conectar ao servidor.');
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Editar contrato">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Editar Contrato</h2>
          <button onClick={onClose} aria-label="Fechar" className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Juros de Mora (%)</span>
              <input
                type="number"
                step="0.01"
                value={form.interest_rate}
                onChange={(e) => set('interest_rate', e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Multa (%)</span>
              <input
                type="number"
                step="0.01"
                value={form.penalty_rate}
                onChange={(e) => set('penalty_rate', e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Início</span>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => set('start_date', e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Vencimento</span>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => set('due_date', e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Índice de Correção</span>
            <input
              type="text"
              value={form.monetary_correction_index}
              onChange={(e) => set('monetary_correction_index', e.target.value)}
              placeholder="Ex.: IPCA, IGPM"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Foro Competente</span>
            <input
              type="text"
              value={form.forum}
              onChange={(e) => set('forum', e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <div className="grid grid-cols-2 gap-4 pt-1">
            <label className="block">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Dias até Negativação</span>
              <input
                type="number"
                min="0"
                value={form.override_days_to_negative}
                onChange={(e) => set('override_days_to_negative', e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Dias até Protesto</span>
              <input
                type="number"
                min="0"
                value={form.override_days_to_protest}
                onChange={(e) => set('override_days_to_protest', e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>

          <div className="flex gap-6 pt-1">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.negative_allowed}
                onChange={(e) => set('negative_allowed', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Negativação permitida
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.protest_allowed}
                onChange={(e) => set('protest_allowed', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Protesto permitido
            </label>
          </div>

          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={handleArchive}
            disabled={archiving}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-red-600 border border-gray-200 rounded-lg disabled:opacity-50"
          >
            {archiving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
            Arquivar
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}