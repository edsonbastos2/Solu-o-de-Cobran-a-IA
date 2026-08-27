---
status: pending
title: "Página `/crm` + navegação"
type: frontend
complexity: medium
dependencies:
  - task_07
  - task_08
---

# Task 09: Página `/crm` + navegação

## Overview

Monta a página do CRM (`app/(dashboard)/crm/page.tsx`): stats + filtros + board conectados aos hooks, com responsividade e carregamento/erro. Adiciona o item "CRM" no menu (`lib/navigation.ts`).

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST criar `app/(dashboard)/crm/page.tsx` como shell enxuto: `CrmStats` + `CrmFilters` + `CrmBoard`, com estado dos filtros e permissões vindos de `use-crm-board`/`use-crm-stats`/`useAuth`
- MUST carregar a lista de operadores via `hooks/useTeamMembers.ts` para `CrmFilters` e `CrmTransferDialog` (gestor+)
- MUST item "CRM" em `lib/navigation.ts` na seção Operação (ícone `FolderKanban` ou equivalente), posicionado junto de "Casos" e "Conversas"
- MUST estados de carregamento (skeleton do board) e erro (mensagem + retry) da página
- MUST layout responsivo: colunas com scroll horizontal no desktop e empilhamento navegável em telas pequenas
- MUST a página respeitar `AuthGuard` do layout do dashboard (sem lógica de auth própria)
</requirements>

## Subtasks
- [ ] 9.1 Página `/crm` compondo stats, filtros e board
- [ ] 9.2 Item de navegação "CRM"
- [ ] 9.3 Estados de loading/erro e responsividade
- [ ] 9.4 Testes da página

## Implementation Details

Follow the shell pattern of `app/(dashboard)/conversations/page.tsx`. Filters state lives in the page/hook — never in the board. See TechSpec section "Frontend".

### Relevant Files
- `app/(dashboard)/conversations/page.tsx` — padrão de página-shell
- `lib/navigation.ts` — estrutura do menu
- `hooks/useTeamMembers.ts`, `hooks/useAuth.ts` — dados de equipe/perfil

### Dependent Files
- — 

### Related ADRs
- [ADR-001](../adrs/adr-001.md)

## Deliverables
- `app/(dashboard)/crm/page.tsx` + item de navegação + testes

## Tests
- Unit tests:
  - [ ] Página renderiza stats, filtros e board montados a partir dos hooks
  - [ ] Operador não vê filtro por operador; gestor vê
  - [ ] Estado de erro da API exibe mensagem + retry
- Integration tests:
  - [ ] Navegar para `/crm` autenticado renderiza o board (e2e manual ou Playwright, se mantido o padrão)
- Test coverage target: >=80% da página
- All tests must pass

## Success Criteria
- All tests passing; fluxo completo visível: filtros → board → mover card → feedback
- Item "CRM" aparece no menu para usuários autenticados
