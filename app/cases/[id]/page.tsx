'use client';

import { use, useEffect, useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import { Header } from '@/components/header';

import { fetcher, fetchWithAuth } from '@/lib/api';
import { useActiveTenant } from '@/hooks/use-active-tenant';
import { useNegotiationActions } from '@/hooks/use-negotiation-actions';
import {
  ArrowLeft,
  Bot,
  User as UserIcon,
  Send,
  Radio,
  CheckCircle,
  AlertCircle,
  Clock,
  FileText,
  MessageSquare,
  ShieldAlert,
  Play,
  RefreshCw,
  Download,
  Phone,
  Mail,
  MapPin,
  Sparkles,
  Layers,
  Handshake
} from 'lucide-react';
import { AuditLog, Case, CaseDetailsResponse, Client, ContractWithClient, FinancialTitle, Message, NegotiationWithRelations, NegotiationsListResponse } from '@/lib/types';
import { formatPhoneInput, formatCurrency } from '@/lib/utils';
import { generateCaseDossier, CollectionStageInfo } from '@/lib/finance';
import { NegotiationStatusBadge } from '@/components/negotiations/negotiation-status-badge';

function ObligationContextCard({
  caseData,
  client,
  contract,
  financialTitle,
}: {
  caseData: Case;
  client: Client | null;
  contract: ContractWithClient | null;
  financialTitle: FinancialTitle | null;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
        <Layers className="w-4 h-4 text-emerald-600" />
        Contexto da Obrigação
      </h3>
      <dl className="grid grid-cols-1 gap-3 text-sm">
        <div>
          <dt className="text-xs text-slate-400">Cliente</dt>
          <dd className="font-semibold text-slate-900">{client?.name || caseData.name}</dd>
          {(client?.document || caseData.debtor_document) && <dd className="text-xs text-slate-500">{client?.document || caseData.debtor_document}</dd>}
        </div>
        <div>
          <dt className="text-xs text-slate-400">Contrato</dt>
          <dd className="font-semibold text-slate-900">{contract?.contract_number ? `#${contract.contract_number}` : 'Não vinculado'}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Título financeiro</dt>
          <dd className="font-semibold text-slate-900">{financialTitle ? `Parcela ${financialTitle.installment_number}` : 'Não vinculado'}</dd>
          {financialTitle?.external_reference && <dd className="text-xs text-slate-500">Ref. {financialTitle.external_reference}</dd>}
        </div>
        <div className="flex justify-between border-t border-slate-100 pt-3">
          <span className="text-slate-500">Responsável</span>
          <span className="font-semibold text-slate-900">{caseData.assigned_user_id || 'Não atribuído'}</span>
        </div>
      </dl>
    </div>
  );
}

function FinancialSummaryCard({ caseData, stage, formattedOriginal, formattedUpdated }: {
  caseData: Case;
  stage: CollectionStageInfo | null;
  formattedOriginal: string;
  formattedUpdated: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
        <FileText className="w-4 h-4 text-emerald-600" />
        Resumo Financeiro
      </h3>
      <div className="space-y-3 pt-1">
        <div className="flex justify-between items-center pb-2 border-b border-slate-100 text-sm">
          <span className="text-slate-500">Valor Original:</span>
          <span className="font-semibold text-slate-900">{formattedOriginal}</span>
        </div>
        <div className="flex justify-between items-center pb-2 border-b border-slate-100 text-sm">
          <span className="text-slate-500">Data de Vencimento:</span>
          <span className="font-semibold text-slate-900">{new Date(caseData.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
        </div>
        <div className="flex justify-between items-center pb-2 border-b border-slate-100 text-sm">
          <span className="text-slate-500">Valor Atualizado com Juros:</span>
          <span className="font-bold text-emerald-600 text-base">{formattedUpdated}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-500">Margem Max. Desconto:</span>
          <span className="font-semibold text-amber-600">{caseData.max_discount_margin}%</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-500">Dias em atraso:</span>
          <span className="font-semibold text-slate-900">{stage?.diasAtraso ?? 0}</span>
        </div>
      </div>
    </div>
  );
}

function AuditActivityCard({ auditLogs }: { auditLogs: AuditLog[] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
        <ShieldAlert className="w-4 h-4 text-emerald-600" />
        Atividade de Auditoria
      </h3>
      {auditLogs.length === 0 ? (
        <p className="text-xs text-slate-500">Nenhuma ação auditada disponível.</p>
      ) : (
        <ul className="space-y-3">
          {auditLogs.slice(0, 8).map((log) => (
            <li key={log.id} className="border-l-2 border-emerald-200 pl-3">
              <p className="text-xs font-semibold text-slate-800">{log.action}</p>
              <p className="text-[11px] text-slate-500">{log.details || 'Ação registrada'} · {new Date(log.created_at).toLocaleString('pt-BR')}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface AgreementsSectionProps {
  caseId: string;
  tenantId: string | null;
  canFetch: boolean;
}

function AgreementsSection({ caseId, tenantId, canFetch }: AgreementsSectionProps) {
  const queryUrl = useMemo(() => {
    if (!caseId) return null;
    const params = new URLSearchParams();
    params.set('case_id', caseId);
    params.set('limit', '50');
    if (tenantId) params.set('tenant_id', tenantId);
    return `/api/negotiations?${params.toString()}`;
  }, [caseId, tenantId]);
  const { data, error, isLoading, mutate } = useSWR<NegotiationsListResponse>(
    canFetch ? queryUrl : null,
    fetcher
  );
  const { updatingId, handleTransition } = useNegotiationActions(tenantId, () => mutate());

  const negotiations: NegotiationWithRelations[] = data?.negotiations || [];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Handshake className="w-4 h-4 text-emerald-600" />
          Acordos deste caso
        </h3>
        {isLoading && <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />}
      </div>

      {error ? (
        <p className="text-xs text-red-600">Não foi possível carregar os acordos. {error instanceof Error ? error.message : ''}</p>
      ) : isLoading && negotiations.length === 0 ? (
        <p className="text-xs text-slate-500">Carregando acordos...</p>
      ) : negotiations.length === 0 ? (
        <p className="text-xs text-slate-500">Nenhum acordo registrado para este caso ainda.</p>
      ) : (
        <ul className="space-y-3">
          {negotiations.map((n) => (
            <li key={n.id} className="border border-slate-100 rounded-xl p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <NegotiationStatusBadge status={n.status} />
                <span className="text-xs text-slate-400">
                  Criado em {new Date(n.created_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-xs text-slate-400 block">Valor acordado</span>
                  <span className="font-semibold text-slate-900">
                    {n.agreed_value != null ? formatCurrency(n.agreed_value) : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Parcelas</span>
                  <span className="font-semibold text-slate-900">{n.installment_count ? `${n.installment_count}x` : '—'}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Desconto</span>
                  <span className="font-semibold text-slate-900">{n.discount_percent != null ? `${n.discount_percent}%` : '—'}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Expira em</span>
                  <span className="font-semibold text-slate-900">{n.expires_at ? new Date(n.expires_at).toLocaleDateString('pt-BR') : '—'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {n.status === 'open' && (
                  <button
                    onClick={() => handleTransition(n.id, 'accept')}
                    disabled={updatingId === n.id}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold transition-colors border border-emerald-200/80"
                  >
                    {updatingId === n.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Handshake className="w-3.5 h-3.5" />}
                    Aceitar
                  </button>
                )}
                {n.status === 'accepted' && (
                  <button
                    onClick={() => handleTransition(n.id, 'fulfill')}
                    disabled={updatingId === n.id}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-lg text-xs font-semibold transition-colors border border-teal-200/80"
                  >
                    {updatingId === n.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    Marcar Cumprido
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function CaseDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const caseId = unwrappedParams.id;
  const { user, authLoading, tenantId, tenantPath, needsTenantSelection } = useActiveTenant();
  const canFetch = !authLoading && Boolean(user) && !needsTenantSelection;

  const caseUrl = caseId ? `/api/cases/${caseId}${tenantPath}` : null;
  const { data, error, isLoading: loading, mutate } = useSWR<CaseDetailsResponse>(canFetch ? caseUrl : null, fetcher, {
    refreshInterval: 4000
  });

  const caseData: Case | null = data?.case || null;
  const messages: Message[] = useMemo(() => data?.messages || [], [data?.messages]);
  const stage: CollectionStageInfo | null = data?.stage || null;
  const client: Client | null = data?.client || null;
  const contract: ContractWithClient | null = data?.contract || null;
  const financialTitle: FinancialTitle | null = data?.financial_title || null;
  const auditLogs: AuditLog[] = data?.audit_logs || [];

  // Human intervention input
  const [humanMessage, setHumanMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isStartingIA, setIsStartingIA] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Real-time Supabase channels for live chat and status updates
  useEffect(() => {
    const client = supabase;
    if (!client || !caseId || !canFetch) return;

    // Listen to message inserts for this case
    const messagesChannel = client
      .channel(`realtime-messages-${caseId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `case_id=eq.${caseId}`
        },
        () => {
          mutate();
        }
      )
      .subscribe();

    // Listen to case status/data changes
    const caseChannel = client
      .channel(`realtime-case-${caseId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cases',
          filter: `id=eq.${caseId}`
        },
        () => {
          mutate();
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(messagesChannel);
      client.removeChannel(caseChannel);
    };
  }, [caseId, canFetch, mutate]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (needsTenantSelection) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Header />
        <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-12">
          <div className="bg-white rounded-2xl border border-amber-200 p-8 text-center shadow-sm">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-slate-900">Selecione um tenant para continuar</h1>
            <p className="text-sm text-slate-500 mt-2">Este caso só pode ser consultado por meio de um tenant ativo. Nenhuma operação foi executada.</p>
            <Link href={`/cases${tenantPath}`} className="inline-flex mt-5 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800">
              Voltar para casos
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const handleSendHumanMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!humanMessage.trim() || isSending) return;

    setIsSending(true);
    const msgText = humanMessage.trim();
    setHumanMessage('');

    try {
      const res = await fetchWithAuth('/api/agent-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId,
          message: msgText,
          tenant_id: tenantId || undefined
        })
      });

      const resData = await res.json();
      if (!res.ok) {
        alert('Erro ao enviar mensagem: ' + (resData.error || 'Erro desconhecido'));
      } else {
        mutate();
      }
    } catch (err: unknown) {
      alert('Erro na conexão: ' + (err instanceof Error ? err.message : 'erro desconhecido'));
    } finally {
      setIsSending(false);
    }
  };

  const handleStartNegotiation = async () => {
    setIsStartingIA(true);
    try {
      const res = await fetchWithAuth('/api/start-negotiation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, tenant_id: tenantId || undefined })
      });
      const resData = await res.json();
      if (!res.ok) {
        alert(resData.error || 'Erro ao iniciar abordagem por IA');
      } else {
        mutate();
      }
    } catch (err: unknown) {
      alert('Erro: ' + (err instanceof Error ? err.message : 'erro desconhecido'));
    } finally {
      setIsStartingIA(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    setIsUpdatingStatus(true);
    try {
      const res = await fetchWithAuth(`/api/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, tenant_id: tenantId || undefined })
      });
      if (!res.ok) {
        const resData = await res.json();
        alert(resData.error || 'Erro ao atualizar status');
      } else {
        mutate();
      }
    } catch (err: unknown) {
      alert('Erro: ' + (err instanceof Error ? err.message : 'erro desconhecido'));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDownloadDossier = () => {
    if (!caseData) return;
    const textDossier = generateCaseDossier(caseData, messages);
    const blob = new Blob([textDossier], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dossie_cobranca_${caseData.name.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'in_negotiation':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
            </span>
            Em Negociação (IA)
          </span>
        );
      case 'needs_attention':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-600"></span>
            </span>
            Requer Atenção / Atendimento Humano
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            Acordo Fechado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
            <Clock className="w-3.5 h-3.5" />
            Não Iniciado
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Header />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-12 flex flex-col items-center justify-center">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
          <p className="text-slate-500 font-medium">Carregando caso em tempo real...</p>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Header />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-12">
          <div className="bg-white p-8 rounded-2xl border border-red-200 shadow-sm text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-slate-900">Não foi possível carregar o caso</h2>
            <p className="text-slate-500 text-sm mt-1 mb-6">{error instanceof Error ? error.message : 'Tente novamente.'}</p>
            <button
              type="button"
              onClick={() => mutate()}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Header />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-12">
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-slate-900">Caso não encontrado</h2>
            <p className="text-slate-500 text-sm mt-1 mb-6">Este caso pode ter sido removido ou você não tem acesso.</p>
            <Link
               href={`/cases${tenantPath}`}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors"
            >
              Voltar para a lista de casos
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const originalVal = Number(caseData.original_value) || 0;
  const updatedVal = Number(caseData.updated_value) || originalVal;
  const formattedOriginal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(originalVal);
  const formattedUpdated = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(updatedVal);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Link
               href={`/cases${tenantPath}`}
              className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors shadow-sm"
              title="Voltar para Casos"
              aria-label="Voltar para casos"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  <Radio className="w-3 h-3 animate-pulse text-emerald-600" />
                  Ao Vivo
                </span>
                {getStatusBadge(caseData.status)}
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
                {caseData.name}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadDossier}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              <Download className="w-4 h-4 text-slate-500" />
              Baixar Dossiê
            </button>

            {caseData.status === 'not_started' && (
              <button
                onClick={handleStartNegotiation}
                disabled={isStartingIA}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all"
              >
                {isStartingIA ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 fill-white" />
                )}
                Iniciar Negociação IA
              </button>
            )}
          </div>
        </div>

        {/* AI Collection Stage Card */}
        {stage && (
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-700 mb-6 relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl shrink-0 mt-0.5">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      Estágio Atual: {stage.name}
                    </span>
                    <span className="text-xs text-slate-300">
                      • {stage.diasAtraso > 0 ? `${stage.diasAtraso} dias de atraso` : 'Em dia'}
                    </span>
                  </div>
                  <p className="text-slate-300 text-xs mt-1.5 leading-relaxed max-w-3xl">
                    {stage.description}
                  </p>
                </div>
              </div>

              <div className="shrink-0 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block">
                  Desconto Máximo Efetivo
                </span>
                <span className="text-xl font-extrabold text-emerald-400">
                  {stage.effectiveMaxDiscount}%
                </span>
              </div>
            </div>
          </div>
        )}

        {data?.legacy_context && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold">Contexto legado incompleto</p>
              <p className="mt-1 text-xs text-amber-800">Este caso histórico não possui um vínculo determinístico com título e contrato. A conversa e o histórico continuam disponíveis.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chat Panel */}
          <div className="lg:col-span-2 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-[680px]">
            {/* Chat Sub-Header */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping" />
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                    WhatsApp Feed - Sincronizado ao vivo
                  </span>
                  <span className="text-xs text-emerald-400 font-medium">
                    {formatPhoneInput(caseData.phone)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Status do Caso:</span>
                <label htmlFor="case-status" className="sr-only">Status do caso</label>
                <select
                  id="case-status"
                  value={caseData.status}
                  disabled={isUpdatingStatus}
                  onChange={(e) => handleUpdateStatus(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white text-xs font-semibold rounded-lg px-2 py-1 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="not_started">Não Iniciado</option>
                  <option value="in_negotiation">Em Negociação</option>
                  <option value="needs_attention">Requer Atenção</option>
                  <option value="closed">Acordo Fechado</option>
                </select>
              </div>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-100/60">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                  <MessageSquare className="w-12 h-12 text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-600">Nenhuma mensagem registrada ainda</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Inicie a abordagem automatizada via IA ou envie uma mensagem direta de intervenção humana abaixo.
                  </p>
                  {caseData.status === 'not_started' && (
                    <button
                      onClick={handleStartNegotiation}
                      disabled={isStartingIA}
                      className="mt-4 px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-2"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      Iniciar Negociação por IA
                    </button>
                  )}
                </div>
              ) : (
                messages.map((m) => {
                  const isUser = m.role === 'user';
                  const isAI = m.role === 'ai';
                  const isHuman = m.role === 'human';
                  const isSystem = m.role === 'system';

                  if (isSystem) {
                    return (
                      <div key={m.id} className="flex justify-center my-2">
                        <span className="bg-slate-200 text-slate-600 text-[11px] font-medium px-3 py-1 rounded-full border border-slate-300/60">
                          {m.content}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isUser ? 'items-start' : 'items-end'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                        {isUser && (
                          <>
                            <UserIcon className="w-3 h-3 text-slate-500" />
                            <span>{caseData.name} (Devedor)</span>
                          </>
                        )}
                        {isAI && (
                          <>
                            <Bot className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-700 font-bold">Agente Cobrança IA</span>
                          </>
                        )}
                        {isHuman && (
                          <>
                            <ShieldAlert className="w-3 h-3 text-blue-600" />
                            <span className="text-blue-700 font-bold">Atendente Humano</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      <div
                        className={`max-w-[82%] px-4 py-3 rounded-2xl text-sm shadow-sm leading-relaxed ${
                          isUser
                            ? 'bg-white text-slate-800 rounded-tl-none border border-slate-200'
                            : isAI
                            ? 'bg-emerald-600 text-white rounded-tr-none shadow-emerald-600/10'
                            : 'bg-blue-600 text-white rounded-tr-none shadow-blue-600/10'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Human Intervention Input Bar */}
            <form onSubmit={handleSendHumanMessage} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
              <label htmlFor="human-message" className="sr-only">Mensagem de intervenção humana</label>
              <input
                id="human-message"
                type="text"
                placeholder="Enviar mensagem via WhatsApp (Intervenção Humana)..."
                value={humanMessage}
                onChange={(e) => setHumanMessage(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white"
              />
              <button
                type="submit"
                disabled={isSending || !humanMessage.trim()}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-blue-600/20 disabled:opacity-50 flex items-center gap-2 shrink-0"
              >
                {isSending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Enviar (Humano)
              </button>
            </form>
          </div>

          {/* Sidebar Info & Controls */}
          <div className="space-y-6">
            <ObligationContextCard caseData={caseData} client={client} contract={contract} financialTitle={financialTitle} />
            <FinancialSummaryCard caseData={caseData} stage={stage} formattedOriginal={formattedOriginal} formattedUpdated={formattedUpdated} />

            {/* Debtor Info */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <UserIcon className="w-4 h-4 text-emerald-600" />
                Dados do Devedor
              </h3>

              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2.5">
                  <UserIcon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs text-slate-400 block">Nome Completo</span>
                    <span className="font-semibold text-slate-900">{caseData.name}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs text-slate-400 block">WhatsApp / Telefone</span>
                    <span className="font-semibold text-slate-900">{formatPhoneInput(caseData.phone)}</span>
                  </div>
                </div>

                {caseData.debtor_document && (
                  <div className="flex items-start gap-2.5">
                    <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs text-slate-400 block">CPF / CNPJ</span>
                      <span className="font-semibold text-slate-900 font-mono text-xs">{caseData.debtor_document}</span>
                    </div>
                  </div>
                )}

                {caseData.debtor_email && (
                  <div className="flex items-start gap-2.5">
                    <Mail className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs text-slate-400 block">E-mail</span>
                      <span className="font-semibold text-slate-900">{caseData.debtor_email}</span>
                    </div>
                  </div>
                )}

                {caseData.debtor_address && (
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs text-slate-400 block">Endereço</span>
                      <span className="font-semibold text-slate-900 text-xs">{caseData.debtor_address}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Objectives & Guidelines Card */}
            {stage && stage.objectives && stage.objectives.length > 0 && (
              <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Layers className="w-4 h-4" />
                  Objetivos da Abordagem
                </h3>
                <ul className="space-y-2 text-xs text-slate-300">
                  {stage.objectives.map((obj, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span>{obj}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

<AuditActivityCard auditLogs={auditLogs} />
          </div>
        </div>

        <div className="mt-6">
          <AgreementsSection caseId={caseId} tenantId={tenantId} canFetch={canFetch} />
        </div>
      </main>
    </div>
  );
}
