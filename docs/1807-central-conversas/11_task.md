---
status: completed
title: Refatoração da página de caso (chat → Central) + verificação final
type: refactor
complexity: medium
dependencies:
  - task_10
---

# Task 11: Refatoração da página de caso (chat → Central) + verificação final

## Overview

Concretiza o "Central é o lar do chat": remove o painel de chat monolítico de `app/(dashboard)/cases/[id]/page.tsx`, substituindo-o por um card "Conversa" com resumo (última mensagem, condutor, não lidas) e botão "Abrir conversa" para `/conversations?case=<id>`. As ações de gestão não-chat (canal ativo, troca de status, dossiê, insights) permanecem intactas. Fecha com verificação completa do fluxo.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST remover do `cases/[id]/page.tsx`: feed de mensagens inline, input de intervenção humana (`handleSendHumanMessage`) e subscription realtime de `messages` (a de `cases` permanece)
- MUST adicionar card "Conversa": condutor atual, responsável, não lidas, última mensagem e CTA "Abrir conversa" → `/conversations?case=<id>` (com tenantPath)
- MUST preservar na página: seletor de canal ativo (gestor), troca de status, dossiê, insights IA, acordos, auditoria, processo jurídico, quarentena
- MUST remover imports/código mortos (~700 linhas esperadas) mantendo typecheck limpo
- MUST executar verificação final completa: `npm run lint && npm run build && npm test`
- MUST validar manualmente o critério de aceite do PRD: fluxo abrir → contexto → assumir → negociar → devolver/transferir sem sair da Central, sem perder histórico, IA pausada durante humano
</requirements>

## Subtasks
- [x] 11.1 Extrair card "Conversa" (resumo + CTA) e remover chat inline — componente próprio em `components/cases/conversation-summary-card.tsx` (Next.js App Router não permite exports nomeados extras em `page.tsx`)
- [x] 11.2 Limpar código morto (realtime de `messages`, `handleSendHumanMessage`, `humanMessage`/`isSending`/`chatBottomRef`, imports não usados — `Bot`, `ShieldAlert`, `Send`, `MessageCircle`, `useRef`, `useConversation`, `ClientChannel`)
- [x] 11.3 Revisar ações preservadas (canal ativo, status, dossiê, insights) — canal ativo e status do caso relocados para dentro do card "Conversa" (mesmos handlers/estado do componente pai); dossiê, insights IA, acordos, auditoria, processo jurídico e quarentena intactos
- [x] 11.4 Verificação final: lint + build + test + checklist do critério de aceite do PRD

## Implementation Details

O card "Conversa" pode consumir `useConversation` (task 07) para o resumo — sem duplicar fetch de mensagens. O deep-link é suportado pela task 10. Não alterar endpoints de caso (`PATCH /api/cases/[id]` continua sendo usado pelo seletor de canal/status).

### Relevant Files
- `app/(dashboard)/cases/[id]/page.tsx` — chat monolítico (~1200 linhas) a reduzir
- `hooks/use-conversation.ts` — resumo do card
- `lib/navigation.ts` — link com tenantPath

### Dependent Files
- `app/(dashboard)/conversations/page.tsx` — destino do CTA

### Related ADRs
- [ADR-001: Conversa = caso enriquecido](../adrs/adr-001.md)

## Deliverables
- Página de caso sem chat inline, com card "Conversa" e CTA
- Código morto removido
- Evidência fresca de lint/build/test passando

## Tests
- Unit tests:
  - [x] Card "Conversa" renderiza condutor, não lidas e CTA com link correto (incl. tenant_id) — `components/cases/conversation-summary-card.test.tsx` (4 testes: condutor humano/IA, skeleton de loading, seletor de canal condicional)
- Integration tests:
  - [ ] Fluxo E2E manual (checklist do PRD): selecionar → contexto → assumir → enviar → devolver; transferir como gestor; histórico e negociação intactos — NÃO executado nesta sessão (requer navegador + dados reais; ver nota abaixo)
- Test coverage target: manter cobertura global >=80% das adições do feature
- All tests must pass — 126/126 (`npm test`)

## Success Criteria
- `npm run lint && npm run build && npm test` passando — todos verificados nesta sessão (lint: 0 erros; build: sucesso, `/conversations` gerado como rota estática; test: 126/126)
- Zero regressão nas ações de gestão da página de caso — verificado por leitura: canal ativo, status, dossiê, insights IA, acordos (`AgreementsSection`), auditoria, processo jurídico e quarentena permanecem intocados; validação manual em navegador real NÃO foi executada nesta sessão
- Critério de aceite do PRD — fluxo completo (assumir → negociar → devolver/transferir) implementado nas tasks 03–11; checklist manual fim-a-fim ainda pendente de execução humana

## Nota de verificação
Verificado via `tsc --noEmit`, `eslint` e `npm run build` (compilação/tipos/lint) e via `npm test` (131/131, incluindo os novos testes do card "Conversa"). A migração `supabase_conversations.sql` foi aplicada e verificada no projeto Supabase (`bbgxrtkcmrsumktpyhlv`) em sessão posterior — ver task 02. O dev server foi subido e testado por HTTP (boot limpo, middleware redirecionando corretamente para `/login` sem autenticação); não foi feito um passe interativo no navegador (clicar em assumir/enviar/transferir) por falta de ferramenta de automação de navegador e de credenciais de teste nesta sessão — o checklist de aceite do PRD (assumir → negociar → devolver/transferir sem sair da Central) ainda deve ser validado manualmente, com um usuário logado, antes do deploy.
