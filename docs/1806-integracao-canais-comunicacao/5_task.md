---
status: pending
title: message-service.ts + lib/messaging.ts como fachada
type: backend
complexity: high
dependencies: ["4_task"]
---

# message-service.ts + lib/messaging.ts como fachada

## Visão Geral

Cria o serviço de envio unificado consumido pelo domínio: resolve o canal ativo do caso (com fallback legado), despacha via registry e persiste a mensagem em `messages` com canal, resultado e motivo de falha. `lib/messaging.ts` vira fachada transitória com a mesma assinatura atual.

<critical>
- Leia PRD e TechSpec antes de implementar
- Referencie a seção "Interfaces Centrais" (serviço de envio) do TechSpec
- Foque no QUÊ entregar, não no COMO
- Minimize alterações de código ao necessário
- Testes são obrigatórios
- Execute `npm run lint && npm run build` como pipeline de verificação
</critical>

<requirements>
1. `lib/channels/message-service.ts` DEVE exportar `sendCaseMessage({ caseId, content, database, tenantId, senderRole })` com o contrato do TechSpec, retornando `{ status: 'sent'|'failed'|'skipped', channel?, error? }`.
2. Resolução de destino em ordem: (a) `cases.active_channel` → `client_channels` do cliente do caso; (b) fallback legado: `cases.telegram_chat_id` (telegram) ou `cases.phone` (whatsapp); (c) sem destino → `skipped`.
3. O serviço DEVE gravar a mensagem em `messages` com `channel`, `send_status` (`sent`/`failed`), `status_error` (motivo claro quando falhou), `sent_at` e `role` = `senderRole ?? 'ai'` — a gravação acontece independentemente do resultado do envio (auditoria: nenhuma mensagem sem rastro).
4. O serviço DEVE também exportar `sendClientMessage({ clientId, content, database, tenantId })` para envios escopados por cliente (usados pelos crons de protests/negativations, que hoje enviam para `clients.phone`): resolve o canal ativo do caso aberto mais recente do cliente; sem caso, usa o canal whatsapp do cliente (`client_channels` ou `clients.phone` legado).
5. Canal desabilitado/não configurado (`getChannel` → null) DEVE resultar em `failed` com "Canal não configurado ou desabilitado" e mensagem persistida com esse motivo.
6. `lib/messaging.ts` DEVE manter a assinatura `sendMessage(to, message, userId?)` exportada atual delegando ao message-service em modo legacy: resolve o provider como hoje (`profiles.messaging_provider`/env) apenas para manter compatibilidade até a tarefa 7 migrar os callers — após a tarefa 7, `messaging.ts` pode ser reduzido a um re-export deprecado.
7. O serviço NÃO DEVE conhecer WhatsApp/Telegram além do tipo `ChannelId`; despacho exclusivamente via registry.
8. Erros de persistência em `messages` NÃO DEVEM mascarar o resultado do envio (logar e retornar o resultado do envio).
</requirements>

## Subtarefas

- [ ] Implementar `sendCaseMessage` com resolução (a)/(b)/(c) e persistência de resultado
- [ ] Implementar `sendClientMessage` para crons
- [ ] Reduzir `lib/messaging.ts` a fachada delegando ao serviço
- [ ] Compilar e lintar

## Detalhes de Implementação

### Arquivos a Criar

- `lib/channels/message-service.ts` — serviço de envio unificado

### Arquivos a Modificar

- `lib/messaging.ts` — corpo substituído por delegação (mantém exports `sendMessage` e `getMessagingProvider`)

### Arquivos Relevantes

- `lib/agent.ts:474-512` — padrão atual de insert em `messages` + envio com fallback (a lógica aqui substituída)
- `lib/channels/registry.ts` (tarefa 4) — `getChannel`
- `lib/types.ts:92-126` — shapes de `Case`, `Client`, `Message`
- `app/api/cron/protests/route.ts:175-196` e `app/api/cron/negativations/route.ts:162-183` — caso de uso de `sendClientMessage` (envio por telefone do cliente hoje)

### Arquivos Dependentes

- `lib/agent.ts`, `app/api/agent-message`, `app/api/start-negotiation`, crons (tarefa 7) — trocam `sendMessage` por `sendCaseMessage`/`sendClientMessage`
- `lib/channels/inbound.ts` (tarefa 6) — mesmo módulo, sem dependência direta

### ADRs Relacionados

- [ADR-001: Plataforma de Canais unificada](adrs/adr-001.md) — serviço único para todo o domínio
- [ADR-002: Identidade de canal por cliente com canal ativo por caso](adrs/adr-002.md) — ordem de resolução do destino
- [ADR-006: Evoluir a tabela messages](adrs/adr-006.md) — colunas gravadas

## Entregáveis

- [ ] `sendCaseMessage` e `sendClientMessage` implementados
- [ ] `lib/messaging.ts` delegando sem mudar a assinatura pública
- [ ] Toda mensagem enviada (sucesso ou falha) gera linha em `messages` com `channel` e `send_status`

## Testes

### Testes Unitários

- Sem runner; validar por compilação.

### Testes de Integração

- [ ] Caso com `active_channel='telegram'` e `client_channels` do cliente → envia pelo adapter Telegram e grava `send_status='sent'`, `channel='telegram'`
- [ ] Caso legado (sem `active_channel`, com `telegram_chat_id`) → fallback legado telegram
- [ ] Caso sem `active_channel` e sem `telegram_chat_id`, com `phone` → fallback whatsapp
- [ ] Canal desabilitado → `failed` com "Canal não configurado ou desabilitado" e a mensagem persistida com o motivo
- [ ] `sendClientMessage` para cliente com caso aberto → usa canal ativo do caso; cliente sem caso → whatsapp/telefone

## Critérios de Sucesso

- [ ] `npm run build` compila
- [ ] `npm run lint` sem erros
- [ ] Nenhuma referência a `sendWhatsAppMessage`/`sendTelegramMessage` dentro de `message-service.ts`
