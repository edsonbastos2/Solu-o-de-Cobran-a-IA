import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MessageList } from './message-list';
import type { ConversationEvent, Message } from '@/lib/types';

afterEach(cleanup);

const resolveOperatorName = () => 'Ana Operadora';

describe('MessageList', () => {
  it('renderiza estado vazio quando não há mensagens nem eventos', () => {
    render(
      <MessageList messages={[]} events={[]} debtorName="Maria" resolveOperatorName={resolveOperatorName} />
    );
    expect(screen.getByTestId('message-list-empty')).toBeInTheDocument();
  });

  it('agrupa mensagens consecutivas do mesmo remetente (mostra o cabeçalho uma vez)', () => {
    const messages: Message[] = [
      { id: 'm1', created_at: '2026-08-20T10:00:00Z', case_id: 'c1', role: 'ai', content: 'Olá' },
      { id: 'm2', created_at: '2026-08-20T10:00:05Z', case_id: 'c1', role: 'ai', content: 'Tudo bem?' },
    ];
    render(<MessageList messages={messages} events={[]} debtorName="Maria" resolveOperatorName={resolveOperatorName} />);
    expect(screen.getAllByText('IA de Cobrança')).toHaveLength(1);
    expect(screen.getByText('Olá')).toBeInTheDocument();
    expect(screen.getByText('Tudo bem?')).toBeInTheDocument();
  });

  it('intercala eventos de sistema entre mensagens em ordem cronológica', () => {
    const messages: Message[] = [
      { id: 'm1', created_at: '2026-08-20T10:00:00Z', case_id: 'c1', role: 'user', content: 'Oi' },
      { id: 'm2', created_at: '2026-08-20T10:05:00Z', case_id: 'c1', role: 'human', content: 'Vou ajudar' },
    ];
    const events: ConversationEvent[] = [
      {
        id: 'e1',
        tenant_id: 't1',
        case_id: 'c1',
        type: 'HUMAN_TAKEOVER',
        performed_by: 'op-1',
        created_at: '2026-08-20T10:02:00Z',
      },
    ];
    render(<MessageList messages={messages} events={events} debtorName="Maria" resolveOperatorName={resolveOperatorName} />);
    const container = screen.getByRole('log');
    const text = container.textContent ?? '';
    expect(text.indexOf('Oi')).toBeLessThan(text.indexOf('assumiu a conversa'));
    expect(text.indexOf('assumiu a conversa')).toBeLessThan(text.indexOf('Vou ajudar'));
  });

  it('exibe indicador "IA está analisando" quando isAIThinking', () => {
    const messages: Message[] = [{ id: 'm1', created_at: '2026-08-20T10:00:00Z', case_id: 'c1', role: 'user', content: 'Oi' }];
    render(
      <MessageList messages={messages} events={[]} debtorName="Maria" resolveOperatorName={resolveOperatorName} isAIThinking />
    );
    expect(screen.getByTestId('ai-thinking-indicator')).toBeInTheDocument();
  });
});
