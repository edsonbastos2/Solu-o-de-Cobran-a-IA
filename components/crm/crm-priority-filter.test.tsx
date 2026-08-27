import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CrmPriorityFilter } from './crm-priority-filter';

afterEach(cleanup);

describe('CrmPriorityFilter', () => {
  it('renderiza todas as prioridades a partir de CRM_PRIORITIES', () => {
    render(<CrmPriorityFilter value="all" onChange={vi.fn()} />);

    const select = screen.getByLabelText('Filtrar por prioridade');
    expect(select).toHaveValue('all');
    expect(screen.getByRole('option', { name: 'Todas as prioridades' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Alta' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Média' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Baixa' })).toBeInTheDocument();
  });

  it('propaga a alteração de prioridade', () => {
    const onChange = vi.fn();
    render(<CrmPriorityFilter value="all" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Filtrar por prioridade'), { target: { value: 'alta' } });
    expect(onChange).toHaveBeenCalledWith('alta');
  });

  it('exibe o valor selecionado', () => {
    render(<CrmPriorityFilter value="baixa" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Filtrar por prioridade')).toHaveValue('baixa');
  });
});
