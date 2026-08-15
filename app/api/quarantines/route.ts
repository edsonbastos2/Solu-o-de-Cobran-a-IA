import { NextRequest, NextResponse } from 'next/server';
import { requireRole, serverError } from '@/lib/api-auth';
import { recordAuditAction } from '@/lib/audit';
import { getSupabaseServer } from '@/lib/supabase-server';

const VALID_REASONS = ['legal_dispute', 'deceased', 'no_contact', 'internal_review', 'other'];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenant = await requireRole(req, 'operador', searchParams.get('tenant_id'));
  if ('response' in tenant) return tenant.response;

  try {
    const { ctx } = tenant;
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('limit') || '10', 10) || 10));
    const status = (searchParams.get('status') || '').trim();
    const offset = (page - 1) * limit;

    let query = ctx.supabase
      .from('quarantines')
      .select('*', { count: 'exact' })
      .eq('tenant_id', ctx.tenantId);

    if (status && status !== 'all') query = query.eq('status', status);

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return serverError('quarantines GET error', error);

    return NextResponse.json({
      quarantines: data || [],
      totalPages: Math.ceil((count || 0) / limit) || 1,
      total: count || 0,
    });
  } catch (error) {
    return serverError('quarantines GET exception', error);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const requestedTenantId = (typeof body?.tenant_id === 'string' ? body.tenant_id : null)
    || new URL(req.url).searchParams.get('tenant_id');
  const tenant = await requireRole(req, 'admin', requestedTenantId);
  if ('response' in tenant) return tenant.response;

  try {
    const { ctx } = tenant;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 });
    }

    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason) {
      return NextResponse.json({ error: 'Motivo é obrigatório para criar uma quarentena.' }, { status: 400 });
    }
    if (!VALID_REASONS.includes(reason)) {
      return NextResponse.json({ error: 'Motivo inválido. Use: legal_dispute, deceased, no_contact, internal_review, other.' }, { status: 400 });
    }

    const caseId = typeof body.case_id === 'string' && body.case_id ? body.case_id : null;
    const financialTitleId = typeof body.financial_title_id === 'string' && body.financial_title_id ? body.financial_title_id : null;
    if (!caseId && !financialTitleId) {
      return NextResponse.json({ error: 'Informe case_id ou financial_title_id.' }, { status: 400 });
    }

    // Valida que os IDs pertencem ao tenant
    if (caseId) {
      const { data: existingCase } = await ctx.supabase
        .from('cases')
        .select('id')
        .eq('id', caseId)
        .eq('tenant_id', ctx.tenantId)
        .maybeSingle();
      if (!existingCase) {
        return NextResponse.json({ error: 'Caso não encontrado ou não pertence ao tenant.' }, { status: 404 });
      }
    }

    if (financialTitleId) {
      const { data: existingTitle } = await ctx.supabase
        .from('financial_titles')
        .select('id')
        .eq('id', financialTitleId)
        .eq('tenant_id', ctx.tenantId)
        .maybeSingle();
      if (!existingTitle) {
        return NextResponse.json({ error: 'Título financeiro não encontrado ou não pertence ao tenant.' }, { status: 404 });
      }
    }

    const status = 'pending_review';
    const expiresAt = body.expires_at ? new Date(body.expires_at).toISOString() : null;

    const { data, error } = await ctx.supabase
      .from('quarantines')
      .insert({
        tenant_id: ctx.tenantId,
        case_id: caseId,
        financial_title_id: financialTitleId,
        reason,
        status,
        expires_at: expiresAt,
        metadata: body.metadata ?? {},
      })
      .select()
      .single();

    if (error) return serverError('quarantines POST insert error', error);

    await recordAuditAction(ctx.supabase, {
      tenantId: ctx.tenantId,
      entityType: 'quarantine',
      entityId: data.id,
      actorUserId: ctx.userId,
      actorRole: ctx.role,
      action: 'QUARANTINE_CREATED',
      after: data,
      metadata: { reason, caseId, financialTitleId },
    });

    return NextResponse.json({ ok: true, quarantine: data }, { status: 201 });
  } catch (error) {
    return serverError('quarantines POST exception', error);
  }
}