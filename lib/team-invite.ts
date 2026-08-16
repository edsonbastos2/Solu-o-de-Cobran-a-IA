// Helpers compartilhados pelas rotas de gestão de equipe
// (app/api/tenants/[id]/members/*): classificação de erros do Admin API do
// Supabase Auth (generateLink) e montagem do contexto usado no e-mail de
// convite próprio (Resend) — ver docs/1805-gestao-usuarios-tenant/adrs/adr-003.md.
import { isAuthApiError, SupabaseClient } from '@supabase/supabase-js';
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

/** Base pública da aplicação usada para montar URLs de convite/recovery. */
function appBaseUrl(): string {
  return (process.env.APP_URL || '').replace(/\/+$/, '');
}

/**
 * Monta a URL de convite enviada por e-mail apontando para nossa própria rota
 * de confirmação (`/convite/confirmar`) em vez do `action_link` bruto do
 * Supabase. Motivo: o `action_link` consome o token com um simples GET no
 * `/auth/v1/verify` do Supabase e devolve a sessão via hash fragment — isso
 * quebra com scanners de segurança de e-mail que pré-visitam links (ex.: Safe
 * Links do Outlook/Hotmail) e não é compatível com o client cookie-based do
 * @supabase/ssr. Usando `hashed_token` + nossa rota `/convite/confirmar`
 * (que chama `verifyOtp` server-side e seta a sessão via cookies na resposta),
 * o token só é consumido quando o usuário efetivamente abre nossa página.
 */
export function buildConfirmUrl(tokenHash: string, type: string, next: string = '/convite/aceitar'): string {
  const params = new URLSearchParams({ token_hash: tokenHash, type, next });
  return `${appBaseUrl()}/convite/confirmar?${params.toString()}`;
}

/**
 * Resolve o nome do tenant e do convidante para personalizar o e-mail de
 * convite. Usa fallbacks genéricos quando o nome não está preenchido —
 * nunca bloqueia o envio por falta desse dado cosmético.
 */
export async function resolveInviteEmailContext(
  admin: SupabaseClient,
  tenantId: string,
  actorUserId: string
): Promise<{ tenantName: string; inviterName: string }> {
  const [{ data: tenantRow }, { data: inviterProfile }] = await Promise.all([
    admin.from('tenants').select('name').eq('id', tenantId).maybeSingle(),
    admin.from('profiles').select('name').eq('id', actorUserId).maybeSingle(),
  ]);
  return {
    tenantName: tenantRow?.name || 'seu time',
    inviterName: inviterProfile?.name || 'Um administrador',
  };
}
