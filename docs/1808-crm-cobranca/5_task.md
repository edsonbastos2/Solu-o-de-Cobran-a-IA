---
status: completed
title: "`PATCH /api/cases/[id]` com `priority` + GET estendido (`stage_history`)"
type: backend
complexity: medium
dependencies:
  - task_01
---

# Task 05: Prioridade no PATCH do caso + GET estendido

## Overview

Estende a API existente do caso: `PATCH /api/cases/[id]` passa a aceitar `priority` (com validação e auditoria própria) e `GET /api/cases/[id]` passa a retornar `crm_stage`, `priority` e o histórico de movimentação (`stage_history`).

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST `PATCH /api/cases/[id]` aceitar `priority` com valor em `alta|media|baixa`; valor inválido → 400
- MUST mudança de prioridade gravar auditoria `CASE_PRIORITY_CHANGED` com before/after (padrão já usado para `CASE_ASSIGNMENT_CHANGE`)
- MUST manter inalteradas as validações existentes de `status`, `assigned_user_id` e `active_channel` (inclusive permissão `gestor` para o PATCH — prioridade segue a mesma regra de permissão do PATCH atual, conforme decisão de o operador editar prioridade apenas do seu caso: operador só pode alterar prioridade de caso atribuído a si)
- MUST `GET /api/cases/[id]` retornar `crm_stage`, `priority` e `stage_history: CaseStageHistoryEntry[]` (desc por `created_at`), com nome do autor quando disponível
- MUST `CaseDetailsResponse` em `lib/types.ts` refletir os campos novos

</requirements>

## Subtasks
- [ ] 5.1 Aceitar `priority` no PATCH com validação + auditoria + regra de posse para operadores
- [ ] 5.2 GET estendido com `stage_history` (join com `profiles` para nome do autor)
- [ ] 5.3 Tipos atualizados + testes

## Implementation Details

Extend the existing switch/if of allowed fields in `app/api/cases/[id]/route.ts` — do not create a new endpoint. History query mirrors `audit_logs` retrieval already in the route. See TechSpec "Endpoints de API".

### Relevant Files
- `app/api/cases/[id]/route.ts` — PATCH (campos aceitos, auditoria) e GET (resposta)
- `lib/types.ts` — `CaseDetailsResponse`
- `lib/audit.ts` — `recordAuditAction`

### Dependent Files
- Task 10 (página de detalhes exibe etapa/prioridade/histórico), Task 08 (card permite editar prioridade via PATCH)

### Related ADRs
- [ADR-002](../adrs/adr-002.md)

## Deliverables
- PATCH/GET estendidos + tipos + testes

## Tests
- Unit tests:
  - [ ] PATCH com `priority` válida atualiza e audita `CASE_PRIORITY_CHANGED`
  - [ ] PATCH com `priority` inválida → 400
  - [ ] Operador altera prioridade de caso atribuído a si → ok; caso de outro → 403
  - [ ] GET retorna `stage_history` desc com autor nomeado
- Integration tests:
  - [ ] `GET /api/cases/[id]` inclui `crm_stage`, `priority`, `stage_history` no payload 200
- Test coverage target: >=80% das linhas novas
- All tests must pass

## Success Criteria
- All tests passing; nenhum campo existente do PATCH regrediu (status/assignee/canal)
