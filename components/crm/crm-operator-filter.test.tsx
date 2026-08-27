import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CrmOperatorFilter } from './crm-operator-filter';

afterEach(cleanup);

const OPERATORS = [
  { id: 'op-1', name: 'Ana Operadora' },
  { id: 'op-2', name: 'Bruno Gestor' },
];

describe('CrmOperatorFilter', () => {
  it('não renderiza quando canFilterByOperator é false', () => {
    const { container } = render(
      <CrmOperatorFilter operators={OPERATORS} value="all" onChange={vi.fn()} canFilterByOperator={false} />
    );

    expect(container.innerHTML).toBe('');
    expect(screen.queryByTestId('crm-operator-filter')).not.toBeInTheDocument();
  });

  it('renderiza opções fixas e operadores quando canFilterByOperator é true', () => {
    render(
      <CrmOperatorFilter operators={OPERATORS} value="all" onChange={vi.fn()} canFilterByOperator={true} />
    );

    const select = screen.getByLabelText('Filtrar por operador');
    expect(select).toHaveValue('all');
    expect(screen.getByRole('option', { name: 'Todos os operadores' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sem responsável' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Ana Operadora' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Bruno Gestor' })).toBeInTheDocument();
  });

  it('propaga a alteração de valor', () => {
    const onChange = vi.fn();
    render(
      <CrmOperatorFilter operators={OPERATORS} value="all" onChange={onChange} canFilterByOperator={true} />
    );

    fireEvent.change(screen.getByLabelText('Filtrar por operador'), { target: { value: 'unassigned' } });
    expect(onChange).toHaveBeenCalledWith('unassigned');

    fireEvent.change(screen.getByLabelText('Filtrar por operador'), { target: { value: 'op-1' } });
    expect(onChange).toHaveBeenCalledWith('op-1');
  });
});
