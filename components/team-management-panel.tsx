'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Mail,
  Pencil,
  RotateCcw,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useActiveTenant } from '@/hooks/use-active-tenant';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { RoleSelectField } from '@/components/team-role-select-field';
import { TeamInviteModal } from '@/components/team-invite-modal';
import { InvitableRole, ROLE_DESCRIPTIONS, ROLE_LABELS, TeamMember } from '@/lib/team-roles-client';

function StatusBadge({ status }: { status: 'active' | 'pending' }) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300">
        <Mail className="w-3 h-3" />
        Convite pendente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
      <CheckCircle2 className="w-3 h-3" />
      Ativo
    </span>
  );
}

interface MemberRowProps {
  member: TeamMember;
  onSave: (memberId: string, payload: { role: InvitableRole; canConfigureAI: boolean }) => Promise<void>;
  onRemoveOrRevoke: (memberId: string) => Promise<void>;
  onResend: (memberId: string) => Promise<void>;
}

// Linha da tabela de equipe: espelha `AiBucketEditor` (components/ai-bucket-editor.tsx)
// mantendo TODO o estado de edição/confirmação/reenvio local ao componente,
// sincronizado a partir da prop `member` via `useEffect` quando ela muda
// (ex.: após o pai revalidar a lista). O pai só conhece os três callbacks
// assíncronos abaixo — nenhum estado de UI por linha é levantado para ele.
function MemberRow({ member, onSave, onRemoveOrRevoke, onResend }: MemberRowProps) {
  const isOwner = member.role === 'owner';
  const isPending = member.status === 'pending';
  const displayName = member.name || member.email || 'Usuário';

  const [isEditing, setIsEditing] = useState(false);
  const [editRole, setEditRole] = useState<InvitableRole>(isOwner ? 'operador' : (member.role as InvitableRole));
  const [editCanConfigureAI, setEditCanConfigureAI] = useState(member.canConfigureAI);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [isConfirming, setIsConfirming] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const resendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-sincroniza os valores exibidos/editáveis quando o membro muda (ex.:
  // após o pai recarregar a lista pós-mutação).
  useEffect(() => {
    if (!isOwner) setEditRole(member.role as InvitableRole);
    setEditCanConfigureAI(member.canConfigureAI);
  }, [isOwner, member.role, member.canConfigureAI]);

  // Cleanup do timeout de "reenviado com sucesso" caso a linha desmonte
  // antes dos 3s (ex.: lista recarregada e a linha some).
  useEffect(() => {
    return () => {
      if (resendTimeoutRef.current) clearTimeout(resendTimeoutRef.current);
    };
  }, []);

  const startEdit = () => {
    if (isOwner) return;
    setIsConfirming(false);
    setActionError(null);
    setEditRole(member.role as InvitableRole);
    setEditCanConfigureAI(member.canConfigureAI);
    setEditError(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditError(null);
  };

  const saveEdit = async () => {
    setSavingEdit(true);
    setEditError(null);
    try {
      await onSave(member.id, { role: editRole, canConfigureAI: editCanConfigureAI });
      setIsEditing(false);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Erro ao atualizar o membro.');
    } finally {
      setSavingEdit(false);
    }
  };

  const requestConfirm = () => {
    setIsEditing(false);
    setActionError(null);
    setIsConfirming(true);
  };

  const cancelConfirm = () => {
    setIsConfirming(false);
    setActionError(null);
  };

  const confirmedAction = async () => {
    setActionBusy(true);
    setActionError(null);
    try {
      await onRemoveOrRevoke(member.id);
      setIsConfirming(false);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erro ao remover o membro.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setActionError(null);
    setResendSuccess(false);
    try {
      await onResend(member.id);
      setResendSuccess(true);
      if (resendTimeoutRef.current) clearTimeout(resendTimeoutRef.current);
      resendTimeoutRef.current = setTimeout(() => setResendSuccess(false), 3000);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erro ao reenviar o convite.');
    } finally {
      setResending(false);
    }
  };

  return (
    <tr className="border-b border-white/5 last:border-b-0 align-top">
      <td className="px-3 py-3">
        <p className="text-sm text-white font-medium">{displayName}</p>
        {member.email && member.name && <p className="text-xs text-slate-500 mt-0.5">{member.email}</p>}
      </td>
      <td className="px-3 py-3 max-w-[180px]">
        {isEditing ? (
          <RoleSelectField
            id={`edit-role-${member.id}`}
            value={editRole}
            onChange={setEditRole}
            disabled={savingEdit}
          />
        ) : (
          <>
            <p className="text-sm text-slate-200">{ROLE_LABELS[member.role]}</p>
            <p className="text-xs text-slate-500 mt-0.5 truncate" title={ROLE_DESCRIPTIONS[member.role]}>
              {ROLE_DESCRIPTIONS[member.role]}
            </p>
          </>
        )}
      </td>
      <td className="px-3 py-3">
        <ToggleSwitch
          checked={isEditing ? editCanConfigureAI : member.canConfigureAI}
          onChange={setEditCanConfigureAI}
          disabled={!isEditing || savingEdit || isOwner}
          label={`Pode configurar provedores de IA — ${displayName}`}
        />
      </td>
      <td className="px-3 py-3">
        <StatusBadge status={member.status} />
      </td>
      <td className="px-3 py-3 w-28">
        {isEditing ? (
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={cancelEdit}
                disabled={savingEdit}
                title="Cancelar edição"
                aria-label={`Cancelar edição de ${displayName}`}
                className="p-1.5 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={savingEdit}
                title="Salvar alterações"
                aria-label={`Salvar alterações de ${displayName}`}
                className="p-1.5 rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 transition-colors disabled:opacity-50"
              >
                {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              </button>
            </div>
            {editError && (
              <p role="alert" className="text-xs text-red-400 text-right">
                {editError}
              </p>
            )}
          </div>
        ) : isConfirming ? (
          <div className="flex flex-col items-end gap-2">
            <p className="text-xs text-amber-300 text-right">
              {isPending ? 'Revogar este convite?' : 'Remover da equipe?'}
            </p>
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={cancelConfirm}
                disabled={actionBusy}
                title="Cancelar"
                aria-label="Cancelar"
                className="p-1.5 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={confirmedAction}
                disabled={actionBusy}
                title={isPending ? 'Confirmar revogação' : 'Confirmar remoção'}
                aria-label={isPending ? `Confirmar revogação do convite de ${displayName}` : `Confirmar remoção de ${displayName}`}
                className="p-1.5 rounded-lg bg-red-500 text-white hover:bg-red-400 transition-colors disabled:opacity-50"
              >
                {actionBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </div>
            {actionError && (
              <p role="alert" className="text-xs text-red-400 text-right">
                {actionError}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center justify-end gap-1.5 flex-wrap">
              {!isOwner && !isPending && (
                <button
                  type="button"
                  onClick={startEdit}
                  title="Editar papel e configuração de IA"
                  aria-label={`Editar ${displayName}`}
                  className="p-1.5 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              {isPending && (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  title="Reenviar convite"
                  aria-label={`Reenviar convite para ${displayName}`}
                  className="p-1.5 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                </button>
              )}
              {!isOwner && (
                <button
                  type="button"
                  onClick={requestConfirm}
                  title={isPending ? 'Revogar convite' : 'Remover membro'}
                  aria-label={isPending ? `Revogar convite de ${displayName}` : `Remover ${displayName}`}
                  className="p-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            {resendSuccess && (
              <p className="text-xs text-emerald-400" role="status">
                Convite reenviado com sucesso.
              </p>
            )}
            {actionError && (
              <p role="alert" className="text-xs text-red-400 text-right">
                {actionError}
              </p>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

export function TeamManagementPanel() {
  const { tenantId, tenantQuery } = useActiveTenant();
  const { members, loading, error, reload, updateMember, removeMember, resendInvite } = useTeamMembers(
    tenantId,
    tenantQuery
  );

  const [showInviteModal, setShowInviteModal] = useState(false);

  if (!tenantId) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 p-4 rounded-xl text-sm">
        Selecione um tenant ativo para gerenciar a equipe.
      </div>
    );
  }

  if (loading) {
    return <div className="text-slate-500 text-sm">Carregando equipe…</div>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start text-sm">
          <AlertTriangle className="w-5 h-5 mr-3 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <div className="bg-[#111318] border border-white/5 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-500" />
              Equipe do Tenant
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Convide colegas, defina o papel de cada um e controle o acesso à configuração de provedores de IA.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center justify-center gap-2 bg-emerald-500 text-black px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-emerald-400 transition-colors shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            Convidar membro
          </button>
        </div>

        {members.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-sm">
            Nenhum membro na equipe ainda. Convide o primeiro colega para começar.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full min-w-[620px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-3 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Membro</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Papel</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">IA</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider w-28">Ações</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    onSave={updateMember}
                    onRemoveOrRevoke={removeMember}
                    onResend={resendInvite}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showInviteModal && (
        <TeamInviteModal
          tenantId={tenantId}
          tenantQuery={tenantQuery}
          onClose={() => setShowInviteModal(false)}
          onInvited={() => {
            setShowInviteModal(false);
            reload();
          }}
        />
      )}
    </div>
  );
}
