import { SupabaseClient } from '@supabase/supabase-js';
import { recordAuditAction } from '@/lib/audit';
import { ROLE_RANK, TenantContext } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import { Case } from '@/lib/types';
import { CRM_STAGES, canTransition, statusForStage, CrmStage } from './stages';

export type StageActionResult =
  | { ok: true; case: Case }
  | {
      ok: false;
      error_code: 'NOT_FOUND' | 'FORBIDDEN' | 'INVALID_TRANSITION' | 'STAGE_CONFLICT' | 'VALIDATION_ERROR';
      message: string;
      currentStage?: CrmStage;
    };

export async function moveCaseStage(
  db: SupabaseClient,
  ctx: TenantContext,
  caseId: string,
  input: { stageId: string; expectedStageId?: string; reason?: string }
): Promise<StageActionResult> {
  const { data: current, error } = await db
    .from('cases')
    .select('*')
    .eq('id', caseId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle();
  if (error) {
    logger.warn('[stage-service] case lookup error', undefined, { error: error.message });
    return { ok: false, error_code: 'NOT_FOUND', message: 'Caso não encontrado ou acesso negado.' };
  }
  if (!current) {
    return { ok: false, error_code: 'NOT_FOUND', message: 'Caso não encontrado ou acesso negado.' };
  }

  const snapshot = current as {
    crm_stage: CrmStage | null;
    status: string;
    assigned_user_id: string | null;
  } & Record<string, unknown>;
  const fromStage: CrmStage = snapshot.crm_stage ?? 'NOVO';

  if (
    !ctx.isSuperAdmin &&
    ROLE_RANK[ctx.role] < ROLE_RANK.gestor &&
    snapshot.assigned_user_id !== ctx.userId
  ) {
    return { ok: false, error_code: 'FORBIDDEN', message: 'Permissão insuficiente para mover a etapa deste caso.' };
  }

  const targetStage = input.stageId as CrmStage;
  if (!(CRM_STAGES as readonly string[]).includes(input.stageId)) {
    return { ok: false, error_code: 'VALIDATION_ERROR', message: 'Etapa inválida.' };
  }

  if (!canTransition(fromStage, targetStage)) {
    return {
      ok: false,
      error_code: 'INVALID_TRANSITION',
      message: `Transição de etapa inválida: ${fromStage} para ${targetStage}.`,
    };
  }

  if (input.expectedStageId !== undefined && input.expectedStageId !== fromStage) {
    return {
      ok: false,
      error_code: 'STAGE_CONFLICT',
      message: 'A etapa do caso foi alterada por outro operador. Atualize antes de tentar novamente.',
      currentStage: fromStage,
    };
  }

  const { data: updated, error: updateError } = await db
    .from('cases')
    .update({ crm_stage: targetStage, status: statusForStage(targetStage) })
    .eq('id', caseId)
    .eq('tenant_id', ctx.tenantId)
    .eq('crm_stage', fromStage)
    .select('*')
    .maybeSingle();
  if (updateError) {
    logger.warn('[stage-service] case stage update error', undefined, { error: updateError.message });
    throw updateError;
  }
  if (!updated) {
    return {
      ok: false,
      error_code: 'STAGE_CONFLICT',
      message: 'A etapa do caso foi alterada por outro operador. Atualize antes de tentar novamente.',
      currentStage: fromStage,
    };
  }

  const { error: historyError } = await db.from('case_stage_history').insert({
    tenant_id: ctx.tenantId,
    case_id: caseId,
    from_stage: fromStage,
    to_stage: targetStage,
    changed_by: ctx.userId,
    reason: input.reason ?? null,
  });
  if (historyError) {
    logger.warn('[stage-service] case_stage_history insert error', undefined, { error: historyError.message });
  }

  await recordAuditAction(db, {
    tenantId: ctx.tenantId,
    entityType: 'case',
    entityId: caseId,
    caseId,
    actorUserId: ctx.userId,
    actorRole: ctx.role,
    action: 'CASE_STAGE_CHANGED',
    before: { crm_stage: fromStage, status: snapshot.status },
    after: { crm_stage: targetStage, status: statusForStage(targetStage) },
    metadata: { reason: input.reason ?? null },
  });

  return { ok: true, case: updated as unknown as Case };
}
