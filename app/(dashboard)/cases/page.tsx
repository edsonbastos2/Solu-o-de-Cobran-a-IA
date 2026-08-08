'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import { useActiveTenant } from '@/hooks/use-active-tenant';
import {
  FolderKanban, 
  Search, 
  Bot, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Eye, 
  Play, 
  Radio, 
  RefreshCw, 
  MessageSquare
} from 'lucide-react';
import { formatPhoneInput } from '@/lib/utils';
import { Pagination } from '@/components/pagination';
import { Case, CasesListResponse } from '@/lib/types';

import { fetcher, fetchWithAuth } from '@/lib/api';

export default function CasesPage() {
  const { user, authLoading, tenantId, tenantQuery, tenantPath, needsTenantSelection } = useActiveTenant();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startingNegotiationId, setStartingNegotiationId] = useState<string | null>(null);
  const limit = 10;

  const queryUrl = `/api/cases?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&status=${statusFilter}${tenantQuery ? `&${tenantQuery}` : ''}`;
  const canFetch = !authLoading && Boolean(user) && !needsTenantSelection;
  const { data, error, isLoading: loading, mutate } = useSWR<CasesListResponse>(canFetch ? [queryUrl, user?.id || 'anon', tenantId] : null, ([url]) => fetcher(url), {
    refreshInterval: 5000 // Polling fallback every 5s
  });

  const cases: Case[] = data?.cases || [];

  // Real-time subscription to cases changes
  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const channel = client
      .channel('realtime-cases-list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cases'
        },
        () => {
          mutate();
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [mutate]);

  if (needsTenantSelection) {
    return (
<div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-12">
          <div className="bg-white rounded-2xl border border-amber-200 p-8 text-center shadow-sm">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-slate-900">Selecione um tenant para continuar</h1>
            <p className="text-sm text-slate-500 mt-2">O módulo de casos exige um tenant ativo para usuários super-admin. Nenhuma operação foi executada.</p>
          </div>
        </main>
      </div>
    );
  }

  const handleStartNegotiation = async (caseId: string) => {
    setStartingNegotiationId(caseId);
    try {
      const res = await fetchWithAuth('/api/start-negotiation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, tenant_id: tenantId || undefined })
      });

      const resData = await res.json();
      if (!res.ok) {
        alert(resData.error || 'Erro ao iniciar negociação por IA');
      } else {
        mutate();
      }
    } catch (err: unknown) {
      alert('Erro ao conectar com o servidor: ' + (err instanceof Error ? err.message : 'erro desconhecido'));
    } finally {
      setStartingNegotiationId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_negotiation':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            Em Negociação (IA)
          </span>
        );
      case 'needs_attention':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            Requer Atenção Humana
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            Acordo Fechado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Não Iniciado
          </span>
        );
    }
  };

  // Metrics count
  const allCasesCount = data?.total || 0;
  const totalInNegotiation = cases.filter(c => c.status === 'in_negotiation').length;
  const totalNeedsAttention = cases.filter(c => c.status === 'needs_attention').length;
  const totalClosed = cases.filter(c => c.status === 'closed').length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-100/80 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-600" />
                Sincronização em Tempo Real
              </span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <FolderKanban className="w-8 h-8 text-emerald-600" />
              Módulo de Casos de Cobrança
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Acompanhe suas negociações em tempo real, intervenha via WhatsApp ou ative atendimentos com IA.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => mutate()}
              className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
              title="Atualizar lista"
              aria-label="Atualizar lista de casos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total de Casos</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{allCasesCount}</p>
            </div>
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
              <FolderKanban className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Em Negociação (IA)</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{totalInNegotiation}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <Bot className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Requer Atenção</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{totalNeedsAttention}</p>
            </div>
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
              <AlertCircle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Acordos Fechados</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{totalClosed}</p>
            </div>
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
          <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-50/50">
              {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <label htmlFor="cases-search" className="sr-only">Buscar casos</label>
              <input
                id="cases-search"
                type="text"
                placeholder="Buscar por nome, telefone, documento ou email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
              />
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'in_negotiation', label: 'Em Negociação' },
                { id: 'needs_attention', label: 'Requer Atenção' },
                { id: 'closed', label: 'Acordo Fechado' },
                { id: 'not_started', label: 'Não Iniciados' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setStatusFilter(tab.id);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    statusFilter === tab.id
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-100/70 text-slate-500 font-semibold uppercase text-xs tracking-wider border-b border-slate-200">
                <tr>
                  <th scope="col" className="px-6 py-3.5">Devedor</th>
                  <th scope="col" className="px-6 py-3.5">Contato</th>
                  <th scope="col" className="px-6 py-3.5">Valores (Orig. / Atual)</th>
                  <th scope="col" className="px-6 py-3.5">Vencimento</th>
                  <th scope="col" className="px-6 py-3.5">Origem</th>
                  <th scope="col" className="px-6 py-3.5">Status</th>
                  <th scope="col" className="px-6 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 bg-white">
                {error ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-red-600">
                      <div className="max-w-sm mx-auto flex flex-col items-center gap-2">
                        <AlertCircle className="w-8 h-8" />
                        <p className="font-semibold">Não foi possível carregar a lista de casos</p>
                        <p className="text-xs text-red-500">{error instanceof Error ? error.message : 'Tente novamente.'}</p>
                        <button
                          type="button"
                          onClick={() => mutate()}
                          className="mt-2 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold"
                        >
                          Tentar novamente
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : loading && cases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                        <span>Carregando casos em tempo real...</span>
                      </div>
                    </td>
                  </tr>
                ) : cases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      <div className="max-w-sm mx-auto flex flex-col items-center">
                        <FolderKanban className="w-12 h-12 text-slate-300 mb-3" />
                        <p className="font-semibold text-slate-700 text-base">Nenhum caso encontrado</p>
                        <p className="text-xs text-slate-400 mt-1 text-center">
                          Vá para o módulo de Contratos para iniciar uma nova cobrança a partir de títulos em atraso.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  cases.map((c) => {
                    const originalVal = Number(c.original_value) || 0;
                    const updatedVal = Number(c.updated_value) || originalVal;
                    const formattedOriginal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(originalVal);
                    const formattedUpdated = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(updatedVal);

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors group">
                        {/* Devedor */}
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900 text-sm">{c.name}</div>
                          {c.debtor_document && (
                            <div className="text-xs text-slate-400 mt-0.5 font-mono">
                              CPF/CNPJ: {c.debtor_document}
                            </div>
                          )}
                        </td>

                        {/* Contato */}
                        <td className="px-6 py-4">
                          <div className="text-slate-800 font-medium text-sm flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                            {formatPhoneInput(c.phone)}
                          </div>
                          {c.debtor_email && (
                            <div className="text-xs text-slate-400 truncate max-w-[180px] mt-0.5">
                              {c.debtor_email}
                            </div>
                          )}
                        </td>

                        {/* Valores */}
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900 text-sm">{formattedUpdated}</div>
                          {updatedVal > originalVal && (
                            <div className="text-xs text-slate-400 line-through">
                              {formattedOriginal}
                            </div>
                          )}
                        </td>

                        {/* Vencimento */}
                        <td className="px-6 py-4">
                          <div className="text-slate-700 text-sm font-medium">
                            {new Date(c.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                          </div>
                          <div className="text-xs text-slate-400">
                            Margem: {c.max_discount_margin}% desc.
                          </div>
                        </td>

                        {/* Origem canônica ou contexto legado */}
                        <td className="px-6 py-4">
                          {c.financial_title ? (
                            <>
                              <div className="font-medium text-slate-800">
                                Título #{c.financial_title.installment_number}
                              </div>
                              <div className="text-xs text-slate-400">
                                {c.contract?.contract_number ? `Contrato ${c.contract.contract_number}` : 'Contrato vinculado'}
                              </div>
                            </>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 border border-amber-200">
                              Contexto legado incompleto
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          {getStatusBadge(c.status)}
                        </td>

                        {/* Ações */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {c.status === 'not_started' && (
                              <button
                                onClick={() => handleStartNegotiation(c.id)}
                                disabled={startingNegotiationId === c.id}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold transition-colors border border-emerald-200/80 shadow-sm"
                                title="Iniciar Abordagem de Cobrança por IA"
                              >
                                {startingNegotiationId === c.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Play className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
                                )}
                                Iniciar IA
                              </button>
                            )}

                            <Link
                               href={`/cases/${c.id}${tenantPath}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm"
                              title="Acompanhar em Tempo Real"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Ver Chat Ao Vivo
                            </Link>

                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={page}
            totalPages={data?.totalPages || 1}
            onPageChange={setPage}
            theme="light"
          />
        </div>
      </main>
    </div>
  );
}
