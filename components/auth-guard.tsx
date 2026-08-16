'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { GuidedTour } from '@/components/guided-tour';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, isConfigured } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // /convite/* também é público: a página de aceite de convite roda antes de
  // qualquer sessão própria existir (a sessão é estabelecida pelo próprio
  // Supabase a partir do link do e-mail, já dentro da página) — ver ticket 1805.
  const isPublicRoute = pathname === '/login' || pathname.startsWith('/convite');

  useEffect(() => {
    if (isConfigured && !loading && !user && !isPublicRoute) {
      router.push('/login');
    }
  }, [isConfigured, user, loading, router, isPublicRoute]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0d10] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Demo mode intentionally renders the app without an auth session.
  if (isConfigured && !user && !isPublicRoute) {
    return null;
  }

  return (
    <>
      {children}
      <GuidedTour userId={user?.id ?? null} loading={loading} isConfigured={isConfigured} />
    </>
  );
}
