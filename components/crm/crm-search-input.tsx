'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';

const DEBOUNCE_MS = 300;

export interface CrmSearchInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function CrmSearchInput({ value, onChange }: CrmSearchInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleChange = (nextValue: string) => {
    setInputValue(nextValue);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(nextValue), DEBOUNCE_MS);
  };

  return (
    <div className="relative w-full sm:max-w-xs">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
        aria-hidden="true"
      />
      <input
        type="search"
        aria-label="Buscar cliente, CPF/CNPJ ou nº do caso"
        placeholder="Buscar cliente, CPF/CNPJ ou nº do caso"
        data-testid="crm-search-input"
        value={inputValue}
        onChange={(event) => handleChange(event.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />
    </div>
  );
}
