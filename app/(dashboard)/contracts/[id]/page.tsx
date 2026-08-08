'use client';

import { useEffect, useMemo, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, FileText, CheckCircle, CircleDollarSign, XCircle, AlertCircle, Play, RefreshCw } from 'lucide-react';
import { Client, ContractWithClient, FinancialTitleWithEligibility, FinancialTitlesResponse } from '@/lib/types';
import { formatPhoneInput, formatCurrency } from '@/lib/utils';
import { fetcher, fetchWithAuth } from '@/lib/api';
import { useActiveTenant } from '@/hooks/use-active-tenant';
import { useTitleBaixaActions } from '@/hooks/use-title-baixa';
import { TitleStatusBadge } from '@/components/financial-titles/title-status-badge';
import { PartialPaymentModal } from '@/components/financial-titles/partial-payment-modal';

type ContractLoadError = 'not_found' | 'network' | 'server';

type CollectionError = {
  titleId: string;
  message: string;
  code?: string;
};

const CASE_CREATION_ERROR_MESSAGES: Record<string, string> = {
  ACTIVE_CASE_EXISTS: 'Já existe um caso ativo para este título financeiro. Não é possível abrir outro enquanto ele estiver em andamento.',
  TITLE_NOT_OVERDUE: 'Este título ainda não está vencido. A cobrança só pode ser iniciada após o vencimento.',
  TITLE_NOT_COLLECTIBLE: 'Este título está pago, quitado ou cancelado e não pode gerar cobrança.',
  TITLE_NOT_FOUND: 'Título financeiro não encontrado ou indisponível para este tenant.',
  TENANT_REQUIRED: 'Selecione um tenant ativo antes de iniciar a cobrança.',
};

const CLOSED_STATUSES = ['paid', 'settled', 'recovered', 'cancelled', 'canceled'];

function isClosedTitle(status: string): boolean {
  return CLOSED_STATUSES.includes(status.toLowerCase());
}

export default function ContractDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const contractId = unwrappedParams.id;
  const { user, authLoading, tenantId, tenantQuery, tenantPath, needsTenantSelection } = useActiveTenant();

  const [contract, setContract] = useState<ContractWithClient | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ContractLoadError | null>(null);
  const [startingCollectionId, setStartingCollectionId] = useState<string | null>(null);
  const [collectionError, setCollectionError] = useState<CollectionError | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [partialTitle, setPartialTitle] = useState<FinancialTitleWithEligibility | null>(null);

  const canFetchTitles = !authLoading && Boolean(user) && !needsTenantSelection && Boolean(contractId);
  const titlesUrl = canFetchTitles
    ? `/api/financial-titles?contract_id=${encodeURIComponent(contractId)}${tenantQuery ? `&${tenantQuery}` : ''}`
    : null;
  const {
    data: titlesData,
    error: titlesError,
    isLoading: titlesLoading,
    mutate: mutateTitles,
  } = useSWR<FinancialTitlesResponse>(titlesUrl, fetcher);

  const { busyId, bulkBusy, baixaTotal, baixaParcial, cancelar, baixaTotalEmMassa } =
    useTitleBaixaActions(tenantId, () => mutateTitles());

  const financialTitles: FinancialTitleWithEligibility[] = useMemo(
    () => titlesData?.financial_titles || [],
    [titlesData]
  );

  useEffect(() => {
    const fetchContract = async () => {
      if (authLoading) return;
      if (!user || needsTenantSelection) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError(null);
      try {
        const contractResponse = await fetchWithAuth(`/api/contracts/${contractId}${tenantPath}`);
        const contractData = await contractResponse.json() as { contract?: ContractWithClient; error?: string };
        if (!contractResponse.ok) {
          setLoadError(contractResponse.status === 404 ? 'not_found' : 'server');
          return;
        }
        const typedContract = contractData.contract;
        if (!typedContract) {
          setLoadError('server');
          return;
        }
        setContract(typedContract);
        setClient(typedContract.clients ?? null);
      } catch (err) {
        console.error(err);
        setLoadError(err instanceof TypeError ? 'network' : 'server');
      } finally {
        setLoading(false);
      }
    };

    fetchContract();
  }, [authLoading, contractId, needsTenantSelection, tenantPath, user]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => financialTitles.some((title) => title.id === id)));
  }, [financialTitles]);

  const selectableTitles = financialTitles.filter((title) => !isClosedTitle(title.status));
  const allSelected = selectableTitles.length > 0 && selectableTitles.every((title) => selectedIds.includes(title.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : selectableTitles.map((title) => title.id));
  };

  const handleStartCollection = async (title: FinancialTitleWithEligibility) => {
    if (!client || !contract) return;
    setCollectionError(null);
    if (!title.eligible) {
      setCollectionError({ titleId: title.id, message: getEligibilityMessage(title.eligibility_reason) });
      return;
    }

    setStartingCollectionId(title.id);
    try {
      const response = await fetchWithAuth('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ financial_title_id: title.id, tenant_id: tenantId || undefined })
      });

      const data = await response.json().catch(() => null) as { case?: { id: string }; error?: string; code?: string } | null;
      if (!response.ok || !data?.case) {
        const code = typeof data?.code === 'string' ? data.code : undefined;
        const message = (code && CASE_CREATION_ERROR_MESSAGES[code])
          || data?.error
          || 'Não foi possível criar o caso de cobrança. Tente novamente.';
        setCollectionError({ titleId: title.id, message, code });
        return;
      }

      router.push(`/cases/${data.case.id}${tenantPath}`);
    } catch (err: unknown) {
      console.error(err);
      setCollectionError({
        titleId: title.id,
        message: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.'
      });
    } finally {
      setStartingCollectionId(null);
    }
  };

  const handleCancelTitle = (title: FinancialTitleWithEligibility) => {
    if (window.confirm('Cancelar este título financeiro? Esta ação não pode ser desfeita.')) {
      void cancelar(title.id);
    }
  };

  const handleBulkBaixa = () => {
    if (selectedIds.length === 0) return;
    void baixaTotalEmMassa(selectedIds);
    setSelectedIds([]);
  };

  const getEligibilityMessage = (reason: FinancialTitleWithEligibility['eligibility_reason']) => {
    if (reason === 'future') return 'Este título ainda não venceu. Revise o vencimento antes de iniciar a cobrança.';
    if (reason === 'today') return 'Este título vence hoje e só poderá gerar cobrança a partir de amanhã.';
    if (reason === 'paid') return 'Este título já foi pago ou está quitado e não pode gerar um caso.';
    if (reason === 'cancelled') return 'Este título foi cancelado e não pode gerar um caso.';
    return 'Este título não está elegível para cobrança.';
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 flex items-center justify-center">
          <p className="text-gray-500">Carregando detalhes do contrato...</p>
        </main>
      </div>
    );
  }

  if (needsTenantSelection) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-12">
          <div className="bg-white rounded-2xl border border-amber-200 p-8 text-center shadow-sm">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-gray-900">Selecione um tenant para continuar</h1>
            <p className="text-sm text-gray-500 mt-2">O contrato exige um tenant ativo para usuários super-admin. Nenhuma operação foi executada.</p>
            <Link href="/contracts" className="inline-flex mt-5 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800">
              Voltar para contratos
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (loadError || !contract) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
          <div className="bg-white rounded-xl border border-red-100 p-8 text-center shadow-sm">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <h1 className="text-xl font-semibold text-gray-900">
              {loadError === 'network' ? 'Não foi possível conectar ao servidor.' : loadError === 'server' ? 'Não foi possível carregar o contrato.' : 'Contrato não encontrado.'}
            </h1>
            <p className="text-sm text-gray-500 mt-2">
              {loadError === 'network' ? 'Verifique sua conexão e tente novamente.' : loadError === 'server' ? 'Tente novamente em instantes.' : 'O contrato pode ter sido removido ou você não tem acesso.'}
            </p>
            <Link href={`/contracts${tenantPath}`} className="inline-flex mt-5 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800">
              Voltar para contratos
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const maxDaysLate = financialTitles.length > 0
    ? Math.max(...financialTitles.map((title) => title.days_overdue))
    : 0;

  const isNegativeAllowed = contract?.negative_allowed ?? contract?.collection_policies?.negative_allowed;
  const daysToNegative = contract?.override_days_to_negative ?? contract?.collection_policies?.days_to_negative;

  const isProtestAllowed = contract?.protest_allowed ?? contract?.collection_policies?.protest_allowed;
  const daysToProtest = contract?.override_days_to_protest ?? contract?.collection_policies?.days_to_protest;

  let alertMessage = null;
  if (isProtestAllowed && daysToProtest && maxDaysLate >= daysToProtest) {
    alertMessage = `Ação Requerida: Cliente possui parcelas com ${maxDaysLate} dias de atraso. O contrato ultrapassou o prazo de ${daysToProtest} dias e está passível de Protesto.`;
  } else if (isNegativeAllowed && daysToNegative && maxDaysLate >= daysToNegative) {
    alertMessage = `Ação Requerida: Cliente possui parcelas com ${maxDaysLate} dias de atraso. O contrato ultrapassou o prazo de ${daysToNegative} dias e está passível de Negativação.`;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">

        <Link href={`/contracts${tenantPath}`} className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar para Contratos
        </Link>

        {alertMessage && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{alertMessage}</p>
          </div>
        )}

        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">
              Contrato {contract.contract_number ? `#${contract.contract_number}` : ''}
            </h1>
            <p className="text-gray-500 mt-1">{client?.name} • {client?.document}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-medium text-gray-900">Títulos Financeiros</h2>
                {financialTitles.length > 0 && (
                  <button
                    onClick={handleBulkBaixa}
                    disabled={bulkBusy || selectedIds.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {bulkBusy ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CircleDollarSign className="w-3.5 h-3.5" />
                    )}
                    Baixa total dos selecionados ({selectedIds.length})
                  </button>
                )}
              </div>

              {titlesError && (
                <div className="px-6 py-4 border-b border-red-100 bg-red-50 text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Não foi possível carregar os títulos financeiros. {titlesError instanceof Error ? titlesError.message : ''}</span>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm text-gray-600">
                  <thead className="bg-gray-50/50 text-gray-500 font-medium">
                    <tr>
                      <th scope="col" className="px-6 py-4 w-12">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          disabled={selectableTitles.length === 0}
                          onChange={toggleSelectAll}
                          aria-label="Selecionar todos os títulos disponíveis"
                          className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </th>
                      <th scope="col" className="px-6 py-4">Parcela</th>
                      <th scope="col" className="px-6 py-4">Vencimento</th>
                      <th scope="col" className="px-6 py-4">Valor Original</th>
                      <th scope="col" className="px-6 py-4">Saldo</th>
                      <th scope="col" className="px-6 py-4">Status</th>
                      <th scope="col" className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {titlesLoading && financialTitles.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                          Carregando títulos financeiros...
                        </td>
                      </tr>
                    ) : financialTitles.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                          Nenhum título gerado para este contrato.
                        </td>
                      </tr>
                    ) : (
                      financialTitles.map((title) => {
                        const closed = isClosedTitle(title.status);
                        const remaining = title.current_value != null ? Number(title.current_value) : Number(title.original_value);
                        const busy = busyId === title.id;
                        return (
                          <tr key={title.id} className="hover:bg-gray-50/50">
                            <td className="px-6 py-4">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(title.id)}
                                disabled={closed}
                                onChange={() => toggleSelect(title.id)}
                                aria-label={`Selecionar parcela ${title.installment_number}`}
                                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-40"
                              />
                            </td>
                            <td className="px-6 py-4 font-medium text-gray-900">{title.installment_number}</td>
                            <td className="px-6 py-4">
                              {new Date(title.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                            </td>
                            <td className="px-6 py-4">{formatCurrency(Number(title.original_value))}</td>
                            <td className="px-6 py-4">
                              <span className={closed ? 'text-gray-400' : 'font-medium text-gray-900'}>{formatCurrency(remaining)}</span>
                            </td>
                            <td className="px-6 py-4">
                              <TitleStatusBadge status={title.status} />
                              {title.paid_at && (
                                <p className="mt-1 text-xs text-gray-500">Pago em {new Date(title.paid_at).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                              )}
                              {!title.eligible && !closed && (
                                <p className="mt-1 text-xs text-gray-500">{getEligibilityMessage(title.eligibility_reason)} ({title.days_overdue} dias)</p>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                {!closed && (
                                  <>
                                    <button
                                      onClick={() => void baixaTotal(title.id)}
                                      disabled={busy}
                                      aria-label={`Baixa total da parcela ${title.installment_number}`}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                                      title="Baixa total"
                                    >
                                      {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CircleDollarSign className="w-3.5 h-3.5" />}
                                      <span className="hidden md:inline">Baixa total</span>
                                      <span className="md:hidden">Pagar</span>
                                    </button>
                                    <button
                                      onClick={() => setPartialTitle(title)}
                                      disabled={busy}
                                      aria-label={`Baixa parcial da parcela ${title.installment_number}`}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200/80 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                                      title="Baixa parcial"
                                    >
                                      {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                      <span className="hidden md:inline">Parcial</span>
                                      <span className="md:hidden">Parcial</span>
                                    </button>
                                    <button
                                      onClick={() => handleCancelTitle(title)}
                                      disabled={busy}
                                      aria-label={`Cancelar parcela ${title.installment_number}`}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-red-600 border border-gray-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                                      title="Cancelar título"
                                    >
                                      <XCircle className="w-3.5 h-3.5" />
                                      <span className="hidden md:inline">Cancelar</span>
                                      <span className="md:hidden">Canc.</span>
                                    </button>
                                  </>
                                )}
                                {title.eligible && (
                                  <button
                                    onClick={() => handleStartCollection(title)}
                                    disabled={startingCollectionId === title.id || busy}
                                    aria-label={`Iniciar cobrança da parcela ${title.installment_number}`}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-50"
                                    title="Iniciar Cobrança Automática via IA"
                                  >
                                    {startingCollectionId === title.id ? (
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Play className="w-3.5 h-3.5 fill-current" />
                                    )}
                                    <span className="hidden md:inline">Iniciar Cobrança</span>
                                    <span className="md:hidden">Cobrança</span>
                                  </button>
                                )}
                              </div>
                              {collectionError?.titleId === title.id && (
                                <div role="alert" className="mt-2 max-w-xs ml-auto rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left">
                                  <p className="text-xs text-red-700 font-medium">{collectionError.message}</p>
                                  {collectionError.code === 'ACTIVE_CASE_EXISTS' && (
                                    <Link
                                      href={`/cases${tenantPath}`}
                                      className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-red-700 underline hover:text-red-900"
                                    >
                                      Acompanhar caso existente no módulo de Casos
                                    </Link>
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
            </div>

          </div>

          {/* Sidebar */}
          <div className="space-y-6">

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Regras de Cobrança</h3>

              {contract.collection_policies && (
                <div className="mb-4 pb-4 border-b border-gray-100">
                  <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded-md">
                    Política: {contract.collection_policies.name}
                  </span>
                </div>
              )}

              <ul className="space-y-4 text-sm text-gray-700">
                <li className="flex justify-between">
                  <span className="text-gray-500">Juros de Mora</span>
                  <span className="font-medium">
                    {contract.interest_rate ?? contract.collection_policies?.interest_rate ?? '-'}% a.m.
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-500">Multa por Atraso</span>
                  <span className="font-medium">
                    {contract.penalty_rate ?? contract.collection_policies?.penalty_rate ?? '-'}%
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-500">Índice Correção</span>
                  <span className="font-medium">
                    {contract.monetary_correction_index || contract.collection_policies?.monetary_correction_index || '-'}
                  </span>
                </li>

                <li className="flex flex-col gap-1 mt-4 pt-4 border-t border-gray-50">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Negativação Permitida</span>
                    <span className="font-medium">
                      {(contract.negative_allowed ?? contract.collection_policies?.negative_allowed) ? 'Sim' : 'Não'}
                    </span>
                  </div>
                  {(contract.negative_allowed ?? contract.collection_policies?.negative_allowed) && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Prazo para negativar</span>
                      <span className="font-medium text-gray-600">
                        Após {contract.override_days_to_negative ?? contract.collection_policies?.days_to_negative ?? '-'} dias
                      </span>
                    </div>
                  )}
                </li>

                <li className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Protesto Permitido</span>
                    <span className="font-medium">
                      {(contract.protest_allowed ?? contract.collection_policies?.protest_allowed) ? 'Sim' : 'Não'}
                    </span>
                  </div>
                  {(contract.protest_allowed ?? contract.collection_policies?.protest_allowed) && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Prazo para protestar</span>
                      <span className="font-medium text-gray-600">
                        Após {contract.override_days_to_protest ?? contract.collection_policies?.days_to_protest ?? '-'} dias
                      </span>
                    </div>
                  )}
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Dados do Cliente</h3>
              <ul className="space-y-4 text-sm text-gray-700">
                <li>
                  <span className="text-gray-500 block mb-1">Nome</span>
                  <span className="font-medium">{client?.name}</span>
                </li>
                <li>
                  <span className="text-gray-500 block mb-1">Documento</span>
                  <span className="font-medium">{client?.document}</span>
                </li>
                {client?.email && (
                  <li>
                    <span className="text-gray-500 block mb-1">Email</span>
                    <span className="font-medium">{client?.email}</span>
                  </li>
                )}
                {client?.phone && (
                  <li>
                    <span className="text-gray-500 block mb-1">Telefone</span>
                    <span className="font-medium">{formatPhoneInput(client.phone)}</span>
                  </li>
                )}
              </ul>
            </div>

          </div>
        </div>

      </main>

      <PartialPaymentModal
        title={partialTitle}
        busy={partialTitle ? busyId === partialTitle.id : false}
        onConfirm={async (amount) => {
          if (!partialTitle) return;
          const ok = await baixaParcial(partialTitle.id, amount);
          if (ok) setPartialTitle(null);
        }}
        onClose={() => setPartialTitle(null)}
      />
    </div>
  );
}