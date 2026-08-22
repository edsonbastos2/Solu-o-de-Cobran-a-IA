---
status: completed
title: Página /conversations (layout 3 colunas) + navegação
type: frontend
complexity: high
dependencies:
  - task_08
  - task_09
---

# Task 10: Página `/conversations` + navegação

## Overview

Monta a página da Central de Conversas compondo lista, chat e painel de contexto da dívida em layout de 3 colunas responsivo, registra o item "Conversas" na navegação e suporta deep-link (`/conversations?case=<id>`) usado pela página de caso (task 11).

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST criar `app/(dashboard)/conversations/page.tsx` + `components/conversations/conversations-page.tsx` (client) compondo: `ConversationFilters` + `ConversationList` | `ChatWindow` | `DebtContextPanel`
- MUST criar `components/conversations/debt-context-panel.tsx`: devedor (nome, documento mascarado), dívida (valor original/atualizado, vencimento, dias em atraso), contrato, negociação (status, última proposta, parcelas) e ações (Ver contrato, Ver cobrança/caso, Ver histórico) — dados do detalhe da conversa
- MUST responsividade: 3 colunas em desktop; contexto recolhível em telas médias (notebook/tablet); mobile em pilha (lista → conversa → informações), sem 3 colunas em telas pequenas
- MUST item "Conversas" (ícone MessageCircle do lucide) na seção Operação de `lib/navigation.ts`, na posição logo após "Casos"
- MUST deep-link `?case=<id>` seleciona e abre a conversa (usado pela task 11 e por notificações)
- MUST seleção de conversa via estado da página (não rota aninhada — YAGNI)
- MUST title/metadata pt-BR e tour `data-tour` se o padrão existir na navegação
- Estados da página: nenhuma conversa selecionada (empty state "Selecione uma conversa"), loading inicial
</requirements>

## Subtasks
- [x] 10.1 `DebtContextPanel` com dados do detalhe + links para caso/contrato/histórico
- [x] 10.2 `ConversationsPage` (composição, seleção, deep-link, estados)
- [x] 10.3 Rota `app/(dashboard)/conversations/page.tsx` + metadata
- [x] 10.4 Item de navegação em `lib/navigation.ts`
- [x] 10.5 Testes de integração de componentes da página

## Implementation Details

Máscara de documento: `***.***.***-**` (utilitário local). Dias em atraso e valores do `Case`/`FinancialTitle` do detalhe. Layout com grid Tailwind (`lg:grid-cols-[320px_1fr_300px]`, collapse do painel via toggle). Links preservam `tenantPath` (padrão do `lib/navigation.ts`). Header da página segue padrão das demais (`app/(dashboard)/cases/page.tsx`).

### Relevant Files
- `lib/navigation.ts` — navConfig (fonte única de menu)
- `app/(dashboard)/cases/page.tsx` — padrão de página/estados
- `hooks/use-active-tenant.ts` — tenantPath nos links
- `components/conversations/*` (tasks 08–09)

### Dependent Files
- Task 11 linka da página de caso para `/conversations?case=<id>`

### Related ADRs
- [ADR-001: Conversa = caso enriquecido](../adrs/adr-001.md)

## Deliverables
- Página `/conversations` completa e responsiva
- Item de navegação + DebtContextPanel + testes

## Tests
- Unit tests:
  - [x] DebtContextPanel renderiza devedor com documento mascarado, valores e dias em atraso (`debt-context-panel.test.tsx`)
  - [x] Sem conversa selecionada → empty state "Selecione uma conversa" (`conversations-page.test.tsx`, via `ChatWindow`)
  - [x] Deep-link `?case=<id>` seleciona a conversa ao carregar (`conversations-page.test.tsx`)
- Integration tests:
  - [x] Seleção de item na lista renderiza ChatWindow da conversa correta (lista + chat integrados com hooks mockados)
  - [x] Responsividade mobile: classe `hidden` alterna entre lista e chat conforme seleção — testado via asserção de classe (jsdom não executa media queries de CSS/Tailwind em runtime; não há `matchMedia` real para mockar já que os breakpoints `lg:`/`xl:` são resolvidos pelo motor de CSS do navegador, não por JS)
- Test coverage target: >=80% dos novos componentes
- All tests must pass — 122/122 (`npm test`), `npx tsc --noEmit` limpo

## Success Criteria
- All tests passing; `npm run lint` e `npm run build` ok
- Página utilizável em desktop, notebook e mobile (checklist manual — layout verificado via classes responsivas: 3 colunas em `xl:`, lista+chat em `lg:`, pilha abaixo de `lg:` com painel de contexto como overlay)
