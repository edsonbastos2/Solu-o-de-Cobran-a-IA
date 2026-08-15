// Helpers compartilhados pelas rotas de gestão de equipe
// (app/api/tenants/[id]/members/*) para classificar erros de
// supabaseAdmin.auth.admin.inviteUserByEmail() sem adivinhar a forma exata
// do erro do GoTrue — ver docs/1805-gestao-usuarios-tenant/adrs/adr-003.md.
import { isAuthApiError } from '@supabase/supabase-js';
import { TenantRole } from '@/lib/api-auth';

/** Papéis atribuíveis por convite — 'owner' nunca é convidado (ver ADR-003). */
export const INVITABLE_ROLES: readonly TenantRole[] = ['admin', 'gestor', 'operador'];

export function isInvitableRole(value: unknown): value is 'admin' | 'gestor' | 'operador' {
  return value === 'admin' || value === 'gestor' || value === 'operador';
}

/**
 * true quando o erro do inviteUserByEmail indica que o e-mail já pertence a
 * um usuário existente (auth.users), em qualquer tenant. O código exato varia
 * por versão do GoTrue (`email_exists`, `user_already_exists`,
 * `identity_already_exists`), então checamos o `code` tipado primeiro e
 * caímos para um match de mensagem apenas como rede de segurança.
 */
export function isDuplicateInviteError(error: unknown): boolean {
  if (!isAuthApiError(error)) return false;
  const code = error.code ?? '';
  if (code === 'email_exists' || code === 'user_already_exists' || code === 'identity_already_exists') {
    return true;
  }
  return /already registered|already exists|already been registered/i.test(error.message);
}

/**
 * true quando o erro do inviteUserByEmail indica falha na ENTREGA do e-mail
 * (ex.: SMTP não configurado no projeto Supabase) em vez de um erro de
 * validação/duplicidade. Heurística best-effort sobre a mensagem do GoTrue —
 * o Supabase não expõe um `code` dedicado para isso hoje.
 */
export function isEmailDeliveryError(error: unknown): boolean {
  if (!isAuthApiError(error)) return false;
  if (isDuplicateInviteError(error)) return false;
  return /smtp|sending|deliver|mail server|email provider/i.test(error.message);
}
