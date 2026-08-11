import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext, requireRole, serverError } from '@/lib/api-auth';
import { recordAuditAction } from '@/lib/audit';

const EDITABLE_FIELDS = [
  'contract_number',
  'type',
  'start_date',
  'due_date',
  'clauses',
  'interest_rate',
  'penalty_rate',
  'monetary_correction_index',
  'guarantees',
  'guarantors',
  'negative_allowed',
  'protest_allowed',
  'forum',
  'document_url',
  'collection_policy_id',
  'override_days_to_negative',
  'override_days_to_protest',
] as const;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const tenant = await requireTenantContext(req, searchParams.get('tenant_id'));
  if ('response' in tenant) return tenant.response;

  try {
    const { data, error } = await tenant.ctx.supabase
      .from('contracts')
      .select('*, clients(*), collection_policies(*)')
      .eq('id', id)
      .eq('tenant_id', tenant.ctx.tenantId)
      .maybeSingle();

    if (error) return serverError('contract detail query error', error);
    if (!data) return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 });

    return NextResponse.json({ contract: data });
  } catch (error) {
    return serverError('contract detail exception', error);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const body = await req.json().catch(() => null);
  const requestedTenantId = searchParams.get('tenant_id')
    || (typeof body?.tenant_id === 'string' ? body.tenant_id : null);
  const tenant = await requireRole(req, 'admin', requestedTenantId);
  if ('response' in tenant) return tenant.response;

  try {
    const { ctx } = tenant;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 });
    }

    const fields = Object.keys(body).filter((field) => field !== 'tenant_id');
    if (fields.length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar.' }, { status: 400 });
    }
    if (fields.some((field) => !(EDITABLE_FIELDS as readonly string[]).includes(field))) {
      return NextResponse.json({ error: 'Campo não permitido para edição do contrato.' }, { status: 400 });
    }

    const { data: before, error: beforeError } = await ctx.supabase
      .from('contracts')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();
    if (beforeError) return serverError('contract PUT lookup error', beforeError);
    if (!before) return NextResponse.json({ error: 'Contrato não encontrado ou acesso negado.' }, { status: 404 });
    if (before.archived_at) {
      return NextResponse.json({ error: 'Contrato arquivado não pode ser editado.' }, { status: 409 });
    }

    // Valida política pertencente ao tenant
    if (body.collection_policy_id) {
      const { data: policy } = await ctx.supabase
        .from('collection_policies')
        .select('id')
        .eq('id', body.collection_policy_id)
        .eq('tenant_id', ctx.tenantId)
        .maybeSingle();
      if (!policy) {
        return NextResponse.json({ error: 'A política selecionada não pertence ao tenant.' }, { status: 400 });
      }
    }

    const update: Record<string, unknown> = {};
    for (const field of fields) {
      if (field === 'collection_policy_id' || field === 'override_days_to_negative' || field === 'override_days_to_protest') {
        update[field] = body[field] ?? null;
      } else {
        update[field] = body[field];
      }
    }
    update.updated_at = new Date().toISOString();

    const { data: updated, error } = await ctx.supabase
      .from('contracts')
      .update(update)
      .eq('id', id)
      .eq('tenant_id', ctx.tenantId)
      .select('*')
      .single();

    if (error) return serverError('contract PUT update error', error);

    await recordAuditAction(ctx.supabase, {
      tenantId: ctx.tenantId,
      entityType: 'contract',
      entityId: id,
      actorUserId: ctx.userId,
      actorRole: ctx.role,
      action: 'CONTRACT_UPDATED',
      before,
      after: updated,
      metadata: { changed_fields: fields },
    });

    return NextResponse.json({ ok: true, contract: updated });
  } catch (error) {
    return serverError('contract PUT exception', error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const tenant = await requireRole(req, 'admin', searchParams.get('tenant_id'));
  if ('response' in tenant) return tenant.response;

  try {
    const { ctx } = tenant;
    const { data: before, error: beforeError } = await ctx.supabase
      .from('contracts')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();
    if (beforeError) return serverError('contract DELETE lookup error', beforeError);
    if (!before) return NextResponse.json({ error: 'Contrato não encontrado ou acesso negado.' }, { status: 404 });
    if (before.archived_at) {
      return NextResponse.json({ error: 'Contrato já está arquivado.' }, { status: 409 });
    }

    // Bloqueia arquivamento se houver casos ativos vinculados
    const { data: activeCases, error: caseError } = await ctx.supabase
      .from('cases')
      .select('id')
      .eq('contract_id', id)
      .eq('tenant_id', ctx.tenantId)
      .neq('status', 'closed')
      .limit(1);
    if (caseError) return serverError('contract DELETE cases check error', caseError);
    if (activeCases && activeCases.length > 0) {
      return NextResponse.json({ error: 'Não é possível arquivar contrato com casos ativos vinculados.' }, { status: 409 });
    }

    const { data: updated, error } = await ctx.supabase
      .from('contracts')
      .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', ctx.tenantId)
      .select('*')
      .single();

    if (error) return serverError('contract DELETE archive error', error);

    await recordAuditAction(ctx.supabase, {
      tenantId: ctx.tenantId,
      entityType: 'contract',
      entityId: id,
      actorUserId: ctx.userId,
      actorRole: ctx.role,
      action: 'CONTRACT_ARCHIVED',
      before,
      after: updated,
    });

    return NextResponse.json({ ok: true, contract: updated });
  } catch (error) {
    return serverError('contract DELETE exception', error);
  }
}