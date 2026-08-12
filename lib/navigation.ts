import { Bot, Cpu, FolderKanban, Handshake, LayoutDashboard, Settings, Shield, Users, ShieldAlert, MessageSquareText, FileUp, Ban, Landmark, Scale, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  section: 'operacao' | 'configuracao';
  adminOnly?: boolean;
  tenantAdminOnly?: boolean;
  dataTour?: string;
};

export type NavSection = {
  id: 'operacao' | 'configuracao';
  label: string;
  items: NavItem[];
};

export const navConfig: NavSection[] = [
  {
    id: 'operacao',
    label: 'Operação',
    items: [
      { label: 'Dashboard', href: '/', icon: LayoutDashboard, section: 'operacao' },
      { label: 'Casos (Ao Vivo)', href: '/cases', icon: FolderKanban, section: 'operacao' },
      { label: 'Acordos', href: '/negotiations', icon: Handshake, section: 'operacao' },
      { label: 'Contratos', href: '/contracts', icon: Bot, section: 'operacao' },
      { label: 'Clientes', href: '/clients', icon: Users, section: 'operacao' },
      { label: 'Quarentena', href: '/quarantines', icon: ShieldAlert, section: 'operacao' },
      { label: 'Templates', href: '/templates', icon: MessageSquareText, section: 'operacao' },
      { label: 'Importação', href: '/import', icon: FileUp, section: 'operacao' },
      { label: 'Negativação', href: '/negativations', icon: Ban, section: 'operacao' },
      { label: 'Protesto', href: '/protests', icon: Landmark, section: 'operacao' },
      { label: 'Jurídico', href: '/legal', icon: Scale, section: 'operacao' },
    ],
  },
  {
    id: 'configuracao',
    label: 'Configuração',
    items: [
      { label: 'Agentes IA', href: '/agents', icon: Cpu, section: 'configuracao', tenantAdminOnly: true, dataTour: 'agents-nav' },
      { label: 'Políticas', href: '/policies', icon: Shield, section: 'configuracao', tenantAdminOnly: true, dataTour: 'policies-nav' },
      { label: 'Configurações', href: '/settings', icon: Settings, section: 'configuracao' },
      { label: 'Painel Admin', href: '/admin/users', icon: Shield, section: 'configuracao', adminOnly: true },
      { label: 'Padrões de IA', href: '/admin/ai-defaults', icon: Sparkles, section: 'configuracao', adminOnly: true },
    ],
  },
];
