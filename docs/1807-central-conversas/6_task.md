---
status: completed
title: API de ações (takeover, return-to-ai, transfer, read)
type: backend
complexity: high
dependencies:
  - task_05
---

# Task 06: API de ações (takeover, return-to-ai, transfer, read)

## Overview

Expõe as quatro rotas de ação da Central sobre o `conversation-service`: assumir conversa, devolver para IA, transferir entre operadores e marcar leitura — com validação de permissão, isolamento por tenant e concorrência otimista (`expectedVersion` → 409 em conflito).

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST criar `POST /api/conversations/[caseId]/takeover` (body `{expectedVersion}`): permissão qualquer membro ativo; retorna conversa atualizada
- MUST criar `POST /api/conversations/[caseId]/return-to-ai` (body `{expectedVersion}`): permissão `canReturnToAI`; IA não dispara mensagem automática
- MUST criar `POST /api/conversations/[caseId]/transfer` (body `{toOperatorId, reason?, expectedVersion}`): `requireRole('gestor')`; retorna conversa atualizada
- MUST criar `POST /api/conversations/[caseId]/read`: upsert de leitura, idempotente
- MUST mapear error codes do service para HTTP: `NOT_FOUND`→404, `FORBIDDEN`→403, `VERSION_CONFLICT`→409, `INVALID_OPERATOR`/`INVALID_STATE`→400/422
- MUST autenticar via `requireTenantContext` e aplicar rate limit nas ações de escrita
- Handlers finos: validação de body + delegação ao service
</requirements>

## Subtasks
- [ ] 6.1 Rota takeover
- [ ] 6.2 Rota return-to-ai
- [ ] 6.3 Rota transfer (validação de body: `toOperatorId` obrigatório, `reason` opcional ≤500 chars)
- [ ] 6.4 Rota read
- [ ] 6.5 Testes das rotas

## Implementation Details

Mesmo padrão de diretório de `app/api/conversations/[caseId]/...` criado na task 05. Usar `validateFields` de `lib/api-validate.ts` para o body. Erros 409 devem carregar mensagem acionável ("conversa alterada por outro operador, atualize") para a UI.

### Relevant Files
- `app/api/agent-message/route.ts` — padrão de rota de escrita com auditoria
- `lib/api-validate.ts`, `lib/rate-limit.ts` — validação/rate limit
- `lib/conversation-service.ts` — implementação das ações

### Dependent Files
- Task 07 (hooks chamam estas rotas), task 09 (TakeoverBar/TransferDialog via hooks)

### Related ADRs
- [ADR-003: Recurso /api/conversations](../adrs/adr-003.md)

## Deliverables
- 4 rotas POST funcionais
- Testes co-localizados

## Tests
- Unit tests:
  - [ ] Takeover sem `expectedVersion` → 400
  - [ ] Takeover com versão conflitante → 409 com mensagem acionável
  - [ ] Transfer para operador de outro tenant → 4xx INVALID_OPERATOR
  - [ ] Transfer por operador sem permissão → 403
  - [ ] Return-to-ai com sucesso → 200 e `assigned_user_id` limpo
  - [ ] Read idempotente (segunda chamada não duplica)
- Integration tests:
  - [ ] N/A (fluxo completo validado via hooks/UI nas tasks 07+ e checklist manual)
- Test coverage target: >=80% dos handlers
- All tests must pass

## Success Criteria
- All tests passing
- Sequência takeover → transfer → return-to-ai com versionamento coerente (cada ação incrementa versão)
