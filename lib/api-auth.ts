import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

export interface AuthContext {
  userId: string;
  isSuperAdmin: boolean;
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
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .maybeSingle();
  return { ctx: { userId: user.id, isSuperAdmin: profile?.is_super_admin === true } };
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

/** Erro genérico 500 sem vazar detalhes internos. */
export function serverError(logMessage: string, err?: unknown) {
  console.error(logMessage, err);
  return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
}