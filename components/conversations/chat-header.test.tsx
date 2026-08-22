import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ChatHeader } from './chat-header';
import type { Case } from '@/lib/types';

afterEach(cleanup);

function buildCase(overrides: Partial<Case> = {}): Case {
  return {
    id: 'case-1',
    created_at: '2026-08-01T10:00:00Z',
    name: 'Maria Souza',
    phone: '11999999999',
    original_value: 1500,
    updated_value: 1500,
    due_date: '2026-07-01',
    max_discount_margin: 10,
    status: 'in_negotiation',
    ...overrides,
  };
}

describe('ChatHeader', () => {
  it('renderiza nome do devedor e valor da dívida', () => {
    render(<ChatHeader caseData={buildCase()} channel="whatsapp" />);
    expect(screen.getByText('Maria Souza')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.500,00')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
  });

  it('não renderiza botão de voltar sem onBack', () => {
    render(<ChatHeader caseData={buildCase()} />);
    expect(screen.queryByTestId('chat-header-back')).not.toBeInTheDocument();
  });

  it('chama onBack ao clicar no botão de voltar', () => {
    const onBack = vi.fn();
    render(<ChatHeader caseData={buildCase()} onBack={onBack} />);
    fireEvent.click(screen.getByTestId('chat-header-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
