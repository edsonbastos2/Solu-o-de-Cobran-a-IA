'use client';

import { Bot, LogOut, Shield, Users, LayoutDashboard, Cpu } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const isSuperAdmin = user?.email === 'bastose132@gmail.com';

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      router.push('/login');
    }
  };

  const getInitials = (email?: string) => {
    if (!email) return 'AD';
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <header className="h-16 border-b border-white/5 bg-[#111318] px-4 sm:px-8 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5 sm:gap-3 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
            <Bot className="w-5 h-5 text-black" />
          </div>
          <span className="font-bold text-white tracking-tight text-base sm:text-lg">CobrançaIA</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-4 border-l border-white/10 pl-6">
          <Link
            href="/"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              pathname === '/' || pathname?.startsWith('/cases')
                ? 'bg-white/10 text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Casos
          </Link>
          <Link
            href="/debtors"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              pathname?.startsWith('/debtors')
                ? 'bg-white/10 text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-4 h-4" />
            Devedores
          </Link>
          <Link
            href="/agents"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              pathname?.startsWith('/agents')
                ? 'bg-white/10 text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Cpu className="w-4 h-4" />
            Agentes IA
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm">
        <Link
          href="/agents"
          className={`md:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
            pathname?.startsWith('/agents') ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Cpu className="w-4 h-4" />
          Agentes
        </Link>
        {isSuperAdmin && (
          <Link href="/admin/users" className="hidden sm:flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-md hover:bg-emerald-500/20 transition-colors font-medium border border-emerald-500/20">
            <Shield className="w-4 h-4" />
            Painel Admin
          </Link>
        )}
        <span className="text-slate-500 hidden lg:inline">{user?.email || 'Painel do Advogado'}</span>
        <div className="w-px h-5 sm:h-6 bg-white/10 hidden sm:block"></div>
        <Link href="/settings" className="hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-medium text-xs shadow-lg shrink-0">
            {getInitials(user?.email)}
          </div>
        </Link>
        <button
          onClick={handleLogout}
          className="text-slate-400 hover:text-white transition-colors p-2"
          title="Sair"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

