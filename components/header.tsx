'use client';

import { Bot, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

export function Header() {
  const router = useRouter();
  const { user } = useAuth();

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
      <Link href="/" className="flex items-center gap-2.5 sm:gap-3 hover:opacity-80 transition-opacity">
        <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
          <Bot className="w-5 h-5 text-black" />
        </div>
        <span className="font-bold text-white tracking-tight text-base sm:text-lg">CobrançaIA</span>
      </Link>
      <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm">
        <span className="text-slate-500 hidden xs:inline">{user?.email || 'Painel do Advogado'}</span>
        <div className="w-px h-5 sm:h-6 bg-white/10 hidden xs:block"></div>
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-medium text-xs shadow-lg shrink-0">
          {getInitials(user?.email)}
        </div>
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
