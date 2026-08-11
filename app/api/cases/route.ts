import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext, serverError } from '@/lib/api-auth';
import { calculateUpdatedValue } from '@/lib/finance';
import { CaseWithRelations, CreateCaseResult } from '@/lib/types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CASE_SELECT = `
  *,
  financial_titles (
    id, tenant_id, contract_id, client_id, installment_number,
    external_reference, description, original_value, current_value,
    due_date, status, paid_at, legacy_installment_id, metadata,
    created_at, updated_at,
    contracts (
      id, tenant_id, client_id, contract_number, type,
      clients (id, tenant_id, name, document, phone, email, address)
    )
  )
`;

function mapRpcError(code: string | null) {
  switch (code) {
    case 'AUTH_REQUIRED':
      return { status: 401, error: 'Sessão não autenticada para iniciar a cobrança.', code };
    case 'TITLE_NOT_OVERDUE':
      return { status: 400, error: 'O título ainda não está vencido. A cobrança pode ser iniciada após o vencimento.', code };
    case 'TITLE_NOT_COLLECTIBLE':
      return { status: 400, error: 'O título está pago, quitado ou cancelado e não pode gerar cobrança.', code };
    case 'ACTIVE_CASE_EXISTS':
      return { status: 409, error: 'Já existe um caso ativo para este título financeiro.', code };
    case 'TITLE_NOT_FOUND':
      return { status: 404, error: 'Título financeiro não encontrado ou indisponível para este tenant.', code };
    case 'TENANT_REQUIRED':
      return { status: 400, error: 'Tenant explícito é obrigatório para esta operação.', code };
    default:
      return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenant = await requireTenantContext(req, searchParams.get('tenant_id'));
  if ('response' in tenant) return tenant.response;

  try {
    const { ctx } = tenant;
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('limit') || '10', 10) || 10));
    const search = (searchParams.get('search') || '').slice(0, 100).trim();
    const status = (searchParams.get('status') || '').slice(0, 50).trim();
    const sort = (searchParams.get('sort') || 'recent').slice(0, 20).trim();
    const offset = (page - 1) * limit;

    let query = ctx.supabase
      .from('cases')
      .select(CASE_SELECT, { count: 'exact' })
      .eq('tenant_id', ctx.tenantId);

    if (search) {
      const term = `%${search}%`;
      query = query.or(`name.ilike.${term},phone.ilike.${term},debtor_document.ilike.${term},debtor_email.ilike.${term}`);
    }
    if (status && status !== 'all') query = query.eq('status', status);

    // Ordenação: 'score' prioriza casos com maior propensão de pagamento.
    if (sort === 'score') {
      query = query.order('propensity_score', { ascending: false, nullsFirst: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data, count, error } = await query
      .range(offset, offset + limit - 1);

    if (error) return serverError('cases GET error', error);

    const cases = (data || []).map((caseData: CaseWithRelations) => {
      const title = Array.isArray(caseData.financial_titles) ? caseData.financial_titles[0] : caseData.financial_titles;
      const contract = title?.contracts || null;
      const client = contract?.clients || null;
      const recalculated = calculateUpdatedValue(Number(caseData.original_value) || 0, new Date(caseData.due_date));
      return {
        ...caseData,
        financial_titles: undefined,
        financial_title: title || null,
        contract,
        client,
        legacy_context: caseData.legacy_context ?? !title,
        updated_value: recalculated > Number(caseData.original_value)
          ? recalculated
          : Number(caseData.updated_value || caseData.original_value),
      };
    });

    const total = count || 0;
    return NextResponse.json({ cases, totalPages: Math.ceil(total / limit) || 1, total, page });
  } catch (error) {
    return serverError('cases GET exception', error);
  }
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const body = await req.json().catch(() => null);
  const requestedTenantId = searchParams.get('tenant_id')
    || (typeof body?.tenant_id === 'string' ? body.tenant_id : null);
  const tenant = await requireTenantContext(req, requestedTenantId);
  if ('response' in tenant) return tenant.response;

  try {
    const { ctx } = tenant;
    const financialTitleId = body?.financial_title_id;

    if (typeof financialTitleId !== 'string' || !UUID_PATTERN.test(financialTitleId)) {
      return NextResponse.json({ error: 'financial_title_id é obrigatório e deve ser um UUID válido.', code: 'TITLE_NOT_FOUND' }, { status: 400 });
    }

    // Usa ctx.supabase para super-admin ter o admin fallback (service role)
    // consistente com as demais rotas tenant-aware. Antes isto usava
    // getSupabaseServer(req) — para super-admin isto resultava no client
    // RLS-scoped, quebrando a consistência do admin fallback.
    const { data, error } = await ctx.supabase.rpc('create_collection_case', {
      p_financial_title_id: financialTitleId,
      p_tenant_id: ctx.tenantId,
    });

    if (error) return serverError('cases POST RPC error', error);

    const result = (Array.isArray(data) ? data[0] : data) as CreateCaseResult | null;
    const mappedError = mapRpcError(result?.error_code || null);
    if (mappedError) {
      return NextResponse.json({ error: mappedError.error, code: mappedError.code }, { status: mappedError.status });
    }
    if (!result?.case) return serverError('cases POST RPC returned no case');

    return NextResponse.json({ ok: true, case: result.case }, { status: 201 });
  } catch (error) {
    return serverError('cases POST exception', error);
  }
}
