import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CrmFilters } from './crm-filters';
import type { CrmBoardFilters } from '@/hooks/use-crm-board';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const OPERATORS = [
  { id: 'op-1', name: 'Ana Operadora' },
  { id: 'op-2', name: 'Bruno Gestor' },
];

const EMPTY_FILTERS: CrmBoardFilters = { search: '', operator: 'all', priority: 'all' };

function setup(filters: CrmBoardFilters = EMPTY_FILTERS, canFilterByOperator = false) {
  const onChange = vi.fn();
  return {
    onChange,
    ...render(
      <CrmFilters
        filters={filters}
        onChange={onChange}
        operators={OPERATORS}
        canFilterByOperator={canFilterByOperator}
      />
    ),
  };
}

describe('CrmFilters', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('renderiza busca e prioridade sempre, sem operador quando não permitido', () => {
    setup();

    expect(screen.getByTestId('crm-search-input')).toBeInTheDocument();
    expect(screen.getByTestId('crm-priority-filter')).toBeInTheDocument();
    expect(screen.queryByTestId('crm-operator-filter')).not.toBeInTheDocument();
  });

  it('renderiza filtro por operador quando canFilterByOperator é true', () => {
    setup(EMPTY_FILTERS, true);

    expect(screen.getByTestId('crm-operator-filter')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Ana Operadora' })).toBeInTheDocument();
  });

  it('busca com debounce propaga novo estado de filtros', () => {
    const { onChange } = setup();

    fireEvent.change(screen.getByTestId('crm-search-input'), { target: { value: 'maria' } });
    vi.advanceTimersByTime(299);
    expect(onChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, search: 'maria' });
  });

  it('alteração de prioridade e operador propaga o estado completo', () => {
    const { onChange } = setup(EMPTY_FILTERS, true);

    fireEvent.change(screen.getByTestId('crm-priority-filter'), { target: { value: 'alta' } });
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, priority: 'alta' });

    fireEvent.change(screen.getByTestId('crm-operator-filter'), { target: { value: 'op-1' } });
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, operator: 'op-1' });
  });

  it('botão "Limpar" reseta busca, operador e prioridade', () => {
    const { onChange } = setup({ search: 'maria', operator: 'op-1', priority: 'alta' }, true);

    fireEvent.click(screen.getByTestId('crm-filters-clear'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ search: '', operator: 'all', priority: 'all' });
  });
});
