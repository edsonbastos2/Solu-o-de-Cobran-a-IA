import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TransferDialog } from './transfer-dialog';
import type { ConversationActionState } from './takeover-bar';

afterEach(cleanup);

const idleState: ConversationActionState = { loading: false, error: null, conflict: false };
const operators = [
  { id: 'op-1', name: 'Ana Operadora', role: 'operador' },
  { id: 'op-2', name: 'Bruno Gestor', role: 'gestor' },
];

describe('TransferDialog', () => {
  it('não renderiza nada quando open=false', () => {
    render(
      <TransferDialog
        open={false}
        onClose={vi.fn()}
        operators={operators}
        conversationVersion={1}
        actionState={idleState}
        onTransfer={vi.fn()}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('motivo é opcional: confirmar chama onTransfer sem reason', () => {
    const onTransfer = vi.fn().mockResolvedValue({ ok: true });
    render(
      <TransferDialog
        open
        onClose={vi.fn()}
        operators={operators}
        conversationVersion={7}
        actionState={idleState}
        onTransfer={onTransfer}
      />
    );
    fireEvent.change(screen.getByLabelText('Transferir para'), { target: { value: 'op-2' } });
    fireEvent.click(screen.getByTestId('transfer-confirm'));
    expect(onTransfer).toHaveBeenCalledWith({ toOperatorId: 'op-2', reason: undefined, expectedVersion: 7 });
  });

  it('confirmar chama onTransfer com toOperatorId e reason preenchidos', () => {
    const onTransfer = vi.fn().mockResolvedValue({ ok: true });
    render(
      <TransferDialog
        open
        onClose={vi.fn()}
        operators={operators}
        conversationVersion={2}
        actionState={idleState}
        onTransfer={onTransfer}
      />
    );
    fireEvent.change(screen.getByLabelText('Transferir para'), { target: { value: 'op-1' } });
    fireEvent.change(screen.getByLabelText('Motivo (opcional)'), { target: { value: 'Alçada de gestor' } });
    fireEvent.click(screen.getByTestId('transfer-confirm'));
    expect(onTransfer).toHaveBeenCalledWith({ toOperatorId: 'op-1', reason: 'Alçada de gestor', expectedVersion: 2 });
  });

  it('botão confirmar fica desabilitado sem operador selecionado', () => {
    render(
      <TransferDialog
        open
        onClose={vi.fn()}
        operators={operators}
        conversationVersion={1}
        actionState={idleState}
        onTransfer={vi.fn()}
      />
    );
    expect(screen.getByTestId('transfer-confirm')).toBeDisabled();
  });

  it('exclui o operador atual da lista de destinatários', () => {
    render(
      <TransferDialog
        open
        onClose={vi.fn()}
        operators={operators}
        currentUserId="op-1"
        conversationVersion={1}
        actionState={idleState}
        onTransfer={vi.fn()}
      />
    );
    expect(screen.queryByText('Ana Operadora')).not.toBeInTheDocument();
    expect(screen.getByText('Bruno Gestor')).toBeInTheDocument();
  });

  it('Esc fecha o dialog', () => {
    const onClose = vi.fn();
    render(
      <TransferDialog
        open
        onClose={onClose}
        operators={operators}
        conversationVersion={1}
        actionState={idleState}
        onTransfer={vi.fn()}
      />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
