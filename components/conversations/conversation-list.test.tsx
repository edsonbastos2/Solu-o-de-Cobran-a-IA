import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ConversationList } from './conversation-list';
import type { ConversationListItem } from '@/lib/types';

afterEach(cleanup);

function buildItem(id: string, name: string, unreadCount = 0): ConversationListItem {
  return {
    case: {
      id,
      created_at: '2026-08-01T10:00:00Z',
      name,
      phone: '11999999999',
      original_value: 1000,
      updated_value: 1000,
      due_date: '2026-07-01',
      max_discount_margin: 10,
      status: 'in_negotiation',
    },
    lastMessage: {
      role: 'user',
      content: `Última mensagem de ${name}`,
      created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      send_status: 'received',
    },
    controller: 'ai',
    currentOperator: null,
    channel: 'whatsapp',
    unreadCount,
    waitingFor: null,
  };
}

const ITEMS = [buildItem('case-1', 'Maria Souza'), buildItem('case-2', 'João Lima'), buildItem('case-3', 'Rita Oliveira')];

describe('ConversationList', () => {
  it('renderiza skeletons acessíveis durante o loading', () => {
    render(<ConversationList items={[]} onSelect={() => {}} isLoading={true} />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Carregando conversas')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('renderiza empty state quando não há conversas', () => {
    render(<ConversationList items={[]} onSelect={() => {}} isLoading={false} />);

    expect(screen.getByTestId('conversations-empty')).toHaveTextContent('Nenhuma conversa encontrada.');
  });

  it('renderiza erro com botão de retry que chama onRetry', () => {
    const onRetry = vi.fn();
    render(
      <ConversationList
        items={[]}
        onSelect={() => {}}
        isLoading={false}
        error="Falha ao carregar conversas."
        onRetry={onRetry}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao carregar conversas.');
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renderiza itens com role option e aria-selected no item selecionado', () => {
    render(<ConversationList items={ITEMS} selectedId="case-2" onSelect={() => {}} isLoading={false} />);

    const listbox = screen.getByRole('listbox', { name: 'Lista de conversas' });
    expect(listbox).toHaveAttribute('aria-activedescendant', 'conversation-option-case-2');

    expect(screen.getByTestId('conversation-item-case-1')).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByTestId('conversation-item-case-2')).toHaveAttribute('aria-selected', 'true');
  });

  it('clique em item chama onSelect com o case id', () => {
    const onSelect = vi.fn();
    render(<ConversationList items={ITEMS} onSelect={onSelect} isLoading={false} />);

    fireEvent.click(screen.getByTestId('conversation-item-case-3'));
    expect(onSelect).toHaveBeenCalledWith('case-3');
  });

  it('ArrowDown move a seleção para o próximo item', () => {
    const onSelect = vi.fn();
    render(
      <ConversationList items={ITEMS} selectedId="case-1" onSelect={onSelect} isLoading={false} />
    );

    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('case-2');
  });

  it('ArrowUp move a seleção para o item anterior', () => {
    const onSelect = vi.fn();
    render(
      <ConversationList items={ITEMS} selectedId="case-2" onSelect={onSelect} isLoading={false} />
    );

    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowUp' });
    expect(onSelect).toHaveBeenCalledWith('case-1');
  });

  it('ArrowDown sem seleção seleciona o primeiro item; não ultrapassa os limites', () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <ConversationList items={ITEMS} selectedId={null} onSelect={onSelect} isLoading={false} />
    );

    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' });
    expect(onSelect).toHaveBeenCalledWith('case-1');

    onSelect.mockClear();
    rerender(
      <ConversationList items={ITEMS} selectedId="case-3" onSelect={onSelect} isLoading={false} />
    );
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' });
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowUp' });
    expect(onSelect).toHaveBeenCalledWith('case-2');
  });

  it('teclas que não são setas não disparam onSelect', () => {
    const onSelect = vi.fn();
    render(
      <ConversationList items={ITEMS} selectedId="case-1" onSelect={onSelect} isLoading={false} />
    );

    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Enter' });
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('destaca "Nova atribuição" quando atribuída a mim, não lida e último evento TRANSFERRED', () => {
    const item: ConversationListItem = {
      ...buildItem('case-4', 'Carla Nunes', 2),
      controller: 'human',
      currentOperator: { id: 'user-1', name: 'Eu' },
      lastEventType: 'TRANSFERRED',
    };
    render(<ConversationList items={[item]} onSelect={() => {}} isLoading={false} currentUserId="user-1" />);

    expect(screen.getByText('Nova atribuição')).toBeInTheDocument();
  });

  it('não destaca "Nova atribuição" quando a conversa não está atribuída ao usuário atual', () => {
    const item: ConversationListItem = {
      ...buildItem('case-4', 'Carla Nunes', 2),
      controller: 'human',
      currentOperator: { id: 'user-2', name: 'Outro Operador' },
      lastEventType: 'TRANSFERRED',
    };
    render(<ConversationList items={[item]} onSelect={() => {}} isLoading={false} currentUserId="user-1" />);

    expect(screen.queryByText('Nova atribuição')).not.toBeInTheDocument();
  });

  it('não destaca "Nova atribuição" quando já lida ou último evento não é TRANSFERRED', () => {
    const readItem: ConversationListItem = {
      ...buildItem('case-4', 'Carla Nunes', 0),
      controller: 'human',
      currentOperator: { id: 'user-1', name: 'Eu' },
      lastEventType: 'TRANSFERRED',
    };
    const { rerender } = render(
      <ConversationList items={[readItem]} onSelect={() => {}} isLoading={false} currentUserId="user-1" />
    );
    expect(screen.queryByText('Nova atribuição')).not.toBeInTheDocument();

    const wrongEventItem: ConversationListItem = {
      ...buildItem('case-4', 'Carla Nunes', 2),
      controller: 'human',
      currentOperator: { id: 'user-1', name: 'Eu' },
      lastEventType: 'HUMAN_TAKEOVER',
    };
    rerender(<ConversationList items={[wrongEventItem]} onSelect={() => {}} isLoading={false} currentUserId="user-1" />);
    expect(screen.queryByText('Nova atribuição')).not.toBeInTheDocument();
  });
});
