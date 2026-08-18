'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/hooks/useAuth';
import { useActiveTenant } from '@/hooks/use-active-tenant';
import { fetcher, fetchWithAuth } from '@/lib/api';
import { Pagination } from '@/components/pagination';
import {
  Landmark,
  AlertCircle,
  RefreshCw,
  Plus,
  CheckCircle2,
  RotateCcw,
  Ban,
  Send,
  ExternalLink,
} from 'lucide-react';

type Protest = {
  id: string;
  status: 'pending_notification' | 'notified' | 'requested' | 'completed' | 'cancelled';
  provider: string | null;
  external_reference: string | null;
  requested_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  notified_at: string | null;
  created_at: string | null;
  clients?: { name: string | null; document: string | null; phone: string | null } | null;
  financial_titles?: { installment_number: number | null; due_date: string | null; current_value: number | null } | null;
};

type ProtestResponse = {
  protests: Protest[];
  total: number;
  totalPages: number;
};

const STATUS_META: Record<Protest['status'], { label: string; className: string }> = {
  pending_notification: { label: 'Aguardando intimação', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  notified: { label: 'Intimado (3 dias)', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  requested: { label: 'Requisitado ao cartório', className: 'bg-sky-100 text-sky-700 border-sky-200' },
  completed: { label: 'Protestado', className: 'bg-red-100 text-red-700 border-red-200' },
  cancelled: { label: 'Cancelado', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ProtestsPage() {
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

  const queryUrl = `/api/protests?page=${page}&limit=${limit}&status=${statusFilter}${tenantQuery ? `&${tenantQuery}` : ''}`;
  const canFetch = !authLoading && Boolean(user) && !needsTenantSelection;
  const { data, error, isLoading, mutate } = useSWR<ProtestResponse>(
    canFetch ? [queryUrl, user?.id || 'anon'] : null,
    ([url]) => fetcher(url)
  );

  const protests = data?.protests || [];

  const handleCreate = async () => {
    setFormError('');
    if (!newTitleId.trim()) {
      setFormError('Informe o ID do título financeiro.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/protests', {
        method: 'POST',
        body: JSON.stringify({
          financial_title_id: newTitleId.trim(),
          tenant_id: tenantQuery ? tenantQuery.split('=')[1] : undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setFormError(json?.error || 'Não foi possível criar o protesto.');
        return;
      }
      setShowCreate(false);
      setNewTitleId('');
      mutate();
      setAlertMessage('Protesto criado e fila aguardando a intimação prévia (Lei 9.492/97).');
    } finally {
      setSaving(false);
    }
  };

  const handleTransition = async (p: Protest, status: Protest['status']) => {
    const res = await fetchWithAuth(`/api/protests/${p.id}?${tenantQuery}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    const json = await res.json().catch(() => null);
    if (res.ok) {
      mutate();
      setAlertMessage(json?.protest?.status || 'Status atualizado.');
    } else {
      setFormError(json?.error || 'Não foi possível atualizar o status.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Landmark className="h-6 w-6 text-red-600" />
              Protesto em Cartório
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Apoio à execução de títulos com intimação prévia de 3 dias úteis (Lei 9.492/97, art. 12),
              integração com central de cartórios e cancelamento automático após quitação.
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowCreate(true); setFormError(''); }}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Novo Protesto
              </button>
              <button
                onClick={() => mutate()}
                className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
                title="Atualizar lista"
                aria-label="Atualizar lista de protestos"
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
            <h2 className="mb-4 text-sm font-bold text-slate-900">Criar protesto manual</h2>
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
            <p className="mt-2 text-xs text-slate-400">
              Será exigida negativação prévia (completada ou tentada) para o título — encadeamento legal.
            </p>
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
              {(['all', 'pending_notification', 'notified', 'requested', 'completed', 'cancelled'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                    statusFilter === s ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  {s === 'all' ? 'Todos' : STATUS_META[s].label}
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
                      Não foi possível carregar os protestos.
                    </td>
                  </tr>
                ) : isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-slate-400" />
                      Carregando...
                    </td>
                  </tr>
                ) : protests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <Landmark className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                      Nenhum protesto encontrado.
                    </td>
                  </tr>
                ) : (
                  protests.map((p) => (
                    <tr key={p.id} className="transition-colors hover:bg-slate-50/80">
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${STATUS_META[p.status].className}`}>
                          {STATUS_META[p.status].label}
                        </span>
                        {p.external_reference && (
                           <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 max-w-[140px] truncate" title={p.external_reference}>
                            <ExternalLink className="h-3 w-3" /> {p.external_reference}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800 truncate max-w-[200px]" title={p.clients?.name || undefined}>{p.clients?.name || '—'}</div>
                        {p.clients?.document && <div className="text-xs font-mono text-slate-400 truncate max-w-[160px]" title={p.clients.document}>{p.clients.document}</div>}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {p.financial_titles ? (
                          <>
                            Parcela #{p.financial_titles.installment_number}
                            <div>{p.financial_titles.due_date ? new Date(p.financial_titles.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}</div>
                          </>
                        ) : (
                          <span className="font-mono">{p.id.slice(0, 8)}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-800">
                        {p.financial_titles?.current_value ? money.format(p.financial_titles.current_value) : '—'}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        <div>Intimado: {p.notified_at ? new Date(p.notified_at).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}</div>
                        {p.completed_at && <div>Protestado: {new Date(p.completed_at).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</div>}
                        {p.cancelled_at && <div className="text-emerald-600">Cancelado: {new Date(p.cancelled_at).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</div>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isAdmin && (
                          <div className="flex justify-end gap-1">
                            {p.status === 'pending_notification' && (
                              <button
                                onClick={() => handleTransition(p, 'notified')}
                                title="Marcar como intimado"
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                              >
                                <Send className="h-4 w-4" />
                              </button>
                            )}
                            {p.status === 'notified' && (
                              <button
                                onClick={() => handleTransition(p, 'requested')}
                                title="Requisitar ao cartório"
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-sky-50 hover:text-sky-600"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </button>
                            )}
                            {p.status === 'requested' && (
                              <button
                                onClick={() => handleTransition(p, 'completed')}
                                title="Confirmar protesto"
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              >
                                <Landmark className="h-4 w-4" />
                              </button>
                            )}
                            {p.status !== 'cancelled' && (
                              <button
                                onClick={() => handleTransition(p, 'cancelled')}
                                title="Cancelar protesto"
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