import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { CrmTransferDialog } from './crm-transfer-dialog';
import { fetchWithAuth } from '@/lib/api';

vi.mock('@/lib/api', () => ({ fetchWithAuth: vi.fn() }));

const fetchMock = vi.mocked(fetchWithAuth);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setup(overrides: Partial<Parameters<typeof CrmTransferDialog>[0]> = {}) {
  const props = {
    open: true,
    caseId: 'case-1',
    caseNumber: '2026-001',
    operators: [
      { id: 'op-1', name: 'Ana Operadora' },
      { id: 'op-2', name: 'Bia Operadora' },
    ],
    currentUserId: 'user-1',
    currentOperatorName: 'Ana Operadora',
    expectedVersion: 3,
    tenantId: 'tenant-1',
    onClose: vi.fn(),
    onUpdate: vi.fn(),
    ...overrides,
  };
  render(<CrmTransferDialog {...props} />);
  return props;
}

function selectOperator(value: string) {
  fireEvent.change(screen.getByTestId('crm-transfer-operator'), { target: { value } });
}

describe('CrmTransferDialog', () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue({ ok: true } as Response);
  });

  it('confirmar desabilitado sem operador selecionado', () => {
    setup();

    expect(screen.getByTestId('crm-transfer-confirm')).toBeDisabled();
  });

  it('confirmar desabilitado enquanto expectedVersion não foi carregado', () => {
    setup({ expectedVersion: null });

    selectOperator('op-2');
    expect(screen.getByTestId('crm-transfer-confirm')).toBeDisabled();
  });

  it('não lista o próprio usuário atual entre operadores', () => {
    setup({ currentUserId: 'op-1' });

    expect(screen.getByTestId('crm-transfer-operator')).toHaveTextContent('Bia Operadora');
    expect(screen.getByTestId('crm-transfer-operator')).not.toHaveTextContent('Ana Operadora');
  });

  it('envia toOperatorId e expectedVersion sem motivo quando motivo vazio', async () => {
    const props = setup();

    selectOperator('op-2');
    fireEvent.click(screen.getByTestId('crm-transfer-confirm'));

    await waitFor(() => expect(props.onUpdate).toHaveBeenCalled());
    expect(props.onClose).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/conversations/case-1/transfer?tenant_id=tenant-1');
    expect(options?.method).toBe('POST');
    expect(JSON.parse(options?.body as string)).toEqual({
      toOperatorId: 'op-2',
      expectedVersion: 3,
    });
  });

  it('envia motivo opcional quando preenchido', async () => {
    const props = setup();

    selectOperator('op-2');
    fireEvent.change(screen.getByTestId('crm-transfer-reason'), {
      target: { value: 'caso exige alçada de gestor' },
    });
    fireEvent.click(screen.getByTestId('crm-transfer-confirm'));

    await waitFor(() => expect(props.onUpdate).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      toOperatorId: 'op-2',
      reason: 'caso exige alçada de gestor',
      expectedVersion: 3,
    });
  });

  it('erro da API exibe mensagem e mantém o diálogo aberto', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Sem permissão para transferir este caso.' }),
    } as unknown as Response);
    const props = setup();

    selectOperator('op-2');
    fireEvent.click(screen.getByTestId('crm-transfer-confirm'));

    await waitFor(() => expect(screen.getByTestId('crm-transfer-error')).toBeInTheDocument());
    expect(screen.getByTestId('crm-transfer-error')).toHaveTextContent(
      'Sem permissão para transferir este caso.'
    );
    expect(props.onUpdate).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('falha de rede exibe mensagem de conexão', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    const props = setup();

    selectOperator('op-2');
    fireEvent.click(screen.getByTestId('crm-transfer-confirm'));

    await waitFor(() => expect(screen.getByTestId('crm-transfer-error')).toBeInTheDocument());
    expect(screen.getByTestId('crm-transfer-error')).toHaveTextContent(
      'Falha de conexão. Tente novamente.'
    );
    expect(props.onUpdate).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('Escape fecha o diálogo', () => {
    const props = setup();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalled();
  });

  it('não renderiza quando fechado', () => {
    setup({ open: false });

    expect(screen.queryByTestId('crm-transfer-confirm')).not.toBeInTheDocument();
  });
});
