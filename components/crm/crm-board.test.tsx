import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { CrmBoard } from './crm-board';
import { CRM_STAGE_META } from '@/lib/crm/stages';
import type { CrmStage } from '@/lib/crm/stages';
import type { CrmBoardCase, CrmBoardColumn } from '@/lib/types';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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

function buildColumn(stage: string, overrides: Partial<CrmBoardColumn> = {}): CrmBoardColumn {
  const cases = overrides.cases ?? [];
  return {
    stage,
    total: cases.length,
    page: 1,
    totalPages: 1,
    cases,
    ...overrides,
  } as CrmBoardColumn;
}

function setup(columns: CrmBoardColumn[]) {
  const handlers = {
    onMoveCase: vi.fn(),
    onLoadMore: vi.fn(),
    onOpenDetails: vi.fn(),
    onTransfer: vi.fn(),
  };
  render(
    <CrmBoard
      columns={columns}
      onMoveCase={handlers.onMoveCase}
      onLoadMore={handlers.onLoadMore}
      onOpenDetails={handlers.onOpenDetails}
      onTransfer={handlers.onTransfer}
    />
  );
  return handlers;
}

function createRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

function mockElementRects(rects: Record<string, DOMRect>) {
  const original = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: Element
  ) {
    const testId = (this as HTMLElement).dataset?.testid;
    if (testId && rects[testId]) return rects[testId];
    return original.call(this);
  });
}

function dragPointer(testId: string, from: { x: number; y: number }, to: { x: number; y: number }) {
  const card = screen.getByTestId(testId);
  fireEvent.pointerDown(card, {
    button: 0,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    buttons: 1,
    clientX: from.x,
    clientY: from.y,
  });
  fireEvent.pointerMove(document.body, {
    pointerId: 1,
    clientX: (from.x + to.x) / 2,
    clientY: (from.y + to.y) / 2,
  });
  fireEvent.pointerMove(document.body, { pointerId: 1, clientX: to.x, clientY: to.y });
  fireEvent.pointerUp(document.body, { pointerId: 1, clientX: to.x, clientY: to.y });
}

describe('CrmBoard', () => {
  it('renderiza as 11 colunas na ordem de CRM_STAGE_META', () => {
    setup(CRM_STAGE_META.map((meta) => buildColumn(meta.id)));

    const columnPattern = new RegExp(`^crm-column-(${CRM_STAGE_META.map((meta) => meta.id).join('|')})$`);
    const rendered = screen.getAllByTestId(columnPattern);
    expect(rendered).toHaveLength(11);
    expect(rendered.map((element) => element.getAttribute('data-stage'))).toEqual(
      CRM_STAGE_META.map((meta) => meta.id)
    );
  });

  it('header exibe o label da etapa e a contagem real da coluna', () => {
    setup([buildColumn('NOVO', { total: 25, cases: [buildCase()] })]);

    expect(screen.getByTestId('crm-column-header-NOVO')).toHaveTextContent('Novo');
    expect(screen.getByTestId('crm-column-count-NOVO')).toHaveTextContent('25');
  });

  it('etapa ausente dos dados renderiza coluna vazia com total 0', () => {
    setup([]);

    expect(screen.getByTestId('crm-column-NOVO')).toBeInTheDocument();
    expect(screen.getByTestId('crm-column-count-NOVO')).toHaveTextContent('0');
    expect(screen.getByTestId('crm-column-empty-NOVO')).toBeInTheDocument();
  });

  it('drop simulado em outra coluna chama onMoveCase com a etapa destino', () => {
    mockElementRects({
      'crm-column-NOVO': createRect(0, 0, 280, 400),
      'crm-column-EM_CONTATO': createRect(320, 0, 280, 400),
      'crm-case-card-case-1': createRect(10, 40, 260, 80),
    });
    const { onMoveCase } = setup([buildColumn('NOVO', { cases: [buildCase()] })]);

    dragPointer('crm-case-card-case-1', { x: 30, y: 70 }, { x: 460, y: 100 });

    expect(onMoveCase).toHaveBeenCalledTimes(1);
    expect(onMoveCase).toHaveBeenCalledWith({
      caseId: 'case-1',
      caseNumber: '2026-001',
      fromStage: 'NOVO',
      toStage: 'EM_CONTATO',
    });
  });

  it('drop sobre um card de outra coluna resolve a etapa da coluna que o contém', () => {
    mockElementRects({
      'crm-column-NOVO': createRect(0, 0, 280, 400),
      'crm-column-EM_CONTATO': createRect(320, 0, 280, 400),
      'crm-case-card-case-1': createRect(10, 40, 260, 80),
      'crm-case-card-case-2': createRect(330, 40, 260, 80),
    });
    const { onMoveCase } = setup([
      buildColumn('NOVO', { cases: [buildCase()] }),
      buildColumn('EM_CONTATO', { cases: [buildCase({ id: 'case-2', caseNumber: '2026-002' })] }),
    ]);

    dragPointer('crm-case-card-case-1', { x: 30, y: 70 }, { x: 460, y: 80 });

    expect(onMoveCase).toHaveBeenCalledTimes(1);
    expect(onMoveCase).toHaveBeenCalledWith({
      caseId: 'case-1',
      caseNumber: '2026-001',
      fromStage: 'NOVO',
      toStage: 'EM_CONTATO',
    });
  });

  it('drop na própria coluna de origem não chama onMoveCase', () => {
    mockElementRects({
      'crm-column-NOVO': createRect(0, 0, 280, 400),
      'crm-column-EM_CONTATO': createRect(320, 0, 280, 400),
      'crm-case-card-case-1': createRect(10, 40, 260, 80),
    });
    const { onMoveCase } = setup([buildColumn('NOVO', { cases: [buildCase()] })]);

    dragPointer('crm-case-card-case-1', { x: 30, y: 70 }, { x: 100, y: 200 });

    expect(onMoveCase).not.toHaveBeenCalled();
  });

  it('DragOverlay exibe o card arrastado durante o arraste', async () => {
    mockElementRects({
      'crm-column-NOVO': createRect(0, 0, 280, 400),
      'crm-column-EM_CONTATO': createRect(320, 0, 280, 400),
      'crm-case-card-case-1': createRect(10, 40, 260, 80),
    });
    setup([buildColumn('NOVO', { cases: [buildCase()] })]);

    const card = screen.getByTestId('crm-case-card-case-1');
    fireEvent.pointerDown(card, {
      button: 0,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      buttons: 1,
      clientX: 30,
      clientY: 70,
    });
    fireEvent.pointerMove(document.body, { pointerId: 1, clientX: 200, clientY: 100 });
    fireEvent.pointerMove(document.body, { pointerId: 1, clientX: 460, clientY: 100 });

    expect(screen.getAllByTestId('crm-card-value-case-1')).toHaveLength(2);

    fireEvent.pointerUp(document.body, { pointerId: 1, clientX: 460, clientY: 100 });
    await waitFor(() => expect(screen.getAllByTestId('crm-card-value-case-1')).toHaveLength(1));
  });

  it('propaga onLoadMore, onOpenDetails e onTransfer para as colunas', () => {
    const caseData = buildCase();
    const { onLoadMore, onOpenDetails, onTransfer } = setup([
      buildColumn('NOVO', { cases: [caseData], page: 1, totalPages: 2 }),
    ]);

    fireEvent.click(screen.getByTestId('crm-load-more-NOVO'));
    expect(onLoadMore).toHaveBeenCalledWith('NOVO');

    fireEvent.click(screen.getByTestId('crm-case-card-case-1'));
    expect(onOpenDetails).toHaveBeenCalledWith(caseData);

    fireEvent.click(screen.getByTestId('crm-card-actions-case-1'));
    fireEvent.click(screen.getByTestId('crm-card-action-transfer-case-1'));
    expect(onTransfer).toHaveBeenCalledWith(caseData);
  });
});
