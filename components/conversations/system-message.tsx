'use client';

import type { ConversationEvent } from '@/lib/types';

export interface SystemMessageProps {
  event: ConversationEvent;
  /** Resolve um id de profile para nome de exibição (ex.: operators do detalhe). */
  resolveName: (id: string | null | undefined) => string;
}

function getTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function buildText(event: ConversationEvent, resolveName: (id: string | null | undefined) => string): string | null {
  const payload = event.payload ?? {};
  const performedBy = resolveName(event.performed_by);

  switch (event.type) {
    case 'HUMAN_TAKEOVER':
      return `${performedBy} assumiu a conversa`;
    case 'RETURNED_TO_AI':
      return `${performedBy} devolveu a conversa para a IA`;
    case 'TRANSFERRED': {
      const from = resolveName(payload.fromOperatorId as string | null | undefined);
      const to = resolveName(payload.toOperatorId as string | null | undefined);
      const reason = typeof payload.reason === 'string' && payload.reason.trim() ? ` — ${payload.reason.trim()}` : '';
      return `Conversa transferida de ${from} para ${to}${reason}`;
    }
    case 'NEGOTIATION_CREATED':
      return 'Negociação iniciada';
    case 'PROPOSAL_ACCEPTED':
      return 'Proposta aceita pelo devedor';
    case 'PROPOSAL_REJECTED':
      return 'Proposta recusada pelo devedor';
    case 'CONVERSATION_COMPLETED':
      return 'Conversa finalizada';
    case 'MESSAGE_RECEIVED':
      return null;
    default:
      return null;
  }
}

export function SystemMessage({ event, resolveName }: SystemMessageProps) {
  const text = buildText(event, resolveName);
  if (!text) return null;

  return (
    <div data-testid={`system-message-${event.id}`} className="my-2 flex justify-center">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-[11px] font-medium text-gray-600">
        {text}
        <span className="text-gray-400">· {getTime(event.created_at)}</span>
      </span>
    </div>
  );
}
