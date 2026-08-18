'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/hooks/useAuth';
import { useActiveTenant } from '@/hooks/use-active-tenant';
import { fetcher, fetchWithAuth } from '@/lib/api';
import { Pagination } from '@/components/pagination';
import {
  ShieldAlert,
  AlertCircle,
  RefreshCw,
  Plus,
  CheckCircle2,
  RotateCcw,
  Ban,
  Send,
  ExternalLink,
} from 'lucide-react';

type Negativation = {
  id: string;
  status: 'pending_notification' | 'notified' | 'requested' | 'completed' | 'removed';
  provider: string | null;
  external_reference: string | null;
  requested_at: string | null;
  completed_at: string | null;
  removed_at: string | null;
  notified_at: string | null;
  created_at: string | null;
  clients?: { name: string | null; document: string | null; phone: string | null } | null;
  financial_titles?: { installment_number: number | null; due_date: string | null; current_value: number | null } | null;
};

type NegativationResponse = {
  negativations: Negativation[];
  total: number;
  totalPages: number;
};

const STATUS_META: Record<Negativation['status'], { label: string; className: string }> = {
  pending_notification: { label: 'Aguardando notificação', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  notified: { label: 'Notificado (5 dias)', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  requested: { label: 'Solicitada ao provedor', className: 'bg-sky-100 text-sky-700 border-sky-200' },
  completed: { label: 'Negativado', className: 'bg-red-100 text-red-700 border-red-200' },
  removed: { label: 'Removido', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function NegativationsPage() {
  const { user, loading: authLoading } = useAuth();
  const { tenantQuery, isAdmin, needsTenantSelection } = useActiveTenant();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitleId, setNewTitleId] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const limit = 10;

  const queryUrl = `/api/negativations?page=${page}&limit=${limit}&status=${statusFilter}${tenantQuery ? `&${tenantQuery}` : ''}`;
  const canFetch = !authLoading && Boolean(user) && !needsTenantSelection;
  const { data, error, isLoading, mutate } = useSWR<NegativationResponse>(
    canFetch ? [queryUrl, user?.id || 'anon'] : null,
    ([url]) => fetcher(url)
  );

  const negativations = data?.negativations || [];

  const handleCreate = async () => {
    setFormError('');
    if (!newTitleId.trim()) {
      setFormError('Informe o ID do título financeiro.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/negativations', {
        method: 'POST',
        body: JSON.stringify({
          financial_title_id: newTitleId.trim(),
          tenant_id: tenantQuery ? tenantQuery.split('=')[1] : undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setFormError(json?.error || 'Não foi possível criar a negativação.');
        return;
      }
      setShowCreate(false);
      setNewTitleId('');
      mutate();
      setAlertMessage('Negativação criada e fila aguardando a notificação prévia (CDC Art. 43).');
    } finally {
      setSaving(false);
    }
  };

  const handleTransition = async (n: Negativation, status: Negativation['status']) => {
    const res = await fetchWithAuth(`/api/negativations/${n.id}?${tenantQuery}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    const json = await res.json().catch(() => null);
    if (res.ok) {
      mutate();
      setAlertMessage(json?.negativation?.status || 'Status atualizado.');
    } else {
      setFormError(json?.error || 'Não foi possível atualizar o status.');
    }
  };

  const resetAlert = () => setTimeout(() => setAlertMessage(''), 4000);

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-red-600" />
              Negativação
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Registro de negativação em Serasa/SPC/Boa Vista com controle do prazo legal de notificação prévia
              de 5 dias (CDC Art. 43) e remoção automática após quitação.
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowCreate(true); setFormError(''); }}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Nova Negativação
              </button>
              <button
                onClick={() => mutate()}
                className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
                title="Atualizar lista"
                aria-label="Atualizar lista de negativações"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}
        </div>

        {alertMessage && (
          <div className="mb-6 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{alertMessage}</span>
            <button onClick={() => setAlertMessage('')} className="text-emerald-500 hover:text-emerald-700 text-xs font-bold">OK</button>
          </div>
        )}

        {showCreate && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-bold text-slate-900">Criar negativação manual</h2>
            <div className="grid gap-4 sm:grid-cols-1">
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-slate-700">ID do título financeiro *</span>
                <input
                  value={newTitleId}
                  onChange={(e) => setNewTitleId(e.target.value)}
                  placeholder="uuid do título em atraso"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900"
                />
              </label>
            </div>
            {formError && <p className="mt-3 text-sm font-medium text-red-600">{formError}</p>}
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleCreate}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {saving ? 'Salvando...' : 'Criar'}
              </button>
              <button
                onClick={() => { setShowCreate(false); setFormError(''); }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/50 p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-1 overflow-x-auto">
              {(['all', 'pending_notification', 'notified', 'requested', 'completed', 'removed'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                    statusFilter === s ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  {s === 'all' ? 'Todas' : STATUS_META[s].label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap">
              <thead className="border-b border-slate-200 bg-slate-100/70 text-xs font-semibold tracking-wider text-slate-500 uppercase">
                <tr>
                  <th className="px-6 py-3.5">Situação</th>
                  <th className="px-6 py-3.5">Cliente</th>
                  <th className="px-6 py-3.5">Título</th>
                  <th className="px-6 py-3.5">Valor</th>
                  <th className="px-6 py-3.5">Prazos</th>
                  <th className="px-6 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 bg-white">
                {error ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-red-600">
                      <AlertCircle className="mx-auto mb-2 h-8 w-8" />
                      Não foi possível carregar as negativações.
                    </td>
                  </tr>
                ) : isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-slate-400" />
                      Carregando...
                    </td>
                  </tr>
                ) : negativations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <ShieldAlert className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                      Nenhuma negativação encontrada.
                    </td>
                  </tr>
                ) : (
                  negativations.map((n) => (
                    <tr key={n.id} className="transition-colors hover:bg-slate-50/80">
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${STATUS_META[n.status].className}`}>
                          {STATUS_META[n.status].label}
                        </span>
                        {n.external_reference && (
                           <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 max-w-[140px] truncate" title={n.external_reference}>
                            <ExternalLink className="h-3 w-3" /> {n.external_reference}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800 truncate max-w-[200px]" title={n.clients?.name || undefined}>{n.clients?.name || '—'}</div>
                        {n.clients?.document && <div className="text-xs font-mono text-slate-400 truncate max-w-[160px]" title={n.clients.document}>{n.clients.document}</div>}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {n.financial_titles ? (
                          <>
                            Parcela #{n.financial_titles.installment_number}
                            <div>{n.financial_titles.due_date ? new Date(n.financial_titles.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}</div>
                          </>
                        ) : (
                          <span className="font-mono">{n.id.slice(0, 8)}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-800">
                        {n.financial_titles?.current_value ? money.format(n.financial_titles.current_value) : '—'}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        <div>Notificada: {n.notified_at ? new Date(n.notified_at).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}</div>
                        {n.completed_at && <div>Negativada: {new Date(n.completed_at).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</div>}
                        {n.removed_at && <div className="text-emerald-600">Removida: {new Date(n.removed_at).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</div>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isAdmin && (
                          <div className="flex justify-end gap-1">
                            {n.status === 'pending_notification' && (
                              <button
                                onClick={() => handleTransition(n, 'notified')}
                                title="Marcar como notificada"
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                              >
                                <Send className="h-4 w-4" />
                              </button>
                            )}
                            {n.status === 'notified' && (
                              <button
                                onClick={() => handleTransition(n, 'requested')}
                                title="Solicitar ao provedor"
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-sky-50 hover:text-sky-600"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </button>
                            )}
                            {n.status === 'requested' && (
                              <button
                                onClick={() => handleTransition(n, 'completed')}
                                title="Confirmar negativação"
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              >
                                <ShieldAlert className="h-4 w-4" />
                              </button>
                            )}
                            {n.status !== 'removed' && (
                              <button
                                onClick={() => handleTransition(n, 'removed')}
                                title="Remover negativação"
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {(data?.total ?? 0) > limit && (
            <Pagination currentPage={page} totalPages={data?.totalPages || 1} onPageChange={setPage} theme="light" />
          )}
        </div>
      </main>
    </div>
  );
}