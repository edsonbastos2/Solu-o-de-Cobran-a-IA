import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const isBrowser = typeof window !== 'undefined';

const customStorage = {
  getItem: (key: string) => {
    if (!isBrowser) return null;
    try {
      const localVal = localStorage.getItem(key);
      if (localVal) return localVal;
    } catch (e) {
      // localStorage may fail in restricted sandboxes
    }
    try {
      const match = document.cookie.match(new RegExp('(^| )' + key + '=([^;]+)'));
      return match ? decodeURIComponent(match[2]) : null;
    } catch (e) {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    if (!isBrowser) return;
    try {
      localStorage.setItem(key, value);
    } catch (e) {}
    try {
      const isSecure = window.location.protocol === 'https:';
      const maxAge = 30 * 24 * 60 * 60; // 30 dias
      document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${isSecure ? '; secure' : ''}`;
    } catch (e) {}
  },
  removeItem: (key: string) => {
    if (!isBrowser) return;
    try {
      localStorage.removeItem(key);
    } catch (e) {}
    try {
      document.cookie = `${key}=; path=/; max-age=0; SameSite=Lax`;
    } catch (e) {}
  }
};

// Create a client if keys are present
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: customStorage,
        storageKey: 'supabase-auth-token',
        flowType: 'pkce'
      }
    })
  : null as any;


