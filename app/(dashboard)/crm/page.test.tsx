import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import CrmPage from './page';
import { useActiveTenant } from '@/hooks/use-active-tenant';
import { useCrmBoard } from '@/hooks/use-crm-board';
import { useCrmStats } from '@/hooks/use-crm-stats';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import useSWR from 'swr';
import type { CrmBoardCase, CrmBoardColumn, CrmStats } from '@/lib/types';

vi.mock('next/navigation', () => ({ useRouter: vi.fn(() => ({ push: vi.fn() })) }));
vi.mock('swr', () => ({ useSWR: vi.fn(), default: vi.fn() }));
vi.mock('@/hooks/use-active-tenant', () => ({ useActiveTenant: vi.fn() }));
vi.mock('@/hooks/use-crm-board', () => ({
  useCrmBoard: vi.fn(),
  EMPTY_CRM_FILTERS: { search: '', operator: 'all', priority: 'all' },
}));
vi.mock('@/hooks/use-crm-stats', () => ({ useCrmStats: vi.fn() }));
vi.mock('@/hooks/useTeamMembers', () => ({ useTeamMembers: vi.fn() }));

const activeTenantMock = vi.mocked(useActiveTenant);
const boardMock = vi.mocked(useCrmBoard);
const statsMock = vi.mocked(useCrmStats);
const teamMock = vi.mocked(useTeamMembers);
const swrMock = vi.mocked(useSWR);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function buildCase(overrides: Partial<CrmBoardCase> = {}): CrmBoardCase {
  return {
    id: 'case-1',
    caseNumber: '2026-001',
    clientName: 'Maria Souza',
    clientDocumentMasked: '***.456.789-**',
    currentValue: 1500,
    dueDate: '2026-08-26',
    lastContactAt: null,
    controller: null,
    priority: 'media',
    assignee: null,
    ...overrides,
  };
}

function buildStats(): CrmStats {
  return {
    totalCases: 12,
    negotiating: 4,
    awaitingPayment: 2,
    negotiationsCreated: 8,
    negotiationsAccepted: 3,
    promises: 2,
    paymentsConfirmed: 1,
    recoveredValue: 5000,
  };
}

function setupMocks(overrides: { role?: string; board?: Record<string, unknown> } = {}) {
  const refresh = vi.fn();
  const moveCase = vi.fn().mockResolvedValue(null);
  const columns: CrmBoardColumn[] = [
    { stage: 'NOVO', total: 1, page: 1, totalPages: 1, cases: [buildCase()] },
    { stage: 'EM_CONTATO', total: 0, page: 1, totalPages: 1, cases: [] },
  ];

  activeTenantMock.mockReturnValue({
    user: { id: 'user-1' },
    role: (overrides.role ?? 'gestor') as 'gestor',
    tenantId: 'tenant-1',
    tenantPath: '?tenant_id=tenant-1',
    tenantQuery: 'tenant_id=tenant-1',
    needsTenantSelection: false,
  } as ReturnType<typeof useActiveTenant>);

  const board = {
    columns,
    isLoading: false,
    error: null,
    filters: { search: '', operator: 'all', priority: 'all' },
    setFilters: vi.fn(),
    loadMore: vi.fn(),
    moveCase,
    refresh,
    ...(overrides.board ?? {}),
  };
  boardMock.mockReturnValue(board as ReturnType<typeof useCrmBoard>);

  statsMock.mockReturnValue({
    stats: buildStats(),
    isLoading: false,
    error: null,
  } as ReturnType<typeof useCrmStats>);

  teamMock.mockReturnValue({
    members: [
      { userId: 'user-1', name: 'Gestor Silva', email: 'gestor@x.com', status: 'active', role: 'gestor' },
      { userId: 'op-2', name: 'Bia Operadora', email: 'bia@x.com', status: 'active', role: 'operador' },
    ],
    loading: false,
    error: null,
    reload: vi.fn(),
    updateMember: vi.fn(),
    removeMember: vi.fn(),
    resendInvite: vi.fn(),
  } as unknown as ReturnType<typeof useTeamMembers>);

  swrMock.mockReturnValue({ data: { conversationVersion: 3 } } as ReturnType<typeof useSWR>);

  return { refresh: board.refresh as Mock, moveCase: board.moveCase as Mock, columns };
}

describe('CrmPage', () => {
  beforeEach(() => {
    setupMocks();
  });

  it('renderiza stats, filtros e board montados a partir dos hooks', () => {
    render(<CrmPage />);

    expect(screen.getByTestId('crm-stats')).toBeInTheDocument();
    expect(screen.getByTestId('crm-stat-totalCases')).toHaveTextContent('12');
    expect(screen.getByTestId('crm-filters')).toBeInTheDocument();
    expect(screen.getByTestId('crm-board')).toBeInTheDocument();
    expect(screen.getByTestId('crm-case-card-case-1')).toBeInTheDocument();
  });

  it('gestor vê o filtro por operador com a lista da equipe', () => {
    render(<CrmPage />);

    const operatorFilter = screen.getByTestId('crm-operator-filter');
    expect(operatorFilter).toBeInTheDocument();
    expect(operatorFilter).toHaveTextContent('Bia Operadora');
  });

  it('operador não vê o filtro por operador', () => {
    setupMocks({ role: 'operador' });
    render(<CrmPage />);

    expect(screen.queryByTestId('crm-operator-filter')).not.toBeInTheDocument();
  });

  it('estado de erro da API exibe mensagem + retry que chama refresh', () => {
    const { refresh } = setupMocks({ board: { error: new Error('falha') } });
    render(<CrmPage />);

    expect(screen.getByTestId('crm-board-error')).toBeInTheDocument();
    expect(screen.queryByTestId('crm-board')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('crm-board-retry'));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('carregamento exibe skeleton do board', () => {
    setupMocks({ board: { isLoading: true } });
    render(<CrmPage />);

    expect(screen.getByTestId('crm-board-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('crm-board')).not.toBeInTheDocument();
  });

  it('movimentação com STAGE_CONFLICT exibe feedback e o card permanece na coluna original', async () => {
    const { moveCase } = setupMocks({
      board: {
        moveCase: vi.fn().mockResolvedValue({
          error_code: 'STAGE_CONFLICT',
          message: 'Caso 2026-001 foi movido por outro operador.',
        }),
      },
    });
    render(<CrmPage />);

    fireEvent.click(screen.getByTestId('crm-card-actions-case-1'));
    fireEvent.click(screen.getByTestId('crm-move-to-SEM_CONTATO'));

    await waitFor(() => expect(screen.getByTestId('crm-toast')).toBeInTheDocument());
    expect(screen.getByTestId('crm-toast')).toHaveTextContent(
      'Caso 2026-001 atualizado por outro operador — atualizando'
    );

    const originColumn = screen.getByTestId('crm-column-NOVO');
    expect(within(originColumn).getByTestId('crm-case-card-case-1')).toBeInTheDocument();
    expect(moveCase).toHaveBeenCalledWith('case-1', '2026-001', 'NOVO', 'SEM_CONTATO');
  });

  it('abre o diálogo de transferência a partir das ações do card', () => {
    render(<CrmPage />);

    fireEvent.click(screen.getByTestId('crm-card-actions-case-1'));
    fireEvent.click(screen.getByTestId('crm-card-action-transfer-case-1'));

    expect(screen.getByTestId('crm-transfer-operator')).toBeInTheDocument();
    expect(screen.getByTestId('crm-transfer-confirm')).toBeDisabled();
  });
});
