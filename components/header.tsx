'use client';

import { LogOut, CircleHelp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useActiveTenant } from '@/hooks/use-active-tenant';
import { SidebarTrigger } from '@/components/ui/sidebar';
import Link from 'next/link';

export function Header() {
  const router = useRouter();
  const { user, profile, tenantPath } = useActiveTenant();
  const withTenant = (href: string) => href === '/admin/users' ? href : `${href}${tenantPath}`;

  const userName = profile?.name || user?.user_metadata?.full_name || user?.user_metadata?.name || (user?.email ? user.email.split('@')[0] : 'Painel do Advogado');

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
    <header className="relative border-b border-white/5 bg-[#111318]">
      <div className="h-14 px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <SidebarTrigger data-tour="mobile-menu-trigger" />
        </div>

        <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
          <span className="text-slate-500 hidden lg:inline">{userName}</span>
          <div className="w-px h-5 sm:h-6 bg-white/10 hidden sm:block"></div>
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
