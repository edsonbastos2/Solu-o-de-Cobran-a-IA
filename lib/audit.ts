import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { TenantRole } from '@/lib/api-auth';

export interface AuditActionParams {
  tenantId: string;
  entityType: string;
  entityId: string;
  actorUserId: string | null;
  actorRole?: TenantRole | null;
  action: string;
  caseId?: string;
  metadata?: Record<string, unknown>;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  details?: string;
  targetUserId?: string;
}

type AuditClient = SupabaseClient;

/** Registra auditoria no mesmo cliente/escopo da mutação e propaga falhas. */
export async function recordAuditAction(client: AuditClient, params: AuditActionParams) {
  const { error } = await client.from('audit_logs').insert({
    tenant_id: params.tenantId,
    case_id: params.caseId ?? (params.entityType === 'case' ? params.entityId : null),
    user_id: params.actorUserId,
    actor_user_id: params.actorUserId,
    actor_role: params.actorRole ?? null,
    entity_type: params.entityType,
    entity_id: params.entityId,
    action: params.action,
    details: params.details
      ? `${params.details}${params.targetUserId ? ` | target=${params.targetUserId}` : ''}`
      : (params.targetUserId ? `target=${params.targetUserId}` : null),
    metadata: params.metadata ?? {},
    before_state: params.before ?? null,
    after_state: params.after ?? null,
  });

  if (error) throw error;
}

/** Compatibilidade para auditoria administrativa já existente. */
export async function auditAdminAction(params: {
  actorUserId: string;
  actorRole?: TenantRole | null;
  action: string;
  details?: string;
  targetUserId?: string;
  caseId?: string;
  tenantId?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('Supabase admin não configurado para auditoria.');

  let tenantId = params.tenantId;
  if (!tenantId) {
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('tenant_id')
      .eq('id', params.actorUserId)
      .maybeSingle();
    if (profileError || !profile?.tenant_id) {
      throw profileError || new Error('Tenant do ator não encontrado para auditoria.');
    }
    tenantId = profile.tenant_id;
  }

  if (!tenantId) throw new Error('Tenant não encontrado para auditoria.');

  await recordAuditAction(admin, {
    tenantId,
    entityType: params.entityType ?? (params.caseId ? 'case' : 'admin'),
    entityId: params.entityId ?? params.caseId ?? params.actorUserId,
    actorUserId: params.actorUserId,
    actorRole: params.actorRole ?? null,
    action: params.action,
    caseId: params.caseId,
    details: params.details,
    targetUserId: params.targetUserId,
    metadata: params.metadata,
    before: params.before,
    after: params.after,
  });
}
