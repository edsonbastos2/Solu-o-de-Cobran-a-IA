---
status: pending
title: Adapters whatsapp-channel.ts e telegram-channel.ts
type: backend
complexity: medium
dependencies: ["2_task"]
---

# Adapters whatsapp-channel.ts e telegram-channel.ts

## Visão Geral

Transplanta a lógica de envio de `lib/whatsapp.ts` (Z-API) e `lib/telegram.ts` (Bot API) para adapters que implementam `CommunicationChannel`, recebendo credenciais resolvidas via `ChannelContext` em vez de ler `profiles`/env por conta própria.

<critical>
- Leia PRD e TechSpec antes de implementar
- Referencie as seções "Interfaces Centrais" e "Pontos de Integração" do TechSpec
- Foque no QUÊ entregar, não no COMO
- Minimize alterações de código ao necessário
- Testes são obrigatórios
- Execute `npm run lint && npm run build` como pipeline de verificação
</critical>

<requirements>
1. `lib/channels/whatsapp-channel.ts` DEVE implementar `CommunicationChannel` preservando o comportamento de `lib/whatsapp.ts`: normalização de telefone (dígitos, prefixo 55 quando ausente, 10-13 dígitos), timeout 10s via AbortController, header `Client-Token` opcional, log de falha sem corpo bruto além de 300 chars.
2. `lib/channels/telegram-channel.ts` DEVE implementar `CommunicationChannel` preservando o comportamento de `lib/telegram.ts`: `parse_mode: 'HTML'`, timeout 10s, validação de chat_id numérico.
3. Os adapters DEVE retornar `SendOutcome` (sent com `externalMessageId` do provedor quando disponível; failed com erro traduzido e `retryable`), NUNCA `boolean`.
4. Erros do Telegram DEVERIAM ser mapeados: 400 → "Mensagem inválida ou muito grande" (retryable false), 403 → "Devedor bloqueou o bot" (retryable false), 429 → "Limite de envios do Telegram atingido" (retryable true), 401 → "Token do bot inválido" (retryable false), timeout/erro de rede → erro genérico (retryable true).
5. Mensagem maior que `capabilities.maxMessageLength` (4096 Telegram / 4096 Z-API) DEVE falhar pré-chamada com erro claro, sem truncar a saída.
6. Credenciais DEVEM vir exclusivamente de `ChannelContext` (registry da tarefa 4 resolve); os adapters NÃO acessam Supabase nem `process.env`.
7. `lib/whatsapp.ts` e `lib/telegram.ts` NÃO DEVEM ser removidos nesta tarefa (remoção na tarefa 7).
</requirements>

## Subtarefas

- [ ] Implementar `whatsapp-channel.ts` com validação de telefone preservada
- [ ] Implementar `telegram-channel.ts` com mapeamento de erros do requisito 4
- [ ] Guarda de comprimento máximo pré-envio nos dois adapters
- [ ] Compilar e lintar

## Detalhes de Implementação

### Arquivos a Criar

- `lib/channels/whatsapp-channel.ts` — adapter Z-API
- `lib/channels/telegram-channel.ts` — adapter Bot API

### Arquivos a Modificar

- Nenhum (implantação paralela ao legado)

### Arquivos Relevantes

- `lib/whatsapp.ts` — lógica a transplantar (fonte da verdade do comportamento atual)
- `lib/telegram.ts` — lógica a transplantar
- `lib/channels/channel.ts` (tarefa 2) — interface a implementar
- `lib/logger.ts` — logging estruturado

### Arquivos Dependentes

- `lib/channels/registry.ts` (tarefa 4) — instancia os adapters
- `lib/messaging.ts` (tarefa 5) — passa a delegar aos adapters via registry

### ADRs Relacionados

- [ADR-001: Plataforma de Canais unificada](adrs/adr-001.md) — os dois canais migram juntos
- [ADR-004: Módulo lib/channels/](adrs/adr-004.md) — adapters absorvem o legado

## Entregáveis

- [ ] Dois adapters implementando `CommunicationChannel`
- [ ] Mapeamento de erros do Telegram documentado em código (nomes de erro claros)

## Testes

### Testes Unitários

- Sem runner; validar por compilação e pelos testes de integração abaixo.

### Testes de Integração

- [ ] `validateRecipient`: telefone com 11 dígitos sem 55 → true; chat_id "123456789" → true; "abc" → false; telefone de 5 dígitos → false
- [ ] `sendMessage` com `content` de 5000 chars retorna failed sem chamar fetch (guarda de comprimento)
- [ ] `sendMessage` com token falso retorna failed com erro traduzido (verificar manualmente com fetch mockado ou bot de teste)

## Critérios de Sucesso

- [ ] `npm run build` compila
- [ ] `npm run lint` sem erros
- [ ] Zero acesso a `process.env` ou Supabase dentro dos adapters
