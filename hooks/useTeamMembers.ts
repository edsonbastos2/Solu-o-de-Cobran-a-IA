'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchWithAuth } from '@/lib/api';
import { InvitableRole, TeamMember } from '@/lib/team-roles-client';

// Camada de dados de `components/team-management-panel.tsx` (ticket 1805,
// task_06): busca a listagem de membros do tenant e expõe as mutações
// (editar papel/toggle de IA, remover/revogar, reenviar convite) contra os
// endpoints `app/api/tenants/[id]/members*` (task_05). As mensagens de erro
// específicas por status (409 e-mail já registrado, 502 entrega
// indisponível, etc.) já vêm prontas do backend — este hook apenas propaga
// `data.error` via `throw`, sem reinterpretar por código HTTP.
export function useTeamMembers(tenantId: string | null, tenantQuery: string) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/tenants/${tenantId}/members?${tenantQuery}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Falha ao carregar a equipe do tenant.');
      setMembers(Array.isArray(data.members) ? data.members : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar a equipe.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, tenantQuery]);

  useEffect(() => {
    reload();
  }, [reload]);

  const updateMember = useCallback(
    async (memberId: string, payload: { role: InvitableRole; canConfigureAI: boolean }) => {
      if (!tenantId) return;
      const res = await fetchWithAuth(`/api/tenants/${tenantId}/members/${memberId}?${tenantQuery}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: payload.role, canConfigureAI: payload.canConfigureAI }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar o membro.');
      await reload();
    },
    [tenantId, tenantQuery, reload]
  );

  const removeMember = useCallback(
    async (memberId: string) => {
      if (!tenantId) return;
      const res = await fetchWithAuth(`/api/tenants/${tenantId}/members/${memberId}?${tenantQuery}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao remover o membro.');
      await reload();
    },
    [tenantId, tenantQuery, reload]
  );

  const resendInvite = useCallback(
    async (memberId: string) => {
      if (!tenantId) return;
      const res = await fetchWithAuth(`/api/tenants/${tenantId}/members/${memberId}/resend?${tenantQuery}`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao reenviar o convite.');
    },
    [tenantId, tenantQuery]
  );

  return { members, loading, error, reload, updateMember, removeMember, resendInvite };
}
