import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CrmStatsPanel } from './crm-stats';
import type { CrmStats } from '@/lib/types';

afterEach(cleanup);

const STATS: CrmStats = {
  totalCases: 42,
  negotiating: 10,
  awaitingPayment: 7,
  negotiationsCreated: 25,
  negotiationsAccepted: 13,
  promises: 7,
  paymentsConfirmed: 9,
  recoveredValue: 1234.56,
};

describe('CrmStatsPanel', () => {
  it('renderiza skeleton de carregamento com 8 blocos', () => {
    render(<CrmStatsPanel stats={null} isLoading={true} />);

    expect(screen.getByTestId('crm-stats-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('crm-stats')).not.toBeInTheDocument();
    expect(screen.getByTestId('crm-stats-skeleton').children).toHaveLength(8);
  });

  it('renderiza estado vazio quando não há estatísticas', () => {
    render(<CrmStatsPanel stats={null} isLoading={false} />);

    expect(screen.getByTestId('crm-stats-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('crm-stats')).not.toBeInTheDocument();
  });

  it('renderiza os 8 indicadores com valores', () => {
    render(<CrmStatsPanel stats={STATS} isLoading={false} />);

    expect(screen.getByTestId('crm-stats')).toBeInTheDocument();
    expect(screen.getByTestId('crm-stat-totalCases')).toHaveTextContent('42');
    expect(screen.getByTestId('crm-stat-negotiating')).toHaveTextContent('10');
    expect(screen.getByTestId('crm-stat-awaitingPayment')).toHaveTextContent('7');
    expect(screen.getByTestId('crm-stat-negotiationsCreated')).toHaveTextContent('25');
    expect(screen.getByTestId('crm-stat-negotiationsAccepted')).toHaveTextContent('13');
    expect(screen.getByTestId('crm-stat-promises')).toHaveTextContent('7');
    expect(screen.getByTestId('crm-stat-paymentsConfirmed')).toHaveTextContent('9');
  });

  it('formata valor recuperado como moeda em pt-BR', () => {
    render(<CrmStatsPanel stats={STATS} isLoading={false} />);

    const recovered = screen.getByTestId('crm-stat-recoveredValue');
    expect(recovered).toHaveTextContent('R$');
    expect(recovered).toHaveTextContent('1.234,56');
    expect(recovered.textContent).not.toContain('1234.56');
  });

  it('exibe os labels dos indicadores', () => {
    render(<CrmStatsPanel stats={STATS} isLoading={false} />);

    expect(screen.getByText('Total de casos')).toBeInTheDocument();
    expect(screen.getByText('Em negociação')).toBeInTheDocument();
    expect(screen.getByText('Aguardando pagamento')).toBeInTheDocument();
    expect(screen.getByText('Negociações criadas')).toBeInTheDocument();
    expect(screen.getByText('Negociações aceitas')).toBeInTheDocument();
    expect(screen.getByText('Promessas')).toBeInTheDocument();
    expect(screen.getByText('Pagamentos confirmados')).toBeInTheDocument();
    expect(screen.getByText('Valor recuperado')).toBeInTheDocument();
  });
});
