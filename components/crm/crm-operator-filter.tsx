'use client';

export interface CrmOperatorOption {
  id: string;
  name: string;
}

export interface CrmOperatorFilterProps {
  operators: CrmOperatorOption[];
  value: string;
  onChange: (value: string) => void;
  canFilterByOperator: boolean;
}

export function CrmOperatorFilter({
  operators,
  value,
  onChange,
  canFilterByOperator,
}: CrmOperatorFilterProps) {
  if (!canFilterByOperator) return null;

  return (
    <div>
      <label htmlFor="crm-operator-filter" className="sr-only">
        Filtrar por operador
      </label>
      <select
        id="crm-operator-filter"
        data-testid="crm-operator-filter"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      >
        <option value="all">Todos os operadores</option>
        <option value="unassigned">Sem responsável</option>
        {operators.map((operator) => (
          <option key={operator.id} value={operator.id}>
            {operator.name}
          </option>
        ))}
      </select>
    </div>
  );
}
