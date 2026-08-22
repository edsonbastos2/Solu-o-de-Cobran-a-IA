'use client';

import { Bot, MessageSquare } from 'lucide-react';
import type { ConversationEvent, Message } from '@/lib/types';
import { MessageBubble } from './message-bubble';
import { SystemMessage } from './system-message';

export interface MessageListProps {
  messages: Message[];
  events: ConversationEvent[];
  debtorName: string;
  operatorName?: string | null;
  resolveOperatorName: (id: string | null | undefined) => string;
  /** "🤖 IA está analisando a conversa..." — última mensagem é do devedor, aguardando resposta da IA. */
  isAIThinking?: boolean;
}

type TimelineEntry =
  | { kind: 'message'; key: string; createdAt: string; message: Message; showSender: boolean }
  | { kind: 'event'; key: string; createdAt: string; event: ConversationEvent };

function buildTimeline(messages: Message[], events: ConversationEvent[]): TimelineEntry[] {
  const merged: Array<
    | { kind: 'message'; createdAt: string; message: Message }
    | { kind: 'event'; createdAt: string; event: ConversationEvent }
  > = [
    ...messages.map((message) => ({ kind: 'message' as const, createdAt: message.created_at, message })),
    ...events
      .filter((event) => event.type !== 'MESSAGE_RECEIVED')
      .map((event) => ({ kind: 'event' as const, createdAt: event.created_at, event })),
  ];
  merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  let previousRole: string | null = null;
  return merged.map((entry) => {
    if (entry.kind === 'event') {
      previousRole = null;
      return { kind: 'event', key: `event-${entry.event.id}`, createdAt: entry.createdAt, event: entry.event };
    }
    const showSender = previousRole !== entry.message.role;
    previousRole = entry.message.role;
    return {
      kind: 'message',
      key: `message-${entry.message.id}`,
      createdAt: entry.createdAt,
      message: entry.message,
      showSender,
    };
  });
}

export function MessageList({
  messages,
  events,
  debtorName,
  operatorName,
  resolveOperatorName,
  isAIThinking = false,
}: MessageListProps) {
  const timeline = buildTimeline(messages, events);

  if (timeline.length === 0) {
    return (
      <div
        data-testid="message-list-empty"
        className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-gray-400"
      >
        <MessageSquare className="h-10 w-10 text-gray-300" aria-hidden="true" />
        <p className="text-sm font-medium text-gray-500">Nenhuma mensagem registrada ainda</p>
      </div>
    );
  }

  return (
    <div role="log" aria-live="polite" aria-label="Histórico da conversa" className="flex flex-col gap-2.5 px-4 py-3">
      {timeline.map((entry) =>
        entry.kind === 'event' ? (
          <SystemMessage key={entry.key} event={entry.event} resolveName={resolveOperatorName} />
        ) : (
          <MessageBubble
            key={entry.key}
            message={entry.message}
            showSender={entry.showSender}
            debtorName={debtorName}
            operatorName={operatorName}
          />
        )
      )}

      {isAIThinking && (
        <div
          data-testid="ai-thinking-indicator"
          className="flex items-center gap-1.5 px-1 text-xs font-medium text-emerald-700"
        >
          <Bot className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
          IA está analisando a conversa...
        </div>
      )}
    </div>
  );
}
