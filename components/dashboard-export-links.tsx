'use client';

import { FileDown, FileText } from 'lucide-react';
import { useActiveTenant } from '@/hooks/use-active-tenant';

/** Botão de exportação dos relatórios (dashboard). Usa o tenant ativo para montar as URLs. */
export function DashboardExportLinks() {
  const { tenantQuery, needsTenantSelection } = useActiveTenant();
  const base = tenantQuery ? `?${tenantQuery}` : '';
  return (
    <div className="flex items-center gap-2">
      <a
        href={`/api/reports/portfolio.csv${base}`}
        title="Exportar carteira por estágio (CSV)"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
      >
        <FileDown className="h-3.5 w-3.5 text-emerald-600" />
        Carteira CSV
      </a>
      <a
        href={`/api/reports/agreements.csv${base}`}
        title="Exportar acordos (CSV)"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
      >
        <FileDown className="h-3.5 w-3.5 text-emerald-600" />
        Acordos CSV
      </a>
      <a
        href={`/api/reports/recovery.pdf${base}`}
        title="Relatório de recuperação (PDF)"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
      >
        <FileText className="h-3.5 w-3.5 text-red-500" />
        Recuperação PDF
      </a>
    </div>
  );
}