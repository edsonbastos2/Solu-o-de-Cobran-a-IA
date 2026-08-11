import { NextRequest, NextResponse } from 'next/server';
import { requireRole, serverError, TenantContext } from '@/lib/api-auth';
import { parseRawRows, normalizeRows, detectMapping, ImportRow, IMPORT_FIELDS } from '@/lib/import-parser';
import { logger } from '@/lib/logger';
import { recordAuditAction } from '@/lib/audit';

export const runtime = 'nodejs';

const DEFAULT_MAX_LINES = 1000;

type ImportError = { line: number; reason: string };

type ImportResult = {
  imported: number;
  skipped: number;
  errors: ImportError[];
};

type DatabaseError = { code?: string; message?: string };

function getDatabaseError(error: unknown): DatabaseError {
  if (typeof error !== 'object' || error === null) return {};
  const candidate = error as Record<string, unknown>;
  return {
    code: typeof candidate.code === 'string' ? candidate.code : undefined,
    message: typeof candidate.message === 'string' ? candidate.message : undefined,
  };
}

function cleanDocument(raw: string): string {
  return raw.replace(/[^\d]/g, '');
}

function cleanPhone(raw?: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  return digits.length <= 11 ? digits : digits;
}

function validateRow(row: ImportRow): string | null {
  if (!row.documento) return 'documento ausente ou inválido';
  if (!row.nome) return 'nome ausente';
  if (!row.vencimento_primeira) return 'vencimento da primeira parcela ausente ou inválido';
  if (row.valor_total <= 0) return 'valor_total deve ser maior que zero';
  if (row.parcelas < 1) return 'parcelas deve ser maior ou igual a 1';
  if (row.parcelas > 120) return 'parcelas excede o limite de 120';
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    const tenantIdOverride = (form.get('tenant_id') as string) || null;
    const requestedMaxLines = parseInt((form.get('max_lines') as string) || '', 10);

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Arquivo obrigatório.' }, { status: 400 });
    }

    const tenantContext = await requireRole(req, 'admin', tenantIdOverride);
    if ('response' in tenantContext) return tenantContext.response;
    const ctx = tenantContext.ctx;
    const { supabase, tenantId, userId } = ctx;

    const fileName = (file as File).name || 'arquivo';
    const buffer = await (file as File).arrayBuffer();

    const rawRows = parseRawRows(buffer, fileName);
    if (rawRows.length === 0) {
      return NextResponse.json({ imported: 0, skipped: 0, errors: [] }, { status: 400 });
    }

    // Mapeamento pode vir do front (após preview) ou ser detectado no servidor.
    const mappingRaw = form.get('mapping');
    let mapping: Partial<Record<keyof ImportRow, string>> = {};
    if (mappingRaw && typeof mappingRaw === 'string') {
      try {
        mapping = JSON.parse(mappingRaw);
      } catch {
        mapping = {};
      }
    }
    if (Object.keys(mapping).length === 0) {
      const headers = Object.keys(rawRows[0] || {});
      mapping = detectMapping(headers) as unknown as Partial<Record<keyof ImportRow, string>>;
    }

    const rows = normalizeRows(rawRows, mapping as never);
    const maxLines = Number.isInteger(requestedMaxLines) && requestedMaxLines > 0
      ? requestedMaxLines
      : DEFAULT_MAX_LINES;

    if (rows.length > maxLines) {
      return NextResponse.json(
        { error: `Limite de ${maxLines} linhas por importação excedido (recebidas ${rows.length}).` },
        { status: 400 }
      );
    }

    // Resolve políticas por nome para o tenant (evita N+1 de consultas por linha).
    const policyNames = Array.from(
      new Set(rows.map((r) => r.politica_nome).filter((n): n is string => Boolean(n)))
    );
    const policiesByName = new Map<string, string>();
    if (policyNames.length > 0) {
      const { data: policies, error: policyError } = await supabase
        .from('collection_policies')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .in('name', policyNames);
      if (!policyError) {
        for (const p of policies || []) policiesByName.set(p.name, p.id);
      }
    }
    const defaultPolicy = policiesByName.get('Padrão') || [...policiesByName.values()][0];

    const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

    // Linha = cliente + contrato + títulos. Cada linha é transacional:
    // se algo falhar, remove o que foi criado e registra erro com a linha.
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const lineNumber = i + 2; // linha 1 é o cabeçalho

      const validation = validateRow(row);
      if (validation) {
        result.skipped += 1;
        result.errors.push({ line: lineNumber, reason: validation });
        continue;
      }

      const created: Array<{ table: 'clients' | 'contracts'; id: string }> = [];
      try {
        const document = cleanDocument(row.documento);

        // 1) Cliente (reusa por documento dentro do tenant)
        let clientId: string;
        const { data: existingClients, error: clientQueryError } = await supabase
          .from('clients')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('document', document)
          .limit(1);
        if (clientQueryError) throw clientQueryError;

        if (existingClients?.[0]?.id) {
          clientId = existingClients[0].id;
        } else {
          const { data: newClient, error: clientError } = await supabase
            .from('clients')
            .insert({
              tenant_id: tenantId,
              user_id: userId,
              name: row.nome,
              document,
              phone: cleanPhone(row.telefone) || null,
            })
            .select('id')
            .single();
          if (clientError) {
            const dbErr = getDatabaseError(clientError);
            if (dbErr.code === '23505' && dbErr.message?.includes('clients_document_key')) {
              // documento existe em outro tenant — não é possível reusar
              result.skipped += 1;
              result.errors.push({ line: lineNumber, reason: 'documento já cadastrado para outro cliente (não pertence ao tenant ativo)' });
              continue;
            }
            throw clientError;
          }
          clientId = newClient.id;
          created.push({ table: 'clients', id: clientId });
        }

        // 2) Contrato (valida duplicado por contract_number no tenant)
        const contractNumber = row.contrato_numero ? String(row.contrato_numero).trim() : null;
        if (contractNumber) {
          const { data: existingContracts, error: contractQueryError } = await supabase
            .from('contracts')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('contract_number', contractNumber)
            .limit(1);
          if (contractQueryError) throw contractQueryError;
          if (existingContracts?.[0]?.id) {
            result.skipped += 1;
            result.errors.push({ line: lineNumber, reason: `número de contrato "${contractNumber}" já cadastrado` });
            continue;
          }
        }

        const policyId = row.politica_nome ? policiesByName.get(row.politica_nome) || null : defaultPolicy || null;

        const { data: newContract, error: contractError } = await supabase
          .from('contracts')
          .insert({
            tenant_id: tenantId,
            user_id: userId,
            client_id: clientId,
            contract_number: contractNumber,
            type: 'importado',
            start_date: row.vencimento_primeira,
            collection_policy_id: policyId,
          })
          .select('id')
          .single();
        if (contractError) {
          const dbErr = getDatabaseError(contractError);
          if (dbErr.code === '23505' && dbErr.message?.includes('contracts_contract_number_key')) {
            result.skipped += 1;
            result.errors.push({ line: lineNumber, reason: `número de contrato "${contractNumber}" já cadastrado no sistema` });
            continue;
          }
          throw contractError;
        }
        const contractId = newContract.id;
        created.push({ table: 'contracts', id: contractId });

        // 3) Títulos financeiros (parcelas mensais a partir da primeira)
        const installmentValue = Math.round((row.valor_total / row.parcelas) * 100) / 100;
        const firstDue = new Date(`${row.vencimento_primeira}T12:00:00`);
        const titles: Array<Record<string, string | number | null>> = [];
        for (let n = 1; n <= row.parcelas; n += 1) {
          const due = new Date(firstDue);
          due.setMonth(due.getMonth() + (n - 1));
          titles.push({
            tenant_id: tenantId,
            contract_id: contractId,
            client_id: clientId,
            installment_number: n,
            original_value: installmentValue,
            current_value: installmentValue,
            due_date: due.toISOString().split('T')[0],
            status: 'pending',
          });
        }

        const { error: titlesError } = await supabase.from('financial_titles').insert(titles);
        if (titlesError) throw titlesError;

        result.imported += 1;
      } catch (error: unknown) {
        // Rollback parcial da linha
        for (const item of [...created].reverse()) {
          const { error: rollbackError } = await supabase
            .from(item.table)
            .delete()
            .eq('id', item.id)
            .eq('tenant_id', tenantId);
          if (rollbackError) logger.warn('[import/debtors] rollback failed', { line: lineNumber, table: item.table }, { error: rollbackError.message });
        }
        result.skipped += 1;
        const message = error instanceof Error ? error.message : 'erro desconhecido';
        result.errors.push({ line: lineNumber, reason: message.length > 200 ? message.slice(0, 200) : message });
        logger.warn('[import/debtors] linha reprovada', { tenantId, line: lineNumber }, { error: message });
      }
    }

    // Auditoria consolidada do batch (evita 1 entry por linha que lotaria audit_logs).
    // Registra resumo + contagem de erros para rastreabilidade do onboarding.
    await recordAuditAction(supabase, {
      tenantId,
      entityType: 'import_batch',
      entityId: fileName,
      actorUserId: userId,
      actorRole: tenantContext.ctx.role,
      action: 'DEBTORS_BULK_IMPORT',
      metadata: {
        source: 'manual',
        file: fileName,
        imported: result.imported,
        skipped: result.skipped,
        error_count: result.errors.length,
        error_sample: result.errors.slice(0, 5),
      },
    }).catch((e) => logger.error('[import/debtors] audit insert failed', { tenantId }, { error: e instanceof Error ? e.message : String(e) }));

    return NextResponse.json(result);
  } catch (error: unknown) {
    return serverError('import/debtors POST exception', error);
  }
}
