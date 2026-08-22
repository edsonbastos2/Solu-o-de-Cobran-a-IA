import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ConversationItem } from './conversation-list-item';
import type { ConversationListItem } from '@/lib/types';

afterEach(cleanup);

function buildItem(overrides: Partial<ConversationListItem> = {}): ConversationListItem {
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
    },
    lastMessage: {
      role: 'user',
      content: 'Vou pagar na próxima semana',
      created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      send_status: 'received',
    },
    controller: 'ai',
    currentOperator: null,
    channel: 'whatsapp',
    unreadCount: 0,
    waitingFor: null,
    ...overrides,
  };
}

describe('ConversationItem', () => {
  it('renderiza nome do devedor, última mensagem, valor e indicador de condutor IA', () => {
    render(<ConversationItem item={buildItem()} selected={false} onSelect={() => {}} />);

    expect(screen.getByText('Maria Souza')).toBeInTheDocument();
    expect(screen.getByText('Vou pagar na próxima semana')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.500,00')).toBeInTheDocument();
    expect(screen.getByText('🤖 IA')).toBeInTheDocument();
  });

  it('renderiza indicador de condutor humano com nome do operador', () => {
    render(
      <ConversationItem
        item={buildItem({ controller: 'human', currentOperator: { id: 'op-1', name: 'Ana Operadora' } })}
        selected={false}
        onSelect={() => {}}
      />
    );

    expect(screen.getByText('👤 Ana Operadora')).toBeInTheDocument();
    expect(screen.queryByText('🤖 IA')).not.toBeInTheDocument();
  });

  it('renderiza "Sem responsável" quando condutor humano sem operador', () => {
    render(<ConversationItem item={buildItem({ controller: 'human', currentOperator: null })} selected={false} onSelect={() => {}} />);

    expect(screen.getByText('Sem responsável')).toBeInTheDocument();
  });

  it('renderiza data/hora relativa em pt-BR', () => {
    render(<ConversationItem item={buildItem()} selected={false} onSelect={() => {}} />);

    expect(screen.getByText(/há cerca de 1 hora/)).toBeInTheDocument();
  });

  it('exibe ícone/label do canal whatsapp e telegram', () => {
    const { rerender } = render(<ConversationItem item={buildItem({ channel: 'whatsapp' })} selected={false} onSelect={() => {}} />);
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();

    rerender(<ConversationItem item={buildItem({ channel: 'telegram' })} selected={false} onSelect={() => {}} />);
    expect(screen.getByText('Telegram')).toBeInTheDocument();
  });

  it('exibe badge de não lidas quando unreadCount > 0 e oculta quando 0', () => {
    const { rerender } = render(
      <ConversationItem item={buildItem({ unreadCount: 3 })} selected={false} onSelect={() => {}} />
    );
    expect(screen.getByLabelText('3 mensagens não lidas')).toBeInTheDocument();
    expect(screen.getByLabelText('3 mensagens não lidas')).toHaveTextContent('3');

    rerender(<ConversationItem item={buildItem({ unreadCount: 0 })} selected={false} onSelect={() => {}} />);
    expect(screen.queryByLabelText(/mensagens não lidas/)).not.toBeInTheDocument();
  });

  it('exibe destaque "Nova atribuição" quando isNewAssignment', () => {
    render(<ConversationItem item={buildItem()} selected={false} onSelect={() => {}} isNewAssignment />);

    expect(screen.getByText('Nova atribuição')).toBeInTheDocument();
  });

  it('marca o item como selecionado (aria-selected) e com testid por case id', () => {
    render(<ConversationItem item={buildItem()} selected={true} onSelect={() => {}} />);

    const option = screen.getByTestId('conversation-item-case-1');
    expect(option).toHaveAttribute('role', 'option');
    expect(option).toHaveAttribute('aria-selected', 'true');
  });

  it('chama onSelect com o case id ao clicar', () => {
    const onSelect = vi.fn();
    render(<ConversationItem item={buildItem()} selected={false} onSelect={onSelect} />);

    fireEvent.click(screen.getByTestId('conversation-item-case-1'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('case-1');
  });
});
