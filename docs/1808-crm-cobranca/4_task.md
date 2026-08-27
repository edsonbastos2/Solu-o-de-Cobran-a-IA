---
status: completed
title: Transferência 1807 estendida (operador titular pode transferir)
type: backend
complexity: medium
dependencies:
  - task_01
---

# Task 04: Transferência 1807 estendida

## Overview

Relaxa a permissão da transferência de conversa (`POST /api/conversations/[caseId]/transfer`) para permitir que o operador titular do caso transfira para outro operador — requisito do CRM — mantendo a 1807 como única via de transferência (evento `TRANSFERRED`, auditoria, `conversation_version`).

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST a permissão de transferência passar a aceitar: role >= gestor **OU** (`assigned_user_id` do caso = `userId` do solicitante)
- MUST manter todas as validações existentes: mesmo tenant, destinatário `tenant_members.status='active'`, `expectedVersion` (concorrência), gravação de evento `TRANSFERRED` com payload de/para/motivo e auditoria
- MUST o comportamento da Central de Conversas permanecer inalterado para gestores/admins (sem regressão)
- MUST atualizar `deriveConversationPermissions` (ou ponto equivalente) para refletir `canTransfer` ao operador titular, mantendo a UI da Central consistente
</requirements>

## Subtasks
- [ ] 4.1 Estender a checagem de permissão em `lib/conversation-service.ts` (`transferConversation` + `deriveConversationPermissions`)
- [ ] 4.2 Ajustar a rota `app/api/conversations/[caseId]/transfer/route.ts` se a checagem morar na rota
- [ ] 4.3 Testes de permissão: titular, não titular, gestor, destinatário inválido

## Implementation Details

Minimal change: the ownership check (`case.assigned_user_id === userId`) complements the existing `ROLE_RANK` check in the same function. Do not duplicate transfer semantics in a new endpoint. See TechSpec "Endpoints de API" (linha da transferência estendida).

### Relevant Files
- `lib/conversation-service.ts` — `transferConversation`, `deriveConversationPermissions`
- `app/api/conversations/[caseId]/transfer/route.ts` — rota existente
- `lib/api-auth.ts` — `ROLE_RANK`

### Dependent Files
- Task 08 (`CrmTransferDialog` usa o endpoint), componentes da Central (badge/botão de transferência podem aparecer para titular)

### Related ADRs
- [ADR-003: Transferência reutilizando a 1807](../adrs/adr-003.md)

## Deliverables
- Permissão estendida + testes atualizados/criados

## Tests
- Unit tests:
  - [ ] Operador titular transfere caso atribuído a si → ok, evento `TRANSFERRED` e auditoria gravados
  - [ ] Operador não titular transfere caso de outro → FORBIDDEN
  - [ ] Gestor transfere qualquer caso → ok (comportamento inalterado)
  - [ ] `deriveConversationPermissions`: operador titular agora recebe `canTransfer: true`; operador não titular continua `false`
  - [ ] Destinatário inativo/fora do tenant → INVALID_OPERATOR (regressão preservada)
  - [ ] `expectedVersion` desatualizado → VERSION_CONFLICT (regressão preservada)
- Integration tests:
  - [ ] `POST /api/conversations/[caseId]/transfer` como operador titular → 200; como operador não titular → 403
- Test coverage target: manter cobertura >=80% do `conversation-service.ts`
- All tests must pass

## Success Criteria
- All tests passing (incluindo os existentes da 1807, sem regressão)
- Transferência continua com uma única implementação
