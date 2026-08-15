'use client';

import { INVITABLE_ROLES, InvitableRole, ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/team-roles-client';

export interface RoleSelectFieldProps {
  id: string;
  value: InvitableRole;
  onChange: (role: InvitableRole) => void;
  disabled?: boolean;
}

// Select de papel convidável (admin/gestor/operador) com a descrição em
// linguagem simples do papel selecionado logo abaixo — compartilhado entre
// o modal de convite e a edição inline de um membro existente.
export function RoleSelectField({ id, value, onChange, disabled }: RoleSelectFieldProps) {
  return (
    <div>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as InvitableRole)}
        className="w-full bg-[#0e1014] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {INVITABLE_ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
      <p className="text-xs text-slate-500 mt-1.5">{ROLE_DESCRIPTIONS[value]}</p>
    </div>
  );
}
