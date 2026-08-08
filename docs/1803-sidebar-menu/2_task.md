---
status: done
title: Implementar primitivas do sidebar em `components/ui/sidebar.tsx`
type: frontend
complexity: high
dependencies:
  - task_01
---

# Implementar primitivas do sidebar em `components/ui/sidebar.tsx`

## Visão Geral

Cria o "esqueleto" do componente shadcn-sidebar **sem Radix**: `SidebarProvider` (context com estado de collapse), `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarGroup`, `SidebarMenu/MenuItem/MenuButton/MenuSub`, `SidebarFooter`, `SidebarTrigger`, `SidebarRail` e `SidebarInset`, expondo o hook `useSidebar`. É a base para o `AppSidebar` (task 3) e para o layout do route group (task 4).

## Requirements
1. `SidebarProvider` DEVE expor via context: `open`, `setOpen`, `openMobile`, `setOpenMobile`, `isMobile`, `toggleSidebar` e `state: 'expanded'|'collapsed'`.
2. `SidebarProvider` DEVE usar `hooks/use-mobile.ts` já existente para `isMobile`; DEVE escutar `keydown` de `cmd/Ctrl+b` para `toggleSidebar` (desktop) e `Escape` para fechar o drawer mobile.
3. `Sidebar` DEVE suportar props `side` (left/right), `variant` (sidebar/floating/inset) e `collapsible` ('offcanvas'|'icon'|'none'), com comportamento desktop/mobile conforme a TechSpec (desktop `icon`, mobile drawer overlay).
4. `SidebarMenuButton` DEVE suportar `asChild` (renderiza `<Link>` do Next) e `isActive` para o estado ativo.
5. Sem novas deps no `package.json` — usar somente `cva`, `clsx`, `tailwind-merge`, `lucide-react` e `use-mobile` (já presentes).
6. O drawer mobile DEVE ter backdrop que fecha ao clicar fora, `aria-modal`, `aria-label` e gerenciar foco/escape.
7. Usar variáveis CSS `--sidebar-width`/`--sidebar-width-mobile` (estilo shadcn) para largura.

## Subtasks
- [ ] 2.1 Criar `SidebarProvider` + context + hook `useSidebar` (estados open/openMobile, teclado).
- [ ] 2.2 Criar `Sidebar` (desktop + drawer mobile) e `SidebarInset`.
- [ ] 2.3 Criar `SidebarHeader`, `SidebarContent`, `SidebarFooter` e `SidebarRail`.
- [ ] 2.4 Criar `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupContent`.
- [ ] 2.5 Criar `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton` (com `asChild`), `SidebarMenuAction`, `SidebarMenuBadge`, `SidebarMenuSub` e `SidebarTrigger`.
- [ ] 2.6 Rodar `npx tsc --noEmit` e corrigir tipagem.

## Detalhes de Implementação

- Arquivo novo: `components/ui/sidebar.tsx` (novo diretório `components/ui/`).
- Referência de padrão na TechSpec: seção "Primeiras do sidebar", "Responsividade" e "Pontos de Integração" (data-tour ficam no AppSidebar/Header, não aqui).
- Criar `cn()` local ou usar `lib/utils.ts` se existir (checar; usar o helper `cn` do projeto se presente).

### Arquivos Relevantes
- `components/ui/sidebar.tsx` — arquivo novo (todo o conteúdo da task).
- `hooks/use-mobile.ts` — `useIsMobile` já existente.
- `package.json` — para NÃO adicionar dependências Radix (verificar que cva/clsx/tailwind-merge/lucide presentes).

### Arquivos Dependentes
- `components/app-sidebar.tsx` — consome `useSidebar` e primitivas (task 3).
- `app/(dashboard)/layout.tsx` — consome `SidebarProvider`, `SidebarInset`, `SidebarTrigger` (task 4).

### ADRs Relacionados
- [ADR-001: Shell sidebar do zero](../adrs/adr-001.md) — primitivas nativas sem shadcn/Radix; state em context.

## Entregas
- `components/ui/sidebar.tsx` com todas as primitivas e `useSidebar`.
- Nenhuma dependência nova.
- Validação: `npx tsc --noEmit` sem erros **(REQUERIDO)**.
- Validação: `npm run lint` **(REQUERIDO)**.

## Testes
- Unitários (via build/lint):
  - [ ] `npx tsc --noEmit` compila sem erros.
  - [ ] `npm run lint` não reporta problemas.
- Integração/manuais (após task 3/4):
  - [ ] `toggleSidebar` no desktop alterna `open`/`state`.
  - [ ] `cmd/ctrl+b` alterna; `Esc` fecha drawer mobile.
  - [ ] `SidebarMenuButton asChild` renderiza `<Link>` e `isActive` aplica estilo.
  - [ ] Drawer mobile fecha ao clicar fora e respeita `--sidebar-width-mobile`.
- Target de cobertura: não aplicável (sem suite; tipos & lint).

## Success Criteria
- All tests validações passando (tsc, lint, build).
- `useSidebar` expõe o contrato definido na TechSpec.
- Sem dependências novas no package.