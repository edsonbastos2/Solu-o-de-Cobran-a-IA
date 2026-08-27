---
status: completed
title: "`lib/crm/stage-service.ts` + `PATCH /api/cases/[id]/stage`"
type: backend
complexity: high
dependencies:
  - task_01
---

# Task 02: `lib/crm/stage-service.ts` + `PATCH /api/cases/[id]/stage`

## Overview

Operação de domínio da movimentação de etapa: valida tenant, permissão (operador só casos seus; gestor+ qualquer caso), transição permitida e concorrência (`expectedStageId`), atualiza `crm_stage` com sincronização de `status`, grava `case_stage_history` e `audit_logs`. Expõe `PATCH /api/cases/[id]/stage`.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST implementar `moveCaseStage(db, ctx: TenantContext, caseId, { stageId, expectedStageId?, reason? })` retornando `StageActionResult` (union discriminada por `ok`) com `error_code` estável: `NOT_FOUND | FORBIDDEN | INVALID_TRANSITION | STAGE_CONFLICT | VALIDATION_ERROR`
- MUST resolver tenant exclusivamente via `requireTenantContext` (contexto autenticado); nunca confiar em tenant do body/query
- MUST validar permissão: operador (`ROLE_RANK < gestor`) só move caso com `assigned_user_id = userId`; gestor/admin/owner movem qualquer caso do tenant; super-admin via override existente
- MUST validar transição com `canTransition` do domínio (task 01) — regra nunca duplicada na rota
- MUST concorrência otimista: quando `expectedStageId` informado e `crm_stage` atual divergir, retornar `STAGE_CONFLICT` (HTTP 409) incluindo a etapa atual na resposta
- MUST atualizar `crm_stage` e `status` (via `statusForStage`) na mesma operação, gravar registro em `case_stage_history` (from_stage, to_stage, changed_by, reason) e auditoria `CASE_STAGE_CHANGED` com `before_state`/`after_state` via `recordAuditAction`
- MUST `stageId` inválido (fora de `CRM_STAGES`) retornar `VALIDATION_ERROR` (HTTP 400)
- MUST a rota `app/api/cases/[id]/stage/route.ts` ser fina: validar body com `validateFields`, chamar o service e mapear `error_code` → status HTTP (400/403/404/409)
</requirements>

## Subtasks
- [ ] 2.1 `moveCaseStage` com todas as validações e resultados tipados
- [ ] 2.2 Gravação de histórico + auditoria + sincronização de status
- [ ] 2.3 Rota `PATCH /api/cases/[id]/stage` com mapeamento de erros
- [ ] 2.4 Testes unitários do service (db mockado) e da rota

## Implementation Details

Follow the service pattern of `lib/conversation-service.ts` (typed results, no exceptions for expected failures; optimistic concurrency via conditioned UPDATE — here conditioned on `crm_stage = expectedStageId` when provided). Route thin, mirroring `app/api/conversations/[caseId]/takeover/route.ts`. See TechSpec sections "Interfaces Principais" and "Endpoints de API".

### Relevant Files
- `lib/crm/stages.ts` — domínio (task 01)
- `lib/api-auth.ts` — `requireTenantContext`, `TenantContext`, `ROLE_RANK`
- `lib/audit.ts` — `recordAuditAction`
- `lib/api-validate.ts` — `validateFields`
- `lib/conversation-service.ts` — padrão de resultado tipado e UPDATE condicionado
- `app/api/conversations/[caseId]/takeover/route.ts` — padrão de rota de ação

### Dependent Files
- Task 06 (`use-crm-board` chama o endpoint), Task 10 (detalhe do caso usa ações de etapa)

### Related ADRs
- [ADR-002: Domínio em código + tabela dedicada de histórico](../adrs/adr-002.md)
- [ADR-003: API dedicada + expectedStageId](../adrs/adr-003.md)

## Deliverables
- `lib/crm/stage-service.ts` + `app/api/cases/[id]/stage/route.ts`
- Testes `lib/crm/stage-service.test.ts`

## Tests
- Unit tests:
  - [ ] Operador move caso atribuído a si → ok, `crm_stage` e `status` atualizados, histórico e auditoria gravados
  - [ ] Operador move caso de outro operador → FORBIDDEN (403)
  - [ ] Gestor move qualquer caso do tenant → ok
  - [ ] Transição proibida (ex.: `ENCERRADO → NOVO`) → INVALID_TRANSITION
  - [ ] `expectedStageId` divergente da etapa atual → STAGE_CONFLICT com etapa atual no payload
  - [ ] Caso inexistente ou de outro tenant → NOT_FOUND (sem vazar existência)
  - [ ] `stageId` fora do enum → VALIDATION_ERROR
- Integration tests:
  - [ ] `PATCH /api/cases/[id]/stage` mapeia cada `error_code` para o HTTP correto (400/403/404/409/200)
- Test coverage target: >=80% do `stage-service.ts`
- All tests must pass

## Success Criteria
- All tests passing; nenhuma mutação de etapa fora do service
- Resposta de 409 inclui a etapa atual para o cliente reconciliar o board
