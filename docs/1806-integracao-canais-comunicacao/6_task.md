---
status: pending
title: inbound.ts + refatoração dos webhooks em adaptadores finos
type: api
complexity: high
dependencies: ["4_task"]
---

# inbound.ts + refatoração dos webhooks em adaptadores finos

## Visão Geral

Extrai a lógica de negócio hoje duplicada nos webhooks de WhatsApp e Telegram (idempotência, resolução de cliente/caso, registro da mensagem, guarda de quarentena, rate limit, disparo do pipeline de IA) para `lib/channels/inbound.ts`, deixando os controladores HTTP como adaptadores finos que autenticam e delegam.

<critical>
- Leia PRD e TechSpec antes de implementar
- Referencie as seções "Visão de Componentes", "Endpoints de API" (webhooks) e "Pontos de Integração" do TechSpec
- Foque no QUÊ entregar, não no COMO
- Minimize alterações de código ao necessário
- Testes são obrigatórios
- Execute `npm run lint && npm run build` como pipeline de verificação
</critical>

<requirements>
1. `lib/channels/inbound.ts` DEVE exportar `processInboundEvent(database, event: InboundEvent): Promise<{ ok: boolean; reason?: string }>` centralizando: idempotência (`webhook_events`), resolução de cliente por `client_channels.external_id` (com fallback legado `cases.telegram_chat_id`/`cases.phone`), busca do caso elegível (`not_started|in_negotiation|needs_attention`, mais recente), insert em `messages` (role `user`, `send_status='received'`, `channel`, `external_message_id`), tratamento `needs_attention` (só registra + auditoria, sem IA), rate limit 5/60s por chat e chamada a `processChat`.
2. A resolução de cliente DEVE respeitar o tenant do evento (filtro `tenant_id` em todas as queries — isolamento multi-tenant absoluto).
3. O webhook do Telegram DEVE autenticar via `X-Telegram-Bot-Api-Secret-Token` com `resolveChannelByWebhookSecret` (ADR-005); sem match, cai no fallback demo (`WEBHOOK_SECRET` global + `TELEGRAM_BOT_TOKEN` env); sem ambos → 401.
4. O webhook do Telegram DEVE continuar tratando `/start case_<base64>` (legado, transição) exatamente como hoje (update de `cases.telegram_chat_id` scoped ao tenant), ignorando silenciosamente payload inválido; o handler `/start <token>` (novo fluxo) chega na tarefa 9.
5. O webhook do Telegram DEVE responder `{ ok: true }` rápido ao Telegram em todos os casos de eventos aceitos (o processamento da IA não deve atrasar a resposta quando possível — `processChat` já é await; manter o comportamento atual, sem piorar).
6. O webhook do Telegram DEVE tratar `my_chat_member` (usuário bloqueou/desbloqueou o bot) com log estruturado, sem processar como mensagem.
7. O webhook do WhatsApp DEVE manter a validação `X-Webhook-Secret` global e o `fromMe`, delegando o resto a `processInboundEvent`.
8. Ambos os controladores NÃO DEVEM conter regras de negócio além de autenticação, parse do payload do provedor e chamada ao serviço.
9. Idempotência DEVE usar o padrão existente: insert em `webhook_events` com PK dedicada (`tg:<update_id>` para Telegram; `body.messageId || body.id` para Z-API) e tratamento de código `23505` como duplicado.
10. Rate limit excedido DEVE registrar log e responder ok (sem 429 ao provedor — comportamento atual preservado).
</requirements>

## Subtarefas

- [ ] Implementar `processInboundEvent` com as etapas do requisito 1
- [ ] Refatorar `app/api/webhook/telegram/route.ts` (auth por secret, parse de update, `/start` legado, `my_chat_member`, delegação)
- [ ] Refatorar `app/api/webhook/whatsapp/route.ts` (auth, parse Z-API, delegação)
- [ ] Compilar e lintar

## Detalhes de Implementação

### Arquivos a Criar

- `lib/channels/inbound.ts` — processamento unificado de eventos recebidos

### Arquivos a Modificar

- `app/api/webhook/telegram/route.ts` — controlador fino
- `app/api/webhook/whatsapp/route.ts` — controlador fino

### Arquivos Relevantes

- `app/api/webhook/telegram/route.ts` (atual) — lógica a extrair (idempotência linhas 89-101, match de caso 103-115, needs_attention 119-136, rate limit 138-142)
- `app/api/webhook/whatsapp/route.ts` (atual) — lógica equivalente (normalização de telefone linhas 10-19, idempotência 69-83, match 92-99)
- `lib/quarantine.ts` — guarda de quarentena aplicada antes do `processChat` (verificar uso no roadmap fase 2, task 11)
- `lib/rate-limit.ts:49` — `rateLimit(key, max, windowMs)`
- `lib/audit.ts` — `recordAuditAction` com `EXTERNAL_MESSAGE_RECEIVED`
- `lib/agent.ts` — `processChat(caseId, text, database, tenantId)`

### Arquivos Dependentes

- `app/api/webhook/telegram/route.ts` será estendido na tarefa 9 (handler `/start <token>`)
- `lib/channels/message-service.ts` (tarefa 5) — mesmo módulo

### ADRs Relacionados

- [ADR-001: Plataforma de Canais unificada](adrs/adr-001.md) — unificação da lógica duplicada
- [ADR-002: Identidade de canal por cliente](adrs/adr-002.md) — resolução inbound por `client_channels.external_id` com fallback legado
- [ADR-005: Webhook autenticado por secret_token por tenant](adrs/adr-005.md) — autenticação do webhook Telegram

## Entregáveis

- [ ] `processInboundEvent` único atendendo os dois canais
- [ ] Webhooks com autenticação + parse + delegação apenas
- [ ] Fallback demo do Telegram preservado (WEBHOOK_SECRET global + env token)

## Testes

### Testes de Integração

- [ ] POST webhook Telegram com header de secret válido de um tenant → evento processado; com secret inválido → 401
- [ ] Repost do mesmo `update_id` → `{ ok: true, duplicated: true }` sem segundo processamento (idempotência)
- [ ] Mensagem de chat_id com `client_channels` vinculado → mensagem em `messages` com `channel='telegram'`, `send_status='received'` e IA acionada
- [ ] Mensagem de telefone (WhatsApp) sem caso elegível → ok silencioso (comportamento atual)
- [ ] Caso `needs_attention` → mensagem registrada + auditoria, sem IA
- [ ] `/start case_<base64>` legado continua vinculando `cases.telegram_chat_id`
- [ ] `my_chat_member` (blocked) → log, sem mensagem processada

## Critérios de Sucesso

- [ ] `npm run build` compila
- [ ] `npm run lint` sem erros
- [ ] Nenhuma query ao banco nos controladores além da autenticação (via registry) — regra de negócio toda em `inbound.ts`
