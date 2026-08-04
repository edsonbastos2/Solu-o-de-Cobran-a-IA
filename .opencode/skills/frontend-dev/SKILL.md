---
name: frontend-dev
description: >
  Use para implementar código frontend no projeto Next.js 15 + React 19 + Tailwind CSS 4.1.
  Ative esta skill quando o usuário:
  - Pedir para criar componente React, página, hook customizado
  - Pedir para alterar layout, estilização, responsividade
  - Perguntar sobre padrões de código, estrutura de arquivos ou convenções
  - Mencionar Server Component, Client Component, 'use client'
  - Pedir code review de frontend

  Cobre: estrutura de componentes, hooks, SWR, estilização, formulários,
  ícones, animações, tipagem e checklist de qualidade.
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep]
---

# Frontend Development Skill

Padrões de desenvolvimento frontend para o projeto.

## Stack

- **Next.js 15** App Router (Server + Client Components)
- **React 19** (functional components, hooks)
- **TypeScript 5.7** (strict)
- **Tailwind CSS 4.1** (utility-first, mobile-first)
- **SWR** (data fetching com `fetcher`/`fetchWithAuth`)
- **Supabase** (auth, RLS, multi-tenant)
- **lucide-react** (ícones)
- **motion** (animações)
- **react-hook-form** (formulários)
- **class-variance-authority** (variantes de componente)
- **clsx + tailwind-merge** (merge de classes)

## Estrutura do Projeto

```
components/        # Componentes React (.tsx)
hooks/             # Custom hooks (.ts)
lib/               # Types, Supabase clients, utilities (.ts)
app/               # Pages, layouts, API routes
app/api/           # Route handlers
```

Path alias: `@/*` → raiz do projeto

## Convenções Obrigatórias

1. **Auth**: `AuthGuard` em root layout, `requireUser()` em API routes
2. **Multi-tenant**: RLS via `user_id`, nunca enviar `user_id` manualmente
3. **Graceful degradation**: client retorna `null` quando env vars ausentes (demo mode)

## Passo a passo: feature nova

1. Ler referências `references/frontend.md` e `references/responsividade.md`
2. Se consome API → skill `api-integration` para tipos e SWR hooks
3. Se tabela/CRUD → skill `table-generator` (não monte do zero)
4. Criar tipos em `lib/` (ou estender `lib/types.ts`)
5. Criar hooks em `hooks/`
6. Criar componentes em `components/`
7. Aplicar responsividade mobile-first
8. Executar `npm run lint && npm run build`

## Passo a passo: alteração

1. Mapear impacto: Grep pela referência
2. Alterar apenas o necessário
3. Atualizar tipos se contrato mudou
4. Atualizar hooks se lógica mudou
5. Atualizar componente se UI mudou
6. Verificar `npm run lint && npm run build`

## Passo a passo: code review

1. Ler todos os arquivos alterados
2. Verificar checklist em `references/frontend.md`
3. Sinalizar desvios

## Nomenclatura

| Artefato | Convenção |
|----------|-----------|
| Componente | `NomeComponente.tsx` (PascalCase) |
| Hook | `useNome.ts` (camelCase, prefixo `use`) |
| Tipo | `NomeTipo` (PascalCase, em `lib/types.ts`) |
| Página | `page.tsx` |
| Layout | `layout.tsx` |
| API route | `route.ts` |

## Referências

- `references/frontend.md` — padrões completos de componente, hooks, SWR, formulários
- `references/responsividade.md` — breakpoints Tailwind, mobile-first, tabelas, modais
