import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ConversationSummaryCard } from './conversation-summary-card';
import type { ConversationDetailResponse } from '@/lib/types';

afterEach(cleanup);

const useConversationMock = vi.fn();

vi.mock('@/hooks/use-conversations', () => ({
  useConversation: (...args: unknown[]) => useConversationMock(...args),
}));

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
      controller: 'human',
    },
    client: null,
    contract: null,
    financial_title: null,
    negotiation: null,
    messages: [{ id: 'm1', created_at: '2026-08-20T10:00:00Z', case_id: 'case-1', role: 'human', content: 'Vou verificar seu caso' }],
    events: [],
    conversationVersion: 2,
    unreadCount: 3,
    permissions: { canView: true, canSend: true, canTakeOver: false, canReturnToAI: true, canTransfer: false, canComplete: false },
    currentOperator: { id: 'op-1', name: 'Ana Operadora' },
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

const baseProps = {
  caseId: 'case-1',
  tenantId: 'tenant-1',
  status: 'in_negotiation',
  isUpdatingStatus: false,
  onUpdateStatus: vi.fn(),
  canManageCase: true,
  clientChannels: [],
  activeChannel: null,
  activeChannelLabel: 'Automático',
  isUpdatingChannel: false,
  onUpdateActiveChannel: vi.fn(),
};

describe('ConversationSummaryCard', () => {
  it('renderiza condutor, não lidas e CTA com link correto (incl. tenant_id)', () => {
    useConversationMock.mockReturnValue({ conversation: buildDetail(), isLoading: false });
    render(<ConversationSummaryCard {...baseProps} />);

    expect(screen.getByText('👤 Ana Operadora')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Vou verificar seu caso')).toBeInTheDocument();

    const cta = screen.getByTestId('open-conversation-cta');
    expect(cta).toHaveAttribute('href', '/conversations?case=case-1&tenant_id=tenant-1');
  });

  it('mostra condutor IA quando controller=ai', () => {
    useConversationMock.mockReturnValue({
      conversation: buildDetail({ case: { ...buildDetail().case, controller: 'ai' }, currentOperator: null, unreadCount: 0 }),
      isLoading: false,
    });
    render(<ConversationSummaryCard {...baseProps} />);
    expect(screen.getByText('🤖 IA de Cobrança')).toBeInTheDocument();
  });

  it('mostra skeleton de carregamento enquanto o resumo carrega', () => {
    useConversationMock.mockReturnValue({ conversation: null, isLoading: true });
    render(<ConversationSummaryCard {...baseProps} />);
    expect(screen.queryByTestId('open-conversation-cta')).toBeInTheDocument();
    expect(screen.queryByText('👤 Ana Operadora')).not.toBeInTheDocument();
  });

  it('seletor de canal ativo aparece apenas com canManageCase e canais vinculados', () => {
    useConversationMock.mockReturnValue({ conversation: buildDetail(), isLoading: false });
    const { rerender } = render(
      <ConversationSummaryCard {...baseProps} clientChannels={[{ id: 'ch-1', channel: 'telegram', username: 'maria' }]} />
    );
    expect(screen.getByTestId('active-channel-select')).toBeInTheDocument();

    rerender(<ConversationSummaryCard {...baseProps} canManageCase={false} clientChannels={[{ id: 'ch-1', channel: 'telegram' }]} />);
    expect(screen.queryByTestId('active-channel-select')).not.toBeInTheDocument();
  });
});
