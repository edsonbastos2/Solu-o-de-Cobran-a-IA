import { createClient } from '@supabase/supabase-js';

export function getSupabaseServer(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  const authHeader = req.headers.get('authorization');
  
  if (!supabaseUrl || !supabaseAnonKey) return null;
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader || ''
      }
    },
    auth: {
      persistSession: false,
    }
  });
}
