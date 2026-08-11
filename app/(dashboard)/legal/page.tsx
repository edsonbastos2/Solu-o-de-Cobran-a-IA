'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/hooks/useAuth';
import { useActiveTenant } from '@/hooks/use-active-tenant';
import { fetcher, fetchWithAuth } from '@/lib/api';
import { Pagination } from '@/components/pagination';
import {
  Scale,
  AlertCircle,
  RefreshCw,
  Plus,
  CheckCircle2,
  Gavel,
  Building2,
  UserRound,
  Search,
} from 'lucide-react';

type LegalProcess = {
  id: string;
  status: 'open' | 'in_progress' | 'judgment_won' | 'judgment_lost' | 'closed';
  process_type: string;
  process_number: string | null;
  court: string | null;
  filing_date: string | null;
  lawyer_name: string | null;
  lawyer_contact: string | null;
  case_id: string | null;
  financial_title_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  clients?: { name: string | null; document: string | null } | null;
  cases?: { name: string | null } | null;
  financial_titles?: { installment_number: number | null; due_date: string | null; current_value: number | null } | null;
};

type LegalResponse = {
  legal_processes: LegalProcess[];
  total: number;
  totalPages: number;
};

const STATUS_META: Record<LegalProcess['status'], { label: string; className: string }> = {
  open: { label: 'Em aberto', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  in_progress: { label: 'Em andamento', className: 'bg-sky-100 text-sky-700 border-sky-200' },
  judgment_won: { label: 'Vitória judicial', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  judgment_lost: { label: 'Sentença desfavorável', className: 'bg-red-100 text-red-700 border-red-200' },
  closed: { label: 'Encerrado', className: 'bg-slate-200 text-slate-600 border-slate-300' },
};

const TYPE_META: Record<string, string> = {
  execucao: 'Execução',
  monitoria: 'Monitória',
  cobranca: 'Cobrança',
  collection: 'Cobrança',
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function LegalProcessesPage() {
  const { user, loading: authLoading } = useAuth();
  const { tenantQuery, isAdmin, needsTenantSelection } = useActiveTenant();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [formError, setFormError] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [form, setForm] = useState({
    case_id: '',
    process_type: 'cobranca',
    process_number: '',
    court: '',
    filing_date: '',
    lawyer_name: '',
    lawyer_contact: '',
  });
  const [saving, setSaving] = useState(false);
  const limit = 10;

  const queryUrl = `/api/legal-processes?page=${page}&limit=${limit}&status=${statusFilter}${debouncedSearch ? `&lawyer=${encodeURIComponent(debouncedSearch)}` : ''}${tenantQuery ? `&${tenantQuery}` : ''}`;
  const canFetch = !authLoading && Boolean(user) && !needsTenantSelection;
  const { data, error, isLoading, mutate } = useSWR<LegalResponse>(
    canFetch ? [queryUrl, user?.id || 'anon'] : null,
    ([url]) => fetcher(url)
  );

  const processes = data?.legal_processes || [];

  const setField = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSearch = () => {
    setDebouncedSearch(searchTerm.trim());
    setPage(1);
  };

  const handleCreate = async () => {
    setFormError('');
    if (!form.case_id.trim()) {
      setFormError('Informe o ID do caso.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/legal-processes', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          case_id: form.case_id.trim(),
          tenant_id: tenantQuery ? tenantQuery.split('=')[1] : undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setFormError(json?.error || 'Não foi possível criar o processo jurídico.');
        return;
      }
      setShowCreate(false);
      setForm({ case_id: '', process_type: 'cobranca', process_number: '', court: '', filing_date: '', lawyer_name: '', lawyer_contact: '' });
      mutate();
      setAlertMessage('Processo jurídico criado com sucesso.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (p: LegalProcess, status: LegalProcess['status']) => {
    const res = await fetchWithAuth(`/api/legal-processes/${p.id}?${tenantQuery}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    const json = await res.json().catch(() => null);
    if (res.ok) {
      mutate();
      setAlertMessage(json?.legal_process?.status || 'Status atualizado.');
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
              <Scale className="h-6 w-6 text-purple-600" />
              Pipeline Jurídico
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Acompanhamento de processos de execução, monitória e cobrança com escala automática
              para estágio especializada, vara, advogado responsável e auditoria dupla.
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowCreate(true); setFormError(''); }}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Novo Processo
              </button>
              <button
                onClick={() => mutate()}
                className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
                title="Atualizar lista"
                aria-label="Atualizar lista de processos jurídicos"
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
            <h2 className="mb-4 text-sm font-bold text-slate-900">Criar processo jurídico</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-slate-700">ID do caso *</span>
                <input
                  value={form.case_id}
                  onChange={(e) => setField('case_id', e.target.value)}
                  placeholder="uuid do caso"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-slate-700">Tipo de processo</span>
                <select
                  value={form.process_type}
                  onChange={(e) => setField('process_type', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900"
                >
                  <option value="execucao">Execução</option>
                  <option value="monitoria">Monitória</option>
                  <option value="cobranca">Cobrança</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-slate-700">Nº do processo</span>
                <input
                  value={form.process_number}
                  onChange={(e) => setField('process_number', e.target.value)}
                  placeholder="NUCOM.0000000-00.2026.8.26.0000"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-slate-700">Vara / Comarca</span>
                <input
                  value={form.court}
                  onChange={(e) => setField('court', e.target.value)}
                  placeholder="2ª Vara Cível — São Paulo/SP"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-slate-700">Data de distribuição</span>
                <input
                  type="date"
                  value={form.filing_date}
                  onChange={(e) => setField('filing_date', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-slate-700">Advogado responsável</span>
                <input
                  value={form.lawyer_name}
                  onChange={(e) => setField('lawyer_name', e.target.value)}
                  placeholder="Dr(a). Nome do advogado"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-slate-700">Contato do advogado</span>
                <input
                  value={form.lawyer_contact}
                  onChange={(e) => setField('lawyer_contact', e.target.value)}
                  placeholder="email / telefone"
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
              {(['all', 'open', 'in_progress', 'judgment_won', 'judgment_lost', 'closed'] as const).map((s) => (
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
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                  placeholder="Buscar por advogado"
                  className="w-52 rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <button
                onClick={handleSearch}
                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Buscar
              </button>
              {debouncedSearch && (
                <button
                  onClick={() => { setSearchTerm(''); setDebouncedSearch(''); setPage(1); }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-100/70 text-xs font-semibold tracking-wider text-slate-500 uppercase">
                <tr>
                  <th className="px-6 py-3.5">Situação</th>
                  <th className="px-6 py-3.5">Processo</th>
                  <th className="px-6 py-3.5">Cliente / Caso</th>
                  <th className="px-6 py-3.5">Vara</th>
                  <th className="px-6 py-3.5">Advogado</th>
                  <th className="px-6 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 bg-white">
                {error ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-red-600">
                      <AlertCircle className="mx-auto mb-2 h-8 w-8" />
                      Não foi possível carregar os processos jurídicos.
                    </td>
                  </tr>
                ) : isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-slate-400" />
                      Carregando...
                    </td>
                  </tr>
                ) : processes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <Scale className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                      Nenhum processo jurídico encontrado.
                    </td>
                  </tr>
                ) : (
                  processes.map((p) => (
                    <tr key={p.id} className="transition-colors hover:bg-slate-50/80">
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${STATUS_META[p.status].className}`}>
                          {STATUS_META[p.status].label}
                        </span>
                        {p.financial_titles?.current_value && (
                          <div className="mt-1 text-xs font-semibold text-slate-500">{money.format(p.financial_titles.current_value)}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <Gavel className="h-4 w-4 text-purple-500" />
                          <span className="font-medium text-slate-800">{TYPE_META[p.process_type] || p.process_type}</span>
                        </div>
                        {p.process_number && <div className="mt-0.5 text-xs font-mono text-slate-400">{p.process_number}</div>}
                        {p.filing_date && (
                          <div className="text-xs text-slate-400">
                            Distribuição: {new Date(p.filing_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800">{p.clients?.name || '—'}</div>
                        <div className="text-xs text-slate-400">{p.cases?.name || (p.case_id ? p.case_id.slice(0, 8) : '—')}</div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {p.court && (
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                            {p.court}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {p.lawyer_name ? (
                          <>
                            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                              <UserRound className="h-3.5 w-3.5 text-slate-400" />
                              {p.lawyer_name}
                            </span>
                            {p.lawyer_contact && <div className="mt-0.5 text-slate-400">{p.lawyer_contact}</div>}
                          </>
                        ) : (
                          <span className="text-slate-300">Não informado</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isAdmin && (
                          <div className="flex justify-end gap-1">
                            {p.status === 'open' && (
                              <button
                                onClick={() => handleStatusChange(p, 'in_progress')}
                                title="Marcar em andamento"
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-sky-50 hover:text-sky-600"
                              >
                                <Scale className="h-4 w-4" />
                              </button>
                            )}
                            {['open', 'in_progress'].includes(p.status) && (
                              <>
                                <button
                                  onClick={() => handleStatusChange(p, 'judgment_won')}
                                  title="Vitória judicial"
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleStatusChange(p, 'judgment_lost')}
                                  title="Sentença desfavorável"
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                >
                                  <AlertCircle className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            {['open', 'in_progress', 'judgment_won', 'judgment_lost'].includes(p.status) && (
                              <button
                                onClick={() => handleStatusChange(p, 'closed')}
                                title="Encerrar processo"
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                              >
                                <Gavel className="h-4 w-4" />
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