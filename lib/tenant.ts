import { supabase } from '@/lib/supabase';

export interface TenantAccess {
  userId: string | null;
  isSuperAdmin: boolean;
}

/**
 * Checks if the given userId belongs to a Super Admin or a regular tenant.
 * Super admins can see and manage all tenants' data.
 * Regular tenants can only access data where user_id = userId.
 */
export async function getTenantAccess(requestedUserId?: string | null): Promise<TenantAccess> {
  if (!requestedUserId) {
    return { userId: null, isSuperAdmin: false };
  }

  if (!supabase) {
    return { userId: requestedUserId, isSuperAdmin: false };
  }

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin, email')
      .eq('id', requestedUserId)
      .maybeSingle();

    if (profile) {
      return { userId: requestedUserId, isSuperAdmin: profile.is_super_admin === true };
    }
  } catch (err) {
    console.error('Error checking superadmin status:', err);
  }

  return { userId: requestedUserId, isSuperAdmin: false };
}
