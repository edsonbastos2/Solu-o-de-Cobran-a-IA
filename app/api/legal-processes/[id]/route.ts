import { NextRequest, NextResponse } from 'next/server';
import { requireRole, serverError } from '@/lib/api-auth';
import { recordAuditAction } from '@/lib/audit';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type LegalStatus = 'open' | 'in_progress' | 'judgment_won' | 'judgment_lost' | 'closed';

const ALLOWED_TRANSITIONS: Partial<Record<LegalStatus, LegalStatus[]>> = {
  open: ['in_progress', 'judgment_won', 'judgment_lost', 'closed'],
  in_progress: ['judgment_won', 'judgment_lost', 'closed'],
  judgment_won: ['closed'],
  judgment_lost: ['closed'],
  closed: [],
};

const LEGAL_TYPES = ['execucao', 'monitoria', 'cobranca', 'collection'] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => null);
    const requestedTenantId = searchParams.get('tenant_id')
      || (typeof body?.tenant_id === 'string' ? body.tenant_id : null);

    const tenantContext = await requireRole(req, 'member', requestedTenantId);
    if ('response' in tenantContext) return tenantContext.response;
    const { supabase, tenantId, userId } = tenantContext.ctx;

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 });
    }

    const allowed = [
      'status', 'process_number', 'process_type', 'court', 'filing_date',
      'lawyer_name', 'lawyer_contact', 'metadata',
    ];
    if (Object.keys(body).some((k) => k !== 'tenant_id' && !allowed.includes(k))) {
      return NextResponse.json({ error: 'Campo não permitido para atualização do processo jurídico.' }, { status: 400 });
    }

    const { data: current, error: lookupError } = await supabase
      .from('legal_processes')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!current) {
      return NextResponse.json({ error: 'Processo jurídico não encontrado ou não pertence ao tenant.' }, { status: 404 });
    }

    const update: Record<string, unknown> = {};
    const nextStatus = body.status as unknown;

    if (typeof nextStatus === 'string') {
      if (!ALLOWED_TRANSITIONS[nextStatus as LegalStatus] && nextStatus !== current.status) {
        return NextResponse.json({ error: 'Status jurídico inválido.' }, { status: 400 });
      }
      if (nextStatus !== current.status) {
        const from = current.status as LegalStatus;
        const allowedNext = ALLOWED_TRANSITIONS[from] || [];
        if (!allowedNext.includes(nextStatus as LegalStatus)) {
          return NextResponse.json(
            { error: `Transição inválida: ${from} → ${String(nextStatus)}.` },
            { status: 409 }
          );
        }
        update.status = nextStatus;
      }
    }

    if (body.process_number !== undefined && typeof body.process_number === 'string') {
      update.process_number = body.process_number.trim().slice(0, 60) || null;
    }
    if (body.process_type !== undefined && typeof body.process_type === 'string') {
      update.process_type = LEGAL_TYPES.includes(body.process_type as (typeof LEGAL_TYPES)[number])
        ? body.process_type
        : 'cobranca';
    }
    if (body.court !== undefined && typeof body.court === 'string') {
      update.court = body.court.trim().slice(0, 120) || null;
    }
    if (body.filing_date !== undefined && body.filing_date !== null && body.filing_date !== '') {
      const parsed = new Date(String(body.filing_date));
      if (isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'filing_date deve ser uma data válida.' }, { status: 400 });
      }
      update.filing_date = parsed.toISOString().slice(0, 10);
    } else if (body.filing_date === null || body.filing_date === '') {
      update.filing_date = null;
    }
    if (body.lawyer_name !== undefined && typeof body.lawyer_name === 'string') {
      update.lawyer_name = body.lawyer_name.trim().slice(0, 120) || null;
    }
    if (body.lawyer_contact !== undefined && typeof body.lawyer_contact === 'string') {
      update.lawyer_contact = body.lawyer_contact.trim().slice(0, 160) || null;
    }
    if (body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)) {
      update.metadata = { ...(current.metadata || {}), ...body.metadata };
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: true, legal_process: current });
    }

    const { data: updated, error: updateError } = await supabase
      .from('legal_processes')
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();
    if (updateError) throw updateError;

    await recordAuditAction(supabase, {
      tenantId,
      entityType: 'legal_process',
      entityId: id,
      caseId: current.case_id,
      actorUserId: userId,
      action: 'LEGAL_PROCESS_STATUS_CHANGE',
      before: current,
      after: updated,
      metadata: { status_from: current.status, status_to: updated.status },
    });

    return NextResponse.json({ ok: true, legal_process: updated });
  } catch (error: unknown) {
    logger.error('[legal-processes PATCH] exception', undefined, { error: error instanceof Error ? error.message : String(error) });
    return serverError('legal-processes PATCH exception', error);
  }
}