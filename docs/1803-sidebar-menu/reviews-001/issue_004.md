---
status: pending
file: components/app-sidebar.tsx
line: 35
severity: low
author: claude-code
provider_ref:
---

# Issue 004: Duplicação de lógica withTenant/isActive entre app-sidebar e header

## Review Comment

A lógica `withTenant` (excetua `/admin/users` do sufixo `tenantPath`) e o cálulas de
`isActive` (exact para `/`, `startsWith` para demais módulos) estão implementados
duplicados em `components/app-sidebar.tsx` (linhas 35-40) e `components/header.tsx`
(linha 13). Como a task 5 tornou o header slim, o header só usa hoje `withTenant`
para `/settings` e `/admin/users`; toda a navegação primária migrou para o
`AppSidebar`.

Sugestão de baixo custo: extrair `withTenant` (de `useActiveTenant`) e `isActive`
para `hooks/use-active-tenant.ts` ou `lib/utils.ts`, e reutilizar nos dois arquivos.
Evita divergência futura (ex.: regra do `/admin/users` mudar em um lugar só).

## Triage

- Decision: `UNREVIEWED`
- Notes: