---
status: completed
title: lib/conversation-service.ts — domínio da conversa
type: backend
complexity: high
dependencies:
  - task_01
  - task_02
---

# Task 03: `lib/conversation-service.ts` — domínio da conversa

## Overview

Implementa o coração do backend da Central: query agregada da lista de conversas (última mensagem, não lidas, filtros, busca, paginação), leitura do detalhe, transições de condutor (takeover/devolução), transferência entre operadores com validações e concorrência otimista, derivação de permissões por role e o helper `isAIPaused`. Ponto único que escreve `cases.controller` (ADR-003).

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST implementar as assinaturas da seção "Interfaces Principais" do TechSpec: `listConversations`, `getConversation`, `takeOverConversation`, `returnConversationToAI`, `transferConversation`, além de `markConversationRead` e `deriveConversationPermissions(role, { assignedToMe, controller })`
- MUST usar concorrência otimista: UPDATE condicionado a `.eq('conversation_version', expectedVersion)`; zero linhas → resultado `VERSION_CONFLICT`
- MUST validar em `transferConversation`: mesmo tenant, `tenant_members.status='active'` do destinatário, role destinatário apta, permissão `canTransfer` (role >= gestor), estado da conversa transferível; controller permanece `human`
- MUST toda ação gravar evento em `conversation_events` com payload (de/para/motivo quando aplicável) E auditoria via `recordAuditAction` (padrão de `lib/audit.ts`)
- MUST `isAIPaused(case)`: `controller==='human'` || (`controller` nulo/legado && `status==='needs_attention'`)
- MUST a query agregada computar `waiting_debtor`/`waiting_operator` conforme derivação do TechSpec (seção Endpoints) e contar não lidas como `messages` com `role='user'` e `created_at > last_read_at` (sem row de leitura = tudo não lido)
- MUST filtrar TODAS as queries por `tenant_id` (isolamento não negociável) e buscar nome do operador atual via `tenant_members`/`profiles`
- `returnConversationToAI` NÃO dispara mensagem automática da IA
</requirements>

## Subtasks
- [ ] 3.1 Query agregada da lista (filtros, busca, paginação, última mensagem, não lidas, operador atual)
- [ ] 3.2 `getConversation` (mensagens asc, eventos, contexto do caso, permissões, versão)
- [ ] 3.3 `isAIPaused` + `deriveConversationPermissions`
- [ ] 3.4 Transições: takeover, return-to-ai, transfer com eventos + auditoria + versão
- [ ] 3.5 `markConversationRead` (upsert)
- [ ] 3.6 Testes unitários com mock do cliente Supabase

## Implementation Details

Criar `lib/conversation-service.ts`. Busca por conteúdo de mensagem/contrato/cobrança pode usar `ilike`/`textSearch` sobre joins (`cases` + `messages` + `contracts.contract_number` + `financial_titles`). Seguir o estilo de `app/api/cases/[id]/route.ts` para montagem de contexto (case + client + contract + financial_title). Erros como valores de retorno tipados (`ConversationActionResult`), não exceptions, nas ações.

### Relevant Files
- `lib/types.ts` — tipos da task 02
- `lib/api-auth.ts` — `TenantContext`, `ROLE_RANK` (owner>admin>gestor>operador)
- `lib/audit.ts` — `recordAuditAction`
- `app/api/cases/[id]/route.ts` — padrão de query de contexto do caso
- `app/api/agent-message/route.ts` — padrão de auditoria + transação de status

### Dependent Files
- Tasks 04 (pipeline usa `isAIPaused`), 05–06 (rotas chamam o service), 07 (hooks consomem as rotas)

### Related ADRs
- [ADR-002: Modelo de dados](../adrs/adr-002.md)
- [ADR-003: Recurso /api/conversations e condutor explícito](../adrs/adr-003.md)

## Deliverables
- `lib/conversation-service.ts` com as funções públicas do TechSpec
- Testes unitários co-localizados (`lib/conversation-service.test.ts`) com mock do Supabase client

## Tests
- Unit tests:
  - [ ] `isAIPaused`: controller='human' → true; controller='ai' → false; NULL + needs_attention → true; NULL + in_negotiation → false
  - [ ] `deriveConversationPermissions`: operador atribuído pode enviar/devolver; gestor+ transfere; admin+ completa; operador não atribuído não envia
  - [ ] `takeOverConversation`: sucesso incrementa versão, seta controller/assigned, grava evento HUMAN_TAKEOVER e auditoria
  - [ ] Ações com versão desatualizada retornam VERSION_CONFLICT (update afeta 0 linhas)
  - [ ] `transferConversation`: destinatário de outro tenant → INVALID_OPERATOR; destinatário inativo → INVALID_OPERATOR; sem permissão → FORBIDDEN; sucesso mantém controller='human' e grava TRANSFERRED com payload de/para/motivo
  - [ ] Lista: filtro unread retorna apenas conversas com mensagens do devedor após last_read_at; busca por conteúdo encontra conversa
- Integration tests:
  - [ ] N/A (validação end-to-end na task 05/06 via rotas e checklist manual)
- Test coverage target: >=80% do `conversation-service.ts`
- All tests must pass

## Success Criteria
- All tests passing; cobertura >=80% do service
- Nenhum ponto fora do service escreve `cases.controller`
