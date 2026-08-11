import { SupabaseClient } from '@supabase/supabase-js';

export type QuarantineStatus = 'pending_review' | 'approved' | 'released' | 'permanent_block';

export interface ActiveQuarantine {
  id: string;
  case_id?: string | null;
  financial_title_id?: string | null;
  reason?: string | null;
  status: QuarantineStatus;
  expires_at?: string | null;
}

/**
 * Retorna a quarentena ativa de um caso (status approved/permanent_block) que
 * ainda não expirou. `permanent_block` nunca expira.
 */
export async function getActiveQuarantine(
  client: SupabaseClient,
  caseId: string,
  tenantId?: string
): Promise<ActiveQuarantine | null> {
  let query = client
    .from('quarantines')
    .select('id, case_id, financial_title_id, reason, status, expires_at')
    .eq('case_id', caseId)
    .in('status', ['approved', 'permanent_block']);

  if (tenantId) query = query.eq('tenant_id', tenantId);

  const { data, error } = await query.order('created_at', { ascending: false }).limit(10);

  if (error || !data || data.length === 0) return null;

  // Considera a primeira quarentena ativa válida
  const now = new Date();
  for (const q of data as ActiveQuarantine[]) {
    const isPermanent = q.status === 'permanent_block';
    const expired = q.expires_at ? new Date(q.expires_at).getTime() <= now.getTime() : false;
    if (!expired || isPermanent) {
      // Se expirou mas é permanent_block, não expira nunca
      if (expired && !isPermanent) continue;
      return q;
    }
  }
  return null;
}

/**
 * Guard para bloqueiar ações automatizadas (processChat, start-negotiation,
 * campanhas). Lança erro se houver quarentena ativa.
 */
export async function ensureNotQuarantined(
  client: SupabaseClient,
  caseId: string,
  tenantId?: string
): Promise<ActiveQuarantine | null> {
  const quarantine = await getActiveQuarantine(client, caseId, tenantId);
  if (quarantine) {
    throw new Error('Caso em quarentena: não é permitido enviar mensagens automatizadas.');
  }
  return null;
}

/** Lista quarentenas ativas (para crons e campanhas). */
export async function listActiveQuarantines(client: SupabaseClient): Promise<ActiveQuarantine[]> {
  const { data, error } = await client
    .from('quarantines')
    .select('id, case_id, financial_title_id, reason, status, expires_at, tenant_id')
    .in('status', ['approved', 'permanent_block']);

  if (error || !data) return [];

  const quarantines = data as (ActiveQuarantine & { tenant_id?: string })[];
  return quarantines.map((q) => ({
    id: q.id,
    case_id: q.case_id,
    financial_title_id: q.financial_title_id,
    reason: q.reason,
    status: q.status,
    expires_at: q.expires_at,
  }));
}