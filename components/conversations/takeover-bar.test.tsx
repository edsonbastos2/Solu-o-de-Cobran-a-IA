import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TakeoverBar, type ConversationActionState } from './takeover-bar';

afterEach(cleanup);

const idleState: ConversationActionState = { loading: false, error: null, conflict: false };

describe('TakeoverBar', () => {
  it('controller=ai: mostra "IA está conduzindo" e botão Assumir abre confirmação', () => {
    const onTakeOver = vi.fn().mockResolvedValue({ ok: true });
    render(
      <TakeoverBar
        controller="ai"
        isMine={false}
        canTakeOver
        canReturnToAI={false}
        canTransfer={false}
        conversationVersion={3}
        actionState={idleState}
        onTakeOver={onTakeOver}
        onReturnToAI={vi.fn()}
        onOpenTransfer={vi.fn()}
      />
    );
    expect(screen.getByText('IA está conduzindo esta conversa')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('takeover-button'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('takeover-confirm-button'));
    expect(onTakeOver).toHaveBeenCalledWith(3);
  });

  it('controller=human (eu): mostra "Você está conduzindo" e botão Devolver com confirmação', () => {
    const onReturnToAI = vi.fn().mockResolvedValue({ ok: true });
    render(
      <TakeoverBar
        controller="human"
        isMine
        currentOperatorName="Ana Operadora"
        canTakeOver={false}
        canReturnToAI
        canTransfer={false}
        conversationVersion={5}
        actionState={idleState}
        onTakeOver={vi.fn()}
        onReturnToAI={onReturnToAI}
        onOpenTransfer={vi.fn()}
      />
    );
    expect(screen.getByText('Você está conduzindo esta conversa')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('return-to-ai-button'));
    fireEvent.click(screen.getByTestId('takeover-confirm-button'));
    expect(onReturnToAI).toHaveBeenCalledWith(5);
  });

  it('controller=human (outro operador): mostra o nome do operador atual', () => {
    render(
      <TakeoverBar
        controller="human"
        isMine={false}
        currentOperatorName="Bruno Gestor"
        canTakeOver={false}
        canReturnToAI={false}
        canTransfer={false}
        conversationVersion={1}
        actionState={idleState}
        onTakeOver={vi.fn()}
        onReturnToAI={vi.fn()}
        onOpenTransfer={vi.fn()}
      />
    );
    expect(screen.getByText('Bruno Gestor está conduzindo esta conversa')).toBeInTheDocument();
  });

  it('exibe conflito de versão (409) com mensagem acionável', () => {
    render(
      <TakeoverBar
        controller="ai"
        isMine={false}
        canTakeOver
        canReturnToAI={false}
        canTransfer={false}
        conversationVersion={1}
        actionState={{ loading: false, error: 'conflito', conflict: true }}
        onTakeOver={vi.fn()}
        onReturnToAI={vi.fn()}
        onOpenTransfer={vi.fn()}
      />
    );
    expect(screen.getByTestId('version-conflict-banner')).toBeInTheDocument();
  });

  it('botão Transferir aparece apenas com canTransfer e controller=human', () => {
    const onOpenTransfer = vi.fn();
    render(
      <TakeoverBar
        controller="human"
        isMine
        canTakeOver={false}
        canReturnToAI
        canTransfer
        conversationVersion={2}
        actionState={idleState}
        onTakeOver={vi.fn()}
        onReturnToAI={vi.fn()}
        onOpenTransfer={onOpenTransfer}
      />
    );
    fireEvent.click(screen.getByTestId('open-transfer-dialog'));
    expect(onOpenTransfer).toHaveBeenCalledTimes(1);
  });
});
