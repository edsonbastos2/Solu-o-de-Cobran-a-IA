import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export interface TenantAccess {
  userId: string | null;
  isSuperAdmin: boolean;
  tenantId?: string | null;
}

/**
 * Checks if the given userId belongs to a Super Admin or a regular tenant.
 * Super admins can see and manage all tenants' data.
 * Regular tenants can only access data where user_id = userId.
 */
export async function getTenantAccess(requestedUserId?: string | null): Promise<TenantAccess> {
  if (!requestedUserId) {
    return { userId: null, isSuperAdmin: false, tenantId: null };
  }

  if (!supabase) {
    return { userId: requestedUserId, isSuperAdmin: false, tenantId: null };
  }

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin, email, tenant_id')
      .eq('id', requestedUserId)
      .maybeSingle();

    if (profile) {
      return { userId: requestedUserId, isSuperAdmin: profile.is_super_admin === true, tenantId: profile.tenant_id };
    }
  } catch (err) {
    logger.error('Error checking superadmin status', undefined, { error: err instanceof Error ? err.message : String(err) });
  }

  return { userId: requestedUserId, isSuperAdmin: false, tenantId: null };
}
