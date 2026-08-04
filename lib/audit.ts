import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Registra uma ação administrativa na tabela audit_logs.
 * Usa service role (bypassa RLS). case_id é opcional para ações que não envolvem casos.
 */
export async function auditAdminAction(params: {
  actorUserId: string;
  action: string;
  details?: string;
  targetUserId?: string;
  caseId?: string;
}) {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  try {
    await admin.from('audit_logs').insert({
      case_id: params.caseId ?? null,
      user_id: params.actorUserId,
      action: params.action,
      details: params.details
        ? `${params.details}${params.targetUserId ? ` | target=${params.targetUserId}` : ''}`
        : (params.targetUserId ? `target=${params.targetUserId}` : null)
    });
  } catch (e) {
    console.error('Falha ao registrar audit log:', e);
  }
}