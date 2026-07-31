import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatPhoneInput = (value: string) => {
  let v = value.replace(/\D/g, '');
  if (v.length > 11) v = v.substring(0, 11);
  
  if (v.length === 0) return '';
  if (v.length <= 2) return `(${v}`;
  if (v.length <= 6) return `(${v.substring(0, 2)}) ${v.substring(2)}`;
  if (v.length <= 10) return `(${v.substring(0, 2)}) ${v.substring(2, 6)}-${v.substring(6)}`;
  return `(${v.substring(0, 2)}) ${v.substring(2, 7)}-${v.substring(7)}`;
};

export const formatCurrencyInput = (value: string) => {
  let v = value.replace(/\D/g, '');
  if (v === '') return '';
  
  const num = parseInt(v, 10) / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
};

export const parseCurrency = (value: string) => {
  if (!value) return 0;
  const numeric = value.replace(/\D/g, '');
  return parseInt(numeric, 10) / 100;
};

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};
