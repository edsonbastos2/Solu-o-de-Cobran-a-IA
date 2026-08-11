import { useState, useEffect } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';

export type UserProfile = {
  id: string;
  is_super_admin: boolean;
  email?: string;
  name?: string | null;
  phone?: string | null;
  tenant_id?: string | null;
  current_tenant_id?: string | null;
  ai_provider?: string | null;
  ai_model?: string | null;
  messaging_provider?: string | null;
  zapi_instance?: string | null;
};

export type TenantRole = 'owner' | 'admin' | 'member';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<TenantRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setTimeout(() => setLoading(false), 0);
      return;
    }

    const fetchProfile = async (userId: string) => {
      try {
        const { data } = await client
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        setProfile(data);
        const { data: membership } = await client
          .from('tenant_members')
          .select('role')
          .eq('user_id', userId)
          .eq('status', 'active')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (membership?.role) {
          const r = String(membership.role).toLowerCase();
          setRole(r === 'owner' || r === 'admin' || r === 'member' ? r : 'member');
        }
      } catch (error: unknown) {
        console.error('Error fetching profile:', error);
      }
    };

// Get initial session
    client.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setRole(null);
        setLoading(false);
      }
    });

    // Listen for changes
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setProfile(null);
        setRole(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { user, profile, role, session, loading, isConfigured: isSupabaseConfigured };
}

