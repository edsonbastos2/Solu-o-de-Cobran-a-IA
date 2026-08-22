import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ChatWindow } from './chat-window';
import type { ConversationDetailResponse } from '@/lib/types';

afterEach(cleanup);

const idleAction = { loading: false, error: null, conflict: false };

function buildConversation(overrides: Partial<ConversationDetailResponse> = {}): ConversationDetailResponse {
  return {
    case: {
      id: 'case-1',
      created_at: '2026-08-01T10:00:00Z',
      name: 'Maria Souza',
      phone: '11999999999',
      original_value: 1500,
      updated_value: 1500,
      due_date: '2026-07-01',
      max_discount_margin: 10,
      status: 'in_negotiation',
      controller: 'ai',
      active_channel: 'whatsapp',
    },
    client: null,
    contract: null,
    financial_title: null,
    negotiation: null,
    messages: [{ id: 'm1', created_at: '2026-08-20T10:00:00Z', case_id: 'case-1', role: 'user', content: 'Oi' }],
    events: [],
    conversationVersion: 1,
    unreadCount: 0,
    permissions: {
      canView: true,
      canSend: false,
      canTakeOver: true,
      canReturnToAI: false,
      canTransfer: false,
      canComplete: false,
    },
    currentOperator: null,
    operators: [{ id: 'op-1', name: 'Ana Operadora', role: 'operador' }],
    stage: {
      id: 'amigavel',
      name: 'Cobrança Amigável',
      description: '',
      badgeBg: '',
      badgeText: '',
      badgeBorder: '',
      diasAtraso: 10,
      effectiveMaxDiscount: 10,
      objectives: [],
      suggestedQuestions: [],
    },
    ...overrides,
  };
}

const noop = () => Promise.resolve(null);

describe('ChatWindow', () => {
  it('mostra placeholder "Selecione uma conversa" quando não há conversa', () => {
    render(
      <ChatWindow
        conversation={null}
        isLoading={false}
        sending={false}
        sendError={null}
        onSendMessage={async () => true}
        actionState={idleAction}
        onTakeOver={noop}
        onReturnToAI={noop}
        onTransfer={noop}
      />
    );
    expect(screen.getByTestId('chat-window-placeholder')).toBeInTheDocument();
  });

  it('mostra estado de carregamento', () => {
    render(
      <ChatWindow
        conversation={null}
        isLoading
        sending={false}
        sendError={null}
        onSendMessage={async () => true}
        actionState={idleAction}
        onTakeOver={noop}
        onReturnToAI={noop}
        onTransfer={noop}
      />
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('mostra erro com retry', () => {
    const onRetry = vi.fn();
    render(
      <ChatWindow
        conversation={null}
        isLoading={false}
        error="Falha ao carregar"
        onRetry={onRetry}
        sending={false}
        sendError={null}
        onSendMessage={async () => true}
        actionState={idleAction}
        onTakeOver={noop}
        onReturnToAI={noop}
        onTransfer={noop}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao carregar');
  });

  it('renderiza header, takeover bar e composer desabilitado quando IA conduz', () => {
    render(
      <ChatWindow
        conversation={buildConversation()}
        isLoading={false}
        sending={false}
        sendError={null}
        onSendMessage={async () => true}
        actionState={idleAction}
        onTakeOver={noop}
        onReturnToAI={noop}
        onTransfer={noop}
      />
    );
    expect(screen.getByText('Maria Souza', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByTestId('takeover-bar')).toBeInTheDocument();
    expect(screen.getByTestId('composer-send')).toBeDisabled();
  });

  it('composer habilitado quando canSend=true', () => {
    render(
      <ChatWindow
        conversation={buildConversation({
          case: { ...buildConversation().case, controller: 'human' },
          permissions: { canView: true, canSend: true, canTakeOver: false, canReturnToAI: true, canTransfer: false, canComplete: false },
        })}
        isLoading={false}
        sending={false}
        sendError={null}
        onSendMessage={async () => true}
        actionState={idleAction}
        onTakeOver={noop}
        onReturnToAI={noop}
        onTransfer={noop}
      />
    );
    const textarea = screen.getByLabelText('Mensagem');
    expect(textarea).not.toBeDisabled();
  });

  it('exibe indicador "IA está analisando" quando última mensagem é do devedor e IA conduz', () => {
    render(
      <ChatWindow
        conversation={buildConversation()}
        isLoading={false}
        sending={false}
        sendError={null}
        onSendMessage={async () => true}
        actionState={idleAction}
        onTakeOver={noop}
        onReturnToAI={noop}
        onTransfer={noop}
      />
    );
    expect(screen.getByTestId('ai-thinking-indicator')).toBeInTheDocument();
  });
});
