/** Utilitários de geração de relatórios CSV/PDF (tarefa 14). */

/** Formata número para CSV pt-BR padrão Excel. */
export function csvNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '';
  const n = Number(value);
  return String(n.toFixed(2)).replace('.', ',');
}

/** Formata data ISO para `yyyy-mm-dd` (padrão Excel Brasil). */
export function csvDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/** Escapa um campo para CSV (aspas duplas + separador). */
export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",;\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Gera o corpo CSV com encoding UTF-8 **com BOM** (compatível com Excel Brasil,
 * que usa a BOM para detectar UTF-8 e exibir acentuação corretamente).
 */
export function buildCsv(rows: unknown[][]): Response {
  const BOM = '\uFEFF';
  const lines = rows.map((row) => row.map(csvEscape).join(';'));
  const body = BOM + lines.join('\r\n') + '\r\n';
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="relatorio.csv"',
    },
  });
}

/** Escapa valores de texto para PDF (PDFKit lança erro com certos caracteres). */
export function pdfSafe(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[^\x20-\x7EÀ-ÿ]/g, '').trim();
}

/** Nome seguro para Content-Disposition sem caracteres problemáticos. */
export function safeFileName(name: string): string {
  return name.replace(/[^a-z0-9._-]/gi, '');
}