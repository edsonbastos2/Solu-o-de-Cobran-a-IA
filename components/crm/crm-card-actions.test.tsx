import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CrmCardActions } from './crm-card-actions';
import type { CrmStage } from '@/lib/crm/stages';
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
    lastContactAt: null,
    controller: null,
    priority: 'media',
    assignee: null,
    ...overrides,
  };
}

function setup(stage: CrmStage = 'NOVO', tenantPath?: string) {
  const handlers = { onMoveToStage: vi.fn(), onTransfer: vi.fn() };
  render(
    <CrmCardActions
      caseData={buildCase()}
      stage={stage}
      tenantPath={tenantPath}
      onMoveToStage={handlers.onMoveToStage}
      onTransfer={handlers.onTransfer}
    />
  );
  return handlers;
}

function openMenu() {
  const trigger = screen.getByTestId('crm-card-actions-case-1');
  fireEvent.click(trigger);
  expect(screen.getByTestId('crm-card-menu-case-1')).toBeInTheDocument();
  return trigger;
}

describe('CrmCardActions', () => {
  it('menu abre pelo botão com aria-expanded e fecha com Escape devolvendo o foco', () => {
    setup('NOVO');

    const trigger = openMenu();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(screen.getByTestId('crm-card-menu-case-1'), { key: 'Escape' });
    expect(screen.queryByTestId('crm-card-menu-case-1')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('"Mover para etapa..." lista apenas etapas permitidas por canTransition a partir de NOVO', () => {
    setup('NOVO');
    openMenu();

    expect(screen.getByTestId('crm-move-to-EM_CONTATO')).toHaveTextContent('Em contato');
    expect(screen.getByTestId('crm-move-to-SEM_CONTATO')).toBeInTheDocument();
    expect(screen.getByTestId('crm-move-to-ESCALADO')).toBeInTheDocument();
    expect(screen.getByTestId('crm-move-to-ENCERRADO')).toBeInTheDocument();

    expect(screen.queryByTestId('crm-move-to-EM_NEGOCIACAO')).not.toBeInTheDocument();
    expect(screen.queryByTestId('crm-move-to-NOVO')).not.toBeInTheDocument();
    expect(screen.queryByTestId('crm-move-to-AGUARDANDO_PAGAMENTO')).not.toBeInTheDocument();
  });

  it('"Mover para etapa..." a partir de EM_NEGOCIACAO inclui AGUARDANDO_PAGAMENTO e NEGOCIACAO_RECUSADA', () => {
    setup('EM_NEGOCIACAO');
    openMenu();

    expect(screen.getByTestId('crm-move-to-AGUARDANDO_PAGAMENTO')).toBeInTheDocument();
    expect(screen.getByTestId('crm-move-to-NEGOCIACAO_RECUSADA')).toBeInTheDocument();
    expect(screen.queryByTestId('crm-move-to-EM_CONTATO')).not.toBeInTheDocument();
  });

  it('etapa terminal (ENCERRADO) não oferece destinos', () => {
    setup('ENCERRADO');
    openMenu();

    expect(screen.getByTestId('crm-move-unavailable-case-1')).toHaveTextContent(
      'Nenhuma etapa disponível'
    );
    expect(screen.queryByTestId('crm-move-to-ENCERRADO')).not.toBeInTheDocument();
  });

  it('selecionar destino chama onMoveToStage e fecha o menu', () => {
    const { onMoveToStage } = setup('NOVO');
    openMenu();

    fireEvent.click(screen.getByTestId('crm-move-to-SEM_CONTATO'));
    expect(onMoveToStage).toHaveBeenCalledWith('SEM_CONTATO');
    expect(screen.queryByTestId('crm-card-menu-case-1')).not.toBeInTheDocument();
  });

  it('"Transferir" chama onTransfer e fecha o menu', () => {
    const { onTransfer } = setup('NOVO');
    openMenu();

    fireEvent.click(screen.getByTestId('crm-card-action-transfer-case-1'));
    expect(onTransfer).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('crm-card-menu-case-1')).not.toBeInTheDocument();
  });

  it('"Abrir conversa" aponta para a Central com o caso selecionado', () => {
    setup('NOVO');
    openMenu();

    expect(screen.getByTestId('crm-card-action-conversation-case-1')).toHaveAttribute(
      'href',
      '/conversations?case=case-1'
    );
  });

  it('"Abrir detalhes" aponta para a página do caso', () => {
    setup('NOVO');
    openMenu();

    expect(screen.getByTestId('crm-card-action-details-case-1')).toHaveAttribute(
      'href',
      '/cases/case-1'
    );
  });

  it('links preservam o tenant quando tenantPath é informado', () => {
    setup('NOVO', '?tenant_id=tenant-1');
    openMenu();

    expect(screen.getByTestId('crm-card-action-conversation-case-1')).toHaveAttribute(
      'href',
      '/conversations?case=case-1&tenant_id=tenant-1'
    );
    expect(screen.getByTestId('crm-card-action-details-case-1')).toHaveAttribute(
      'href',
      '/cases/case-1?tenant_id=tenant-1'
    );
  });
});
