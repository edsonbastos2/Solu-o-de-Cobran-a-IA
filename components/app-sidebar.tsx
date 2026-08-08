'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot } from 'lucide-react';
import { navConfig } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { useActiveTenant } from '@/hooks/use-active-tenant';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { TenantSwitcher } from '@/components/tenant-switcher';

type AppSidebarProps = {
  collapsible?: 'offcanvas' | 'icon' | 'none';
};

export function AppSidebar({ collapsible = 'icon' }: AppSidebarProps) {
  const pathname = usePathname();
  const { user, profile, tenantPath } = useActiveTenant();
  const { isMobile, state, setOpenMobile } = useSidebar();

  const isSuperAdmin = profile?.is_super_admin === true;
  const withTenant = (href: string) => (href === '/admin/users' ? href : `${href}${tenantPath}`);

  const isActive = (href: string, exact: boolean) => {
    if (exact) return pathname === href;
    return pathname?.startsWith(href) ?? false;
  };

  const userName =
    profile?.name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    (user?.email ? user.email.split('@')[0] : 'Painel do Advogado');

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

  const sections = navConfig
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.adminOnly || isSuperAdmin),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <Sidebar collapsible={collapsible}>
      <SidebarHeader>
        <Link
          href={withTenant('/')}
          data-tour="app-logo"
          className="flex items-center gap-2.5 px-2 pt-1 transition-opacity hover:opacity-80 group-data-[collapsible=icon]:justify-center"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500 shadow-lg shadow-emerald-500/20">
            <Bot className="h-5 w-5 text-black" />
          </div>
          <span className="truncate text-base font-bold tracking-tight text-white group-data-[collapsible=icon]:hidden">
            CobrançaIA
          </span>
        </Link>
        {isSuperAdmin && (
          <div className="group-data-[collapsible=icon]:hidden">
            <TenantSwitcher />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.id}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href, item.href === '/');
                  const dataTour = item.dataTour ? `${item.dataTour}-${isMobile ? 'mobile' : 'desktop'}` : undefined;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        aria-current={active ? 'page' : undefined}
                        title={state === 'collapsed' || isMobile ? item.label : undefined}
                        onClick={() => {
                          if (isMobile) setOpenMobile(false);
                        }}
                        data-tour={dataTour}
                        className={cn(
                          item.adminOnly && !active && 'text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300',
                          item.adminOnly && active && 'bg-emerald-500/15 text-emerald-400',
                        )}
                      >
                        <Link href={withTenant(item.href)}>
                          <Icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2.5 px-2 py-1 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-xs font-medium text-white">
            {getInitials(profile?.name || user?.user_metadata?.name, user?.email)}
          </div>
          <span className="truncate text-sm text-slate-300 group-data-[collapsible=icon]:hidden">{userName}</span>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}