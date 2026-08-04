import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const isBrowser = typeof window !== 'undefined';

// Usamos createBrowserClient do @supabase/ssr para persistir a sessão em COOKIES
// (sb-<project-ref>-auth-token), em alinhamento com o middleware.ts. Assim o edge
// middleware consegue ler a sessão e validar o acesso às rotas protegidas.
export const supabase = supabaseUrl && supabaseAnonKey && isBrowser
  ? createBrowserClient(supabaseUrl, supabaseAnonKey)
  : null as any;