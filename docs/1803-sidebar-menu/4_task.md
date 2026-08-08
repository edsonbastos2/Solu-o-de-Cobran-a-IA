---
status: done
title: Criar route group `(dashboard)` e mover páginas autenticadas
type: refactor
complexity: high
dependencies:
  - task_2
  - task_3
---

# Criar route group `(dashboard)` e mover páginas autenticadas

## Visão Geral

Cria `app/(dashboard)/layout.tsx` como ponto único do shell (ADR-002): envolve todas as páginas autenticadas com `SidebarProvider` + `AppSidebar` + `SidebarInset` (que contém `Header` e `{children}`). Move mecanicamente as páginas autenticadas para dentro do route group com `git mv` — as **URLs não mudam** (route groups não afetam path) e o middleware de sessão continua válido.

## Requisitos

1. `app/(dashboard)/layout.tsx` DEVE renderizar `<SidebarProvider>` envolvendo `<AppSidebar />` + `<SidebarInset>` (com `Header` top + `{children}`).
2. DEVE mover via `git mv` para dentro de `app/(dashboard)/`: `app/page.tsx`, `app/cases/`, `app/contracts/`, `app/clients/`, `app/negotiations/`, `app/agents/`, `app/policies/`, `app/settings/`, `app/admin/`.
3. DEVE manter fora do grupo: `app/login/`, `app/api/`, `app/loading.tsx` e `app/not-found.tsx`.
4. URLs e middleware NÃO podem mudar (pathnames idênticos).
5. Imports `@/` dos arquivos movidos permanecem válidos (o alias base não muda).
6. Nesta etapa o `Header` atual permanece renderizado dentro de `SidebarInset`; a refatoração fina dele ocorre na task 5.
7. O shell não deve quebrar a guarda de auth do `RootLayout` (`AuthGuard`).

## Subtasks

- [ ] 4.1 Criar `app/(dashboard)/layout.tsx` com `SidebarProvider` + `AppSidebar` + `SidebarInset`(Header + children).
- [ ] 4.2 Mover via `git mv` o `app/page.tsx` e as pastas de módulos para `app/(dashboard)/`.
- [ ] 4.3 Confirmar que `app/login`, `app/api`, `loading` e `not-found` ficaram de fora.
- [ ] 4.4 Rodar `npx tsc --noEmit` e `npm run build`.

## Detalhes de Implementação

- Arquivo novo: `app/(dashboard)/layout.tsx`.
- Referência TechSpec: "Arquitetura do Sistema" e "Sequência de Desenvolvimento" (passos 4-5).
- Exemplo de `git mv`: `git mv app/cases 'app/(dashboard)/cases'`.

### Arquivos Relevantes
- `app/layout.tsx` — RootLayout inalterado (`AuthGuard` + `HelpChat`).
- `components/app-sidebar.tsx` (task 3) e `components/ui/sidebar.tsx` (task 2).
- `components/header.tsx` — renderizado dentro do `SidebarInset` (ref ent na task 5).
- `middleware.ts` — para validar pathnames.

### Arquivos Dependentes
- Todas as pages movidas (mudam de diretório somente).
- `components/header.tsx` — continua usado pelo layout até task 5.

### ADRs Relacionados
- [ADR-002: Route group (app) como ponto único do shell](../adrs/adr-002.md) — decisão central desta task.

## Entregáveis

- `app/(dashboard)/layout.tsx` montando o shell.
- Páginas movidas via `git mv` (histórico preservado).
- Validação: `npx tsc --noEmit`, `npm run lint` e `npm run build` **(REQUERIDOS)**.

## Testes

- Unitários (via build/lint):
  - [ ] `npx tsc --noEmit` compila sem erros.
  - [ ] `npm run lint` não reporta problemas.
- Integração/manual:
  - [ ] Todas as rotas respondem: `/`, `/cases`, `/contracts/:id`, `/clients`, `/negotiations`, `/agents`, `/policies`, `/settings`, `/admin/users`.
  - [ ] Rota protegida sem sessão redireciona para `/login`; `/login` público.
  - [ ] `loading.tsx` e `not-found.tsx` funcionam como antes.
- Target de cobertura: não aplicável (sem suite).

## Critérios de Sucesso

- Todas as rotas inalteradas funcionando com o shell montado.
- Não há arquivos "renomeados" suspeitos no `git status` (git mv limpo).
- Build e lint passam.