import { NextRequest, NextResponse } from 'next/server';
import { requireRole, serverError } from '@/lib/api-auth';
import { recordAuditAction } from '@/lib/audit';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NEGATIVATION_STATUSES = [
  'pending_notification',
  'notified',
  'requested',
  'completed',
  'removed',
] as const;

type NegativationRow = {
  id: string;
  status: (typeof NEGATIVATION_STATUSES)[number];
  provider: string | null;
  external_reference: string | null;
  financial_title_id: string | null;
  client_id: string | null;
  requested_at: string | null;
  completed_at: string | null;
  removed_at: string | null;
  notified_at: string | null;
  created_at: string | null;
};

type TenantRow = { id: string };

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantContext = await requireRole(req, 'member', searchParams.get('tenant_id'));
    if ('response' in tenantContext) return tenantContext.response;
    const { supabase, tenantId } = tenantContext.ctx;

    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('limit') || '10', 10) || 10));
    const status = (searchParams.get('status') || '').slice(0, 50).trim();
    const titleId = (searchParams.get('financial_title_id') || '').slice(0, 64).trim();
    const offset = (page - 1) * limit;

    if (status && status !== 'all' && !NEGATIVATION_STATUSES.includes(status as (typeof NEGATIVATION_STATUSES)[number])) {
      return NextResponse.json({ error: 'Status de negativação inválido.' }, { status: 400 });
    }

    const query = supabase
      .from('negativations')
      .select(`
        id, status, provider, external_reference, financial_title_id, client_id,
        requested_at, completed_at, removed_at, notified_at, created_at,
        clients ( id, name, document, phone ),
        financial_titles ( id, installment_number, due_date, current_value, original_value )
      `, { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (status && status !== 'all') query.eq('status', status);
    if (titleId) query.eq('financial_title_id', titleId);
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;

    return NextResponse.json({
      negativations: data || [],
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit) || 1,
      page,
    });
  } catch (error: unknown) {
    logger.error('[negativations GET] exception', undefined, { error: error instanceof Error ? error.message : String(error) });
    return serverError('negativations GET exception', error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => null);
    const requestedTenantId = searchParams.get('tenant_id')
      || (typeof body?.tenant_id === 'string' ? body.tenant_id : null);

    const tenantContext = await requireRole(req, 'admin', requestedTenantId);
    if ('response' in tenantContext) return tenantContext.response;
    const { supabase, tenantId, userId } = tenantContext.ctx;

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 });
    }
    const financialTitleId = typeof body.financial_title_id === 'string' && body.financial_title_id.trim()
      ? body.financial_title_id.trim()
      : null;
    if (!financialTitleId) {
      return NextResponse.json({ error: 'financial_title_id é obrigatório.' }, { status: 400 });
    }
    const provider = typeof body.provider === 'string' && body.provider.trim()
      ? body.provider.trim().toLowerCase()
      : null;
    if (provider && !['serasa', 'spc', 'boavista'].includes(provider)) {
      return NextResponse.json({ error: 'Provider deve ser serasa, spc ou boavista.' }, { status: 400 });
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : null;

    const { data: title, error: titleError } = await supabase
      .from('financial_titles')
      .select('id, status, due_date, current_value, original_value')
      .eq('id', financialTitleId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (titleError) throw titleError;
    if (!title) {
      return NextResponse.json({ error: 'Título financeiro não encontrado ou não pertence ao tenant.' }, { status: 404 });
    }
    if (['paid', 'settled', 'recovered', 'cancelled', 'canceled'].includes(String(title.status).toLowerCase())) {
      return NextResponse.json({ error: 'Título encerrado não pode ser negativado.' }, { status: 409 });
    }

    const { data: existing } = await supabase
      .from('negativations')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('financial_title_id', financialTitleId)
      .neq('status', 'removed')
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: 'Já existe uma negativação ativa para este título.' }, { status: 409 });
    }

    const { data: created, error: insertError } = await supabase
      .from('negativations')
      .insert({
        tenant_id: tenantId,
        financial_title_id: financialTitleId,
        provider: provider || 'serasa',
        status: 'pending_notification',
        reason,
      })
      .select('*')
      .single();
    if (insertError) throw insertError;

    await recordAuditAction(supabase, {
      tenantId,
      entityType: 'negativation',
      entityId: created.id,
      actorUserId: userId,
      action: 'NEGATIVATION_CREATED',
      after: created,
      metadata: { source: 'manual' },
    });

    return NextResponse.json({ ok: true, negativation: created }, { status: 201 });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err?.code === '23505') {
      return NextResponse.json({ error: 'Já existe uma negativação para este título.' }, { status: 409 });
    }
    logger.error('[negativations POST] exception', undefined, { error: error instanceof Error ? error.message : String(error) });
    return serverError('negativations POST exception', error);
  }
}