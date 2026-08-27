'use client';

import { CRM_PRIORITIES } from '@/lib/crm/stages';
import type { CrmPriority } from '@/lib/crm/stages';

const PRIORITY_LABELS: Record<CrmPriority, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

export type CrmPriorityFilterValue = 'all' | CrmPriority;

export interface CrmPriorityFilterProps {
  value: CrmPriorityFilterValue;
  onChange: (value: CrmPriorityFilterValue) => void;
}

export function CrmPriorityFilter({ value, onChange }: CrmPriorityFilterProps) {
  return (
    <div>
      <label htmlFor="crm-priority-filter" className="sr-only">
        Filtrar por prioridade
      </label>
      <select
        id="crm-priority-filter"
        data-testid="crm-priority-filter"
        value={value}
        onChange={(event) => onChange(event.target.value as CrmPriorityFilterValue)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      >
        <option value="all">Todas as prioridades</option>
        {CRM_PRIORITIES.map((priority) => (
          <option key={priority} value={priority}>
            {PRIORITY_LABELS[priority]}
          </option>
        ))}
      </select>
    </div>
  );
}
