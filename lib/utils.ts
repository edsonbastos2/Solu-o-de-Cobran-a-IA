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

/** Máscara progressiva de CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00), conforme a quantidade de dígitos digitados. */
export const formatDocumentInput = (value: string) => {
  let v = value.replace(/\D/g, '');
  if (v.length > 14) v = v.substring(0, 14);

  if (v.length <= 11) {
    if (v.length <= 3) return v;
    if (v.length <= 6) return `${v.substring(0, 3)}.${v.substring(3)}`;
    if (v.length <= 9) return `${v.substring(0, 3)}.${v.substring(3, 6)}.${v.substring(6)}`;
    return `${v.substring(0, 3)}.${v.substring(3, 6)}.${v.substring(6, 9)}-${v.substring(9)}`;
  }
  if (v.length <= 5) return `${v.substring(0, 2)}.${v.substring(2)}`;
  if (v.length <= 8) return `${v.substring(0, 2)}.${v.substring(2, 5)}.${v.substring(5)}`;
  if (v.length <= 12) return `${v.substring(0, 2)}.${v.substring(2, 5)}.${v.substring(5, 8)}/${v.substring(8)}`;
  return `${v.substring(0, 2)}.${v.substring(2, 5)}.${v.substring(5, 8)}/${v.substring(8, 12)}-${v.substring(12)}`;
};
