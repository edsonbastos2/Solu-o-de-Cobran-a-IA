'use client';

import Link from 'next/link';
import { FileText, History, User, X } from 'lucide-react';
import type { ConversationDetailResponse } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { getDaysOverdue } from '@/lib/finance';

export interface DebtContextPanelProps {
  conversation: ConversationDetailResponse;
  tenantPath: string;
  onClose?: () => void;
}

const NEGOTIATION_STATUS_LABEL: Record<string, string> = {
  open: 'Em aberto',
  accepted: 'Aceita',
  expired: 'Expirada',
  fulfilled: 'Cumprida',
  defaulted: 'Descumprida',
};

function maskDocument(document: string): string {
  const digits = document.replace(/\D/g, '');
  if (digits.length === 11) return '***.***.***-**';
  if (digits.length === 14) return '**.***.***/****-**';
  return '***';
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-100 px-4 py-3 last:border-b-0">
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {title}
      </h3>
      <div className="space-y-1.5 text-sm">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-500">{label}</span>
      <span className="truncate font-medium text-gray-900">{value}</span>
    </div>
  );
}

export function DebtContextPanel({ conversation, tenantPath, onClose }: DebtContextPanelProps) {
  const { case: caseData, client, contract, financial_title, negotiation } = conversation;
  const daysOverdue = getDaysOverdue(caseData.due_date);

  return (
    <div data-testid="debt-context-panel" className="flex h-full flex-col overflow-y-auto bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">Informações da dívida</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar painel de informações"
            data-testid="debt-context-close"
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <Section title="Devedor" icon={User}>
        <Row label="Nome" value={caseData.name} />
        <Row label="Documento" value={client?.document ? maskDocument(client.document) : '—'} />
      </Section>

      <Section title="Dívida" icon={FileText}>
        <Row label="Valor original" value={formatCurrency(caseData.original_value)} />
        <Row label="Valor atualizado" value={formatCurrency(caseData.updated_value)} />
        <Row label="Vencimento" value={new Date(caseData.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} />
        <Row label="Dias em atraso" value={daysOverdue > 0 ? `${daysOverdue} dias` : 'Em dia'} />
        {financial_title && <Row label="Parcela" value={`#${financial_title.installment_number}`} />}
      </Section>

      {contract && (
        <Section title="Contrato" icon={FileText}>
          <Row label="Número" value={contract.contract_number ?? '—'} />
          {contract.type && <Row label="Tipo" value={contract.type} />}
        </Section>
      )}

      {negotiation && (
        <Section title="Negociação" icon={History}>
          <Row label="Status" value={NEGOTIATION_STATUS_LABEL[negotiation.status] ?? negotiation.status} />
          {negotiation.proposed_value != null && <Row label="Última proposta" value={formatCurrency(negotiation.proposed_value)} />}
          {negotiation.installment_count != null && <Row label="Parcelas" value={negotiation.installment_count} />}
        </Section>
      )}

      {/* Os dois atalhos para o caso ficam lado a lado: em 3 linhas empilhadas o
          rodapé sozinho custava ~120px e forçava scroll no painel. */}
      <div className="mt-auto space-y-2 border-t border-gray-100 px-4 py-3">
        {contract && (
          <Link
            href={`/contracts/${contract.id}${tenantPath}`}
            className="block rounded-lg border border-gray-200 px-3 py-1.5 text-center text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Ver contrato
          </Link>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/cases/${caseData.id}${tenantPath}`}
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-center text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Ver cobrança/caso
          </Link>
          <Link
            href={`/cases/${caseData.id}${tenantPath}`}
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-center text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Ver histórico
          </Link>
        </div>
      </div>
    </div>
  );
}
