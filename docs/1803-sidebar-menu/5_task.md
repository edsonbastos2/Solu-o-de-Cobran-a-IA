---
status: done
title: Refatorar `components/header.tsx` para header slim
type: refactor
complexity: medium
dependencies:
  - task_4
---

# Refatorar `components/header.tsx` para header slim

## Visão Geral

Transforma o `Header` atual (que carrega `navLinks`, hambúrguer desktop e dropdown mobile) em um **header slim**: remove a lista de navegação (agora no `AppSidebar`), remove o dropdown mobile manual e usa o `SidebarTrigger` para abrir o drawer. Mantém apenas ações: hambúrguer mobile, nome do usuário, botão de tour, avatar/link `settings` e logout.

## Requisitos

1. O `Header` DEVE remover o array `navLinks` e o `<nav>` desktop.
2. DEVE remover o estado `mobileMenuOpen` e o dropdown mobile; substituir pelo `SidebarTrigger` (botão com `data-tour="mobile-menu-trigger"`).
3. DEVE preservar as ações: botão de tour (`data-tour="guided-tour-trigger"`), link avatars/settings (`data-tour="header-settings"`, com `tenantPath`), nome do usuário e botão de logout.
4. A marca (`app-logo`) NÃO faz mais parte do Header — foi movida ao `AppSidebar` (task 3); garantir que o `data-tour="app-logo"` continue existindo lá (não duplicar).
5. NÃO DEVE renderizar o `TenantSwitcher` (fica no `SidebarHeader` do AppSidebar).
6. O `Header` DEVE importar `SidebarTrigger` de `components/ui/sidebar.tsx`.

## Subtasks

- [ ] 5.1 Remover `navLinks`, o `<nav>` desktop e o dropdown mobile (`mobileMenuOpen`).
- [ ] 5.2 Substituir o hambúrguer manual pelo `SidebarTrigger` (mobile drawer).
- [ ] 5.3 Manter ações: tour, settings/avatar, nome, logout.
- [ ] 5.4 Garantir que a marca não duplica (logo apenas no AppSidebar).
- [ ] 5.5 Rodar `npx tsc --noEmit` e `npm run lint`.

## Detalhes de Implementação

- Arquivo a modificar: `components/header.tsx`.
- Referência TechSpec: "Fluxo de dados" e "Análise de Impacto" (component header modified).
- Importar `SidebarTrigger` de `@/components/ui/sidebar`.
- A lógica de logout e `useActiveTenant` permanece.

### Arquivos Relevantes
- `components/header.tsx` — arquivo da task.
- `components/ui/sidebar.tsx` — `SidebarTrigger`/`useSidebar` (task 2).
- `components/app-sidebar.tsx` — já possui marca/tenant (task 3).
- `hooks/use-active-tenant.ts` — `tenantPath` para o link settings.

### Arquivos Dependentes
- Nenhum novo; o header é renderizado pelo layout (task 4).

### ADRs Relacionados
- [ADR-001: Shell sidebar do zero](../adrs/adr-001.md) — navegação migra para o sidebar; marca no header do sidebar.

## Entregáveis

- `components/header.tsx` sls.
- `data-tour` (`mobile-menu-trigger`, `guided-tour-trigger`, `header-settings`) preservados.
- Validação: `npx tsc --noEmit` **(REQUERIDO)**; `npm run lint` **(REQUERIDO)**.

## Testes

- Unitários (via build/lint):
  - [ ] `npx tsc --noEmit` compila sem erros.
  - [ ] `npm run lint` não reporta problemas.
- Integração/manual:
  - [ ] Header mostra apenas hambúrguer (mobile), nome, tour, settings e logout.
  - [ ] Hambúrguer abre o drawer mobile (não o dropdown antigo).
  - [ ] Tour guiado ainda resolve todos os `data-tour`.
  - [ ] Logout e troca de tenant sem regressão.
- Target de cobertura: não aplicável (sem suite).

## Critérios de Sucesso

- Header slim sem duplicação de nav.
- Tour e tenant sem regressão; build e lint passam.