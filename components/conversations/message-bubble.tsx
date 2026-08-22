'use client';

import { AlertCircle, Bot, UserRound } from 'lucide-react';
import type { Message } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface MessageBubbleProps {
  message: Message;
  /** Exibe o cabeçalho de remetente (agrupamento de mensagens consecutivas). */
  showSender: boolean;
  /** Nome do devedor, usado no rótulo do remetente quando role='user'. */
  debtorName: string;
  /** Nome do operador atual, usado no rótulo quando role='human'. */
  operatorName?: string | null;
}

function getTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function MessageBubble({ message, showSender, debtorName, operatorName }: MessageBubbleProps) {
  const isDebtor = message.role === 'user';
  const isAI = message.role === 'ai';
  const isHuman = message.role === 'human';

  return (
    <div
      data-testid={`message-bubble-${message.id}`}
      className={cn('flex flex-col', isDebtor ? 'items-start' : 'items-end')}
    >
      {showSender && (
        <div className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          {isDebtor && (
            <>
              <UserRound className="h-3 w-3 text-gray-400" aria-hidden="true" />
              <span>{debtorName}</span>
            </>
          )}
          {isAI && (
            <>
              <Bot className="h-3 w-3 text-emerald-600" aria-hidden="true" />
              <span className="text-emerald-700">IA de Cobrança</span>
            </>
          )}
          {isHuman && (
            <>
              <UserRound className="h-3 w-3 text-sky-600" aria-hidden="true" />
              <span className="text-sky-700">{operatorName ?? 'Atendente'}</span>
            </>
          )}
        </div>
      )}

      <div className="flex items-end gap-2">
        {isDebtor && (
          <div
            className={cn(
              'max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-gray-200 bg-white px-3.5 py-2 text-sm leading-relaxed text-gray-800 shadow-sm sm:max-w-[80%] xl:max-w-[42rem]'
            )}
          >
            {message.content}
          </div>
        )}
        {!isDebtor && (
          <div
            className={cn(
              'max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-br-sm px-3.5 py-2 text-sm leading-relaxed text-white shadow-sm sm:max-w-[80%] xl:max-w-[42rem]',
              isAI ? 'bg-emerald-600' : 'bg-sky-600'
            )}
          >
            {message.content}
          </div>
        )}
      </div>

      <div className={cn('mt-1 flex items-center gap-1.5 px-1 text-[11px] text-gray-400', !isDebtor && 'flex-row-reverse')}>
        <time>{getTime(message.created_at)}</time>
      </div>

      {message.send_status === 'failed' && (
        <div
          role="alert"
          data-testid="message-send-failed"
          className="mt-1 flex items-center gap-1.5 px-1 text-[11px] font-semibold text-red-600"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Falha no envio{message.status_error ? `: ${message.status_error}` : ''}</span>
        </div>
      )}
    </div>
  );
}
