'use client';

import { useState, useEffect, useRef } from 'react';
import { LogOut, CircleHelp, Bell, CheckCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useActiveTenant } from '@/hooks/use-active-tenant';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { fetcher, fetchWithAuth } from '@/lib/api';
import type { NotificationsResponse } from '@/lib/types';
import Link from 'next/link';

export function Header() {
  const router = useRouter();
  const { user, profile, tenantPath, tenantQuery } = useActiveTenant();
  const withTenant = (href: string) => href === '/admin/users' ? href : `${href}${tenantPath}`;

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationsResponse['notifications']>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const userName = profile?.name || user?.user_metadata?.full_name || user?.user_metadata?.name || (user?.email ? user.email.split('@')[0] : 'Painel do Advogado');

  const fetchNotifications = async () => {
    if (!user?.id || !tenantQuery) return;
    setLoading(true);
    try {
      const res = await fetcher(`/api/notifications?limit=8${tenantQuery ? `&${tenantQuery}` : ''}`);
      setNotifications((res as NotificationsResponse)?.notifications || []);
      setUnread((res as NotificationsResponse)?.unread || 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Polling curto como fallback + badge em tempo real
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, tenantQuery]);

  // Realtime: badge no header sem refresh
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const channel = client
      .channel('header-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        fetchNotifications();
      })
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, tenantQuery]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllRead = async () => {
    if (!unread) return;
    // Marca individualmente a partir da lista carregada
    const pending = notifications.filter((n) => !n.read_at);
    await Promise.all(
      pending.map((n) =>
        fetchWithAuth(`/api/notifications/${n.id}?${tenantQuery}`, {
          method: 'PATCH',
          body: JSON.stringify({ read: true }),
        })
      )
    );
    await fetchNotifications();
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      router.push('/login');
    }
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    if (!email) return 'AD';
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <header className="relative shrink-0 border-b border-white/5 bg-[#111318]">
      <div className="h-14 px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <SidebarTrigger data-tour="mobile-menu-trigger" />
        </div>

        <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
          <span className="text-slate-500 hidden lg:inline">{userName}</span>
          <div className="w-px h-5 sm:h-6 bg-white/10 hidden sm:block"></div>

          {/* Notificações */}
          <div ref={bellRef} className="relative">
            <button
              type="button"
              onClick={() => {
                if (!open) fetchNotifications();
                setOpen((prev) => !prev);
              }}
              className="relative p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              title="Notificações"
              aria-label="Notificações"
            >
              <Bell className="w-4 h-4" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-white/10 bg-[#1a1e26] shadow-2xl overflow-hidden z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Notificações</span>
                  {unread > 0 && (
                    <button
                      onClick={markAllRead}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300"
                    >
                      <CheckCheck className="w-3 h-3" />
                      Marcar todas como lidas
                    </button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {loading ? (
                    <div className="px-4 py-6 text-center text-xs text-slate-400">Carregando...</div>
                  ) : notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-slate-400">Nenhuma notificação.</div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors ${!n.read_at ? 'bg-emerald-500/5' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className={`text-xs text-white font-semibold ${!n.read_at ? 'text-emerald-300' : ''}`}>
                              {n.title}
                            </p>
                            {n.body && <p className="mt-0.5 text-[11px] text-slate-400 line-clamp-2">{n.body}</p>}
                            <p className="mt-1 text-[10px] text-slate-500">
                              {new Date(n.created_at).toLocaleString('pt-BR')}
                            </p>
                          </div>
                          {n.related_case_id && (
                            <Link
                              href={`/cases/${n.related_case_id}${tenantPath}`}
                              onClick={() => setOpen(false)}
                              className="shrink-0 text-[10px] font-semibold text-emerald-400 hover:underline"
                            >
                              Ver caso
                            </Link>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            data-tour="guided-tour-trigger"
            onClick={() => window.dispatchEvent(new Event('cobrancaia:start-tour'))}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            title="Abrir tour guiado"
            aria-label="Abrir tour guiado"
          >
            <CircleHelp className="w-4 h-4" />
          </button>
          <Link href={withTenant('/settings')} data-tour="header-settings" className="hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-medium text-xs shadow-lg shrink-0">
              {getInitials(profile?.name || user?.user_metadata?.name, user?.email)}
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="text-slate-400 hover:text-white transition-colors p-2"
            title="Sair"
            aria-label="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}