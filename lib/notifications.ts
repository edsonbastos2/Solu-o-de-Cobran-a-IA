import { SupabaseClient } from '@supabase/supabase-js';

export type NotificationType = 'info' | 'warning' | 'error' | 'success';

export interface NotificationRow {
  id: string;
  tenant_id: string;
  user_id?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  related_case_id?: string | null;
  read_at?: string | null;
  created_at: string;
}

export interface CreateNotificationParams {
  tenantId: string;
  userId?: string | null;
  type?: NotificationType;
  title: string;
  body?: string;
  relatedCaseId?: string | null;
}

/**
 * Cria uma notificação persistida (usada por crons e alertas).
 * user_id NULL entrega a todos os membros ativos do tenant (permitido pelo RLS).
 */
export async function createNotification(client: SupabaseClient, params: CreateNotificationParams) {
  const { data, error } = await client.from('notifications').insert({
    tenant_id: params.tenantId,
    user_id: params.userId ?? null,
    type: params.type ?? 'info',
    title: params.title,
    body: params.body ?? null,
    related_case_id: params.relatedCaseId ?? null,
  });
  if (error) {
    throw new Error(`Falha ao criar notificação: ${error.message}`);
  }
  return data;
}

/** Conta notificações não lidas do usuário em um tenant. */
export async function countUnreadNotifications(
  client: SupabaseClient,
  userId: string,
  tenantId: string
): Promise<number> {
  const { count, error } = await client
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .is('read_at', null)
    .or(`user_id.eq.${userId},user_id.is.null`);
  if (error) return 0;
  return count || 0;
}