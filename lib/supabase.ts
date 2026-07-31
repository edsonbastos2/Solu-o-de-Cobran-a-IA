import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const isBrowser = typeof window !== 'undefined';

const cookieStorage = {
  getItem: (key: string) => {
    if (!isBrowser) return null;
    const match = document.cookie.match(new RegExp('(^| )' + key + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  },
  setItem: (key: string, value: string) => {
    if (!isBrowser) return;
    // Expiration set to 24 hours (86400 seconds)
    const maxAge = 24 * 60 * 60;
    document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax; secure`;
  },
  removeItem: (key: string) => {
    if (!isBrowser) return;
    document.cookie = `${key}=; path=/; max-age=0; SameSite=Lax; secure`;
  }
};

// Create a dummy client if keys are missing to prevent crash during build/startup.
// Real API calls will fail, which is expected until configured.
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: cookieStorage,
        storageKey: 'supabase-auth-token',
        flowType: 'pkce'
      }
    })
  : null as any; // Using any to avoid type issues, but we'll check it in components.

