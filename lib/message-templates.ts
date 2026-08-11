import { SupabaseClient } from '@supabase/supabase-js';
import { getDaysOverdue } from '@/lib/finance';

export interface MessageTemplate {
  id: string;
  tenant_id?: string;
  name: string;
  channel: string;
  stage: string;
  language: string;
  body: string;
  variables: string[];
  is_active: boolean;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TemplatePreviewContext {
  supabase: SupabaseClient;
  tenantId: string;
  caseId: string;
  companyName?: string;
}

const VARIABLE_PATTERN = /\{(\w+)\}/g;

/**
 * Busca um caso real do tenant e resolve as variáveis do template a partir do
 * dado canônico (título financeiro + contrato + cliente). Substituição é feita
 * sempre server-side.
 */
export async function resolveTemplateVariables(
  ctx: TemplatePreviewContext,
  body: string
): Promise<{ body: string; used: string[] }> {
  const { supabase, tenantId, caseId, companyName } = ctx;

  const { data: caseRow, error } = await supabase
    .from('cases')
    .select(`
      id, name, phone, due_date, original_value, updated_value,
      financial_titles (id, due_date, current_value, original_value, installment_number, status)
    `)
    .eq('id', caseId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error || !caseRow) {
    throw new Error('Caso não encontrado ou não pertence ao tenant.');
  }

  const title = Array.isArray(caseRow.financial_titles) ? caseRow.financial_titles[0] : caseRow.financial_titles;
  const dueDate = title?.due_date || caseRow.due_date;
  const value = title?.current_value ?? title?.original_value ?? caseRow.updated_value ?? caseRow.original_value ?? 0;
  const daysOverdue = getDaysOverdue(dueDate);

  const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

  const replacements: Record<string, string> = {
    nome: caseRow.name || 'cliente',
    valor: currency,
    vencimento: dueDate ? new Date(dueDate).toLocaleDateString('pt-BR') : '',
    dias_atraso: String(Math.max(0, daysOverdue)),
    empresa: companyName || 'CobrançaIA',
    dias_para_negativacao: '15',
  };

  const used = new Set<string>();
  const resolved = body.replace(VARIABLE_PATTERN, (match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(replacements, key)) {
      used.add(key);
      return replacements[key] as string;
    }
    return match;
  });

  return { body: resolved, used: Array.from(used) };
}