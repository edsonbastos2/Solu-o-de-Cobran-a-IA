'use client';

import { useEffect, useState } from 'react';
import { Loader2, UserPlus, X } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';
import { RoleSelectField } from '@/components/team-role-select-field';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { InvitableRole } from '@/lib/team-roles-client';

interface InviteFormState {
  email: string;
  role: InvitableRole;
  canConfigureAI: boolean;
}

const EMPTY_INVITE_FORM: InviteFormState = { email: '', role: 'operador', canConfigureAI: false };

export interface TeamInviteModalProps {
  tenantId: string;
  tenantQuery: string;
  onInvited: () => void;
  onClose: () => void;
}

// Modal de convite de membro — busca/chama `POST /api/tenants/[id]/members/invite`
// internamente e só notifica o pai em sucesso (`onInvited`), para que ele
// revalide a listagem. Estado de formulário/erro/loading é local ao modal.
export function TeamInviteModal({ tenantId, tenantQuery, onInvited, onClose }: TeamInviteModalProps) {
  const [form, setForm] = useState<InviteFormState>(EMPTY_INVITE_FORM);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fecha o modal com Esc (exceto durante o envio).
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !inviting) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [inviting, onClose]);

  const handleClose = () => {
    if (inviting) return;
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = form.email.trim();
    if (!email) {
      setError('Informe um e-mail.');
      return;
    }
    setInviting(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/tenants/${tenantId}/members/invite?${tenantQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          role: form.role,
          canConfigureAI: form.canConfigureAI,
        }),
      });
      const data = await res.json().catch(() => ({}));
      // As mensagens de erro do endpoint já são específicas por status
      // (409 e-mail já registrado, 502 entrega de e-mail indisponível,
      // 429 limite de convites, 400 validação) — repassadas ao usuário.
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar o convite. Tente novamente.');
      onInvited();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar o convite. Tente novamente.');
    } finally {
      setInviting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={handleClose}
    >
      <div
        className="bg-[#111318] border border-white/10 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-500" />
            Convidar membro
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={inviting}
            aria-label="Fechar"
            className="p-1 text-slate-400 hover:text-white disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label htmlFor="invite-email" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
              E-mail
            </label>
            <input
              id="invite-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="colega@empresa.com"
              className="w-full bg-[#0e1014] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="invite-role" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
              Papel
            </label>
            <RoleSelectField
              id="invite-role"
              value={form.role}
              onChange={(role) => setForm((f) => ({ ...f, role }))}
              disabled={inviting}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0e1014] px-4 py-3">
            <div className="pr-4">
              <p className="text-sm text-slate-200">Pode configurar provedores de IA</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Concede esta permissão independentemente do papel escolhido acima.
              </p>
            </div>
            <ToggleSwitch
              checked={form.canConfigureAI}
              onChange={(next) => setForm((f) => ({ ...f, canConfigureAI: next }))}
              disabled={inviting}
              label="Pode configurar provedores de IA"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={inviting}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={inviting}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 transition-colors disabled:opacity-50"
            >
              {inviting && <Loader2 className="w-4 h-4 animate-spin" />}
              {inviting ? 'Enviando...' : 'Enviar convite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
