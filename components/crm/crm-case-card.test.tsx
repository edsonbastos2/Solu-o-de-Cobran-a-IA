import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CrmCaseCard } from './crm-case-card';
import type { CrmBoardCase } from '@/lib/types';

afterEach(cleanup);

function buildCase(overrides: Partial<CrmBoardCase> = {}): CrmBoardCase {
  return {
    id: 'case-1',
    caseNumber: '2026-001',
    clientName: 'Maria Souza',
    clientDocumentMasked: '***.456.789-**',
    currentValue: 1500,
    dueDate: '2026-08-26',
    lastContactAt: '2026-08-20T10:00:00Z',
    controller: 'ai',
    priority: 'alta',
    assignee: { id: 'op-1', name: 'Ana Operadora' },
    ...overrides,
  };
}

function setup(caseData: CrmBoardCase = buildCase()) {
  const handlers = {
    onMoveCase: vi.fn(),
    onOpenDetails: vi.fn(),
    onTransfer: vi.fn(),
  };
  render(<CrmCaseCard caseData={caseData} stage="NOVO" {...handlers} />);
  return { ...handlers, caseData };
}

describe('CrmCaseCard', () => {
  it('exibe número do caso, cliente, documento mascarado e valor formatado em BRL', () => {
    setup();

    expect(screen.getByText('2026-001')).toBeInTheDocument();
    expect(screen.getByText('Maria Souza')).toBeInTheDocument();
    expect(screen.getByText('***.456.789-**')).toBeInTheDocument();
    expect(screen.getByTestId('crm-card-value-case-1')).toHaveTextContent(/1\.500,00/);
  });

  it('exibe vencimento localizado e indicador de prioridade', () => {
    setup();

    expect(screen.getByTestId('crm-card-due-case-1')).toHaveTextContent('26/08/2026');
    const priority = screen.getByTestId('crm-card-priority-case-1');
    expect(priority).toHaveAttribute('aria-label', 'Prioridade alta');
    expect(priority.className).toContain('bg-red-500');
  });

  it('prioridade média usa estilo distinto de alta', () => {
    setup(buildCase({ priority: 'media' }));

    expect(screen.getByTestId('crm-card-priority-case-1').className).toContain('bg-amber-400');
  });

  it('exibe badge IA para controller "ai"', () => {
    setup(buildCase({ controller: 'ai' }));

    expect(screen.getByTestId('crm-card-controller-case-1')).toHaveTextContent('🤖 IA');
  });

  it('exibe badge Humano para controller "human" e nada quando null', () => {
    const { unmount } = render(
      <CrmCaseCard
        caseData={buildCase({ controller: 'human' })}
        stage="NOVO"
        onMoveCase={vi.fn()}
        onOpenDetails={vi.fn()}
        onTransfer={vi.fn()}
      />
    );
    expect(screen.getByTestId('crm-card-controller-case-1')).toHaveTextContent('👤 Humano');
    unmount();

    setup(buildCase({ controller: null }));
    expect(screen.queryByTestId('crm-card-controller-case-1')).not.toBeInTheDocument();
  });

  it('exibe último contato relativo e "Sem contato" quando ausente', () => {
    setup();
    expect(screen.getByTestId('crm-card-last-contact-case-1')).toBeInTheDocument();

    cleanup();
    setup(buildCase({ lastContactAt: null }));
    expect(screen.getByTestId('crm-card-last-contact-case-1')).toHaveTextContent('Sem contato');
  });

  it('exibe operador responsável quando informado e omite quando ausente', () => {
    setup();
    expect(screen.getByTestId('crm-card-assignee-case-1')).toHaveTextContent('Ana Operadora');

    cleanup();
    setup(buildCase({ assignee: null }));
    expect(screen.queryByTestId('crm-card-assignee-case-1')).not.toBeInTheDocument();
  });

  it('clique no card abre os detalhes do caso', () => {
    const { onOpenDetails, caseData } = setup();

    fireEvent.click(screen.getByTestId('crm-case-card-case-1'));
    expect(onOpenDetails).toHaveBeenCalledTimes(1);
    expect(onOpenDetails).toHaveBeenCalledWith(caseData);
  });
});
