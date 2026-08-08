'use client';

import { useState } from 'react';
import { Bot, LogOut, Shield, Users, LayoutDashboard, Cpu, Menu, X, Settings, FolderKanban, CircleHelp, Handshake } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import { useActiveTenant } from '@/hooks/use-active-tenant';
import { TenantSwitcher } from '@/components/tenant-switcher';
import Link from 'next/link';

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, tenantPath } = useActiveTenant();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isSuperAdmin = profile?.is_super_admin === true;
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

  const navLinks = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { href: '/cases', label: 'Casos (Ao Vivo)', icon: FolderKanban, exact: false },
    { href: '/negotiations', label: 'Acordos', icon: Handshake, exact: false },
    { href: '/contracts', label: 'Contratos', icon: Bot, exact: false },
    { href: '/clients', label: 'Clientes', icon: Users, exact: false },
    { href: '/agents', label: 'Agentes IA', icon: Cpu, exact: false },
    { href: '/policies', label: 'Políticas', icon: Shield, exact: false },
  ];

  const isActive = (href: string, exact: boolean) => {
    if (exact) return pathname === href;
    return pathname?.startsWith(href);
  };

  return (
    <header className="relative border-b border-white/5 bg-[#111318]">
      <div className="h-16 px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-4 sm:gap-6">
          <button
            type="button"
            data-tour="mobile-menu-trigger"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            aria-label="Abrir menu de navegação"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

           <Link href={withTenant('/')} data-tour="app-logo" className="flex items-center gap-2.5 sm:gap-3 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <Bot className="w-5 h-5 text-black" />
            </div>
            <span className="font-bold text-white tracking-tight text-base sm:text-lg">CobrançaIA</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 ml-4 border-l border-white/10 pl-6">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href, link.exact);
              return (
                <Link
                  key={link.href}
                  href={withTenant(link.href)}
                  data-tour={link.href === '/agents' ? 'agents-nav-desktop' : link.href === '/policies' ? 'policies-nav-desktop' : undefined}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                    active
                      ? 'bg-white/10 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm">
          {isSuperAdmin && (
            <div className="hidden sm:block">
              <TenantSwitcher />
            </div>
          )}
          {isSuperAdmin && (
            <Link href="/admin/users" className="hidden sm:flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-md hover:bg-emerald-500/20 transition-colors font-medium border border-emerald-500/20">
              <Shield className="w-4 h-4" />
              Painel Admin
            </Link>
          )}
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

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/5 bg-[#161922] px-4 py-3 space-y-1 shadow-2xl">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 pt-1 pb-2">
            Navegação
          </div>
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href, link.exact);
            return (
              <Link
                key={link.href}
                href={withTenant(link.href)}
                data-tour={link.href === '/agents' ? 'agents-nav-mobile' : link.href === '/policies' ? 'policies-nav-mobile' : undefined}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-emerald-400' : 'text-slate-400'}`} />
                {link.label}
              </Link>
            );
          })}

          <div className="border-t border-white/5 pt-2 mt-2 space-y-1">
            <Link
               href={withTenant('/settings')}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === '/settings'
                  ? 'bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Settings className="w-4 h-4 text-slate-400" />
              Configurações
            </Link>

            {isSuperAdmin && (
              <div className="px-3 py-1">
                <TenantSwitcher />
              </div>
            )}

            {isSuperAdmin && (
              <Link
                href="/admin/users"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname?.startsWith('/admin')
                    ? 'bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/20'
                    : 'text-emerald-400 hover:bg-emerald-500/10'
                }`}
              >
                <Shield className="w-4 h-4 text-emerald-400" />
                Painel Admin
              </Link>
            )}

            <div className="px-3 pt-2 pb-1 text-xs text-slate-400 border-t border-white/5 mt-2 flex items-center justify-between">
              <span className="truncate max-w-[200px]">{userName}</span>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="text-red-400 hover:text-red-300 flex items-center gap-1.5 text-xs font-medium py-1 px-2 rounded hover:bg-red-500/10 transition-colors"
                aria-label="Sair"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}


