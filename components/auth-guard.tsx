'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { GuidedTour } from '@/components/guided-tour';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, isConfigured } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isConfigured && !loading && !user && pathname !== '/login') {
      router.push('/login');
    }
  }, [isConfigured, user, loading, router, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0d10] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Demo mode intentionally renders the app without an auth session.
  if (isConfigured && !user && pathname !== '/login') {
    return null;
  }

  return (
    <>
      {children}
      <GuidedTour userId={user?.id ?? null} loading={loading} isConfigured={isConfigured} />
    </>
  );
}
