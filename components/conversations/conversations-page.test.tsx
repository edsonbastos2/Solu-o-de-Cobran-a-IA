import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ConversationsPage } from './conversations-page';
import type { ConversationDetailResponse, ConversationListItem } from '@/lib/types';

afterEach(cleanup);

let searchParamsValue = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsValue,
}));

vi.mock('@/hooks/use-active-tenant', () => ({
  useActiveTenant: () => ({
    user: { id: 'user-1' },
    role: 'operador',
    tenantId: 'tenant-1',
    tenantPath: '?tenant_id=tenant-1',
    needsTenantSelection: false,
  }),
}));

const useConversationMock = vi.fn();

vi.mock('@/hooks/use-conversations', () => ({
  useConversations: () => ({
    conversations: mockConversationItems,
    total: mockConversationItems.length,
    totalPages: 1,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    searchInput: '',
    setSearchInput: vi.fn(),
  }),
  useConversation: (caseId: string | null) => useConversationMock(caseId),
}));

vi.mock('@/lib/api', () => ({
  fetcher: vi.fn(),
}));

const idleAction = { loading: false, error: null, conflict: false };

let mockConversationItems: ConversationListItem[] = [];

function buildListItem(overrides: Partial<ConversationListItem> = {}): ConversationListItem {
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
    lastMessage: null,
    controller: 'ai',
    currentOperator: null,
    channel: 'whatsapp',
    unreadCount: 0,
    waitingFor: null,
    ...overrides,
  };
}

function buildDetail(overrides: Partial<ConversationDetailResponse> = {}): ConversationDetailResponse {
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
    },
    client: null,
    contract: null,
    financial_title: null,
    negotiation: null,
    messages: [],
    events: [],
    conversationVersion: 1,
    unreadCount: 0,
    permissions: { canView: true, canSend: false, canTakeOver: true, canReturnToAI: false, canTransfer: false, canComplete: false },
    currentOperator: null,
    operators: [],
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

beforeEach(() => {
  searchParamsValue = new URLSearchParams();
  mockConversationItems = [buildListItem()];
  useConversationMock.mockReset();
  useConversationMock.mockReturnValue({
    conversation: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    action: idleAction,
    sending: false,
    sendError: null,
    sendMessage: vi.fn(),
    takeOver: vi.fn(),
    returnToAI: vi.fn(),
    transfer: vi.fn(),
  });
});

describe('ConversationsPage', () => {
  it('sem conversa selecionada mostra o placeholder "Selecione uma conversa"', () => {
    render(<ConversationsPage />);
    expect(screen.getByTestId('chat-window-placeholder')).toHaveTextContent('Selecione uma conversa');
  });

  it('deep-link ?case=<id> seleciona a conversa ao carregar', () => {
    searchParamsValue = new URLSearchParams('case=case-1');
    render(<ConversationsPage />);
    expect(useConversationMock).toHaveBeenCalledWith('case-1');
  });

  it('seleção de item na lista abre a conversa correspondente', () => {
    useConversationMock.mockImplementation((caseId: string | null) => ({
      conversation: caseId ? buildDetail() : null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      action: idleAction,
      sending: false,
      sendError: null,
      sendMessage: vi.fn(),
      takeOver: vi.fn(),
      returnToAI: vi.fn(),
      transfer: vi.fn(),
    }));
    render(<ConversationsPage />);
    expect(screen.getByTestId('chat-window-placeholder')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('conversation-item-case-1'));
    expect(useConversationMock).toHaveBeenCalledWith('case-1');
    expect(screen.getByText('Maria Souza', { selector: 'p' })).toBeInTheDocument();
    expect(screen.queryByTestId('chat-window-placeholder')).not.toBeInTheDocument();
  });

  it('em viewport mobile: lista ocupa a tela até uma conversa ser selecionada (classes responsivas)', () => {
    render(<ConversationsPage />);
    const list = screen.getByRole('listbox').closest('div.w-full') as HTMLElement;
    expect(list.className).not.toContain('hidden');

    fireEvent.click(screen.getByTestId('conversation-item-case-1'));
    const listAfter = screen.getByRole('listbox').closest('div.w-full') as HTMLElement;
    expect(listAfter.className).toContain('hidden');
  });
});
