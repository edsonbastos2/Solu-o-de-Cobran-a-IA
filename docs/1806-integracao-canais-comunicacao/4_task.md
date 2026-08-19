---
status: pending
title: registry.ts — resolução de canal + config por tenant
type: backend
complexity: medium
dependencies: ["1_task", "3_task"]
---

# registry.ts — resolução de canal + config por tenant

## Visão Geral

Cria o registry de canais (Strategy Pattern): dado um tenant e um canal, carrega a config de `channel_configs`, decripta os segredos via RPC `ai_decrypt` e devolve a instância do canal pronta para uso, com fallback para as env vars globais em modo demo.

<critical>
- Leia PRD e TechSpec antes de implementar
- Referencie as seções "Visão de Componentes" e "Pontos de Integração" do TechSpec
- Foque no QUÊ entregar, não no COMO
- Minimize alterações de código ao necessário
- Testes são obrigatórios
- Execute `npm run lint && npm run build` como pipeline de verificação
</critical>

<requirements>
1. `lib/channels/registry.ts` DEVE exportar `getChannel(database: SupabaseClient, tenantId: string, channel: ChannelId): Promise<{ channel: CommunicationChannel; ctx: ChannelContext } | null>` — null quando o canal não está configurado/habilitado para o tenant.
2. O registry DEVE ler `channel_configs` com admin client (service role, já recebido via parâmetro `database`) e decriptar segredos via `admin.rpc('ai_decrypt', { cipher })` para os campos `*_enc`.
3. Fallback demo: sem `channel_configs` para o tenant, o registry DEVE montar `ChannelContext` a partir das env vars globais (`TELEGRAM_BOT_TOKEN`, `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`), preservando o comportamento de desenvolvimento atual.
4. Canal com `enabled = false` DEVE retornar null (envio não tentado; o caller registra "canal desabilitado").
5. O registry DEVERIA aceitar um cache simples por chamada (Map em escopo de request) para evitar reler a config em múltiplos envios da mesma operação — sem cache global entre requests.
6. Segredos decriptados NUNCA devem ser logados.
7. O lookup do webhook por secret (ADR-005) NÃO fica aqui: exportar também `resolveChannelByWebhookSecret(database, secret)` que consulta `channel_configs.webhook_secret_hash` (SHA-256 do secret calculado em Node) e devolve `{ tenantId, channel, config }` ou null.
</requirements>

## Subtarefas

- [ ] Implementar `getChannel` com leitura de config + decriptação + fallback env
- [ ] Implementar `resolveChannelByWebhookSecret` com hash SHA-256 (crypto Node)
- [ ] Cache por request (Map local)
- [ ] Compilar e lintar

## Detalhes de Implementação

### Arquivos a Criar

- `lib/channels/registry.ts` — registry + resolução por secret de webhook

### Arquivos a Modificar

- Nenhum

### Arquivos Relevantes

- `supabase_ai_keys_encryption.sql:72-87` — `ai_decrypt` (service role only; usar admin client)
- `app/api/tenants/[id]/ai-config/route.ts:89,290-298` — padrão de chamada `ai_encrypt`/`ai_decrypt` e tratamento de erro 503 quando a infra de cifragem não está aplicada
- `lib/supabase-admin.ts` — `getSupabaseAdmin()` retorna null sem env (guardar)
- `docs/1806-integracao-canais-comunicacao/adrs/adr-005.md` — estratégia do hash do secret

### Arquivos Dependentes

- `lib/channels/message-service.ts` (tarefa 5) — usa `getChannel`
- `app/api/webhook/telegram/route.ts` (tarefa 6) — usa `resolveChannelByWebhookSecret`
- `app/api/tenants/[id]/channel-configs/route.ts` (tarefa 8) — grava a config lida aqui

### ADRs Relacionados

- [ADR-003: Configuração de canal por tenant](adrs/adr-003.md) — fonte da config e do fallback env
- [ADR-004: Módulo lib/channels/](adrs/adr-004.md) — papel do registry no Strategy Pattern
- [ADR-005: Webhook autenticado por secret_token por tenant](adrs/adr-005.md) — `resolveChannelByWebhookSecret`

## Entregáveis

- [ ] `getChannel` e `resolveChannelByWebhookSecret` funcionando com e sem config de tenant
- [ ] Nenhum segredo em logs

## Testes

### Testes Unitários

- Sem runner; validação por compilação.

### Testes de Integração

- [ ] Tenant com `channel_configs` telegram habilitado → `getChannel` devolve adapter Telegram com token decriptado (testar com config de desenvolvimento após tarefa 8 ou INSERT manual com `ai_encrypt`)
- [ ] Tenant sem config + `TELEGRAM_BOT_TOKEN` em env → `getChannel` devolve adapter em modo demo
- [ ] `channel_configs.enabled = false` → null
- [ ] `resolveChannelByWebhookSecret` com secret desconhecido → null; com secret válido → tenantId + canal corretos

## Critérios de Sucesso

- [ ] `npm run build` compila
- [ ] `npm run lint` sem erros
- [ ] Busca por `logger` no arquivo não retorna chamadas com segredos
