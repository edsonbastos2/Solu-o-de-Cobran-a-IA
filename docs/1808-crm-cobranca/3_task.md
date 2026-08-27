---
status: completed
title: "`lib/crm/board-service.ts` + `GET /api/crm/board` + `GET /api/crm/stats`"
type: backend
complexity: high
dependencies:
  - task_01
---

# Task 03: `lib/crm/board-service.ts` + API de leitura do CRM

## Overview

Leitura agregada do board: colunas por etapa com primeiro lote de casos, totais reais, paginação por coluna ("carregar mais"), filtros server-side (busca, operador, prioridade) e escopo por papel (operador só seus casos). Indicadores do dashboard no mesmo escopo de acesso.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST implementar `getBoard(db, ctx, params)` em `lib/crm/board-service.ts`: sem `stage`, retorna as 11 colunas (`CRM_STAGE_META`) com primeiro lote (`limit` padrão 20) e `total`/`totalPages` reais por coluna; com `stage`, retorna apenas a coluna indicada na `page` solicitada
- MUST montar cada `CrmBoardCase` conforme o TechSpec: nº do caso, nome e documento mascarado do cliente, valor atual, vencimento, último contato (timestamp da última mensagem), `controller`, `priority`, operador responsável (nome via `tenant_members`/`profiles`)
- MUST escopo por papel: operador recebe apenas casos com `assigned_user_id = userId`; gestor+ recebe todos do tenant; parâmetro `operator` (`userId|unassigned|all`) disponível apenas para gestor+ (ignorado/403 para operador)
- MUST busca server-side (`search`) por nome do cliente, documento e número do caso, no padrão de `GET /api/cases`
- MUST filtro `priority` aplicado server-side
- MUST TODA consulta filtrar por `tenant_id` do contexto autenticado
- MUST `getStats(db, ctx)` computar os 8 indicadores de `CrmStats` (TechSpec "Endpoints de API"), com valor recuperado = soma de `agreed_value` de negociações `accepted|fulfilled` no escopo
- MUST as rotas `app/api/crm/board/route.ts` e `app/api/crm/stats/route.ts` serem finas (auth + service + resposta)
</requirements>

## Subtasks
- [ ] 3.1 Query agregada do board (colunas, lotes, totais, filtros, escopo)
- [ ] 3.2 Montagem do `CrmBoardCase` (joins cliente/título/última mensagem/operador, máscara de documento)
- [ ] 3.3 `getStats` com os 8 indicadores
- [ ] 3.4 Rotas `/api/crm/board` e `/api/crm/stats`
- [ ] 3.5 Testes unitários do service (db mockado)

## Implementation Details

Mask documents on the server (never expose full CPF/CNPJ to the board). Last contact via max(`messages.created_at`) per case. Reuse the nested-select/join style of `app/api/cases/route.ts`. See TechSpec sections "Interfaces Principais" and "Endpoints de API".

### Relevant Files
- `app/api/cases/route.ts` — padrão de lista paginada, busca e joins
- `lib/crm/stages.ts` — `CRM_STAGE_META` (ordem das colunas)
- `lib/api-auth.ts` — `requireTenantContext`, `ROLE_RANK`
- `lib/types.ts` — `CrmBoardCase`, `CrmBoardColumn`, `CrmStats` (task 01)

### Dependent Files
- Task 06 (hooks consomem os endpoints), Task 07 (stats alimentam `CrmStats`)

### Related ADRs
- [ADR-003: API dedicada /api/crm](../adrs/adr-003.md)

## Deliverables
- `lib/crm/board-service.ts` + rotas `app/api/crm/board/route.ts`, `app/api/crm/stats/route.ts`
- Testes `lib/crm/board-service.test.ts`

## Tests
- Unit tests:
  - [ ] Operador recebe apenas casos atribuídos a si, em todas as colunas
  - [ ] Gestor recebe todos os casos do tenant; `operator=unassigned` filtra corretamente
  - [ ] `search` por nome/documento/nº do caso encontra o caso esperado
  - [ ] `priority=alta` retorna apenas casos de prioridade alta
  - [ ] `stage=EM_NEGOCIACAO&page=2` retorna a segunda página apenas da coluna indicada
  - [ ] Documento do cliente retorna mascarado (`***.***.***-12`)
  - [ ] `getStats`: valor recuperado soma apenas negociações `accepted|fulfilled`; contadores batem com o escopo (operador vs tenant)
  - [ ] Caso de outro tenant nunca aparece (filtro `tenant_id`)
- Integration tests:
  - [ ] `GET /api/crm/board` e `GET /api/crm/stats` retornam 200 com shape `{ columns }`/`{ stats }`; sem sessão → 401
- Test coverage target: >=80% do `board-service.ts`
- All tests must pass

## Success Criteria
- All tests passing; board nunca carrega todas as cases do tenant sem paginação
- Nenhum dado de outro tenant ou de outro operador (para operadores) nas respostas
