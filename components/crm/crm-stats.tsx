'use client';

import type { CrmStats } from '@/lib/types';

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

interface CrmStatItem {
  key: keyof CrmStats;
  label: string;
  format?: 'currency';
}

const STAT_ITEMS: CrmStatItem[] = [
  { key: 'totalCases', label: 'Total de casos' },
  { key: 'negotiating', label: 'Em negociação' },
  { key: 'awaitingPayment', label: 'Aguardando pagamento' },
  { key: 'negotiationsCreated', label: 'Negociações criadas' },
  { key: 'negotiationsAccepted', label: 'Negociações aceitas' },
  { key: 'promises', label: 'Promessas' },
  { key: 'paymentsConfirmed', label: 'Pagamentos confirmados' },
  { key: 'recoveredValue', label: 'Valor recuperado', format: 'currency' },
];

export interface CrmStatsPanelProps {
  stats: CrmStats | null;
  isLoading: boolean;
}

export function CrmStatsPanel({ stats, isLoading }: CrmStatsPanelProps) {
  if (isLoading) {
    return (
      <div
        data-testid="crm-stats-skeleton"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8"
      >
        {STAT_ITEMS.map((item) => (
          <div
            key={item.key}
            className="h-[76px] animate-pulse rounded-xl border border-gray-200 bg-gray-100"
          />
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div
        data-testid="crm-stats-empty"
        className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500"
      >
        Nenhum indicador disponível.
      </div>
    );
  }

  return (
    <div data-testid="crm-stats" className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
      {STAT_ITEMS.map((item) => (
        <div
          key={item.key}
          data-testid={`crm-stat-${item.key}`}
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            {item.label}
          </p>
          <p className="mt-1 truncate text-lg font-bold text-gray-900" title={item.label}>
            {item.format === 'currency'
              ? currencyFormatter.format(stats[item.key])
              : stats[item.key]}
          </p>
        </div>
      ))}
    </div>
  );
}
