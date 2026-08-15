import { NextRequest, NextResponse } from 'next/server';
import { requireRole, serverError } from '@/lib/api-auth';
import { recordAuditAction } from '@/lib/audit';
import { validateFields } from '@/lib/api-validate';
import { FinancialTitleStatus } from '@/lib/types';

const TITLE_SELECT = 'id, tenant_id, contract_id, client_id, installment_number, external_reference, description, original_value, current_value, due_date, status, paid_at, legacy_installment_id, metadata, created_at, updated_at';

const INCOMING_STATUSES: FinancialTitleStatus[] = ['paid', 'partial', 'cancelled'];

const CLOSED_STATUSES = new Set(['paid', 'settled', 'recovered', 'cancelled', 'canceled']);

function roundCurrency(n: number): number {
  return Math.round(n * 100) / 100;
}

function currentBalance(title: { current_value: number | null; original_value: number | null }): number {
  const value = title.current_value != null ? Number(title.current_value) : Number(title.original_value ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const body = await req.json().catch(() => null);
  const requestedTenantId = searchParams.get('tenant_id')
    || (typeof body?.tenant_id === 'string' ? body.tenant_id : null);
  const tenant = await requireRole(req, 'gestor', requestedTenantId);
  if ('response' in tenant) return tenant.response;

  try {
    const { ctx } = tenant;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 });
    }

    const allowed = ['status', 'paid_at', 'paid_amount', 'metadata'];
    const fields = Object.keys(body).filter((field) => field !== 'tenant_id');
    if (fields.some((field) => !allowed.includes(field))) {
      return NextResponse.json({ error: 'Campo não permitido para atualização do título financeiro.' }, { status: 400 });
    }

    const incomingStatus = body.status as unknown;
    if (typeof incomingStatus !== 'string' || !INCOMING_STATUSES.includes(incomingStatus as FinancialTitleStatus)) {
      return NextResponse.json({ error: 'status deve ser paid, partial ou cancelled.' }, { status: 400 });
    }

    const { data: title, error: titleError } = await ctx.supabase
      .from('financial_titles')
      .select(TITLE_SELECT)
      .eq('id', id)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();
    if (titleError) return serverError('financial titles PATCH lookup error', titleError);
    if (!title) return NextResponse.json({ error: 'Título financeiro não encontrado ou acesso negado.' }, { status: 404 });

    const currentStatus = String(title.status || 'pending').toLowerCase();
    if (CLOSED_STATUSES.has(currentStatus)) {
      return NextResponse.json(
        { error: `O título já está encerrado (${currentStatus}). Não é possível aplicar nova baixa ou cancelamento.` },
        { status: 409 }
      );
    }

    const incomingMetadata = body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
      ? body.metadata as Record<string, unknown>
      : {};
    const existingMetadata = title.metadata && typeof title.metadata === 'object' && !Array.isArray(title.metadata)
      ? title.metadata as Record<string, unknown>
      : {};

    const prevPayment = existingMetadata.payment && typeof existingMetadata.payment === 'object'
      ? existingMetadata.payment as Record<string, unknown>
      : {};
    const previousTotalPaid = typeof prevPayment?.total === 'number' && Number.isFinite(Number(prevPayment.total))
      ? Number(prevPayment.total)
      : 0;
    const previousHistory = Array.isArray(prevPayment?.history)
      ? prevPayment.history as unknown[]
      : [];

    const update: Record<string, unknown> = {};
    let baixaKind: 'total' | 'partial' | 'cancel' = 'total';
    let paidAmountRecorded: number | undefined;

    if (incomingStatus === 'paid') {
      const balance = currentBalance(title);
      const now = new Date().toISOString();
      let paidAt = now;
      if (body.paid_at !== undefined && body.paid_at !== null) {
        const parsed = new Date(String(body.paid_at));
        if (isNaN(parsed.getTime())) {
          return NextResponse.json({ error: 'paid_at deve ser uma data válida.' }, { status: 400 });
        }
        paidAt = parsed.toISOString();
      }
      update.status = 'paid';
      update.paid_at = paidAt;
      update.current_value = 0;
      baixaKind = 'total';
      paidAmountRecorded = balance;
    } else if (incomingStatus === 'cancelled') {
      update.status = 'cancelled';
      baixaKind = 'cancel';
    } else {
      const requiredError = validateFields(body, [{ name: 'paid_amount', type: 'number' }]);
      if (requiredError) return requiredError;
      const paidAmount = Number(body.paid_amount);
      if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
        return NextResponse.json({ error: 'paid_amount deve ser um número maior que zero para baixa parcial.' }, { status: 400 });
      }
      const balance = currentBalance(title);
      if (paidAmount > balance) {
        return NextResponse.json({ error: 'paid_amount não pode exceder o saldo pendente do título.' }, { status: 400 });
      }
      const remaining = roundCurrency(Math.max(0, balance - paidAmount));
      baixaKind = 'partial';
      paidAmountRecorded = roundCurrency(paidAmount);
      if (remaining > 0) {
        update.status = 'partial';
        update.current_value = remaining;
      } else {
        update.status = 'paid';
        update.paid_at = new Date().toISOString();
        update.current_value = 0;
      }
    }

    const paymentAt = new Date().toISOString();
    const totalPaid = roundCurrency(previousTotalPaid + (paidAmountRecorded ?? 0));

    update.metadata = {
      ...existingMetadata,
      ...incomingMetadata,
      payment: {
        kind: baixaKind,
        amount: paidAmountRecorded ?? null,
        total: totalPaid,
        at: paymentAt,
        actor_user_id: ctx.userId,
        history: [
          ...previousHistory,
          { kind: baixaKind, amount: paidAmountRecorded ?? null, at: paymentAt },
        ],
      },
    };

    const { data: updated, error: updateError } = await ctx.supabase
      .from('financial_titles')
      .update(update)
      .eq('id', id)
      .eq('tenant_id', ctx.tenantId)
      .select(TITLE_SELECT)
      .single();
    if (updateError) return serverError('financial titles PATCH update error', updateError);

    const { data: linkedCase } = await ctx.supabase
      .from('cases')
      .select('id')
      .eq('financial_title_id', id)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();

    await recordAuditAction(ctx.supabase, {
      tenantId: ctx.tenantId,
      entityType: 'financial_title',
      entityId: id,
      caseId: linkedCase?.id,
      actorUserId: ctx.userId,
      action: 'TITLE_STATUS_CHANGE',
      before: title,
      after: updated,
      details: baixaKind === 'total' ? 'Baixa total do título.' : baixaKind === 'partial' ? 'Baixa parcial do título.' : 'Cancelamento do título.',
      metadata: { baixa_kind: baixaKind, paid_amount: paidAmountRecorded ?? null },
    });

    const fulfilledNegotiationIds: string[] = [];
    let warning: string | null = null;
    const removedNegativationIds: string[] = [];

    if (String(updated.status) === 'paid') {
      // CDC: remoção da negativação em até 2 dias úteis após quitação.
      const { data: negativations, error: negativationQueryError } = await ctx.supabase
        .from('negativations')
        .select('id')
        .eq('tenant_id', ctx.tenantId)
        .eq('financial_title_id', id)
        .in('status', ['pending_notification', 'notified', 'requested', 'completed']);

      if (negativationQueryError) {
        warning = 'Título baixado, mas não foi possível localizar negativações para remoção automática.';
      } else {
        for (const negativation of (negativations || [])) {
          try {
            const { data: updatedNegativation, error: negativationUpdateError } = await ctx.supabase
              .from('negativations')
              .update({ status: 'removed', removed_at: new Date().toISOString() })
              .eq('id', negativation.id)
              .eq('tenant_id', ctx.tenantId)
              .select('id, status, removed_at')
              .single();
            if (negativationUpdateError) {
              warning = warning
                ? `${warning} Falha ao remover negativação ${negativation.id}.`
                : `Falha ao remover negativação ${negativation.id}.`;
              continue;
            }
            await recordAuditAction(ctx.supabase, {
              tenantId: ctx.tenantId,
              entityType: 'negativation',
              entityId: negativation.id,
              caseId: linkedCase?.id,
              actorUserId: ctx.userId,
              action: 'NEGATIVATION_REMOVED',
              after: updatedNegativation,
              metadata: { source: 'title_full_payment', title_id: id },
            });
            removedNegativationIds.push(negativation.id);
          } catch (err) {
            warning = warning
              ? `${warning} Falha ao registrar remoção da negativação ${negativation.id}.`
              : `Falha ao registrar remoção da negativação ${negativation.id}.`;
          }
        }
      }
    }

    const cancelledProtestIds: string[] = [];
    if (String(updated.status) === 'paid') {
      // Quitação cancela automaticamente protestos ativos do título.
      const { data: protests, error: protestQueryError } = await ctx.supabase
        .from('protests')
        .select('id')
        .eq('tenant_id', ctx.tenantId)
        .eq('financial_title_id', id)
        .in('status', ['pending_notification', 'notified', 'requested', 'completed']);

      if (protestQueryError) {
        warning = warning
          ? `${warning} Não foi possível localizar protestos para cancelamento automático.`
          : 'Título baixado, mas não foi possível localizar protestos para cancelamento automático.';
      } else {
        for (const protest of (protests || [])) {
          try {
            const { data: updatedProtest, error: protestUpdateError } = await ctx.supabase
              .from('protests')
              .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
              .eq('id', protest.id)
              .eq('tenant_id', ctx.tenantId)
              .select('id, status, cancelled_at')
              .single();
            if (protestUpdateError) {
              warning = warning
                ? `${warning} Falha ao cancelar protesto ${protest.id}.`
                : `Falha ao cancelar protesto ${protest.id}.`;
              continue;
            }
            await recordAuditAction(ctx.supabase, {
              tenantId: ctx.tenantId,
              entityType: 'protest',
              entityId: protest.id,
              caseId: linkedCase?.id,
              actorUserId: ctx.userId,
              action: 'PROTEST_CANCELLED',
              after: updatedProtest,
              metadata: { source: 'title_full_payment', title_id: id },
            });
            cancelledProtestIds.push(protest.id);
          } catch (err) {
            warning = warning
              ? `${warning} Falha ao registrar cancelamento do protesto ${protest.id}.`
              : `Falha ao registrar cancelamento do protesto ${protest.id}.`;
          }
        }
      }
    }

    const { data: acceptedNegotiations, error: negotiationQueryError } = await ctx.supabase
        .from('negotiations')
        .select('id, case_id, status')
        .eq('tenant_id', ctx.tenantId)
        .eq('financial_title_id', id)
        .eq('status', 'accepted');

      if (negotiationQueryError) {
        warning = 'Título baixado, mas não foi possível verificar acordos vinculados para cumprimento.';
      } else {
        for (const negotiation of acceptedNegotiations || []) {
          try {
            const { data: updatedNegotiation, error: negotiationUpdateError } = await ctx.supabase
              .from('negotiations')
              .update({ status: 'fulfilled' })
              .eq('id', negotiation.id)
              .eq('tenant_id', ctx.tenantId)
              .select('id, case_id, status, accepted_at, metadata')
              .single();
            if (negotiationUpdateError) {
              warning = warning
                ? `${warning} Falha ao cumprir acordo ${negotiation.id}.`
                : `Falha ao cumprir acordo ${negotiation.id}.`;
              continue;
            }
            await recordAuditAction(ctx.supabase, {
              tenantId: ctx.tenantId,
              entityType: 'negotiation',
              entityId: negotiation.id,
              caseId: negotiation.case_id || undefined,
              actorUserId: ctx.userId,
              action: 'NEGOTIATION_FULFILLED',
              before: negotiation,
              after: updatedNegotiation,
              metadata: { source: 'title_full_payment', title_id: id },
            });
            fulfilledNegotiationIds.push(negotiation.id);
          } catch (err) {
            warning = warning
              ? `${warning} Falha ao registrar cumprimento do acordo ${negotiation.id}.`
              : `Falha ao registrar cumprimento do acordo ${negotiation.id}.`;
          }
        }
      }

    const payload: Record<string, unknown> = {
      ok: true,
      title: updated,
      fulfilled_negotiation_ids: fulfilledNegotiationIds,
      removed_negativation_ids: removedNegativationIds,
      cancelled_protest_ids: cancelledProtestIds,
    };
    if (warning) payload.warning = warning;

    return NextResponse.json(payload);
  } catch (error) {
    return serverError('financial titles PATCH exception', error);
  }
}
