---
status: pending
title: Interface CommunicationChannel (lib/channels/types.ts + channel.ts)
type: backend
complexity: low
dependencies: []
---

# Interface CommunicationChannel (lib/channels/types.ts + channel.ts)

## Visão Geral

Define o contrato da plataforma de canais: tipos compartilhados (`ChannelId`, `ChannelRecipient`, `SendOutcome`, `InboundEvent`, capacidades) e a interface `CommunicationChannel` que os adapters de WhatsApp e Telegram implementarão. É a fundação que desacopla o domínio de cobrança dos canais concretos.

<critical>
- Leia PRD e TechSpec antes de implementar
- Referencie a seção "Interfaces Centrais" do TechSpec
- Foque no QUÊ entregar, não no COMO
- Minimize alterações de código ao necessário
- Testes são obrigatórios
- Execute `npm run lint && npm run build` como pipeline de verificação
</critical>

<requirements>
1. `lib/channels/types.ts` DEVE exportar `ChannelId` (`'whatsapp' | 'telegram'`), `ChannelRecipient`, `SendOutcome` (union sent/failed com `error` em linguagem clara e `retryable`), `ChannelCapabilities` (`maxMessageLength`, `deliveryReceipts: false`) e `ChannelContext` (tenantId + credenciais resolvidas + enabled).
2. `lib/channels/channel.ts` DEVE exportar a interface `CommunicationChannel` com `id`, `capabilities`, `validateRecipient(externalId): boolean` e `sendMessage(ctx, recipient, content): Promise<SendOutcome>` — assinatura idêntica à do TechSpec.
3. A interface NÃO DEVE conter `receiveMessage` nem `getStatus` (recebimento é push de webhook; status é parte do `SendOutcome`) — ver ADR-004.
4. Os tipos DEVERIAM incluir `InboundEvent` (tenantId, channel, externalId, content, externalMessageId?, eventId, metadata) usado pela tarefa 6.
5. `SendOutcome` com `status: 'failed'` DEVE carregar `error` já traduzido (ex.: "Devedor bloqueou o bot") e `retryable: boolean` — nunca payload bruto do provedor.
6. TypeScript strict (projeto usa strict 5.7); nenhum `any`.
</requirements>

## Subtarefas

- [ ] Criar `lib/channels/types.ts` com os tipos do requisito 1 e 4
- [ ] Criar `lib/channels/channel.ts` com a interface `CommunicationChannel`
- [ ] Compilar com `npx tsc --noEmit` sem erros

## Detalhes de Implementação

### Arquivos a Criar

- `lib/channels/types.ts` — tipos compartilhados do módulo
- `lib/channels/channel.ts` — interface do canal

### Arquivos a Modificar

- Nenhum

### Arquivos Relevantes

- `docs/1806-integracao-canais-comunicacao/techspec.md` — seção "Interfaces Centrais" (código de referência)
- `lib/types.ts` — convenção de tipagem do projeto
- `lib/whatsapp.ts` / `lib/telegram.ts` — comportamento que os adapters (tarefa 3) vão absorver; os tipos devem dar conta desses casos de uso

### Arquivos Dependentes

- `lib/channels/whatsapp-channel.ts` e `telegram-channel.ts` (tarefa 3) — implementam a interface
- `lib/channels/registry.ts` (tarefa 4) — consome os tipos
- `lib/channels/message-service.ts` (tarefa 5) — consome `SendOutcome`

### ADRs Relacionados

- [ADR-004: Módulo lib/channels/ com interface de canal e registry](adrs/adr-004.md) — define a fronteira do módulo e a interface mínima

## Entregáveis

- [ ] `lib/channels/types.ts` e `lib/channels/channel.ts` compilando em strict
- [ ] Sem imports de adapters concretos nos arquivos de contrato

## Testes

### Testes Unitários

- Não há runner de testes no projeto; validação por compilação e uso nas tarefas 3-6.

### Testes de Integração

- [ ] `npx tsc --noEmit` passa com os novos arquivos
- [ ] `npm run lint` sem erros

## Critérios de Sucesso

- [ ] `npm run build` compila
- [ ] Interface não referencia Supabase nem fetch (pure types)
