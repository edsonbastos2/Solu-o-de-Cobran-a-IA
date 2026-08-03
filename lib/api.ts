import { supabase } from '@/lib/supabase';

export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  let token: string | undefined;
  
  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token;
    } catch (e) {}
  }
  
  if (!token && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('supabase-auth-token');
      if (stored) {
        const parsed = JSON.parse(stored);
        token = parsed?.access_token || parsed?.currentSession?.access_token;
      }
    } catch (e) {}

    if (!token) {
      try {
        const match = document.cookie.match(new RegExp('(^| )supabase-auth-token=([^;]+)'));
        if (match) {
          const parsed = JSON.parse(decodeURIComponent(match[2]));
          token = parsed?.access_token || parsed?.currentSession?.access_token;
        }
      } catch (e) {}
    }
  }

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  return fetch(url, {
    ...options,
    headers
  });
};

export const fetcher = async (url: string) => {
  const res = await fetchWithAuth(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erro ao carregar os dados');
  }
  return res.json();
};
