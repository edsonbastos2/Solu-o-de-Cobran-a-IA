import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MessageBubble } from './message-bubble';
import type { Message } from '@/lib/types';

afterEach(cleanup);

function buildMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    created_at: '2026-08-20T14:32:00Z',
    case_id: 'case-1',
    role: 'user',
    content: 'Olá, quero negociar',
    ...overrides,
  };
}

describe('MessageBubble', () => {
  it('renderiza mensagem do devedor à esquerda com o nome do devedor', () => {
    render(<MessageBubble message={buildMessage()} showSender debtorName="Maria Souza" />);
    expect(screen.getByText('Maria Souza')).toBeInTheDocument();
    expect(screen.getByText('Olá, quero negociar')).toBeInTheDocument();
  });

  it('identifica claramente mensagens da IA', () => {
    render(<MessageBubble message={buildMessage({ role: 'ai', content: 'Posso ajudar' })} showSender debtorName="Maria" />);
    expect(screen.getByText('IA de Cobrança')).toBeInTheDocument();
  });

  it('identifica mensagens humanas com o nome do operador', () => {
    render(
      <MessageBubble
        message={buildMessage({ role: 'human', content: 'Vou verificar' })}
        showSender
        debtorName="Maria"
        operatorName="Ana Operadora"
      />
    );
    expect(screen.getByText('Ana Operadora')).toBeInTheDocument();
  });

  it('não repete o cabeçalho de remetente quando showSender=false', () => {
    render(<MessageBubble message={buildMessage({ role: 'ai' })} showSender={false} debtorName="Maria" />);
    expect(screen.queryByText('IA de Cobrança')).not.toBeInTheDocument();
  });

  it('exibe falha de envio quando send_status=failed', () => {
    render(
      <MessageBubble
        message={buildMessage({ role: 'human', send_status: 'failed', status_error: 'Timeout' })}
        showSender
        debtorName="Maria"
      />
    );
    expect(screen.getByTestId('message-send-failed')).toHaveTextContent('Timeout');
  });
});
