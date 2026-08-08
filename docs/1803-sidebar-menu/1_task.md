---
status: done
title: Criar config de navegação `lib/navigation.ts`
type: frontend
complexity: low
dependencies: []
---

# Criar config de navegação `lib/navigation.ts`

## Visão Geral

Cria a **fonte única de verdade** da navegação do sidebar: um arquivo tipado com seções ("Operação"/"Configuração") e itens (label, href, ícone, flag sobre `adminOnly`, `dataTour` opcional). Elimina a duplicação da lista `navLinks` hoje embutida no `Header` — decisão config-driven (ADR-001).

## Requisitos

1. O arquivo DEVE declarar um tipo `NavItem` com `label: string`, `href: string`, `icon: LucideIcon`, `section` (`'operacao' | 'configuracao'`), `adminOnly?: boolean` e `dataTour?: string`.
2. O arquivo DEVE declarar `NavSection` com `id`, `label` e `items: NavItem[]` (conforme TechSpec "Core Interfaces").
3. DEVE exportar `navConfig` com as seções "Operação" (Dashboard, Casos (Ao Vivo), Acordos, Contratos, Clientes) e "Configuração" (Agentes IA, Políticas, Configurações).
4. O item "Painel Admin" DEVE existir com `adminOnly: true` e `href: '/admin/users'` na seção Configuração.
5. Itens Agentes e Políticas DEVERAM carregar `dataTour` coerente (`agents-nav-desktop`, `agents-nav-mobile`, `policies-nav-desktop`, `policies-nav-mobile` — campo único aplicado no render com sufixo de tela, ou dois campos, conforme preferência de implementação).
6. NÃO DEVE importar componentes da UI — apenas `LucideIcon` de `lucide-react` e tipos.
7. Os hrefs NÃO devem conter o prefixo `?tenant_id=` (o `tenantPath` é aplicado no `AppSidebar` via `useActiveTenant`).

## Subtasks

- [ ] 1.1 Definir os tipos `NavItem` e `NavSection` conforme a TechSpec.
- [ ] 1.2 Exportar `navConfig` com as duas seções e seus itens (incluindo `adminOnly` e `dataTour`).
- [ ] 1.3 Rodar `npx tsc --noEmit` e corrigir tipagem.

## Detalhes de Implementação

- Arquivo novo: `lib/navigation.ts`.
- Referência de padrão: TechSpec seção "Core Interfaces" (não duplicar).
- Seguir a convenção de imports `@/` do projeto.

### Arquivos Relevantes
- `components/header.tsx` — lista `navLinks` atual que será substituída (dados, não refatoração).
- `hooks/use-active-tenant.ts` — `tenantPath` aplicado no render (não neste arquivo).

### Arquivos Dependentes
- `components/app-sidebar.tsx` — consumirá `navConfig` (task 3).

### ADRs Relacionados
- [ADR-001: Shell sidebar do padrão shadcn](../adrs/adr-001.md) — define navegação config-driven e seções.

## Entregáveis

- `lib/navigation.ts` com tipos + `navConfig`.
- Nenhuma dependência nova.
- Validação: `npx tsc --noEmit` **(REQUERIDO)**; `npm run lint` **(REQUERIDO)**.

## Testes

- Unitários (sem suite de testes; validação por tipo/lint/build):
  - [ ] `npx tsc --noEmit` compila sem erros.
  - [ ] `npm run lint` não reporta problemas.
- Integração/manual (após tasks 3-5):
  - [ ] Navegação aparece completa via `navConfig`.
  - [ ] Item "Painel Admin" só para super-admin.
- Target de cobertura: não aplicável (sem suite).

## Critérios de Sucesso

- `navConfig` é a única fonte da navegação.
- Tipagem estrita passa; lint passa; sem dependências novas.