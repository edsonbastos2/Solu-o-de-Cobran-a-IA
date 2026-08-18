'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useActiveTenant } from '@/hooks/use-active-tenant';
import { useNegotiationActions } from '@/hooks/use-negotiation-actions';
import {
  Handshake,
  AlertCircle,
  RefreshCw,
  CheckCircle,
  Eye,
  FileDown
} from 'lucide-react';
import { Pagination } from '@/components/pagination';
import { NegotiationWithRelations, NegotiationsListResponse } from '@/lib/types';
import { NegotiationStatusBadge } from '@/components/negotiations/negotiation-status-badge';
import { fetcher } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

export default function NegotiationsPage() {
  const { user, authLoading, tenantId, tenantQuery, tenantPath, needsTenantSelection } = useActiveTenant();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const limit = 10;

  const queryUrl = `/api/negotiations?page=${page}&limit=${limit}&status=${statusFilter}${tenantQuery ? `&${tenantQuery}` : ''}`;
  const canFetch = !authLoading && Boolean(user) && !needsTenantSelection;
  const { data, error, isLoading: loading, mutate } = useSWR<NegotiationsListResponse>(
    canFetch ? [queryUrl, user?.id || 'anon', tenantId] : null,
    ([url]) => fetcher(url)
  );
  const { updatingId, handleTransition } = useNegotiationActions(tenantId, () => mutate());

  const negotiations: NegotiationWithRelations[] = data?.negotiations || [];

  if (needsTenantSelection) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-12">
          <div className="bg-white rounded-2xl border border-amber-200 p-8 text-center shadow-sm">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-slate-900">Selecione um tenant para continuar</h1>
            <p className="text-sm text-slate-500 mt-2">O módulo de acordos exige um tenant ativo. Nenhuma operação foi executada.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <Handshake className="w-8 h-8 text-emerald-600" />
              Acordos Formais
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Acompanhe acordos fechados pela IA ou por operadores, seus prazos e cumprimento.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={`/api/reports/agreements.csv?${tenantQuery ? `${tenantQuery}&` : ''}status=${statusFilter}`}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl transition-colors shadow-sm text-xs font-semibold"
              title="Exportar acordos (CSV)"
            >
              <FileDown className="w-4 h-4 text-emerald-600" />
              Exportar CSV
            </a>
            <button
              onClick={() => mutate()}
              className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
              title="Atualizar lista"
              aria-label="Atualizar lista de acordos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
          <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-50/50">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'accepted', label: 'Aceitos' },
                { id: 'open', label: 'Em negociação' },
                { id: 'fulfilled', label: 'Cumpridos' },
                { id: 'expired', label: 'Expirados' },
                { id: 'defaulted', label: 'Não cumpridos' }
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

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap">
              <thead className="bg-slate-100/70 text-slate-500 font-semibold uppercase text-xs tracking-wider border-b border-slate-200">
                <tr>
                  <th scope="col" className="px-6 py-3.5">Devedor</th>
                  <th scope="col" className="px-6 py-3.5">Valores (Orig. / Acordado)</th>
                  <th scope="col" className="px-6 py-3.5">Desconto / Parcelas</th>
                  <th scope="col" className="px-6 py-3.5">Expira em</th>
                  <th scope="col" className="px-6 py-3.5">Status</th>
                  <th scope="col" className="px-6 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 bg-white">
                {error ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-red-600">
                      <div className="max-w-sm mx-auto flex flex-col items-center gap-2">
                        <AlertCircle className="w-8 h-8" />
                        <p className="font-semibold">Não foi possível carregar os acordos</p>
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
                ) : loading && negotiations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 inline-block mr-2" />
                      Carregando acordos...
                    </td>
                  </tr>
                ) : negotiations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 whitespace-normal">
                      <div className="max-w-sm mx-auto flex flex-col items-center">
                        <Handshake className="w-12 h-12 text-slate-300 mb-3" />
                        <p className="font-semibold text-slate-700 text-base">Nenhum acordo encontrado</p>
                        <p className="text-xs text-slate-400 mt-1 text-center">
                          Acordos fechados pela IA ou cadastrados manualmente aparecerão aqui.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  negotiations.map((n) => {
                    const originalVal = Number(n.original_value) || 0;
                    const agreedVal = Number(n.agreed_value) || 0;
                    const debtorName = n.clients?.name || n.cases?.name || '—';
                    return (
                      <tr key={n.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900 text-sm truncate max-w-[220px]" title={debtorName}>{debtorName}</div>
                          {n.cases && (
                            <div className="text-xs text-slate-400 mt-0.5">Caso vinculado</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {agreedVal > 0 ? (
                            <>
                              <div className="font-semibold text-slate-900 text-sm">{formatCurrency(agreedVal)}</div>
                              {originalVal > agreedVal && (
                                <div className="text-xs text-slate-400 line-through">{formatCurrency(originalVal)}</div>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-slate-700 text-sm font-medium">
                            {n.discount_percent != null ? `${n.discount_percent}% desc.` : '—'}
                          </div>
                          <div className="text-xs text-slate-400">
                            {n.installment_count ? `${n.installment_count}x` : 'Sem parcelas'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {n.expires_at ? (
                            <>
                              <div className="text-slate-700 text-sm font-medium">
                                {new Date(n.expires_at).toLocaleDateString('pt-BR')}
                              </div>
                              {n.status === 'accepted' && new Date(n.expires_at) < new Date() && (
                                <div className="text-xs text-red-500">Vencido</div>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-400">Sem prazo</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <NegotiationStatusBadge status={n.status} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {n.status === 'open' && (
                              <button
                                onClick={() => handleTransition(n.id, 'accept')}
                                disabled={updatingId === n.id}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold transition-colors border border-emerald-200/80 shadow-sm"
                              >
                                {updatingId === n.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Handshake className="w-3.5 h-3.5" />}
                                Aceitar
                              </button>
                            )}

                            {n.status === 'accepted' && (
                              <button
                                onClick={() => handleTransition(n.id, 'fulfill')}
                                disabled={updatingId === n.id}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-lg text-xs font-semibold transition-colors border border-teal-200/80 shadow-sm"
                              >
                                {updatingId === n.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                Marcar Cumprido
                              </button>
                            )}

                            {n.case_id && (
                              <Link
                                href={`/cases/${n.case_id}${tenantPath}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm"
                                title="Ver caso vinculado"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Caso
                              </Link>
                            )}
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