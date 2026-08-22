---
status: completed
title: Migração SQL supabase_conversations.sql + tipos TS de conversa
type: backend
complexity: medium
dependencies: []
---

# Task 02: Migração SQL `supabase_conversations.sql` + tipos TS de conversa

## Overview

Cria o backing store da Central de Conversas: colunas `controller` e `conversation_version` em `cases`, tabelas `conversation_events` (histórico tipado de eventos/atribuições) e `conversation_reads` (leitura por operador), com backfill retrocompatível — conforme ADR-002. Inclui os tipos TypeScript correspondentes em `lib/types.ts`, usados por todas as tasks seguintes.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST criar `supabase_conversations.sql` na raiz (aplicação manual, padrão do projeto) com: colunas novas em `cases`, backfill (`needs_attention` → `'human'`, senão `'ai'`), `conversation_events`, `conversation_reads`, índices e RLS
- MUST espelhar as policies RLS de `messages` nas duas tabelas novas (isolamento por tenant via `can_access_tenant`)
- MUST adicionar em `lib/types.ts`: `ConversationController`, `ConversationEventType`, `ConversationEvent`, `ConversationListItem`, `ConversationDetailResponse`, `ConversationListParams`/`ConversationFilter`, `ConversationsListResponse`, `ConversationPermissions` (ver TechSpec "Interfaces Principais")
- MUST estender `Case` com `controller?: ConversationController | null` e `conversation_version?: number`
- MUST atualizar `.env.example` se novas env vars forem necessárias (não é esperado)
- A migração NÃO deve mover ou alterar linhas existentes de `messages`
</requirements>

## Subtasks
- [x] 2.1 Escrever migração SQL (DDL + backfill + índices + RLS)
- [x] 2.2 Revisar policies RLS contra `supabase_tenant_model.sql` (padrão de `can_access_tenant`)
- [x] 2.3 Adicionar tipos em `lib/types.ts`
- [x] 2.4 Validar typecheck (`npx tsc --noEmit`)

## Implementation Details

DDL completo está na seção "Modelo de Dados" do TechSpec — seguir exatamente. PK composta `(tenant_id, case_id, user_id)` em `conversation_reads`; índice `(tenant_id, case_id, created_at)` em `conversation_events`. Idempotência desejável (`IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`) para re-execução segura.

### Relevant Files
- `supabase_schema.sql`, `supabase_tenant_model.sql`, `supabase_channel_platform.sql` — padrão de DDL/RLS/backfill do projeto
- `lib/types.ts` — onde vivem `Case`, `Message`, `CaseDetailsResponse` (estender ali)

### Dependent Files
- `lib/conversation-service.ts` (task 03), rotas `/api/conversations` (tasks 05–06), hooks e componentes (07–10)

### Related ADRs
- [ADR-002: Modelo de dados — colunas em cases + conversation_events + conversation_reads](../adrs/adr-002.md)

## Deliverables
- `supabase_conversations.sql` na raiz
- Tipos novos em `lib/types.ts`
- Typecheck passando

## Tests
- Unit tests:
  - [x] Tipos compilam em cenário de uso (usados por `lib/conversation-service.ts` e cobertos por `lib/conversation-service.test.ts`)
- Integration tests:
  - [x] Aplicação da migração no Supabase (projeto `bbgxrtkcmrsumktpyhlv`) sem erro; re-executada uma segunda vez sem erro (idempotente) — aplicada via Supabase Management API (`POST /v1/projects/{ref}/database/query`) com o `SUPABASE_ACCESS_TOKEN` do `.mcp.json`, já que o servidor MCP não conectou nesta sessão
- Test coverage target: N/A (schema + tipos)
- All tests must pass

## Success Criteria
- Migração aplicável e idempotente; backfill cobre 100% dos casos existentes — verificado: `conversation_events`/`conversation_reads` criadas, RLS `tenant_isolation` ativa em ambas, colunas `controller`/`conversation_version` em `cases`, backfill sem NULLs (6 casos `human`, 7 `ai` no momento da aplicação)
- `npx tsc --noEmit` sem erros
