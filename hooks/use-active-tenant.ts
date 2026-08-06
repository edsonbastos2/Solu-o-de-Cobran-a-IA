'use client';

import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export function useActiveTenant() {
  const { user, profile, loading, isConfigured } = useAuth();
  const searchParams = useSearchParams();
  const requestedTenantId = searchParams.get('tenant_id')?.trim() || null;
  const isSuperAdmin = profile?.is_super_admin === true;
  // Super-admin: override explícito na URL tem precedência sobre o contexto
  // persistido (profiles.current_tenant_id). Usuário regular: tenant de origem.
  const tenantId = isSuperAdmin
    ? requestedTenantId ?? profile?.current_tenant_id ?? null
    : profile?.tenant_id || null;

  return {
    user,
    profile,
    authLoading: loading,
    isConfigured,
    tenantId,
    tenantQuery: tenantId ? `tenant_id=${encodeURIComponent(tenantId)}` : '',
    tenantPath: tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '',
    needsTenantSelection: Boolean(isSuperAdmin && !tenantId),
  };
}
