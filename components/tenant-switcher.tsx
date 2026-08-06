'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { fetcher, fetchWithAuth } from '@/lib/api';
import { useActiveTenant } from '@/hooks/use-active-tenant';

type TenantOption = { id: string; name: string };

/**
 * Seletor de tenant para super-admin. Persiste a escolha no servidor
 * (profiles.current_tenant_id) e reflete no ?tenant_id= da URL, que tem
 * precedência imediata em useActiveTenant (revalida as keys do SWR).
 */
export function TenantSwitcher() {
  const { profile, tenantId } = useActiveTenant();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [updating, setUpdating] = useState(false);

  const isSuperAdmin = profile?.is_super_admin === true;
  const { data } = useSWR<{ tenants: TenantOption[] }>(isSuperAdmin ? '/api/tenants' : null, fetcher);

  if (!isSuperAdmin) return null;

  const tenants = data?.tenants || [];

  const handleChange = async (newTenantId: string) => {
    if (!newTenantId || newTenantId === tenantId) return;
    setUpdating(true);
    try {
      const res = await fetchWithAuth('/api/tenants/current', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: newTenantId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Erro ao trocar de tenant');
        return;
      }
      const params = new URLSearchParams(searchParams.toString());
      params.set('tenant_id', newTenantId);
      router.replace(`${pathname}?${params.toString()}`);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-md px-2 py-1.5">
      <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
      <select
        value={tenantId ?? ''}
        onChange={(e) => handleChange(e.target.value)}
        disabled={updating || tenants.length === 0}
        className="bg-transparent text-xs sm:text-sm text-slate-200 font-medium focus:outline-none cursor-pointer disabled:opacity-50 max-w-[140px] sm:max-w-[200px] truncate"
        aria-label="Selecionar tenant"
      >
        {!tenantId && <option value="" disabled>Selecionar tenant...</option>}
        {tenants.map((t) => (
          <option key={t.id} value={t.id} className="bg-[#111318] text-slate-200">
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}
