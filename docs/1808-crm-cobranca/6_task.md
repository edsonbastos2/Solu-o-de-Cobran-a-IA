---
status: pending
title: "`@dnd-kit` + hooks `use-crm-board`/`use-crm-stats` (SWR, realtime, move otimista)"
type: frontend
complexity: high
dependencies:
  - task_02
  - task_03
---

# Task 06: `@dnd-kit` + hooks de dados do CRM

## Overview

Base de dados do frontend: instala `@dnd-kit`, cria `use-crm-board` (SWR no board, movimentação otimista com rollback, "carregar mais" por coluna, filtros como chave de query) e `use-crm-stats` (indicadores), ambos com subscription Realtime no padrão do projeto.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST instalar `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (verificar compatibilidade React 19 no install)
- MUST `use-crm-board(filters)` buscar `GET /api/crm/board` via `fetcher`/`fetchWithAuth` (SWR), com `loadMore(stage)` paginando a coluna via `stage`+`page`
- MUST `moveCase(case, toStage, { reason? })`: atualização otimista das colunas em cache (remove da origem, insere no destino) + `PATCH /api/cases/[id]/stage` com `expectedStageId`; em erro, rollback (SWR `rollbackOnError`) e retorno do erro tipado (`error_code`) para a UI exibir feedback (incluindo `STAGE_CONFLICT` com etapa atual para revalidar)
- MUST validação de UX pré-drop: usar `canTransition` do domínio (import de `lib/crm/stages.ts`) para desabilitar visualmente drops inválidos — autorização real permanece no backend
- MUST subscription Realtime no canal `realtime-crm-board` (`postgres_changes` UPDATE em `cases` do tenant) revalidando o board com debounce, no padrão de `app/(dashboard)/cases/page.tsx`
- MUST `use-crm-stats()` buscar `GET /api/crm/stats` (SWR) no mesmo escopo
- MUST filtros como estado do hook (search com debounce ~300ms, operator, priority) refletidos nos query params e na chave SWR
</requirements>

## Subtasks
- [ ] 6.1 Instalar `@dnd-kit/*` e validar build
- [ ] 6.2 `use-crm-board`: fetch, filtros, paginação por coluna
- [ ] 6.3 `moveCase` otimista com rollback e erros tipados
- [ ] 6.4 Realtime com revalidação debounced
- [ ] 6.5 `use-crm-stats`
- [ ] 6.6 Testes do hook (mock SWR/fetch)

## Implementation Details

Follow the hook patterns of `hooks/use-conversations.ts` (SWR + actions) and the realtime subscription of `app/(dashboard)/cases/page.tsx`. No UI in this task — hooks only. See TechSpec section "Frontend".

### Relevant Files
- `hooks/use-conversations.ts` — padrão de hook com ações
- `app/(dashboard)/cases/page.tsx` — padrão de realtime + SWR
- `lib/api.ts` — `fetcher`/`fetchWithAuth`
- `lib/crm/stages.ts` — `canTransition` para UX pré-drop
- `lib/supabase.ts` — client para realtime

### Dependent Files
- Tasks 07–09 (componentes e página consomem os hooks)

### Related ADRs
- [ADR-003: expectedStageId](../adrs/adr-003.md)
- [ADR-004: @dnd-kit](../adrs/adr-004.md)

## Deliverables
- Dependências instaladas + `hooks/use-crm-board.ts` + `hooks/use-crm-stats.ts` + testes

## Tests
- Unit tests:
  - [ ] `moveCase` sucesso: card migra de coluna no cache e PATCH é chamado com `expectedStageId` correto
  - [ ] `moveCase` com erro 409: cache volta ao estado original e erro expõe etapa atual
  - [ ] `moveCase` com transição inválida: PATCH não é chamado (bloqueio de UX) ou erro mapeado
  - [ ] Filtros alterados geram nova chave SWR (nova requisição)
  - [ ] `loadMore` incrementa página apenas da coluna indicada
  - [ ] Realtime emitindo UPDATE revalida o board (debounce aplicado)
- Integration tests:
  - [ ] N/A (validação end-to-end nas tasks 08–09)
- Test coverage target: >=80% dos hooks
- All tests must pass

## Success Criteria
- All tests passing; board nunca fica divergente do backend após erro (rollback garantido)
- DnD instalado sem quebrar `npm run build`
