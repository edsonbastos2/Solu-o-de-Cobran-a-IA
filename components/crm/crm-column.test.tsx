import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CrmColumn } from './crm-column';
import { CRM_STAGE_META } from '@/lib/crm/stages';
import type { CrmStageMeta } from '@/lib/crm/stages';
import type { CrmBoardCase, CrmBoardColumn } from '@/lib/types';

afterEach(cleanup);

function getMeta(stage: string): CrmStageMeta {
  const meta = CRM_STAGE_META.find((item) => item.id === stage);
  if (!meta) throw new Error(`meta não encontrada: ${stage}`);
  return meta;
}

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

function setup(column: Partial<CrmBoardColumn> & { stage: string }) {
  const handlers = {
    onMoveCase: vi.fn(),
    onLoadMore: vi.fn(),
    onOpenDetails: vi.fn(),
    onTransfer: vi.fn(),
  };
  const fullColumn: CrmBoardColumn = {
    total: column.cases?.length ?? 0,
    page: 1,
    totalPages: 1,
    ...column,
  } as CrmBoardColumn;
  render(<CrmColumn meta={getMeta(column.stage)} column={fullColumn} {...handlers} />);
  return handlers;
}

describe('CrmColumn', () => {
  it('header exibe o label e a contagem real (total)', () => {
    setup({ stage: 'NOVO', total: 25, cases: [buildCase()] });

    expect(screen.getByTestId('crm-column-NOVO')).toHaveTextContent('Novo');
    expect(screen.getByTestId('crm-column-count-NOVO')).toHaveTextContent('25');
  });

  it('coluna de exceção recebe estilo distinto de coluna de fluxo', () => {
    setup({ stage: 'SEM_CONTATO', cases: [] });
    const exceptionHeader = screen.getByTestId('crm-column-header-SEM_CONTATO');
    expect(screen.getByTestId('crm-column-SEM_CONTATO')).toHaveAttribute('data-kind', 'exception');
    expect(exceptionHeader.className).toContain('amber');

    cleanup();

    setup({ stage: 'NOVO', cases: [] });
    expect(screen.getByTestId('crm-column-NOVO')).toHaveAttribute('data-kind', 'flow');
    expect(screen.getByTestId('crm-column-header-NOVO').className).not.toContain('amber');
  });

  it('exibe estado vazio quando não há casos', () => {
    setup({ stage: 'NOVO', cases: [] });

    expect(screen.getByTestId('crm-column-empty-NOVO')).toHaveTextContent(
      'Nenhum caso nesta etapa'
    );
    expect(screen.queryByTestId('crm-case-card-case-1')).not.toBeInTheDocument();
  });

  it('"Carregar mais" visível apenas quando page < totalPages e chama onLoadMore(stage)', () => {
    setup({ stage: 'NOVO', cases: [buildCase()], page: 1, totalPages: 3 });

    const button = screen.getByTestId('crm-load-more-NOVO');
    fireEvent.click(button);
    expect(screen.getByTestId('crm-load-more-NOVO')).toBeInTheDocument();
    expect(button).toBeInTheDocument();
  });

  it('loadMore é chamado com a etapa da coluna', () => {
    const { onLoadMore } = setup({ stage: 'NOVO', cases: [buildCase()], page: 1, totalPages: 2 });

    fireEvent.click(screen.getByTestId('crm-load-more-NOVO'));
    expect(onLoadMore).toHaveBeenCalledWith('NOVO');
  });

  it('"Carregar mais" não aparece quando page === totalPages', () => {
    setup({ stage: 'NOVO', cases: [buildCase()], page: 2, totalPages: 2 });

    expect(screen.queryByTestId('crm-load-more-NOVO')).not.toBeInTheDocument();
  });
});
