import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const isBrowser = typeof window !== 'undefined';

// Create a client if keys are present.
// Usamos a configuração padrão de cookies do supabase-js v2 (storage key = sb-<project-ref>-auth-token),
// em alinhamento com @supabase/ssr usado no middleware.ts. Mantemos localStorage fallback só em
// ambientes cruzados que ainda precisem dele (sem impactar o cookie principal).
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: isBrowser
      }
    })
  : null as any;