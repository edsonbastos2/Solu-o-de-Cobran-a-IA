---
status: completed
title: Hooks de dados da Central (SWR + realtime + ações)
type: frontend
complexity: medium
dependencies:
  - task_05
  - task_06
---

# Task 07: Hooks de dados da Central

## Overview

Cria a ponte única entre UI e API da Central: `use-conversations.ts` (lista com filtros/busca/debounce/paginação + realtime) e `use-conversation.ts` (detalhe da conversa aberta + ações takeover/return/transfer/read/send + marcação de leitura). Componentes das tasks 08–10 nunca chamam fetch diretamente.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST `useConversations(params)` usar SWR com `fetcher` de `lib/api.ts`, query string com filtros/busca/page, debounce de busca 300ms e `refreshInterval: 10000` (polling de segurança)
- MUST `useConversation(caseId)` usar SWR com `refreshInterval: 4000` e subscription realtime do browser client (`postgres_changes` em `messages` e `cases`) como gatilho de `mutate()` — padrão de `app/(dashboard)/cases/[id]/page.tsx` (linhas ~559-601)
- MUST expor ações: `sendMessage` (POST `/api/agent-message`), `takeOver`, `returnToAI`, `transfer`, `markRead` — com estados loading/erro por ação e tratamento de 409 (revalidar conversa + sinalizar conflito para a UI)
- MUST marcar como lida ao abrir a conversa (quando `unreadCount > 0`)
- MUST os hooks tratarem cliente Supabase nulo (demo mode) graciosamente
- MUST `useConversations` revalidar lista quando ações concluem (takeover/transfer mudam condutor/responsável)
</requirements>

## Subtasks
- [ ] 7.1 `hooks/use-conversations.ts` (SWR + debounce + paginação + refresh)
- [ ] 7.2 `hooks/use-conversation.ts` (SWR + realtime + ações + markRead on open)
- [ ] 7.3 Tratamento centralizado de erros de ação (incl. 409)
- [ ] 7.4 Testes com renderHook + mock do SWR/fetcher

## Implementation Details

Realtime: `supabase.channel('conversations').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => mutate())` — sem filtro por tenant (limitação do postgres_changes), revalidação conservadora, polling de segurança cobre. Cleanup de canal no unmount. Erros de ação retornados como objetos tipados para os componentes decidirem a apresentação.

### Relevant Files
- `lib/api.ts` — `fetcher`, `fetchWithAuth`
- `app/(dashboard)/cases/[id]/page.tsx` — padrão realtime + SWR a extrair
- `lib/supabase.ts` — browser client
- `hooks/use-active-tenant.ts` — `tenantPath` para propagar `tenant_id`

### Dependent Files
- Tasks 08–10 (componentes consomem exclusivamente estes hooks)

### Related ADRs
- [ADR-003: Recurso /api/conversations](../adrs/adr-003.md)

## Deliverables
- 2 hooks documentados e tipados
- Testes co-localizados (`hooks/use-conversations.test.ts` etc.)

## Tests
- Unit tests:
  - [ ] `useConversations` monta query string com filtros corretos (filter=unread&search=joão&page=2)
  - [ ] Busca com debounce: duas digitações rápidas geram uma requisição
  - [ ] `useConversation` chama markRead ao abrir com unreadCount > 0
  - [ ] Ação com resposta 409 revalida e expõe flag de conflito
  - [ ] `takeOver` sucesso dispara revalidação da lista
- Integration tests:
  - [ ] N/A
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Nenhum componente das tasks 08–10 importa fetch/axios diretamente
