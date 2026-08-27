---
status: pending
title: "Componentes de filtros + stats (`CrmFilters`, `CrmStats`)"
type: frontend
complexity: medium
dependencies:
  - task_06
---

# Task 07: Componentes de filtros e stats

## Overview

Componentes de UI pura do cabeçalho do CRM: barra de filtros composta (`CrmFilters`) por subcomponentes dedicados (busca, operador, prioridade) e o painel de indicadores (`CrmStats`). Sem lógica de dados — recebem estado dos hooks.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST criar `components/crm/crm-filters.tsx` compondo `crm-search-input.tsx`, `crm-operator-filter.tsx` e `crm-priority-filter.tsx` — filtros nunca embutidos no board (requisito do PRD "Filtros reutilizáveis")
- MUST `CrmOperatorFilter` aceitar lista de operadores (prop), valor `all|unassigned|userId` e só ser renderizado para gestor+ (prop `canFilterByOperator` do contexto/perfil)
- MUST `CrmSearchInput` aplicar debounce (~300ms) e placeholder "Buscar cliente, CPF/CNPJ ou nº do caso"
- MUST incluir botão "Limpar" que zera todos os filtros
- MUST `components/crm/crm-stats.tsx` renderizar os 8 indicadores de `CrmStats` em cards compactos com estados de carregamento e vazio, formatando moeda em pt-BR
- MUST os componentes serem puros (props in/props out), tipados com os tipos de `lib/types.ts`, seguindo Tailwind 4.1 e convenções visuais dos componentes existentes (ex.: `components/conversations/conversation-filters.tsx`)
</requirements>

## Subtasks
- [ ] 7.1 `crm-search-input.tsx` com debounce
- [ ] 7.2 `crm-operator-filter.tsx` e `crm-priority-filter.tsx`
- [ ] 7.3 `crm-filters.tsx` (composição + limpar)
- [ ] 7.4 `crm-stats.tsx` com formatação e estados
- [ ] 7.5 Testes de renderização e interação

## Implementation Details

Mirror the structure of `components/conversations/conversation-filters.tsx` for visual/behavior consistency. Currency and date formatting with `date-fns`/Intl already used in the project. See TechSpec section "Frontend".

### Relevant Files
- `components/conversations/conversation-filters.tsx` — padrão visual e de composição
- `lib/types.ts` — `CrmStats`, tipos de filtros
- `hooks/useTeamMembers.ts` — fonte da lista de operadores (usada pela página, não pelo componente)

### Dependent Files
- Task 08/09 (board e página compõem os filtros e stats)

### Related ADRs
- [ADR-001](../adrs/adr-001.md)

## Deliverables
- `components/crm/crm-filters.tsx`, `crm-search-input.tsx`, `crm-operator-filter.tsx`, `crm-priority-filter.tsx`, `crm-stats.tsx` + testes co-localizados

## Tests
- Unit tests:
  - [ ] `CrmFilters` renderiza busca + prioridade sempre; operador apenas quando `canFilterByOperator`
  - [ ] Digitar na busca dispara onChange com debounce (fake timers)
  - [ ] "Limpar" reseta busca, operador e prioridade
  - [ ] `CrmStats` renderiza os 8 indicadores formatados (moeda pt-BR) com loading e estado vazio
- Integration tests:
  - [ ] N/A
- Test coverage target: >=80% dos componentes
- All tests must pass

## Success Criteria
- All tests passing; nenhum filtro hardcoded no board
