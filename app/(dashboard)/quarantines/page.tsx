'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/hooks/useAuth';
import {
  ShieldAlert,
  AlertCircle,
  Plus,
  ShieldCheck,
  ShieldX,
  RotateCcw,
  UserRoundX,
  Scale,
  Ban,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Pagination } from '@/components/pagination';
import { useActiveTenant } from '@/hooks/use-active-tenant';
import { fetcher, fetchWithAuth } from '@/lib/api';

type Quarantine = {
  id: string;
  case_id?: string | null;
  financial_title_id?: string | null;
  reason: string;
  status: 'pending_review' | 'approved' | 'released' | 'permanent_block';
  expires_at?: string | null;
  created_at: string;
  reviewed_at?: string | null;
};

type QuarantineResponse = {
  quarantines: Quarantine[];
  totalPages: number;
  total: number;
};

const REASON_META: Record<string, { label: string; icon: typeof Scale }> = {
  legal_dispute: { label: 'Litígio em andamento', icon: Scale },
  deceased: { label: 'Falecimento', icon: UserRoundX },
  no_contact: { label: 'Pedido de não contato', icon: Ban },
  internal_review: { label: 'Revisão interna', icon: ShieldAlert },
  other: { label: 'Outro motivo', icon: AlertCircle },
};

const STATUS_META: Record<Quarantine['status'], { label: string; className: string }> = {
  pending_review: { label: 'Em revisão', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  approved: { label: 'Aprovada', className: 'bg-sky-100 text-sky-700 border-sky-200' },
  released: { label: 'Liberada', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  permanent_block: { label: 'Bloqueio permanente', className: 'bg-red-100 text-red-700 border-red-200' },
};

export default function QuarantinesPage() {
  const { user, loading: authLoading } = useAuth();
  const { tenantQuery, isAdmin, needsTenantSelection } = useActiveTenant();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const limit = 10;

  const queryUrl = `/api/quarantines?page=${page}&limit=${limit}&status=${statusFilter}${tenantQuery ? `&${tenantQuery}` : ''}`;
  const canFetch = !authLoading && Boolean(user) && !needsTenantSelection;
  const { data, error, isLoading, mutate } = useSWR<QuarantineResponse>(
    canFetch ? [queryUrl, user?.id || 'anon'] : null,
    ([url]) => fetcher(url)
  );

  const [showNew, setShowNew] = useState(false);
  const [newCaseId, setNewCaseId] = useState('');
  const [newReason, setNewReason] = useState('no_contact');
  const [newExpiresAt, setNewExpiresAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  const [search, setSearch] = useState('');

  const quarantines = data?.quarantines || [];

  useEffect(() => {
    if (!alertMessage) return;
    const t = setTimeout(() => setAlertMessage(''), 4000);
    return () => clearTimeout(t);
  }, [alertMessage]);

  const handleChangeStatus = async (q: Quarantine, status: Quarantine['status']) => {
    const updated = await fetchWithAuth(`/api/quarantines/${q.id}?${tenantQuery}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (updated.ok) {
      mutate();
      setAlertMessage('Status atualizado.');
    }
  };

  const handleCreate = async () => {
    setFormError('');
    if (!newCaseId.trim()) {
      setFormError('Informe o ID do caso.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/quarantines', {
        method: 'POST',
        body: JSON.stringify({
          case_id: newCaseId.trim(),
          reason: newReason,
          expires_at: newExpiresAt || undefined,
          tenant_id: tenantQuery ? tenantQuery.split('=')[1] : undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setFormError(json?.error || 'Não foi possível criar a quarentena.');
        return;
      }
      setShowNew(false);
      setNewCaseId('');
      setNewReason('no_contact');
      setNewExpiresAt('');
      mutate();
      setAlertMessage('Quarentena criada e enviada para revisão.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = search.trim()
    ? quarantines.filter((q) => q.case_id?.includes(search.trim()) || q.reason?.includes(search.trim()))
    : quarantines;

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Quarentena de Contas</h1>
            <p className="mt-1 text-sm text-slate-500">
              Bloqueio de abordagens para devedores em situação especial (litígio, falecimento, pedido de não contato).
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              Nova Quarentena
            </button>
          )}
        </div>

        {alertMessage && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
            {alertMessage}
          </div>
        )}

        {showNew && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-bold text-slate-900">Criar quarentena</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-slate-700">ID do caso *</span>
                <input
                  value={newCaseId}
                  onChange={(e) => setNewCaseId(e.target.value)}
                  placeholder="uuid do caso"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-slate-700">Motivo *</span>
                <select
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                >
                  {Object.entries(REASON_META).map(([value, meta]) => (
                    <option key={value} value={value}>{meta.label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-slate-700">Expira em (opcional)</span>
                <input
                  type="datetime-local"
                  value={newExpiresAt}
                  onChange={(e) => setNewExpiresAt(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
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
                onClick={() => setShowNew(false)}
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
              {['all', 'pending_review', 'approved', 'released', 'permanent_block'].map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                    statusFilter === s ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  {s === 'all' ? 'Todas' : STATUS_META[s as Quarantine['status']].label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por caso ou motivo..."
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-slate-900 md:w-64"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-100/70 text-xs font-semibold tracking-wider text-slate-500 uppercase">
                <tr>
                  <th className="px-6 py-3.5">Situação</th>
                  <th className="px-6 py-3.5">Motivo</th>
                  <th className="px-6 py-3.5">Caso</th>
                  <th className="px-6 py-3.5">Expira em</th>
                  <th className="px-6 py-3.5">Criada em</th>
                  <th className="px-6 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 bg-white">
                {error ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-red-600">
                      <AlertCircle className="mx-auto mb-2 h-8 w-8" />
                      Não foi possível carregar as quarentenas.
                    </td>
                  </tr>
                ) : isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-slate-400" />
                      Carregando...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <ShieldAlert className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                      Nenhuma quarentena encontrada.
                    </td>
                  </tr>
                ) : (
                  filtered.map((q) => {
                    const ReasonIcon = REASON_META[q.reason]?.icon || AlertCircle;
                    return (
                      <tr key={q.id} className="transition-colors hover:bg-slate-50/80">
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${STATUS_META[q.status].className}`}>
                            {STATUS_META[q.status].label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 font-medium text-slate-800">
                            <ReasonIcon className="h-4 w-4 text-slate-400" />
                            {REASON_META[q.reason]?.label || q.reason}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-500">{q.case_id || '—'}</td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {q.expires_at ? new Date(q.expires_at).toLocaleString('pt-BR') : q.status === 'permanent_block' ? 'Nunca' : '—'}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {new Date(q.created_at).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {isAdmin && (
                            <div className="flex justify-end gap-1">
                              {q.status === 'pending_review' && (
                                <button
                                  onClick={() => handleChangeStatus(q, 'approved')}
                                  title="Aprovar"
                                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                                >
                                  <ShieldCheck className="h-4 w-4" />
                                </button>
                              )}
                              {q.status !== 'released' && (
                                <button
                                  onClick={() => handleChangeStatus(q, 'released')}
                                  title="Liberar"
                                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </button>
                              )}
                              {q.status !== 'permanent_block' && (
                                <button
                                  onClick={() => handleChangeStatus(q, 'permanent_block')}
                                  title="Bloqueio permanente"
                                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                                >
                                  <ShieldX className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={page} totalPages={data?.totalPages || 1} onPageChange={setPage} theme="light" />
        </div>
      </main>
    </div>
  );
}