'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { PanelLeft } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const SIDEBAR_WIDTH = '16rem';
const SIDEBAR_WIDTH_MOBILE = '18rem';
const SIDEBAR_WIDTH_ICON = '3rem';
const SIDEBAR_KEYBOARD_SHORTCUT = 'b';

type SidebarContextValue = {
  state: 'expanded' | 'collapsed';
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar deve ser usado dentro de <SidebarProvider>.');
  }
  return context;
}

type SidebarCssVars = React.CSSProperties & {
  '--sidebar-width'?: string;
  '--sidebar-width-icon'?: string;
  '--sidebar-width-mobile'?: string;
};

// Substitui @radix-ui/react-slot: mescla props e className no único filho.
type SlotProps = React.HTMLAttributes<HTMLElement> & {
  children: React.ReactNode;
};

function Slot({ children, className, ...rest }: SlotProps) {
  const child = React.Children.only(children);
  if (!React.isValidElement<Record<string, unknown>>(child)) {
    return child;
  }
  return React.cloneElement(child, {
    ...rest,
    ...child.props,
    className: cn(child.props.className as string | undefined, className),
  });
}

type SidebarProviderProps = React.ComponentPropsWithoutRef<'div'> & {
  defaultOpen?: boolean;
};

export function SidebarProvider({ defaultOpen = true, className, style, children, ...props }: SidebarProviderProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(defaultOpen);
  const [openMobile, setOpenMobile] = React.useState(false);

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile((prev) => !prev);
    } else {
      setOpen((prev) => !prev);
    }
  }, [isMobile]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleSidebar();
        return;
      }
      if (event.key === 'Escape') {
        setOpenMobile(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  const state = open ? 'expanded' : 'collapsed';

  const contextValue = React.useMemo<SidebarContextValue>(
    () => ({ state, open, setOpen, openMobile, setOpenMobile, isMobile, toggleSidebar }),
    [state, open, setOpen, openMobile, setOpenMobile, isMobile, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        data-sidebar="wrapper"
        style={
          {
            '--sidebar-width': SIDEBAR_WIDTH,
            '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
            '--sidebar-width-mobile': SIDEBAR_WIDTH_MOBILE,
            ...style,
          } as SidebarCssVars
        }
        className={cn('flex min-h-svh w-full', className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

type SidebarProps = React.ComponentPropsWithoutRef<'div'> & {
  side?: 'left' | 'right';
  variant?: 'sidebar' | 'floating' | 'inset';
  collapsible?: 'offcanvas' | 'icon' | 'none';
};

export function Sidebar({ side = 'left', variant = 'sidebar', collapsible = 'offcanvas', className, children, ...props }: SidebarProps) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

  if (collapsible === 'none') {
    return (
      <div
        data-sidebar="sidebar"
        className={cn('flex h-full w-[var(--sidebar-width)] flex-col bg-[#111318] text-slate-400', className)}
        {...props}
      >
        {children}
      </div>
    );
  }

  // Drawer/overlay no mobile: backdrop fecha ao clicar fora, painel desliza.
  if (isMobile) {
    return (
      <>
        {openMobile && (
          <div
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => setOpenMobile(false)}
            aria-hidden="true"
          />
        )}
        <div
          data-sidebar="sidebar"
          data-mobile="true"
          role={openMobile ? 'dialog' : undefined}
          aria-modal={openMobile ? true : undefined}
          aria-label="Menu de navegação"
          inert={!openMobile}
          style={{ '--sidebar-width-mobile': SIDEBAR_WIDTH_MOBILE } as SidebarCssVars}
          className={cn(
            'fixed inset-y-0 z-50 flex w-[var(--sidebar-width-mobile)] max-w-[85vw] flex-col bg-[#111318] text-slate-400 shadow-2xl transition-transform duration-300 ease-in-out',
            side === 'left' ? 'left-0 border-r border-white/5' : 'right-0 border-l border-white/5',
            openMobile
              ? 'translate-x-0'
              : side === 'left'
                ? '-translate-x-full'
                : 'translate-x-full',
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </>
    );
  }

  return (
    <div
      data-state={state}
      data-collapsible={state === 'collapsed' ? collapsible : undefined}
      data-variant={variant}
      data-side={side}
      className={cn('group peer hidden text-slate-400 md:block', className)}
      {...props}
    >
      {/* Reserva o espaço do sidebar no fluxo do layout no desktop */}
      <div
        className={cn(
          'relative h-svh w-[var(--sidebar-width)] bg-transparent transition-[width] duration-200 ease-linear',
          'group-data-[collapsible=offcanvas]:w-0',
          variant === 'floating' || variant === 'inset'
            ? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+1rem)]'
            : 'group-data-[collapsible=icon]:w-[var(--sidebar-width-icon)]',
        )}
      />
      <div
        className={cn(
          'fixed inset-y-0 z-10 hidden h-svh w-[var(--sidebar-width)] transition-[left,right,width] duration-200 ease-linear md:flex',
          side === 'left'
            ? 'left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]'
            : 'right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]',
          variant === 'floating' || variant === 'inset'
            ? 'p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+1rem+2px)]'
            : 'group-data-[collapsible=icon]:w-[var(--sidebar-width-icon)] group-data-[side=left]:border-r group-data-[side=right]:border-l border-white/5',
          className,
        )}
        {...props}
      >
        <div data-sidebar="sidebar" className="flex h-full w-full flex-col bg-[#111318]">
          {children}
        </div>
      </div>
    </div>
  );
}

type SidebarInsetProps = React.ComponentPropsWithoutRef<'main'>;

export function SidebarInset({ className, ...props }: SidebarInsetProps) {
  return (
    <main
      className={cn(
        'relative flex min-w-0 flex-1 flex-col bg-[#111318]',
        'md:peer-data-[variant=inset]:m-2 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl',
        className,
      )}
      {...props}
    />
  );
}

type SidebarHeaderProps = React.ComponentPropsWithoutRef<'div'>;

export function SidebarHeader({ className, ...props }: SidebarHeaderProps) {
  return <div data-sidebar="header" className={cn('flex flex-col gap-2 p-2', className)} {...props} />;
}

type SidebarContentProps = React.ComponentPropsWithoutRef<'div'>;

export function SidebarContent({ className, ...props }: SidebarContentProps) {
  return (
    <div
      data-sidebar="content"
      className={cn('flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto', 'group-data-[collapsible=icon]:overflow-visible', className)}
      {...props}
    />
  );
}

type SidebarFooterProps = React.ComponentPropsWithoutRef<'div'>;

export function SidebarFooter({ className, ...props }: SidebarFooterProps) {
  return <div data-sidebar="footer" className={cn('flex flex-col gap-2 p-2', className)} {...props} />;
}

type SidebarGroupProps = React.ComponentPropsWithoutRef<'div'>;

export function SidebarGroup({ className, ...props }: SidebarGroupProps) {
  return <div data-sidebar="group" className={cn('relative flex w-full min-w-0 flex-col gap-1 p-2', className)} {...props} />;
}

type SidebarGroupLabelProps = React.ComponentPropsWithoutRef<'div'> & { asChild?: boolean };

export function SidebarGroupLabel({ className, asChild = false, ...props }: SidebarGroupLabelProps) {
  const Comp: React.ElementType = asChild ? Slot : 'div';
  return (
    <Comp
      data-sidebar="group-label"
      className={cn(
        'flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-semibold uppercase tracking-wider text-slate-500',
        'group-data-[collapsible=icon]:hidden',
        className,
      )}
      {...props}
    />
  );
}

type SidebarGroupContentProps = React.ComponentPropsWithoutRef<'div'>;

export function SidebarGroupContent({ className, ...props }: SidebarGroupContentProps) {
  return <div data-sidebar="group-content" className={cn('w-full text-sm', className)} {...props} />;
}

type SidebarMenuProps = React.ComponentPropsWithoutRef<'ul'>;

export function SidebarMenu({ className, ...props }: SidebarMenuProps) {
  return <ul data-sidebar="menu" className={cn('flex w-full min-w-0 flex-col gap-1', className)} {...props} />;
}

type SidebarMenuItemProps = React.ComponentPropsWithoutRef<'li'>;

export function SidebarMenuItem({ className, ...props }: SidebarMenuItemProps) {
  return <li data-sidebar="menu-item" className={cn('group/menu-item relative', className)} {...props} />;
}

const sidebarMenuButtonVariants = cva(
  cn(
    'peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none transition-colors',
    'focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:pointer-events-none disabled:opacity-50',
    'hover:bg-white/5 hover:text-white',
    'data-[active=true]:bg-white/10 data-[active=true]:font-medium data-[active=true]:text-white',
    'group-has-[[data-sidebar=menu-action]]/menu-item:pr-7',
    '[&>svg]:size-[1.125rem] [&>svg]:shrink-0',
    'group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:[&>svg]:size-4',
    'group-data-[collapsible=icon]:[&>span]:hidden',
  ),
  {
    variants: {
      variant: {
        default: 'text-slate-400',
        outline: 'border border-white/10 text-slate-400 hover:bg-white/5 hover:text-white',
      },
      size: {
        default: 'h-9 text-sm',
        sm: 'h-8 text-xs',
        lg: 'h-11 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

type SidebarMenuButtonProps = React.ComponentPropsWithoutRef<'button'> &
  VariantProps<typeof sidebarMenuButtonVariants> & {
    asChild?: boolean;
    isActive?: boolean;
  };

export function SidebarMenuButton({ asChild = false, isActive = false, variant = 'default', size = 'default', className, ...props }: SidebarMenuButtonProps) {
  const Comp: React.ElementType = asChild ? Slot : 'button';
  return (
    <Comp
      data-sidebar="menu-button"
      data-size={size}
      data-active={isActive}
      className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

type SidebarMenuActionProps = React.ComponentPropsWithoutRef<'button'> & {
  asChild?: boolean;
  showOnHover?: boolean;
};

export function SidebarMenuAction({ className, asChild = false, showOnHover = false, ...props }: SidebarMenuActionProps) {
  const Comp: React.ElementType = asChild ? Slot : 'button';
  return (
    <Comp
      data-sidebar="menu-action"
      className={cn(
        'absolute right-2 top-1.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-slate-400 outline-none transition-opacity hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-500/40 [&>svg]:size-4 [&>svg]:shrink-0',
        'group-data-[collapsible=icon]:hidden',
        showOnHover && 'group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 md:opacity-0',
        className,
      )}
      {...props}
    />
  );
}

type SidebarMenuBadgeProps = React.ComponentPropsWithoutRef<'div'>;

export function SidebarMenuBadge({ className, ...props }: SidebarMenuBadgeProps) {
  return (
    <div
      data-sidebar="menu-badge"
      className={cn(
        'pointer-events-none absolute right-3 top-1.5 flex h-5 min-w-5 select-none items-center justify-center rounded-md px-1.5 text-xs font-medium tabular-nums text-slate-400',
        'group-data-[collapsible=icon]:hidden',
        className,
      )}
      {...props}
    />
  );
}

type SidebarMenuSubProps = React.ComponentPropsWithoutRef<'ul'>;

export function SidebarMenuSub({ className, ...props }: SidebarMenuSubProps) {
  return (
    <ul
      data-sidebar="menu-sub"
      className={cn('mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-white/10 px-3 py-1', 'group-data-[collapsible=icon]:hidden', className)}
      {...props}
    />
  );
}

type SidebarMenuSubItemProps = React.ComponentPropsWithoutRef<'li'>;

export function SidebarMenuSubItem({ className, ...props }: SidebarMenuSubItemProps) {
  return <li data-sidebar="menu-sub-item" className={cn('relative', className)} {...props} />;
}

type SidebarMenuSubButtonProps = React.ComponentPropsWithoutRef<'a'> & {
  asChild?: boolean;
  size?: 'sm' | 'md';
  isActive?: boolean;
};

export function SidebarMenuSubButton({ asChild = false, size = 'md', isActive = false, className, ...props }: SidebarMenuSubButtonProps) {
  const Comp: React.ElementType = asChild ? Slot : 'a';
  return (
    <Comp
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        'flex h-7 min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 text-sm text-slate-400 outline-none transition-colors hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-500/40 [&>svg]:size-4 [&>svg]:shrink-0',
        'data-[active=true]:bg-white/10 data-[active=true]:font-medium data-[active=true]:text-white',
        'group-data-[collapsible=icon]:hidden',
        size === 'sm' && 'text-xs',
        className,
      )}
      {...props}
    />
  );
}

type SidebarTriggerProps = React.ComponentPropsWithoutRef<'button'>;

export function SidebarTrigger({ className, onClick, ...props }: SidebarTriggerProps) {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      type="button"
      data-sidebar="trigger"
      aria-label="Alternar menu lateral"
      title="Alternar menu lateral"
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      className={cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-white',
        className,
      )}
      {...props}
    >
      <PanelLeft className="h-5 w-5" />
      <span className="sr-only">Alternar menu lateral</span>
    </button>
  );
}

type SidebarRailProps = React.ComponentPropsWithoutRef<'button'>;

export function SidebarRail({ className, ...props }: SidebarRailProps) {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      type="button"
      data-sidebar="rail"
      aria-label="Expandir ou recolher menu lateral"
      tabIndex={-1}
      onClick={toggleSidebar}
      className={cn(
        'absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] after:bg-transparent hover:after:bg-white/10 sm:flex',
        'group-data-[side=left]:-right-4 group-data-[side=right]:left-0',
        className,
      )}
      {...props}
    />
  );
}
