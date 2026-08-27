import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CrmSearchInput } from './crm-search-input';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('CrmSearchInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('renderiza com placeholder e valor controlado', () => {
    render(<CrmSearchInput value="maria" onChange={vi.fn()} />);

    const input = screen.getByTestId('crm-search-input');
    expect(input).toHaveAttribute('placeholder', 'Buscar cliente, CPF/CNPJ ou nº do caso');
    expect(input).toHaveValue('maria');
  });

  it('digitar dispara onChange somente após o debounce de 300ms', () => {
    const onChange = vi.fn();
    render(<CrmSearchInput value="" onChange={onChange} />);

    fireEvent.change(screen.getByTestId('crm-search-input'), { target: { value: 'par' } });
    fireEvent.change(screen.getByTestId('crm-search-input'), { target: { value: 'parcela' } });
    vi.advanceTimersByTime(299);
    expect(onChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('parcela');
  });

  it('nova digitação cancela o timer anterior do debounce', () => {
    const onChange = vi.fn();
    render(<CrmSearchInput value="" onChange={onChange} />);

    fireEvent.change(screen.getByTestId('crm-search-input'), { target: { value: 'par' } });
    vi.advanceTimersByTime(200);
    fireEvent.change(screen.getByTestId('crm-search-input'), { target: { value: 'parc' } });
    vi.advanceTimersByTime(200);
    expect(onChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('parc');
  });

  it('valor externo atualizado sincroniza o campo', () => {
    const { rerender } = render(<CrmSearchInput value="" onChange={vi.fn()} />);

    rerender(<CrmSearchInput value="joão" onChange={vi.fn()} />);
    expect(screen.getByTestId('crm-search-input')).toHaveValue('joão');
  });
});
