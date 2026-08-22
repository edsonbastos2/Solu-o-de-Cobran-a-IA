import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DebtContextPanel } from './debt-context-panel';
import type { ConversationDetailResponse } from '@/lib/types';

afterEach(cleanup);

function buildConversation(overrides: Partial<ConversationDetailResponse> = {}): ConversationDetailResponse {
  return {
    case: {
      id: 'case-1',
      created_at: '2026-08-01T10:00:00Z',
      name: 'Maria Souza',
      phone: '11999999999',
      original_value: 1500,
      updated_value: 1650,
      due_date: '2026-08-01',
      max_discount_margin: 10,
      status: 'in_negotiation',
    },
    client: { id: 'client-1', created_at: '2026-01-01T00:00:00Z', name: 'Maria Souza', document: '12345678900' },
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

describe('DebtContextPanel', () => {
  it('renderiza devedor com documento mascarado, valores e dias em atraso', () => {
    render(<DebtContextPanel conversation={buildConversation()} tenantPath="" />);
    expect(screen.getByText('Maria Souza')).toBeInTheDocument();
    expect(screen.getByText('***.***.***-**')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.650,00')).toBeInTheDocument();
  });

  it('não renderiza seção de contrato quando ausente', () => {
    render(<DebtContextPanel conversation={buildConversation()} tenantPath="" />);
    expect(screen.queryByText('Contrato')).not.toBeInTheDocument();
  });

  it('renderiza negociação quando presente', () => {
    render(
      <DebtContextPanel
        conversation={buildConversation({
          negotiation: {
            id: 'neg-1',
            tenant_id: 't1',
            client_id: 'client-1',
            contract_id: null,
            financial_title_id: null,
            case_id: 'case-1',
            status: 'open',
            original_value: 1500,
            proposed_value: 1200,
            agreed_value: null,
            discount_percent: 20,
            installment_count: 3,
            expires_at: null,
            accepted_at: null,
            metadata: {},
            created_by: null,
            created_at: '2026-08-01T00:00:00Z',
            updated_at: '2026-08-01T00:00:00Z',
          },
        })}
        tenantPath=""
      />
    );
    expect(screen.getByText('Em aberto')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.200,00')).toBeInTheDocument();
  });

  it('chama onClose ao clicar em fechar', () => {
    let closed = false;
    render(<DebtContextPanel conversation={buildConversation()} tenantPath="" onClose={() => (closed = true)} />);
    screen.getByTestId('debt-context-close').click();
    expect(closed).toBe(true);
  });
});
