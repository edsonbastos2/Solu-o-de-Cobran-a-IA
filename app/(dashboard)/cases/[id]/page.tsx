'use client';

import { use, useEffect, useState, useMemo, memo } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip } from 'recharts';
import { supabase } from '@/lib/supabase';

import { fetcher, fetchWithAuth } from '@/lib/api';
import { useActiveTenant } from '@/hooks/use-active-tenant';
import { useNegotiationActions } from '@/hooks/use-negotiation-actions';
import {
  ArrowLeft,
  User as UserIcon,
  Radio,
  CheckCircle,
  AlertCircle,
  Clock,
  FileText,
  MessageSquare,
  Play,
  RefreshCw,
  Download,
  Phone,
  Mail,
  MapPin,
  Sparkles,
  Layers,
  Handshake,
  Ban,
  Landmark,
  Scale,
  Building2,
  UserRound
} from 'lucide-react';
import { AuditLog, Case, CaseDetailsResponse, CaseInsights, Client, ContractWithClient, FinancialTitle, Message, NegotiationWithRelations, NegotiationsListResponse } from '@/lib/types';
import { formatPhoneInput, formatCurrency } from '@/lib/utils';
import { generateCaseDossier, CollectionStageInfo } from '@/lib/finance';
import { NegotiationStatusBadge } from '@/components/negotiations/negotiation-status-badge';
import { ConversationSummaryCard } from '@/components/cases/conversation-summary-card';

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

function LegalProcessCard({ legalProcess, tenantPath }: {
  legalProcess: {
    id: string;
    status: string;
    process_type: string;
    process_number: string | null;
    court: string | null;
    filing_date: string | null;
    lawyer_name: string | null;
    lawyer_contact: string | null;
    updated_at: string | null;
  };
  tenantPath: string;
}) {
  const statusLabels: Record<string, { label: string; className: string }> = {
    open: { label: 'Em aberto', className: 'bg-slate-100 text-slate-600 border-slate-200' },
    in_progress: { label: 'Em andamento', className: 'bg-sky-100 text-sky-700 border-sky-200' },
    judgment_won: { label: 'Vitória judicial', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    judgment_lost: { label: 'Sentença desfavorável', className: 'bg-red-100 text-red-700 border-red-200' },
    closed: { label: 'Encerrado', className: 'bg-slate-200 text-slate-600 border-slate-300' },
  };
  const meta = statusLabels[legalProcess.status] || statusLabels.closed;
  const typeLabels: Record<string, string> = { execucao: 'Execução', monitoria: 'Monitória', cobranca: 'Cobrança', collection: 'Cobrança' };

  return (
    <div className="bg-white rounded-2xl border border-purple-200 p-5 shadow-sm space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
        <Scale className="w-4 h-4 text-purple-600" />
        Processo Jurídico
      </h3>
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${meta.className}`}>
            {meta.label}
          </span>
          <span className="text-xs font-semibold text-purple-700">{typeLabels[legalProcess.process_type] || legalProcess.process_type}</span>
        </div>
        {legalProcess.process_number && (
          <div className="text-xs font-mono text-slate-500">Proc. {legalProcess.process_number}</div>
        )}
        {legalProcess.court && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
            {legalProcess.court}
          </div>
        )}
        {legalProcess.filing_date && (
          <div className="text-xs text-slate-500">
            Distribuição: {new Date(legalProcess.filing_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
          </div>
        )}
        {legalProcess.lawyer_name && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <UserRound className="h-3.5 w-3.5 text-slate-400" />
            <span>
              <span className="font-semibold text-slate-700">{legalProcess.lawyer_name}</span>
              {legalProcess.lawyer_contact && <span className="text-slate-400"> · {legalProcess.lawyer_contact}</span>}
            </span>
          </div>
        )}
        {legalProcess.status === 'judgment_won' && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
            Vitória judicial! Sugerimos aplicar a baixa do título (quitação) na tela de títulos.
          </p>
        )}
        {legalProcess.updated_at && (
          <p className="text-[11px] text-slate-400">Atualizado em {new Date(legalProcess.updated_at).toLocaleString('pt-BR')}</p>
        )}
        <Link
          href={`/legal${tenantPath}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 hover:text-purple-800"
        >
          <Scale className="h-3.5 w-3.5" />
          Ver pipeline jurídico
        </Link>
      </div>
    </div>
  );
}

function AuditActivityCard({ auditLogs }: { auditLogs: AuditLog[] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
        <MessageSquare className="w-4 h-4 text-emerald-600" />
        Auditoria (Histórico de Ações)
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

type InsightsResponse = CaseInsights | { error: string };

function formatShortDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

interface InsightsPanelProps {
  caseId: string;
  tenantPath: string;
  canFetch: boolean;
}

const InsightsPanel = memo(function InsightsPanel({ caseId, tenantPath, canFetch }: InsightsPanelProps) {
  const insightsUrl = caseId ? `/api/cases/${caseId}/insights${tenantPath}` : null;
  const { data, error, isLoading, mutate } = useSWR<InsightsResponse>(
    canFetch ? insightsUrl : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const errorMessage = useMemo(() => {
    if (error) return error instanceof Error ? error.message : 'Erro ao carregar insights.';
    if (data && 'error' in data && typeof data.error === 'string') return data.error;
    return null;
  }, [data, error]);

  const insights = data && !('error' in data) ? data : null;
  const isConfigError = errorMessage?.includes('Chave de API') ?? false;

  const probability = Math.min(1, Math.max(0, insights?.agreement_probability ?? 0));
  const probabilityPercent = Math.round(probability * 100);
  const probabilityBarColor =
    probability < 0.3 ? 'bg-red-500' : probability < 0.7 ? 'bg-amber-500' : 'bg-emerald-500';
  const probabilityTextColor =
    probability < 0.3 ? 'text-red-600' : probability < 0.7 ? 'text-amber-600' : 'text-emerald-600';

  return (
    <div data-testid="insights-panel" className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
        <Sparkles className="w-4 h-4 text-emerald-600" />
        Insights de IA
      </h3>

      {isLoading ? (
        <div data-testid="insights-loading" className="flex items-center justify-center py-8">
          <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin" />
        </div>
      ) : errorMessage ? (
        <div data-testid="insights-error" className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <div className="space-y-1.5">
            <p className="text-xs text-red-700">
              {isConfigError
                ? 'Insights indisponíveis no momento — configure as chaves de IA para liberar o painel.'
                : errorMessage}
            </p>
            <button
              type="button"
              onClick={() => mutate()}
              className="text-xs font-semibold text-red-700 underline underline-offset-2"
              data-testid="insights-retry"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      ) : !insights ? (
        <p className="text-xs text-slate-500">Nenhum dado de insights disponível para este caso.</p>
      ) : (
        <div className="space-y-4">
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
              Sentimento ao longo do tempo
            </h4>
            {insights.sentiment_trend.length === 0 ? (
              <p className="text-xs text-slate-500">Sem histórico suficiente para análise de sentimento.</p>
            ) : (
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={insights.sentiment_trend} margin={{ top: 5, right: 8, left: -16, bottom: 0 }}>
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatShortDate}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      dy={4}
                    />
                    <YAxis
                      domain={[-1, 1]}
                      ticks={[-1, -0.5, 0, 0.5, 1]}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      width={40}
                    />
                    <RechartsTooltip
                      labelFormatter={(label) => formatShortDate(String(label))}
                      formatter={(value) => [`${Number(value).toFixed(2)}`, 'Sentimento']}
                    />
                    <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <AlertCircle className="h-3.5 w-3.5 text-red-500" />
              Principais Objeções
            </h4>
            {insights.main_objections.length === 0 ? (
              <p className="text-xs text-slate-500">Nenhuma objeção relevante identificada.</p>
            ) : (
              <ul className="space-y-2">
                {insights.main_objections.slice(0, 5).map((objection, index) => (
                  <li key={index} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-50 text-[10px] font-bold text-red-600">
                      {index + 1}
                    </span>
                    <span className="text-xs text-slate-700">{objection}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Probabilidade de Acordo
              </h4>
              <span className={`text-sm font-extrabold ${probabilityTextColor}`}>{probabilityPercent}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${probabilityBarColor}`} style={{ width: `${probabilityPercent}%` }} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tom Recomendado</h4>
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
              {insights.recommended_tone}
            </span>
          </div>

          {insights.theme_summary && (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Resumo Temático
              </h4>
              <p className="text-xs leading-relaxed text-slate-600">{insights.theme_summary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default function CaseDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const caseId = unwrappedParams.id;
  const { user, authLoading, tenantId, tenantPath, needsTenantSelection, isAdmin, role } = useActiveTenant();
  const canFetch = !authLoading && Boolean(user) && !needsTenantSelection;
  // Troca de canal ativo exige role gestor (o PATCH da API já exige) — visualizadores não veem o seletor.
  const canManageCase = isAdmin || role === 'gestor';

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

  // Negativação ativa vinculada ao título financeiro do caso (alerta no topo).
  const negativationUrl = canFetch && financialTitle?.id
    ? `/api/negativations?limit=1&financial_title_id=${financialTitle.id}${tenantId ? `&tenant_id=${encodeURIComponent(tenantId)}` : ''}`
    : null;
  const { data: negativationData, mutate: mutateNegativation } = useSWR<{
    negativations: Array<{ id: string; status: string; completed_at?: string | null; notified_at?: string | null; provider?: string | null }>;
  }>(negativationUrl, fetcher);
  const activeNegativation = (negativationData?.negativations || []).find(
    (n) => ['pending_notification', 'notified', 'requested', 'completed'].includes(n.status)
  ) || null;

  // Protesto ativo vinculado ao título financeiro do caso (alerta no topo).
  const protestUrl = canFetch && financialTitle?.id
    ? `/api/protests?limit=1&financial_title_id=${financialTitle.id}${tenantId ? `&tenant_id=${encodeURIComponent(tenantId)}` : ''}`
    : null;
  const { data: protestData } = useSWR<{
    protests: Array<{ id: string; status: string; completed_at?: string | null; notified_at?: string | null; provider?: string | null }>;
  }>(protestUrl, fetcher);
  const activeProtest = (protestData?.protests || []).find(
    (p) => ['pending_notification', 'notified', 'requested', 'completed'].includes(p.status)
  ) || null;

  // Processo jurídico vinculado ao caso (seção jurídica no detalhe).
  const legalUrl = canFetch && caseId ? `/api/legal-processes?limit=1&case_id=${caseId}${tenantId ? `&tenant_id=${encodeURIComponent(tenantId)}` : ''}` : null;
  const { data: legalData } = useSWR<{
    legal_processes: Array<{
      id: string;
      status: string;
      process_type: string;
      process_number: string | null;
      court: string | null;
      filing_date: string | null;
      lawyer_name: string | null;
      lawyer_contact: string | null;
      updated_at: string | null;
    }>;
  }>(legalUrl, fetcher);
  const legalProcess = legalData?.legal_processes?.[0] || null;

  const [isStartingIA, setIsStartingIA] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUpdatingChannel, setIsUpdatingChannel] = useState(false);

  // Real-time Supabase channel para status/dados do caso. O chat inline foi
  // removido (Central de Conversas, task 11) — a subscription de `messages`
  // agora vive apenas em `hooks/use-conversations.ts` (useConversation), sem
  // duplicação aqui.
  useEffect(() => {
    const client = supabase;
    if (!client || !caseId || !canFetch) return;

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
      client.removeChannel(caseChannel);
    };
  }, [caseId, canFetch, mutate]);

  if (needsTenantSelection) {
    return (
<div className="min-h-screen bg-slate-50 flex flex-col font-sans">
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
      // Tenant via query string (mesmo padrão do GET da página): o PATCH da
      // API lê tenant_id de searchParams e rejeita campos fora da whitelist.
      const res = await fetchWithAuth(`/api/cases/${caseId}${tenantPath}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
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

  const handleUpdateActiveChannel = async (channel: 'whatsapp' | 'telegram' | null) => {
    if (!caseId) return;
    setIsUpdatingChannel(true);
    try {
      // Tenant via query string (mesmo padrão do GET da página): o PATCH da
      // API lê tenant_id de searchParams e rejeita campos fora da whitelist.
      const res = await fetchWithAuth(`/api/cases/${caseId}${tenantPath}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active_channel: channel })
      });
      if (!res.ok) {
        const resData = await res.json().catch(() => ({}));
        alert(resData.error || 'Erro ao atualizar o canal ativo');
      } else {
        mutate();
      }
    } catch (err: unknown) {
      alert('Erro: ' + (err instanceof Error ? err.message : 'erro desconhecido'));
    } finally {
      setIsUpdatingChannel(false);
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

  const clientChannels = client?.client_channels ?? [];
  const telegramBinding = clientChannels.find((c) => c.channel === 'telegram');
  const activeChannelLabel =
    caseData.active_channel === 'telegram'
      ? `Telegram${telegramBinding?.username ? ` (@${telegramBinding.username})` : ''}`
      : caseData.active_channel === 'whatsapp'
        ? `WhatsApp (${formatPhoneInput(caseData.phone)})`
        : `Automático (${formatPhoneInput(caseData.phone)})`;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Alerta de negativação ativa */}
        {activeNegativation && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
            <div className="flex items-start gap-2 text-sm">
              <Ban className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <div>
                <p className="font-semibold text-red-700">
                  Este título está em processo de negativação
                  {activeNegativation.status === 'completed' ? ' (negativado)' : ' (em andamento)'}.
                </p>
                <p className="text-xs text-red-600 mt-0.5">
                  {activeNegativation.status === 'pending_notification' && 'Aguardando a notificação prévia ao devedor (CDC Art. 43, 5 dias).'}
                  {activeNegativation.status === 'notified' && `Devedor notificado em ${activeNegativation.notified_at ? new Date(activeNegativation.notified_at).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}. Aguardando o prazo legal para registro.`}
                  {activeNegativation.status === 'requested' && 'Solicitação já enviada ao provedor de negativação.'}
                  {activeNegativation.status === 'completed' && `Registrada no ${activeNegativation.provider || 'provedor'} — remoção automática ocorre após a quitação.`}
                </p>
              </div>
            </div>
            <Link
              href={`/negativations${tenantPath}`}
              className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              Ver fila
            </Link>
          </div>
        )}

        {/* Alerta de protesto ativo */}
        {activeProtest && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 shadow-sm">
            <div className="flex items-start gap-2 text-sm">
              <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
              <div>
                <p className="font-semibold text-orange-700">
                  Este título está em processo de protesto em cartório
                  {activeProtest.status === 'completed' ? ' (protestado)' : ' (em andamento)'}.
                </p>
                <p className="text-xs text-orange-600 mt-0.5">
                  {activeProtest.status === 'pending_notification' && 'Aguardando a intimação prévia ao devedor (Lei 9.492/97, art. 12).'}
                  {activeProtest.status === 'notified' && `Devedor intimado em ${activeProtest.notified_at ? new Date(activeProtest.notified_at).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}. Aguardando o prazo legal para requisição.`}
                  {activeProtest.status === 'requested' && 'Requisição já enviada ao cartório.'}
                  {activeProtest.status === 'completed' && `Protestado no ${activeProtest.provider || 'cartório'} — cancelamento automático ocorre após a quitação.`}
                </p>
              </div>
            </div>
            <Link
              href={`/protests${tenantPath}`}
              className="shrink-0 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700"
            >
              Ver fila
            </Link>
          </div>
        )}

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

              <div className="flex items-center gap-2 shrink-0">
                {typeof caseData.propensity_score === 'number' && caseData.propensity_score !== null && (
                  <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block">
                      Propensão a pagar
                    </span>
                    <span className={`text-xl font-extrabold ${
                      caseData.propensity_score >= 0.7
                        ? 'text-emerald-400'
                        : caseData.propensity_score >= 0.4
                          ? 'text-amber-400'
                          : 'text-red-400'
                    }`}>
                      {(caseData.propensity_score * 100).toFixed(0)}%
                    </span>
                  </div>
                )}

              <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block">
                  Desconto Máximo Efetivo
                </span>
                <span className="text-xl font-extrabold text-emerald-400">
                  {stage.effectiveMaxDiscount}%
                </span>
              </div>
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

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <ConversationSummaryCard
            caseId={caseId}
            tenantId={tenantId}
            status={caseData.status}
            isUpdatingStatus={isUpdatingStatus}
            onUpdateStatus={handleUpdateStatus}
            canManageCase={canManageCase}
            clientChannels={clientChannels}
            activeChannel={caseData.active_channel}
            activeChannelLabel={activeChannelLabel}
            isUpdatingChannel={isUpdatingChannel}
            onUpdateActiveChannel={handleUpdateActiveChannel}
          />
<ObligationContextCard caseData={caseData} client={client} contract={contract} financialTitle={financialTitle} />
            <FinancialSummaryCard caseData={caseData} stage={stage} formattedOriginal={formattedOriginal} formattedUpdated={formattedUpdated} />
            {legalProcess && <LegalProcessCard legalProcess={legalProcess} tenantPath={tenantPath} />}

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
          <InsightsPanel caseId={caseId} tenantPath={tenantPath} canFetch={canFetch} />
        </div>

        <div className="mt-6">
          <AgreementsSection caseId={caseId} tenantId={tenantId} canFetch={canFetch} />
        </div>
      </main>
    </div>
  );
}
