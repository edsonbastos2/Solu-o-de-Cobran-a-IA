---
status: completed
title: Componentes de lista de conversas
type: frontend
complexity: high
dependencies:
  - task_07
---

# Task 08: Componentes de lista de conversas

## Overview

Implementa a coluna esquerda da Central: lista de conversas estilo app de mensagens (avatar, nome, última mensagem, data/hora, valor da dívida, canal, badge de não lidas, indicador de condutor) com filtros e busca. Componentes puros que recebem dados dos hooks da task 07.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST criar em `components/conversations/`: `conversation-list.tsx`, `conversation-list-item.tsx`, `conversation-filters.tsx`
- MUST cada item apresentar: avatar (iniciais), nome do devedor, última mensagem truncada, data/hora relativa (date-fns, pt-BR), valor da dívida, canal (ícone WhatsApp/Telegram do lucide), badge de não lidas, indicador de condutor (🤖 IA / 👤 nome do operador / sem responsário)
- MUST `ConversationFilters` com filtros do PRD (Todas, Não lidas, IA conduzindo, Atendimento humano, Aguardando devedor, Aguardando operador, Em negociação, Finalizadas, Minhas conversas) + filtro por responsável (gestor/admin) + busca com debounce
- MUST estados: loading (skeleton), empty ("Nenhuma conversa encontrada"), erro com retry
- MUST destaque "Nova atribuição" quando conversa atribuída a mim sem leitura e último evento TRANSFERRED
- MUST item selecionado com estado ativo claro; navegação por teclado na lista (roving tabindex ou arrow keys)
- MUST acessibilidade: lista semântica (`role="listbox"`/`option` ou `ul/li`), aria-selected, labels nos filtros
- Tailwind puro + `cn()` — sem novas dependências; identidade própria (não copiar WhatsApp)
</requirements>

## Subtasks
- [ ] 8.1 `conversation-list.tsx` (ordenação por atividade, estados loading/empty/erro)
- [ ] 8.2 `conversation-list-item.tsx` (todos os indicadores, badge, ativo)
- [ ] 8.3 `conversation-filters.tsx` (filtros + busca + responsável condicional por permissão)
- [ ] 8.4 Testes RTL dos três componentes

## Implementation Details

Tipos de entrada: `ConversationListItem` de `lib/types.ts`. Formatação monetária/date seguir utilitários já usados nas páginas de casos (`Intl.NumberFormat`/date-fns). Avatar com iniciais + cor derivada do nome. Sem lógica de dados nos componentes — props + callbacks.

### Relevant Files
- `components/pagination.tsx` — paginação existente a reutilizar na lista
- `app/(dashboard)/cases/page.tsx` — padrão de filtros/busca/estados
- `lib/utils.ts` — `cn()`

### Dependent Files
- `app/(dashboard)/conversations/page.tsx` (task 10) monta a página com estes componentes

### Related ADRs
- [ADR-001: Conversa = caso enriquecido](../adrs/adr-001.md)

## Deliverables
- 3 componentes + testes co-localizados (`*.test.tsx`)

## Tests
- Unit tests:
  - [ ] ListItem renderiza nome, última mensagem, valor e indicador de condutor IA vs humano
  - [ ] Badge de não lidas aparece quando unreadCount > 0 e some quando 0
  - [ ] Clique em item chama onSelect com o case id
  - [ ] Filtro "Não lidas" selecionado chama onFilterChange com valor correto
  - [ ] Lista vazia renderiza empty state; erro renderiza botão retry
  - [ ] Loading renderiza skeletons acessíveis
  - [ ] Destaque "Nova atribuição" quando atribuído a mim + sem leitura
- Integration tests:
  - [ ] N/A
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Lista navegável por teclado; contraste e labels adequados
