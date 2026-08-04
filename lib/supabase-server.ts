import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Cliente server-side que lê a sessão via cookies (compatível com o client browser e middleware).
 * Usa @supabase/ssr createServerClient, que automaticamente extrai sb-<ref>-auth-token.
 */
export function getSupabaseServer(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) return null;

  // Em Route Handlers (Next 15), req é NextRequest que herda de Request e implementa cookies().
  const cookieStore = (req as any).cookies;
  if (!cookieStore || typeof cookieStore.getAll !== 'function') {
    // Fallback: cliente sem cookies (não autenticado por padrão)
    return null;
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map((c: any) => ({ name: c.name, value: c.value }));
      },
      setAll() {
        // Route handlers não podem setar cookies da response aqui; ignoramos (client cuida do refresh)
      },
    },
  });
}

/**
 * Retorna adminClient (service role) se o usuário autenticado for superadmin.
 * Caso contrário retorna o client server normal (RLS-enforced).
 */
export async function getSupabaseServerWithAdminFallback(req: Request) {
  const serverClient = getSupabaseServer(req);
  if (!serverClient) return null;

  const adminClient = getSupabaseAdmin();
  if (!adminClient) return serverClient;

  try {
    const { data: { user } } = await serverClient.auth.getUser();
    if (user) {
      const { data: profile } = await adminClient.from('profiles').select('is_super_admin').eq('id', user.id).maybeSingle();
      if (profile?.is_super_admin === true) {
        return adminClient;
      }
    }
  } catch (err) {
    console.error('Error checking user in server client:', err);
  }

  return serverClient;
}