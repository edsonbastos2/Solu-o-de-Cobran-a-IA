import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { AuthGuard } from '@/components/auth-guard';
import { HelpChat } from '@/components/help-chat';

export const metadata: Metadata = {
  title: 'SaaS Recuperação de Crédito',
  description: 'Plataforma SaaS multiempresa de recuperação de crédito com IA',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR">
      <body suppressHydrationWarning>
        <AuthGuard>
          {children}
          <HelpChat />
        </AuthGuard>
      </body>
    </html>
  );
}
