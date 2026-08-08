---
status: done
title: Implementar `components/app-sidebar.tsx` (config-driven)
type: frontend
complexity: medium
dependencies:
  - task_1
  - task_2
---

# Implementar `components/app-sidebar.tsx` (config-driven)

## Visão Geral

Monta o `AppSidebar` que renderiza a navegação a partir de `lib/navigation.ts` (config-driven), destacando o item ativo via `usePathname`, filtrando itens `adminOnly` para não-super-admin, aplicando `tenantPath` nos hrefs, colocando a **marca** e o `TenantSwitcher` no `SidebarHeader` e o usuário no `SidebarFooter`. Consome as primitivas da task 2 preservando o design system atual (dark, accent emerald).

## Requisitos

1. O componente DEVE renderizar `Sidebar` com `SidebarHeader` (marca CobrançaIA com `data-tour="app-logo"` + `TenantSwitcher` quando `isSuperAdmin`), `SidebarContent` com os `SidebarGroup` das seções de `navConfig`, e `SidebarFooter` com o nome do usuário.
2. DEVE aplicar `tenantPath` de `useActiveTenant` nos hrefs de todos os itens, exceto `/admin/users` (comportamento do Header atual).
3. DEVE calcular `isActive` por pathname: `exact` para `/` e prefixo `startsWith` para os demais (ex.: `/cases` ativo em `/cases/[id]`).
4. DEVE filtrar itens `adminOnly` quando o usuário não é super-admin (`profile.is_super_admin`).
5. Ao clicar em um item no drawer mobile, DEVE fechar o drawer (`setOpenMobile(false)` de `useSidebar`).
6. Itens Agentes/Políticas DEVERÃO aplicar `data-tour` conforme o `dataTour` do config.
7. NÃO DEVE duplicar a marca (o Header slim não renderiza logo; o logo mora aqui).

## Subtasks

- [ ] 3.1 Mapear `navConfig` em `SidebarGroup`/`SidebarMenu`/`SidebarMenuButton`.
- [ ] 3.2 Integrar `useActiveTenant` (`tenantPath`, `isSuperAdmin`) e `usePathname`.
- [ ] 3.3 Implementar `isActive` (exact/startsWith) e aplicar nos buttons.
- [ ] 3.4 Montar `SidebarHeader` (marca + TenantSwitcher) e `SidebarFooter`.
- [ ] 3.5 Fechar drawer mobile no clique de item.
- [ ] 3.6 Rodar `npx tsc --noEmit` e `npm run lint`.

## Detalhes de Implementação

- Arquivo novo: `components/app-sidebar.tsx`.
- Referência TechSpec: "Fluxo de dados" e "Pontos de Integração" (tour/tenant).
- Reutilizar `components/tenant-switcher.tsx` inalterado dentro do `SidebarHeader`.
- Usar `SidebarMenuButton asChild` com `next/link` e `isActive`.

### Arquivos Relevantes
- `lib/navigation.ts` — config (task 1).
- `components/ui/sidebar.tsx` — primitivas (task 2).
- `components/tenant-switcher.tsx` — componente a reusar.
- `hooks/use-active-tenant.ts` — `tenantPath`/`isSuperAdmin`.

### Arquivos Dependentes
- `app/(dashboard)/layout.tsx` — renderiza `AppSidebar` (task 4).

### ADRs Relacionados
- [ADR-001: Shell sidebar do zero](../adrs/adr-001.md) — config-driven, marca no header, RBAC.

## Entregáveis

- `components/app-sidebar.tsx` renderizando seções, marca, tenant e usuário.
- Validação: `npx tsc --noEmit` **(REQUERIDO)**; `npm run lint` **(REQUERIDO)**.

## Testes

- Unitários (via build/lint):
  - [ ] `npx tsc --noEmit` compila sem erros.
  - [ ] `npm run lint` não reporta problemas.
- Integração/manual (após task 4 montar o layout):
  - [ ] Seções/itens renderizam; marca e TenantSwitcher no topo (admin).
  - [ ] Item ativo destacado ao navegar por módulos e subpáginas.
  - [ ] Usuário regular NÃO vê "Painel Admin".
  - [ ] Trocar tenant atualiza `?tenant_id=` sem quebrar o item ativo.
  - [ ] Clicar item no drawer mobile fecha o drawer.
  - [ ] `data-tour` de Agentes/Políticas preservado.
- Target de cobertura: não aplicável (sem suite).

## Critérios de Sucesso

- Navegação config-driven funcional; RBAC aplicado; item ativo correto.
- Tour guiado preservado; sem regressão de tenant.