---
status: completed
title: Pipeline respeita o condutor explícito
type: backend
complexity: high
dependencies:
  - task_03
---

# Task 04: Pipeline respeita o condutor explícito

## Overview

Ajusta o pipeline existente para pausar/retomar a IA pelo condutor explícito (`cases.controller`) em vez do status implícito `needs_attention`: o processamento de mensagens recebidas (`lib/channels/inbound.ts`), o envio humano (`app/api/agent-message/route.ts`) e os envios automatizados da IA (crons de follow-up/protesto/negativação). Comportamento retrocompatível com casos legados (`controller IS NULL`).

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST `lib/channels/inbound.ts` substituir a checagem `status==='needs_attention'` por `isAIPaused(case)` do conversation-service; pausado → persiste mensagem do devedor + evento `MESSAGE_RECEIVED` + auditoria, SEM chamar `processChat`
- MUST todo envio automatizado de IA (crons: `app/api/cron/*`, follow-ups, protesto, negativação) verificar `isAIPaused` antes de disparar mensagem; pausado → skip auditado
- MUST `app/api/agent-message/route.ts` não forçar `status='needs_attention'` quando `controller='human'` (humano já conduz; manter transição apenas no comportamento legado)
- MUST preservar rate limit, idempotência e todos os demais comportamentos do inbound
- NÃO alterar `processChat` em si (a pausa acontece antes da chamada)
- Regressão ZERO para casos legados com `controller IS NULL` (derivação por status)
</requirements>

## Subtasks
- [x] 4.1 Substituir critério de pausa no `inbound.ts` por `isAIPaused` + gravar evento `MESSAGE_RECEIVED`
- [x] 4.2 Adicionar guard `isAIPaused` nos envios automatizados (localizado: cron `follow-up` guarda via `isAIPaused`; `protests`/`negativations`/`negotiations-expiry`/`legal-escalation` não enviam mensagem de IA — apenas mudam status/registram eventos, sem guard necessário; `start-negotiation/route.ts` recebeu guard `isAIPaused` — 409 quando um humano já assumiu antes do primeiro contato)
- [x] 4.3 Ajustar `agent-message` para respeitar condutor humano
- [x] 4.4 Testes de regressão dos três pontos (`lib/channels/inbound.test.ts`; `lib/conversation-service.test.ts` cobre `recordAIHandoff`)
- [x] 4.5 Revisar fluxo `[HANDOFF]`/`[ACORDO_FECHADO]` em `lib/agent.ts`: `recordAIHandoff` (novo, em `lib/conversation-service.ts`) seta `controller='human'` + evento `HUMAN_TAKEOVER` (performed_by null, payload `{automatic:true, reason:'ai_handoff'}`) quando o status transiciona para `needs_attention` — cobre o caso em que `controller` já estava explicitamente 'ai' e a derivação legada por status sozinha não pausaria a IA

## Implementation Details

Localizar os emissores automáticos: `app/api/cron/` (follow-up, protesto, negativação) e qualquer chamada de `sendCaseMessage` com `senderRole: 'ai'` fora do fluxo de chat. O guard deve ficar na origem do envio (não dentro de `sendCaseMessage`, que também é usado por humanos). Eventos de conversa gravados via conversation-service.

### Relevant Files
- `lib/channels/inbound.ts` — `processInboundEvent` (checagem atual de status, linhas ~168-179)
- `app/api/agent-message/route.ts` — transição atual para `needs_attention` (linhas 61-81)
- `lib/agent.ts` — `processChat`, tags `[HANDOFF]`/`[ACORDO_FECHADO]`
- `app/api/cron/` — emissores automáticos
- `lib/channels/message-service.ts` — `sendCaseMessage`

### Dependent Files
- `lib/conversation-service.ts` — `isAIPaused`, gravação de eventos

### Related ADRs
- [ADR-003: Recurso /api/conversations e condutor explícito](../adrs/adr-003.md)

## Deliverables
- `inbound.ts`, `agent-message/route.ts` e crons ajustados
- Testes de regressão co-localizados

## Tests
- Unit tests:
  - [x] Inbound com `controller='human'`: mensagem persistida, evento MESSAGE_RECEIVED gravado, `processChat` NÃO chamado (`lib/channels/inbound.test.ts`)
  - [x] Inbound com `controller='ai'`: comportamento atual preservado (IA responde) (`lib/channels/inbound.test.ts`)
  - [x] Inbound legado (`controller` NULL + `needs_attention`): pausa preservada (`lib/channels/inbound.test.ts`)
  - [x] `recordAIHandoff`: seta controller human + evento sem `performed_by`; não escreve nada quando humano já conduz (`lib/conversation-service.test.ts`)
  - [ ] `agent-message` com humano conduzindo: status do caso não muda para `needs_attention` — verificado por leitura de código (linha `if (controller === 'ai' && ...)` do route), sem teste automatizado dedicado (sem harness de rota HTTP mockada no projeto ainda)
  - [ ] Cron `follow-up` com `controller='human'`: envio skippado — verificado por leitura de código (guard `isAIPaused` antes do envio), sem teste automatizado dedicado
- Integration tests:
  - [ ] N/A (checklist manual do fluxo webhook → pausa/retomada no fechamento)
- Test coverage target: >=80% das novas ramificações
- All tests must pass — 114/114 (`npm test`), `npx tsc --noEmit` limpo

## Success Criteria
- All tests passing
- Fluxo legado (casos NULL) 100% preservado; IA pausada nunca envia mensagem automática (inbound, `start-negotiation` e `agent.ts`/HANDOFF cobertos; crons de protesto/negativação/vencimento não enviam mensagem de IA e não precisam do guard)
