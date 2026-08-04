import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export function getSupabaseServer(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  const authHeader = req.headers.get('authorization') || '';
  
  if (!supabaseUrl || !supabaseAnonKey) return null;
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader
      }
    },
    auth: {
      persistSession: false,
    }
  });
}

export async function getSupabaseServerWithAdminFallback(req: Request) {
  const serverClient = getSupabaseServer(req);
  if (!serverClient) return null;

  const adminClient = getSupabaseAdmin();
  if (!adminClient) return serverClient;

  try {
    const { data: { user } } = await serverClient.auth.getUser();
    if (user) {
      const { data: profile } = await adminClient.from('profiles').select('is_super_admin, email').eq('id', user.id).maybeSingle();
      const isSuper = profile?.is_super_admin === true;
      if (isSuper) {
        return adminClient;
      }
      return serverClient;
    }
  } catch (err) {
    console.error('Error checking user in server client:', err);
  }

  // Default to serverClient (RLS-protected). Never fall back to admin client for unauthenticated requests.
  return serverClient;
}

