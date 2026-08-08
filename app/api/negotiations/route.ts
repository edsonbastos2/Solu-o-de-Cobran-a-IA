import { NextRequest, NextResponse } from 'next/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { requireTenantContext, serverError } from '@/lib/api-auth';
import { recordAuditAction } from '@/lib/audit';
import { NegotiationStatus, NegotiationWithRelations } from '@/lib/types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NEGOTIATION_STATUSES: NegotiationStatus[] = ['open', 'accepted', 'expired', 'fulfilled', 'defaulted'];

const NEGOTIATION_SELECT = `
  *,
  clients (id, name, document),
  cases (id, name, status)
`;

type NegotiationLinks = {
  client_id: string | null;
  contract_id: string | null;
  financial_title_id: string | null;
  case_id: string | null;
};

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/** Valida se todos os vínculos opcionais pertencem ao tenant. Retorna null se ok. */
async function validateTenantLinks(
  supabase: SupabaseClient,
  tenantId: string,
  links: NegotiationLinks
): Promise<NextResponse | null> {
  const tableByLink: { key: keyof NegotiationLinks; table: string }[] = [
    { key: 'client_id', table: 'clients' },
    { key: 'contract_id', table: 'contracts' },
    { key: 'financial_title_id', table: 'financial_titles' },
    { key: 'case_id', table: 'cases' },
  ];

  for (const { key, table } of tableByLink) {
    const value = links[key];
    if (!value) continue;
    const { data } = await supabase
      .from(table)
      .select('id')
      .eq('id', value)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!data) {
      return NextResponse.json({ error: `${key} não pertence ao tenant.` }, { status: 400 });
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenant = await requireTenantContext(req, searchParams.get('tenant_id'));
  if ('response' in tenant) return tenant.response;

  try {
    const { ctx } = tenant;
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('limit') || '10', 10) || 10));
    const status = (searchParams.get('status') || '').slice(0, 50).trim();
    const caseId = (searchParams.get('case_id') || '').slice(0, 50).trim();
    const clientId = (searchParams.get('client_id') || '').slice(0, 50).trim();
    const offset = (page - 1) * limit;

    if (status && status !== 'all' && !NEGOTIATION_STATUSES.includes(status as NegotiationStatus)) {
      return NextResponse.json({ error: 'Status de acordo inválido.' }, { status: 400 });
    }

    let query = ctx.supabase
      .from('negotiations')
      .select(NEGOTIATION_SELECT, { count: 'exact' })
      .eq('tenant_id', ctx.tenantId);

    if (status && status !== 'all') query = query.eq('status', status);
    if (caseId) query = query.eq('case_id', caseId);
    if (clientId) query = query.eq('client_id', clientId);

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return serverError('negotiations GET error', error);

    const total = count || 0;
    return NextResponse.json({
      negotiations: (data || []) as NegotiationWithRelations[],
      totalPages: Math.ceil(total / limit) || 1,
      total,
      page,
    });
  } catch (error) {
    return serverError('negotiations GET exception', error);
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
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 });
    }

    const links: NegotiationLinks = {
      client_id: typeof body.client_id === 'string' ? body.client_id : null,
      contract_id: typeof body.contract_id === 'string' ? body.contract_id : null,
      financial_title_id: typeof body.financial_title_id === 'string' ? body.financial_title_id : null,
      case_id: typeof body.case_id === 'string' ? body.case_id : null,
    };

    for (const [key, value] of Object.entries(links) as [keyof NegotiationLinks, string | null][]) {
      if (value !== null && !isUuid(value)) {
        return NextResponse.json({ error: `${key} deve ser um UUID válido ou nulo.` }, { status: 400 });
      }
    }

    const validationError = await validateTenantLinks(ctx.supabase, ctx.tenantId, links);
    if (validationError) return validationError;

    const originalValue = body.original_value;
    const proposedValue = body.proposed_value;
    const agreedValue = body.agreed_value;
    const discountPercent = body.discount_percent;
    const installmentCount = body.installment_count;

    const hasValue = [originalValue, proposedValue, agreedValue].some(
      (v) => typeof v === 'number' && v > 0
    );
    if (!hasValue) {
      return NextResponse.json({ error: 'Informe ao menos um valor (original_value, proposed_value ou agreed_value).' }, { status: 400 });
    }

    const numericFields: { value: unknown; name: string }[] = [
      { value: originalValue, name: 'original_value' },
      { value: proposedValue, name: 'proposed_value' },
      { value: agreedValue, name: 'agreed_value' },
      { value: discountPercent, name: 'discount_percent' },
      { value: installmentCount, name: 'installment_count' },
    ];
    for (const { value, name } of numericFields) {
      if (value !== undefined && value !== null && (typeof value !== 'number' || isNaN(value) || value < 0)) {
        return NextResponse.json({ error: `Campo inválido: ${name} deve ser um número não negativo.` }, { status: 400 });
      }
    }
    if (installmentCount !== undefined && installmentCount !== null && !Number.isInteger(installmentCount)) {
      return NextResponse.json({ error: 'Campo inválido: installment_count deve ser um inteiro.' }, { status: 400 });
    }
    if (discountPercent !== undefined && discountPercent !== null && discountPercent > 100) {
      return NextResponse.json({ error: 'Campo inválido: discount_percent não pode ultrapassar 100%.' }, { status: 400 });
    }

    let expiresAt: string | null = null;
    if (body.expires_at !== undefined && body.expires_at !== null) {
      const parsed = new Date(String(body.expires_at));
      if (isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'Campo inválido: expires_at deve ser uma data válida.' }, { status: 400 });
      }
      expiresAt = parsed.toISOString();
    }

    const insert: Record<string, unknown> = {
      tenant_id: ctx.tenantId,
      status: 'open',
      created_by: ctx.userId,
      metadata: body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
        ? body.metadata
        : {},
    };

    if (links.client_id) insert.client_id = links.client_id;
    if (links.contract_id) insert.contract_id = links.contract_id;
    if (links.financial_title_id) insert.financial_title_id = links.financial_title_id;
    if (links.case_id) insert.case_id = links.case_id;
    if (originalValue !== undefined && originalValue !== null) insert.original_value = originalValue;
    if (proposedValue !== undefined && proposedValue !== null) insert.proposed_value = proposedValue;
    if (agreedValue !== undefined && agreedValue !== null) insert.agreed_value = agreedValue;
    if (discountPercent !== undefined && discountPercent !== null) insert.discount_percent = discountPercent;
    if (installmentCount !== undefined && installmentCount !== null) insert.installment_count = installmentCount;
    if (expiresAt) insert.expires_at = expiresAt;

    const { data: negotiation, error } = await ctx.supabase
      .from('negotiations')
      .insert(insert)
      .select(NEGOTIATION_SELECT)
      .single();

    if (error) return serverError('negociations POST insert error', error);

    await recordAuditAction(ctx.supabase, {
      tenantId: ctx.tenantId,
      entityType: 'negotiation',
      entityId: negotiation.id,
      caseId: links.case_id || undefined,
      actorUserId: ctx.userId,
      action: 'NEGOTIATION_CREATED',
      after: negotiation,
      metadata: { source: 'manual' },
    });

    return NextResponse.json({ ok: true, negotiation }, { status: 201 });
  } catch (error) {
    return serverError('negotiations POST exception', error);
  }
}