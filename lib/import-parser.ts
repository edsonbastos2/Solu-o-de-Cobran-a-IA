import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export type ImportField =
  | 'documento'
  | 'nome'
  | 'telefone'
  | 'contrato_numero'
  | 'valor_total'
  | 'parcelas'
  | 'vencimento_primeira'
  | 'politica_nome';

export interface ImportRow {
  documento: string;
  nome: string;
  telefone?: string;
  contrato_numero?: string;
  valor_total: number;
  parcelas: number;
  vencimento_primeira: string;
  politica_nome?: string;
}

export const IMPORT_FIELDS: ImportField[] = [
  'documento',
  'nome',
  'telefone',
  'contrato_numero',
  'valor_total',
  'parcelas',
  'vencimento_primeira',
  'politica_nome',
];

const FIELD_ALIASES: Record<ImportField, string[]> = {
  documento: ['documento', 'cpf', 'cnpj', 'doc', 'document', 'documento_do_cliente'],
  nome: ['nome', 'name', 'cliente', 'nome_cliente', 'devedor', 'debtor', 'razao_social'],
  telefone: ['telefone', 'phone', 'celular', 'whatsapp', 'fone', 'contato'],
  contrato_numero: ['contrato', 'contrato_numero', 'numero_contrato', 'contract_number', 'protocolo', 'contrato_n'],
  valor_total: ['valor', 'valor_total', 'total', 'value', 'montante', 'divida', 'valor_da_divida'],
  parcelas: ['parcelas', 'installments', 'prestacoes', 'qtd_parcelas', 'n_parcelas', 'numero_de_parcelas'],
  vencimento_primeira: [
    'vencimento',
    'vencimento_primeira',
    'primeiro_vencimento',
    'due_date',
    'data_vencimento',
    'vencimento_primeira_parcela',
  ],
  politica_nome: ['politica', 'politica_nome', 'policy', 'plano', 'campanha', 'estrategia'],
};

const FIELD_LABELS: Record<ImportField, string> = {
  documento: 'Documento (CPF/CNPJ)',
  nome: 'Nome',
  telefone: 'Telefone (opcional)',
  contrato_numero: 'Número do contrato',
  valor_total: 'Valor total',
  parcelas: 'Parcelas',
  vencimento_primeira: 'Vencimento da 1ª parcela',
  politica_nome: 'Política (opcional)',
};

/** Detecta a extensão do arquivo a partir do nome. */
export function detectFormat(fileName: string): 'csv' | 'xlsx' | null {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'csv' || ext === 'txt') return 'csv';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  return null;
}

/** Converte ArrayBuffer em uma lista de linhas cruas (objetos com header como chaves). */
export function parseRawRows(buffer: ArrayBuffer, fileName: string): Record<string, unknown>[] {
  const format = detectFormat(fileName);
  if (format === 'csv') {
    const text = new TextDecoder('utf-8').decode(buffer);
    const result = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: false,
    });
    return (result.data || []).filter((row) => row && Object.keys(row).some((k) => String(row[k]).trim() !== ''));
  }
  if (format === 'xlsx') {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true });
  }
  return [];
}

/** Extrai os cabeçalhos (chaves) da primeira linha. */
export function extractHeaders(rawRows: Record<string, unknown>[]): string[] {
  const seen: string[] = [];
  for (const row of rawRows) {
    for (const key of Object.keys(row)) {
      if (!seen.includes(key)) seen.push(String(key).trim());
    }
    break;
  }
  return seen;
}

/** Mapeia cada campo esperado para a coluna correspondente no arquivo. */
export function detectMapping(headers: string[]): Partial<Record<ImportField, string>> {
  const mapping: Partial<Record<ImportField, string>> = {};
  const normalized = headers.map((h) => h.toLowerCase().replace(/[\s_-]+/g, '_').replace(/[^a-z0-9_ãâáàêéíóôõúüç]/gi, ''));
  for (const field of IMPORT_FIELDS) {
    const aliases = FIELD_ALIASES[field].map((a) => a.toLowerCase().replace(/[\s_-]+/g, '_'));
    for (let i = 0; i < headers.length; i += 1) {
      const normalizedHeader = normalized[i];
      const exact = aliases.some((alias) => alias === normalizedHeader);
      const contains = aliases.some((alias) => normalizedHeader.includes(alias) || alias.includes(normalizedHeader));
      if (exact || contains) {
        mapping[field] = headers[i];
        break;
      }
    }
  }
  return mapping;
}

/** Converte um valor cru em número suportando formato pt-BR ("1.234,56") e en-US. */
export function parseNumberRaw(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).trim().replace(/[R$\s]/g, '');
  if (!s) return null;
  s = s.replace(/[^\d.,-]/g, '');
  if (!s) return null;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    s = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Converte um valor cru em data ISO (yyyy-mm-dd), aceitando dd/mm/aaaa e datas do XLSX. */
export function parseDateRaw(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    const jsDate = XLSX.SSF.parse_date_code(v);
    if (jsDate) {
      return `${jsDate.y}-${String(jsDate.m).padStart(2, '0')}-${String(jsDate.d).padStart(2, '0')}`;
    }
    return null;
  }
  const s = String(v).trim();
  const br = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (br) {
    return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return null;
}

/** Aplica o mapeamento e normaliza as linhas para o modelo esperado. */
export function normalizeRows(
  rawRows: Record<string, unknown>[],
  mapping: Partial<Record<ImportField, string>>
): ImportRow[] {
  const get = (row: Record<string, unknown>, field: ImportField): unknown => {
    const col = mapping[field];
    if (!col) return undefined;
    return row[col];
  };

  const rows: ImportRow[] = [];
  for (const raw of rawRows) {
    const documento = String(get(raw, 'documento') ?? '').trim().replace(/[^\d]/g, '');
    const nome = String(get(raw, 'nome') ?? '').trim();
    const telefone = String(get(raw, 'telefone') ?? '').trim().replace(/[^\d+]/g, '') || undefined;
    const contratoNumero = String(get(raw, 'contrato_numero') ?? '').trim() || undefined;
    const valorTotal = parseNumberRaw(get(raw, 'valor_total'));
    const parcelas = parseNumberRaw(get(raw, 'parcelas'));
    const vencimentoPrimeira = parseDateRaw(get(raw, 'vencimento_primeira'));
    const politicaNome = String(get(raw, 'politica_nome') ?? '').trim() || undefined;

    if (!documento && !nome) continue;

    rows.push({
      documento,
      nome,
      telefone,
      contrato_numero: contratoNumero,
      valor_total: valorTotal ?? 0,
      parcelas: Math.round(parcelas ?? 1),
      vencimento_primeira: vencimentoPrimeira ?? '',
      politica_nome: politicaNome,
    });
  }
  return rows;
}

export { FIELD_LABELS };