'use client';

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Header } from '@/components/header';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      {/* O shell ocupa exatamente a altura da viewport: a janela nunca rola, o
          scroll fica no container de conteúdo. Assim as páginas podem usar
          h-full para preencher a tela sem depender da altura do Header. */}
      <SidebarInset className="h-svh overflow-hidden">
        <Header />
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}