---
status: completed
title: API de leitura /api/conversations (lista agregada + detalhe)
type: backend
complexity: high
dependencies:
  - task_03
---

# Task 05: API de leitura `/api/conversations`

## Overview

Expõe as duas rotas de leitura da Central sobre o `conversation-service`: `GET /api/conversations` (lista paginada server-side com filtros, busca e agregações) e `GET /api/conversations/[caseId]` (detalhe completo com permissões). Rotas finas — toda lógica vive no service.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST `GET /api/conversations` aceitar query params `page, limit, search, filter, assignee, tenant_id` conforme TechSpec (seção Endpoints) e retornar `{conversations, total, page, totalPages}`
- MUST validar `filter` contra whitelist (`all|unread|ai|human|waiting_debtor|waiting_operator|negotiating|closed|mine`) e `assignee` apenas para role >= gestor (senão ignorar/403)
- MUST `GET /api/conversations/[caseId]` retornar mensagens asc, eventos, contexto (case/client/contract/financial_title/negociação), permissões derivadas, `conversation_version` e não lidas; 404 quando caso inexistente ou de outro tenant
- MUST autenticar via `requireTenantContext` em ambas (padrão das rotas existentes)
- MUST aplicar rate limit via `lib/rate-limit.ts` na lista (debounce 300ms já no cliente)
- Respostas de erro no padrão das rotas existentes (JSON `{error}` com status adequado)
</requirements>

## Subtasks
- [ ] 5.1 Criar `app/api/conversations/route.ts` (GET lista)
- [ ] 5.2 Criar `app/api/conversations/[caseId]/route.ts` (GET detalhe)
- [ ] 5.3 Whitelists de parâmetros + defaults de paginação
- [ ] 5.4 Testes das rotas

## Implementation Details

Seguir o padrão de `app/api/cases/route.ts` (query params + paginação) e `app/api/cases/[id]/route.ts` (detalhe). `assignee` restrito a gestor+ espelha o padrão de `requireRole` em `lib/api-auth.ts`.

### Relevant Files
- `app/api/cases/route.ts` — padrão de paginação/filtros
- `app/api/cases/[id]/route.ts` — padrão de detalhe + 404
- `lib/api-auth.ts` — `requireTenantContext`, `requireRole`
- `lib/rate-limit.ts`, `lib/api-validate.ts` — validação e rate limit

### Dependent Files
- `lib/conversation-service.ts` — implementação
- Tasks 07–10 (hooks/UI consomem estas rotas)

### Related ADRs
- [ADR-003: Recurso /api/conversations](../adrs/adr-003.md)

## Deliverables
- 2 rotas GET funcionais
- Testes co-localizados (`app/api/conversations/route.test.ts` etc.)

## Tests
- Unit tests:
  - [ ] GET lista sem sessão → 401 (padrão middleware/api-auth)
  - [ ] GET lista com filtro inválido → 400
  - [ ] GET lista com `assignee` para role operador → ignorado ou 403
  - [ ] GET detalhe de caso de outro tenant → 404
  - [ ] GET detalhe retorna permissões derivadas do requesting user
- Integration tests:
  - [ ] N/A (validação manual com migração aplicada)
- Test coverage target: >=80% dos handlers
- All tests must pass

## Success Criteria
- All tests passing
- Lista retorna agregações corretas para uma base de teste com múltiplos filtros
