import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer, getSupabaseServerWithAdminFallback } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';

export interface AuthContext {
  userId: string;
  isSuperAdmin: boolean;
  currentTenantId: string | null;
}

export interface TenantContext extends AuthContext {
  tenantId: string;
  role: 'owner' | 'admin' | 'member';
  supabase: NonNullable<ReturnType<typeof getSupabaseServer>>;
}

/** Retorna 401 se não houver sessão; caso contrário, userId + flag superadmin. */
export async function requireUser(req: NextRequest): Promise<{ ctx: AuthContext } | { response: NextResponse }> {
  const supabase = getSupabaseServer(req);
  if (!supabase) {
    return { response: NextResponse.json({ error: 'Servidor não configurado.' }, { status: 500 }) };
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { response: NextResponse.json({ error: 'Não autorizado.' }, { status: 401 }) };
  }
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('is_super_admin, current_tenant_id')
    .eq('id', user.id)
    .maybeSingle();
  if (profileErr) logger.warn('[requireUser] profiles query error', { userId: user.id }, { error: profileErr.message });
  return {
    ctx: {
      userId: user.id,
      isSuperAdmin: profile?.is_super_admin === true,
      currentTenantId: profile?.current_tenant_id ?? null,
    },
  };
}

/** Requer superadmin; retorna 403 caso contrário. */
export async function requireSuperAdmin(req: NextRequest): Promise<{ ctx: AuthContext } | { response: NextResponse }> {
  const r = await requireUser(req);
  if ('response' in r) return r;
  if (!r.ctx.isSuperAdmin) {
    return { response: NextResponse.json({ error: 'Acesso negado.' }, { status: 403 }) };
  }
  return r;
}

/**
 * Resolve o tenant no servidor. Um tenant vindo da URL só é considerado para
 * super-admin e precisa existir; sem override explícito, o super-admin usa o
 * contexto persistido (profiles.current_tenant_id); usuários regulares usam
 * sua membership ativa.
 */
export async function requireTenantContext(
  req: NextRequest,
  requestedTenantId?: string | null
): Promise<{ ctx: TenantContext } | { response: NextResponse }> {
  const auth = await requireUser(req);
  if ('response' in auth) return auth;

  const supabase = auth.ctx.isSuperAdmin
    ? await getSupabaseServerWithAdminFallback(req)
    : getSupabaseServer(req);
  if (!supabase) {
    return { response: NextResponse.json({ error: 'Servidor não configurado.' }, { status: 500 }) };
  }

  const { ctx: authContext } = auth;
  let tenantId: string | null = null;
  let role: TenantContext['role'] = 'member';

  if (authContext.isSuperAdmin) {
    role = 'owner';
    const candidateTenantId = requestedTenantId ?? authContext.currentTenantId;
    if (!candidateTenantId) {
      return { response: NextResponse.json({ error: 'Tenant explícito é obrigatório para esta operação.', code: 'TENANT_REQUIRED' }, { status: 400 }) };
    }

    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', candidateTenantId)
      .eq('status', 'active')
      .maybeSingle();

    if (error || !tenant) {
      return { response: NextResponse.json({ error: 'Tenant não encontrado.', code: 'TENANT_NOT_FOUND' }, { status: 404 }) };
    }
    tenantId = tenant.id;
  } else {
    const { data: membership, error } = await supabase
      .from('tenant_members')
      .select('tenant_id, role')
      .eq('user_id', authContext.userId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !membership) {
      return { response: NextResponse.json({ error: 'Tenant ativo não encontrado.', code: 'TENANT_NOT_FOUND' }, { status: 404 }) };
    }

    const { data: activeTenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', membership.tenant_id)
      .eq('status', 'active')
      .maybeSingle();
    if (tenantError || !activeTenant) {
      return { response: NextResponse.json({ error: 'Tenant ativo não encontrado.', code: 'TENANT_NOT_FOUND' }, { status: 404 }) };
    }

    if (requestedTenantId && requestedTenantId !== membership.tenant_id) {
      return { response: NextResponse.json({ error: 'Acesso negado.', code: 'TENANT_FORBIDDEN' }, { status: 404 }) };
    }
    tenantId = membership.tenant_id;
    const memberRole = String(membership.role || 'member').toLowerCase();
    role = memberRole === 'owner' || memberRole === 'admin' ? memberRole : 'member';
  }

  if (!tenantId) {
    return { response: NextResponse.json({ error: 'Tenant não encontrado.', code: 'TENANT_NOT_FOUND' }, { status: 404 }) };
  }
  return { ctx: { ...authContext, tenantId, role, supabase } };
}

/**
 * Exige um papel mínimo (owner > admin > member) no tenant ativo.
 * Retorna 403 se o papel do usuário for insuficiente.
 */
export async function requireRole(
  req: NextRequest,
  minRole: 'owner' | 'admin' | 'member',
  requestedTenantId?: string | null
): Promise<{ ctx: TenantContext } | { response: NextResponse }> {
  const result = await requireTenantContext(req, requestedTenantId);
  if ('response' in result) return result;

  const ROLE_RANK: Record<'owner' | 'admin' | 'member', number> = { owner: 3, admin: 2, member: 1 };
  if (ROLE_RANK[result.ctx.role] < ROLE_RANK[minRole]) {
    return { response: NextResponse.json({ error: 'Permissão insuficiente para realizar esta ação.' }, { status: 403 }) };
  }
  return result;
}

/** Erro genérico 500 sem vazar detalhes internos. */
export function serverError(logMessage: string, err?: unknown, includeDebug?: boolean) {
  logger.error(logMessage, undefined, { error: err instanceof Error ? err.message : String(err) });
  const debug = includeDebug && err instanceof Error ? err.message : undefined;
  const body: Record<string, unknown> = { error: 'Erro interno do servidor.' };
  if (debug) body.debug = debug;
  return NextResponse.json(body, { status: 500 });
}
