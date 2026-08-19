import { NextRequest, NextResponse } from 'next/server';
import { requireRole, serverError } from '@/lib/api-auth';
import { recordAuditAction } from '@/lib/audit';
import { resolveCaseClientId } from '@/lib/channels/message-service';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LEGAL_STATUSES = ['open', 'in_progress', 'judgment_won', 'judgment_lost', 'closed'] as const;
const LEGAL_TYPES = ['execucao', 'monitoria', 'cobranca', 'collection'] as const;

type LegalProcessRow = {
  id: string;
  status: (typeof LEGAL_STATUSES)[number];
  process_type: string;
  process_number: string | null;
  court: string | null;
  lawyer_name: string | null;
  lawyer_contact: string | null;
  filing_date: string | null;
  case_id: string | null;
  contract_id: string | null;
  financial_title_id: string | null;
  client_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type TenantRow = { id: string };

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantContext = await requireRole(req, 'operador', searchParams.get('tenant_id'));
    if ('response' in tenantContext) return tenantContext.response;
    const { supabase, tenantId } = tenantContext.ctx;

    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('limit') || '10', 10) || 10));
    const status = (searchParams.get('status') || '').slice(0, 50).trim();
    const lawyer = (searchParams.get('lawyer') || '').slice(0, 120).trim();
    const court = (searchParams.get('court') || '').slice(0, 120).trim();
    const caseId = (searchParams.get('case_id') || '').slice(0, 64).trim();
    const offset = (page - 1) * limit;

    if (status && status !== 'all' && !LEGAL_STATUSES.includes(status as (typeof LEGAL_STATUSES)[number])) {
      return NextResponse.json({ error: 'Status jurídico inválido.' }, { status: 400 });
    }

    let query = supabase
      .from('legal_processes')
      .select(`
        id, status, process_type, process_number, court, filing_date,
        lawyer_name, lawyer_contact, case_id, contract_id, financial_title_id, client_id,
        created_at, updated_at,
        clients ( id, name, document, phone ),
        cases ( id, name ),
        contracts ( id, contract_number ),
        financial_titles ( id, installment_number, due_date, current_value, original_value )
      `, { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (status && status !== 'all') query = query.eq('status', status);
    if (lawyer) query = query.ilike('lawyer_name', `%${lawyer}%`);
    if (court) query = query.ilike('court', `%${court}%`);
    if (caseId) query = query.eq('case_id', caseId);
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;

    return NextResponse.json({
      legal_processes: data || [],
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit) || 1,
      page,
    });
  } catch (error: unknown) {
    logger.error('[legal-processes GET] exception', undefined, { error: error instanceof Error ? error.message : String(error) });
    return serverError('legal-processes GET exception', error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => null);
    const requestedTenantId = searchParams.get('tenant_id')
      || (typeof body?.tenant_id === 'string' ? body.tenant_id : null);

    const tenantContext = await requireRole(req, 'gestor', requestedTenantId);
    if ('response' in tenantContext) return tenantContext.response;
    const { supabase, tenantId, userId } = tenantContext.ctx;

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 });
    }

    const caseId = typeof body.case_id === 'string' && body.case_id.trim() ? body.case_id.trim() : null;
    if (!caseId) {
      return NextResponse.json({ error: 'case_id é obrigatório.' }, { status: 400 });
    }

    const { data: linkedCase, error: caseError } = await supabase
      .from('cases')
      .select('id, tenant_id, financial_title_id, debtor_id, contract_id, name')
      .eq('id', caseId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (caseError) throw caseError;
    if (!linkedCase) {
      return NextResponse.json({ error: 'Caso não encontrado ou não pertence ao tenant.' }, { status: 404 });
    }

    // cases não possui coluna client_id: resolve por debtor_id ou título.
    const clientId = await resolveCaseClientId(supabase, tenantId, linkedCase);

    // Evita duplicar processo para o mesmo caso (apenas um aberto).
    const { data: existingOpen } = await supabase
      .from('legal_processes')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('case_id', caseId)
      .in('status', ['open', 'in_progress'])
      .maybeSingle();
    if (existingOpen) {
      return NextResponse.json({ error: 'Já existe um processo jurídico aberto para este caso.' }, { status: 409 });
    }

    const process_type = typeof body.process_type === 'string' && LEGAL_TYPES.includes(body.process_type as (typeof LEGAL_TYPES)[number])
      ? body.process_type
      : 'cobranca';
    const process_number = typeof body.process_number === 'string' ? body.process_number.trim().slice(0, 60) : null;
    const court = typeof body.court === 'string' ? body.court.trim().slice(0, 120) : null;
    const lawyer_name = typeof body.lawyer_name === 'string' ? body.lawyer_name.trim().slice(0, 120) : null;
    const lawyer_contact = typeof body.lawyer_contact === 'string' ? body.lawyer_contact.trim().slice(0, 160) : null;
    const status = typeof body.status === 'string' && LEGAL_STATUSES.includes(body.status as (typeof LEGAL_STATUSES)[number])
      ? body.status
      : 'open';

    let filing_date: string | null = null;
    if (body.filing_date !== undefined && body.filing_date !== null && body.filing_date !== '') {
      const parsed = new Date(String(body.filing_date));
      if (isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'filing_date deve ser uma data válida.' }, { status: 400 });
      }
      filing_date = parsed.toISOString().slice(0, 10);
    }

    const { data: created, error: insertError } = await supabase
      .from('legal_processes')
      .insert({
        tenant_id: tenantId,
        case_id: caseId,
        client_id: clientId,
        contract_id: linkedCase.contract_id,
        financial_title_id: linkedCase.financial_title_id,
        process_type,
        process_number,
        court,
        filing_date,
        lawyer_name,
        lawyer_contact,
        status,
        created_by: userId,
      })
      .select('*')
      .single();
    if (insertError) throw insertError;

    await recordAuditAction(supabase, {
      tenantId,
      entityType: 'legal_process',
      entityId: created.id,
      caseId,
      actorUserId: userId,
      action: 'LEGAL_PROCESS_CREATED',
      after: created,
      metadata: { source: 'manual' },
    });

    return NextResponse.json({ ok: true, legal_process: created }, { status: 201 });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err?.code === '23505') {
      return NextResponse.json({ error: 'Já existe um processo jurídico para este caso.' }, { status: 409 });
    }
    logger.error('[legal-processes POST] exception', undefined, { error: error instanceof Error ? error.message : String(error) });
    return serverError('legal-processes POST exception', error);
  }
}