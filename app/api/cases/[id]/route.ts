import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext, requireRole, serverError } from '@/lib/api-auth';
import { calculateUpdatedValue, getCollectionStage } from '@/lib/finance';
import { recordAuditAction } from '@/lib/audit';
import { resolveCaseClientId } from '@/lib/channels/message-service';
import { CaseWithRelations } from '@/lib/types';

const ALLOWED_STATUSES = ['not_started', 'in_negotiation', 'needs_attention', 'closed'] as const;
const STATUS_TRANSITIONS: Record<string, Set<string>> = {
  not_started: new Set(['not_started', 'in_negotiation', 'needs_attention', 'closed']),
  in_negotiation: new Set(['in_negotiation', 'needs_attention', 'closed']),
  needs_attention: new Set(['needs_attention', 'in_negotiation', 'closed']),
  closed: new Set(['closed']),
};

const ALLOWED_ACTIVE_CHANNELS = ['whatsapp', 'telegram'] as const;

const CASE_SELECT = `
  *,
  financial_titles (
    id, tenant_id, contract_id, client_id, installment_number,
    external_reference, description, original_value, current_value,
    due_date, status, paid_at, legacy_installment_id, metadata,
    created_at, updated_at,
    contracts (
      id, tenant_id, client_id, contract_number, type,
      clients (id, tenant_id, name, document, phone, email, address,
        client_channels (id, channel, username, verified_at))
    )
  )
`;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const tenant = await requireTenantContext(req, searchParams.get('tenant_id'));
  if ('response' in tenant) return tenant.response;

  try {
    const { ctx } = tenant;
    const { data: caseData, error } = await ctx.supabase
      .from('cases')
      .select(CASE_SELECT)
      .eq('id', id)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();

    if (error) return serverError('case detail query error', error);
    if (!caseData) return NextResponse.json({ error: 'Caso não encontrado ou acesso negado.' }, { status: 404 });

    const { data: messages, error: messagesError } = await ctx.supabase
      .from('messages')
      .select('*')
      .eq('case_id', id)
      .eq('tenant_id', ctx.tenantId)
      .order('created_at', { ascending: true });
    if (messagesError) return serverError('case messages query error', messagesError);

    const { data: auditLogs, error: auditError } = await ctx.supabase
      .from('audit_logs')
      .select('*')
      .eq('case_id', id)
      .eq('tenant_id', ctx.tenantId)
      .order('created_at', { ascending: false });
    if (auditError) return serverError('case audit query error', auditError);

    const relatedCase = caseData as CaseWithRelations;
    const title = Array.isArray(relatedCase.financial_titles)
      ? relatedCase.financial_titles[0]
      : relatedCase.financial_titles;
    const contract = title?.contracts || null;
    const client = contract?.clients || null;
    const recalculated = calculateUpdatedValue(Number(caseData.original_value) || 0, new Date(caseData.due_date));
    const currentCase = {
      ...caseData,
      financial_titles: undefined,
      updated_value: recalculated > Number(caseData.original_value)
        ? recalculated
        : Number(caseData.updated_value || caseData.original_value),
      legacy_context: caseData.legacy_context ?? !title,
    };

    return NextResponse.json({
      case: currentCase,
      client,
      contract,
      financial_title: title || null,
      messages: messages || [],
      audit_logs: auditLogs || [],
      legacy_context: currentCase.legacy_context,
      stage: getCollectionStage(currentCase.due_date, currentCase.max_discount_margin, currentCase.status),
    });
  } catch (error) {
    return serverError('case detail exception', error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const tenant = await requireRole(req, 'gestor', searchParams.get('tenant_id'));
  if ('response' in tenant) return tenant.response;

  try {
    const { ctx } = tenant;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 });
    }

    const allowed = ['status', 'assigned_user_id', 'active_channel'];
    const fields = Object.keys(body);
    if (fields.some((field) => !allowed.includes(field))) {
      return NextResponse.json({ error: 'Campo não permitido para atualização do caso.' }, { status: 400 });
    }
    if (fields.length === 0) return NextResponse.json({ error: 'Nenhum campo para atualizar.' }, { status: 400 });

    const { data: before, error: beforeError } = await ctx.supabase
      .from('cases')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();
    if (beforeError) return serverError('case PATCH lookup error', beforeError);
    if (!before) return NextResponse.json({ error: 'Caso não encontrado ou acesso negado.' }, { status: 404 });

    const update: Record<string, unknown> = {};
    if ('status' in body) {
      if (typeof body.status !== 'string' || !ALLOWED_STATUSES.includes(body.status as typeof ALLOWED_STATUSES[number])) {
        return NextResponse.json({ error: 'Status inválido.' }, { status: 400 });
      }
      if (!STATUS_TRANSITIONS[before.status]?.has(body.status)) {
        return NextResponse.json({ error: `Transição de status inválida: ${before.status} para ${body.status}.` }, { status: 400 });
      }
      update.status = body.status;
    }
    if ('assigned_user_id' in body) {
      if (body.assigned_user_id !== null && typeof body.assigned_user_id !== 'string') {
        return NextResponse.json({ error: 'assigned_user_id deve ser um UUID ou nulo.' }, { status: 400 });
      }
      if (body.assigned_user_id) {
        const { data: member } = await ctx.supabase
          .from('tenant_members')
          .select('user_id')
          .eq('tenant_id', ctx.tenantId)
          .eq('user_id', body.assigned_user_id)
          .eq('status', 'active')
          .maybeSingle();
        if (!member) return NextResponse.json({ error: 'Responsável não pertence ao tenant.' }, { status: 400 });
      }
      update.assigned_user_id = body.assigned_user_id;
    }
    if ('active_channel' in body) {
      const channelValue = body.active_channel;
      if (
        channelValue !== null &&
        (typeof channelValue !== 'string' || !ALLOWED_ACTIVE_CHANNELS.includes(channelValue as (typeof ALLOWED_ACTIVE_CHANNELS)[number]))
      ) {
        return NextResponse.json(
          { error: 'Canal ativo inválido. Use whatsapp, telegram ou null.' },
          { status: 400 }
        );
      }
      const activeChannel = channelValue as (typeof ALLOWED_ACTIVE_CHANNELS)[number] | null;
      if (activeChannel) {
        // O canal ativo exige vinculação real do cliente (ADR-002). O cliente
        // do caso é resolvido via debtor_id ou título financeiro (cases não
        // possui coluna client_id).
        const clientId = await resolveCaseClientId(ctx.supabase, ctx.tenantId, before);
        let hasChannel = false;
        if (clientId) {
          const { data: binding, error: bindingError } = await ctx.supabase
            .from('client_channels')
            .select('id')
            .eq('tenant_id', ctx.tenantId)
            .eq('client_id', clientId)
            .eq('channel', activeChannel)
            .limit(1);
          if (bindingError) return serverError('case PATCH channel lookup error', bindingError);
          hasChannel = Boolean(binding && binding.length > 0);
        }
        if (!hasChannel) {
          return NextResponse.json(
            { error: `Cliente não possui o canal ${activeChannel} vinculado.` },
            { status: 422 }
          );
        }
      }
      update.active_channel = activeChannel;
    }

    const { data: updatedCase, error } = await ctx.supabase
      .from('cases')
      .update(update)
      .eq('id', id)
      .eq('tenant_id', ctx.tenantId)
      .select('*')
      .single();
    if (error) return serverError('case PATCH update error', error);

    const channelChanged =
      'active_channel' in body && before.active_channel !== updatedCase.active_channel;
    const action = channelChanged
      ? 'CASE_CHANNEL_CHANGED'
      : 'status' in body && before.status !== updatedCase.status
        ? (updatedCase.status === 'closed' ? 'CASE_CLOSED' : 'STATUS_CHANGE')
        : 'CASE_ASSIGNMENT_CHANGE';
    await recordAuditAction(ctx.supabase, {
      tenantId: ctx.tenantId,
      entityType: 'case',
      entityId: id,
      caseId: id,
      actorUserId: ctx.userId,
      actorRole: ctx.role,
      action,
      before,
      after: updatedCase,
      metadata: {
        changed_fields: fields,
        ...(channelChanged
          ? {
              active_channel_old: before.active_channel ?? null,
              active_channel_new: updatedCase.active_channel ?? null,
            }
          : {}),
      },
    });

    return NextResponse.json({ ok: true, case: updatedCase });
  } catch (error) {
    return serverError('case PATCH exception', error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const tenant = await requireRole(req, 'gestor', searchParams.get('tenant_id'));
  if ('response' in tenant) return tenant.response;

  try {
    const { ctx } = tenant;
    const { data: existing, error } = await ctx.supabase
      .from('cases')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();
    if (error) return serverError('case archive lookup error', error);
    if (!existing) return NextResponse.json({ error: 'Caso não encontrado ou acesso negado.' }, { status: 404 });

    if (existing.status !== 'closed') {
      const { data: archived, error: archiveError } = await ctx.supabase
        .from('cases')
        .update({ status: 'closed' })
        .eq('id', id)
        .eq('tenant_id', ctx.tenantId)
        .select('*')
        .single();
      if (archiveError) return serverError('case archive error', archiveError);
      await recordAuditAction(ctx.supabase, {
        tenantId: ctx.tenantId,
        entityType: 'case',
        entityId: id,
        caseId: id,
        actorUserId: ctx.userId,
        action: 'CASE_CLOSED',
        before: existing,
        after: archived,
        details: 'Solicitação de exclusão convertida em encerramento para preservar histórico.',
      });
    }

    return NextResponse.json({ ok: true, archived: true });
  } catch (error) {
    return serverError('case DELETE exception', error);
  }
}
