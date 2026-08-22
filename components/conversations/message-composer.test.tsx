import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MessageComposer } from './message-composer';

afterEach(cleanup);

describe('MessageComposer', () => {
  it('Enter envia a mensagem e limpa o campo', async () => {
    const onSend = vi.fn().mockResolvedValue(true);
    render(<MessageComposer onSend={onSend} />);
    const textarea = screen.getByLabelText('Mensagem') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Olá devedor' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('Olá devedor');
    await waitFor(() => expect(textarea.value).toBe(''));
  });

  it('Shift+Enter insere quebra de linha em vez de enviar', () => {
    const onSend = vi.fn();
    render(<MessageComposer onSend={onSend} />);
    const textarea = screen.getByLabelText('Mensagem');
    fireEvent.change(textarea, { target: { value: 'linha 1' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('texto vazio não envia', () => {
    const onSend = vi.fn();
    render(<MessageComposer onSend={onSend} />);
    fireEvent.click(screen.getByTestId('composer-send'));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('disabled impede envio e mostra o motivo', () => {
    const onSend = vi.fn();
    render(<MessageComposer onSend={onSend} disabled disabledReason="Assuma a conversa para enviar mensagens." />);
    expect(screen.getByTestId('composer-disabled-reason')).toHaveTextContent('Assuma a conversa');
    expect(screen.getByTestId('composer-send')).toBeDisabled();
  });

  it('erro mostra botão de tentar novamente', () => {
    const onSend = vi.fn();
    render(<MessageComposer onSend={onSend} error="Falha de conexão." />);
    expect(screen.getByTestId('composer-error')).toHaveTextContent('Falha de conexão.');
    expect(screen.getByTestId('composer-retry')).toBeInTheDocument();
  });

  it('retry reenvia a última tentativa', () => {
    const onSend = vi.fn().mockResolvedValue(false);
    const { rerender } = render(<MessageComposer onSend={onSend} />);
    const textarea = screen.getByLabelText('Mensagem');
    fireEvent.change(textarea, { target: { value: 'tentativa 1' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('tentativa 1');

    rerender(<MessageComposer onSend={onSend} error="Falha de conexão." />);
    fireEvent.click(screen.getByTestId('composer-retry'));
    expect(onSend).toHaveBeenCalledTimes(2);
    expect(onSend).toHaveBeenLastCalledWith('tentativa 1');
  });

  it('sending desabilita o botão de enviar', () => {
    render(<MessageComposer onSend={vi.fn()} sending />);
    expect(screen.getByTestId('composer-send')).toBeDisabled();
  });
});
