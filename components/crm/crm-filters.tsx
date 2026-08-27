'use client';

import { EMPTY_CRM_FILTERS } from '@/hooks/use-crm-board';
import type { CrmBoardFilters } from '@/hooks/use-crm-board';
import { CrmSearchInput } from './crm-search-input';
import { CrmOperatorFilter } from './crm-operator-filter';
import type { CrmOperatorOption } from './crm-operator-filter';
import { CrmPriorityFilter } from './crm-priority-filter';

export interface CrmFiltersProps {
  filters: CrmBoardFilters;
  onChange: (filters: CrmBoardFilters) => void;
  operators: CrmOperatorOption[];
  canFilterByOperator: boolean;
}

export function CrmFilters({ filters, onChange, operators, canFilterByOperator }: CrmFiltersProps) {
  return (
    <div
      data-testid="crm-filters"
      className="flex flex-col gap-2 border-b border-gray-100 bg-white px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3"
    >
      <CrmSearchInput
        value={filters.search}
        onChange={(search) => onChange({ ...filters, search })}
      />
      <div className="flex flex-wrap items-center gap-2">
        <CrmPriorityFilter
          value={filters.priority}
          onChange={(priority) => onChange({ ...filters, priority })}
        />
        <CrmOperatorFilter
          operators={operators}
          value={filters.operator}
          onChange={(operator) => onChange({ ...filters, operator })}
          canFilterByOperator={canFilterByOperator}
        />
        <button
          type="button"
          data-testid="crm-filters-clear"
          onClick={() => onChange({ ...EMPTY_CRM_FILTERS })}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50"
        >
          Limpar
        </button>
      </div>
    </div>
  );
}
