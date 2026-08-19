---
status: pending
title: Migração dos callers do domínio para o message-service
type: refactor
complexity: high
dependencies: ["5_task"]
---

# Migração dos callers do domínio para o message-service

## Visão Geral

Substitui todas as chamadas legadas `sendMessage(destination, ...)` (que embutem `telegram_chat_id || phone`) por `sendCaseMessage`/`sendClientMessage`, remove o if/else de provider e apaga `lib/whatsapp.ts` e `lib/telegram.ts`.

<critical>
- Leia PRD e TechSpec antes de implementar
- Referencie a seção "Análise de Impacto" do TechSpec
- Foque no QUÊ entregar, não no COMO
- Minimize alterações de código ao necessário
- Testes são obrigatórios
- Execute `npm run lint && npm run build` como pipeline de verificação
</critical>

<requirements>
1. `lib/agent.ts` (linhas ~497-512) DEVE substituir o bloco `if (caseData.phone || caseData.telegram_chat_id) { sendMessage(destination, ...) }` por `sendCaseMessage({ caseId, content: cleanAiText, database, tenantId, senderRole: 'ai' })`, preservando o log de falha em background (fire-and-forget com `.catch`) e removendo a mensagem de sistema manual de falha (o próprio serviço já persiste a falha com motivo).
2. `app/api/agent-message/route.ts:51-52` DEVE usar `sendCaseMessage` com `senderRole: 'human'` (mensagem manual do operador) — usar o tenant do contexto da rota.
3. `app/api/start-negotiation/route.ts:197-198` DEVE usar `sendCaseMessage` (senderRole `ai`).
4. `app/api/cron/follow-up/route.ts:91-93` DEVE usar `sendCaseMessage` por caso (o cron itera casos).
5. `app/api/cron/protests/route.ts:175-196` e `app/api/cron/negativations/route.ts:162-183` DEVEM usar `sendClientMessage` por cliente (enviam notificações legais escopadas no cliente/título, não no caso).
6. `lib/whatsapp.ts`, `lib/telegram.ts` e o corpo legado de `lib/messaging.ts` (incluindo `getMessagingProvider` quando não mais referenciado) DEVEM ser removidos; `lib/messaging.ts` DEVERIA virar um re-export deprecado de `sendCaseMessage` ou ser deletado se nenhum import restar.
7. Nenhum caller DEVE conter `telegram_chat_id || phone` ou referência a `sendWhatsAppMessage`/`sendTelegramMessage` após a migração (verificar com busca global).
8. `generateTelegramDeepLink` (lib/telegram.ts) NÃO deve ser perdido: a geração de link muda para o fluxo de token da tarefa 9 — remover a função legada junto com o arquivo (a tarefa 9 cria o novo gerador de link).
9. Comportamento observável (mensagem entregue, log de erro, mensagem de falha no histórico) DEVE permanecer equivalente — a diferença é que a falha agora grava `send_status='failed'` + `status_error`.
</requirements>

## Subtarefas

- [ ] Migrar `lib/agent.ts`
- [ ] Migrar `app/api/agent-message/route.ts`, `app/api/start-negotiation/route.ts`, `app/api/cron/follow-up/route.ts`
- [ ] Migrar crons `protests` e `negativations` para `sendClientMessage`
- [ ] Remover `lib/whatsapp.ts`, `lib/telegram.ts`, reduzir/remover `lib/messaging.ts`
- [ ] Busca global por referências legadas (`sendMessage(`, `telegram_chat_id ||`) e limpeza
- [ ] Compilar e lintar

## Detalhes de Implementação

### Arquivos a Criar

- Nenhum

### Arquivos a Modificar

- `lib/agent.ts` — bloco de envio pós-IA
- `app/api/agent-message/route.ts` — envio manual
- `app/api/start-negotiation/route.ts` — primeira mensagem da negociação
- `app/api/cron/follow-up/route.ts` — follow-ups por caso
- `app/api/cron/protests/route.ts` — intimação por cliente
- `app/api/cron/negativations/route.ts` — notificação CDC por cliente
- `lib/messaging.ts` — fachada removida/reduzida

### Arquivos a Remover

- `lib/whatsapp.ts`, `lib/telegram.ts`

### Arquivos Relevantes

- `lib/channels/message-service.ts` (tarefa 5) — API nova
- `app/api/cron/protests/route.ts:175-196` — resolução atual de client → phone (substituída por `sendClientMessage`)

### Arquivos Dependentes

- `app/settings` (aba Perfil) ainda exibe campos de mensageria de `profiles` (zapi/telegram) — leitura via `GET /api/settings`; sem impacto funcional até a UI da tarefa 11 assumir, mas os campos continuam funcionando como legado.

### ADRs Relacionados

- [ADR-001: Plataforma de Canais unificada](adrs/adr-001.md) — objetivo final da migração de callers

## Entregáveis

- [ ] Todos os callers usando o message-service
- [ ] `lib/whatsapp.ts` e `lib/telegram.ts` removidos do repositório
- [ ] Busca global sem referências legadas

## Testes

### Testes de Integração

- [ ] Conversa de ponta a ponta no caso (chat da UI → `processChat` → resposta da IA enviada pelo canal ativo e gravada com `channel` + `send_status`)
- [ ] `POST /api/agent-message` envia mensagem manual do operador pelo canal ativo
- [ ] Cron follow-up (execução manual da rota com CRON_SECRET) envia pelos casos com canal ativo
- [ ] Crons protests/negativations enviam por cliente (testar com registro pendente em desenvolvimento)

## Critérios de Sucesso

- [ ] `npm run build` compila
- [ ] `npm run lint` sem erros
- [ ] `grep -r "sendWhatsAppMessage\|sendTelegramMessage\|telegram_chat_id ||" lib app` não retorna ocorrências em código ativo
