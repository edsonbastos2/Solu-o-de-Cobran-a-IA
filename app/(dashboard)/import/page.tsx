'use client';

import { useMemo, useState } from 'react';
import { useActiveTenant } from '@/hooks/use-active-tenant';
import { useAuth } from '@/hooks/useAuth';
import { fetchWithAuth } from '@/lib/api';
import { IMPORT_FIELDS, FIELD_LABELS, detectFormat, parseRawRows, detectMapping } from '@/lib/import-parser';
import { UploadCloud, FileSpreadsheet, ArrowRight, CheckCircle2, AlertCircle, FileWarning, RotateCcw } from 'lucide-react';

type PreviewRow = Record<string, string>;

type ImportResponse = {
  imported: number;
  skipped: number;
  errors: { line: number; reason: string }[];
};

export default function ImportPage() {
  const { user, loading: authLoading } = useAuth();
  const { tenantQuery, needsTenantSelection, isAdmin } = useActiveTenant();

  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [importing, setImporting] = useState(false);

  const canImport = !authLoading && Boolean(user) && !needsTenantSelection && isAdmin;

  const handleFile = async (selected: File | null) => {
    if (!selected) return;
    setFile(selected);
    setResult(null);
    setError('');
    setNotice('');

    const format = detectFormat(selected.name);
    if (!format) {
      setError('Formato não suportado. Envie um arquivo .csv ou .xlsx.');
      return;
    }

    try {
      const buffer = await selected.arrayBuffer();
      const rows = parseRawRows(buffer, selected.name);
      if (rows.length === 0) {
        setError('Nenhuma linha encontrada no arquivo. Verifique se há um cabeçalho com dados.');
        return;
      }
      const detectedHeaders = Object.keys(rows[0]);
      setHeaders(detectedHeaders);
      setPreview(
        rows.slice(0, 5).map((row) => {
          const previewRow: PreviewRow = {};
          for (const key of detectedHeaders) {
            const v = row[key];
            previewRow[key] = v === null || v === undefined ? '' : String(v);
          }
          return previewRow;
        })
      );
      setMapping(detectMapping(detectedHeaders));
    } catch (e) {
      setError('Não foi possível ler o arquivo. Confira o formato das colunas.');
    }
  };

  const setMappingField = (field: string, value: string) => {
    setMapping((prev) => ({ ...prev, [field]: value }));
  };

  const handleImport = async () => {
    if (!file) return;
    setError('');
    setNotice('');
    setImporting(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('mapping', JSON.stringify(mapping));
      if (tenantQuery) {
        const tenantId = new URLSearchParams(tenantQuery).get('tenant_id');
        if (tenantId) form.append('tenant_id', tenantId);
      }

      const res = await fetchWithAuth('/api/import/debtors', { method: 'POST', body: form });
      const json = (await res.json().catch(() => ({}))) as ImportResponse & { error?: string };
      if (!res.ok) {
        setError(json.error || 'Não foi possível importar o arquivo.');
        return;
      }
      setResult(json);
      setNotice(`Importação concluída: ${json.imported} importado(s), ${json.skipped} ignorado(s).`);
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setHeaders([]);
    setPreview([]);
    setMapping({});
    setResult(null);
    setError('');
    setNotice('');
  };

  const mappingComplete = useMemo(() => {
    const required = ['documento', 'nome', 'valor_total', 'vencimento_primeira'];
    return required.every((field) => mapping[field]);
  }, [mapping]);

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Importação em massa</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Importe clientes, contratos e títulos financeiros a partir de um arquivo CSV ou XLSX. Cada linha é processada de forma independente e os erros são reportados individualmente.
          </p>
        </div>

        {!isAdmin && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
            <AlertCircle className="h-4 w-4" />
            Apenas administradores do tenant podem importar dados.
          </div>
        )}

        {notice && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            {notice}
          </div>
        )}
        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {!file && (
          <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 bg-white p-10 text-center transition-colors hover:border-slate-400 hover:bg-slate-50">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="sr-only"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
              disabled={!canImport}
            />
            <UploadCloud className="mx-auto mb-3 h-10 w-10 text-slate-400" />
            <p className="text-sm font-semibold text-slate-700">Clique para escolher um arquivo</p>
            <p className="mt-1 text-xs text-slate-500">Suporta .csv e .xlsx (até 1000 linhas por importação)</p>
          </label>
        )}

        {file && (
          <div className="space-y-6">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB · {preview.length} de {preview.length} linhas de preview</p>
                </div>
              </div>
              <button onClick={reset} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700">
                <RotateCcw className="h-3.5 w-3.5" />
                Trocar arquivo
              </button>
            </div>

            {/* Mapeamento de colunas */}
            {headers.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-1 text-sm font-bold text-slate-900">Mapeamento de colunas</h2>
                <p className="mb-4 text-xs text-slate-500">Associe as colunas do arquivo aos campos do sistema.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {IMPORT_FIELDS.map((field) => (
                    <div key={field} className="flex flex-col gap-1">
                      <span className={`text-xs font-semibold ${FIELD_LABELS[field].includes('(opcional)') ? 'text-slate-400' : 'text-slate-700'}`}>
                        {FIELD_LABELS[field]}
                      </span>
                      <select
                        value={mapping[field] || ''}
                        onChange={(e) => setMappingField(field, e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900"
                      >
                        <option value="">— não mapear —</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview */}
            {preview.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 bg-slate-50/60 px-5 py-3">
                  <h2 className="text-sm font-bold text-slate-900">Prévia das primeiras {preview.length} linhas</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="border-b border-slate-200 bg-slate-100/70 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                      <tr>
                        {headers.map((h) => (
                          <th key={h} className="px-4 py-2.5 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {preview.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50/70">
                          {headers.map((h) => (
                            <td key={h} className="max-w-[200px] truncate px-4 py-2">{row[h] ?? ''}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleImport}
                disabled={!mappingComplete || importing}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {importing ? 'Importando...' : 'Importar'}
                {!importing && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Resultado */}
        {result && (
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
              <p className="text-2xl font-bold text-emerald-700">{result.imported}</p>
              <p className="mt-1 text-xs font-semibold text-emerald-600">Importados</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
              <p className="text-2xl font-bold text-amber-700">{result.skipped}</p>
              <p className="mt-1 text-xs font-semibold text-amber-600">Ignorados</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
              <p className="text-2xl font-bold text-slate-700">{result.errors.length}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Linhas com erro</p>
            </div>
          </div>
        )}

        {result && result.errors.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/60 px-5 py-3">
              <FileWarning className="h-4 w-4 text-red-500" />
              <h2 className="text-sm font-bold text-slate-900">Relatório de erros</h2>
            </div>
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-100/70 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                  <tr>
                    <th className="px-5 py-2.5 w-20">Linha</th>
                    <th className="px-5 py-2.5">Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {result.errors.map((e, i) => (
                    <tr key={i} className="hover:bg-slate-50/70">
                      <td className="px-5 py-2.5 font-mono">{e.line}</td>
                      <td className="px-5 py-2.5 text-red-600">{e.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}