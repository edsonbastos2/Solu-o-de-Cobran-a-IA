# TechSpec: Plataforma de Canais de Comunicação com Integração Telegram

Ticket 1806. PRD de entrada: `docs/1806-integracao-canais-comunicacao/prd.md` (ADRs 001–003).

## Resumo Executivo

A mensageria sai do if/else por provider (`lib/messaging.ts`) para um módulo `lib/channels/` com interface `CommunicationChannel`, adapters `WhatsAppChannel` (Z-API) e `TelegramChannel` (Bot API), registry por tenant e serviço único de envio/processamento. A identidade de canal migra do caso (`cases.phone`/`cases.telegram_chat_id`) para o cliente (`client_channels`), com `cases.active_channel` apontando o canal em uso; a tabela `messages` ganha colunas de canal/resultado. Configuração por tenant em `channel_configs` (segredos cifrados com a infra `ai_encrypt` existente, migração one-shot do perfil do owner — padrão 1804). O webhook do Telegram autentica e resolve o tenant numa consulta via `secret_token` por tenant (hash indexado).

**Trade-off principal**: migração completa em uma entrega (WhatsApp + Telegram + modelo de dados) em troca de eliminar o acoplamento de uma vez — maior superfície de mudança e necessidade de dual-read legado durante o rollout, contra o custo de perpetuar dois caminhos de envio se fosse feito incrementalmente.

## Arquitetura do Sistema

### Visão de Componentes

```
Domínio de cobrança (agent.ts, crons, rotas de API)
        │  chama apenas
        ▼
lib/channels/message-service.ts   ← envio unificado (resolve canal ativo do caso)
        │                                  lib/channels/inbound.ts ← processamento unificado de recebimento
        ▼                                            ▲
lib/channels/registry.ts  (Strategy: resolve canal + config do tenant)
        │                                            │
        ├── lib/channels/whatsapp-channel.ts  ──► Z-API REST
        └── lib/channels/telegram-channel.ts  ──► Telegram Bot API
                                                     │
app/api/webhook/{whatsapp,telegram}/route.ts ───────┘ (adaptadores HTTP finos)

app/api/tenants/[id]/channel-configs/route.ts ── CRUD da config (aba Canais)
app/api/clients/[id]/channel-links/route.ts  ── geração de token de vinculação
```

- **Domínio** nunca importa um adapter concreto; depende de `message-service` e de `types`.
- **Webhooks** são controladores finos: autenticam, delegam a `inbound.ts`, respondem rápido ao provedor.
- **Supabase**: novas tabelas `channel_configs`, `client_channels`, `channel_link_tokens`; evolução de `messages` e `cases`. Migration manual em `supabase_channel_platform.sql` (padrão do projeto).

## Design de Implementação

### Interfaces Centrais

```ts
// lib/channels/types.ts
export type ChannelId = 'whatsapp' | 'telegram';

export interface ChannelRecipient {
  externalId: string; // Telegram: chat_id numérico; WhatsApp: dígitos do telefone
  metadata?: Record<string, unknown>; // ex.: username do Telegram
}

export type SendOutcome =
  | { status: 'sent'; externalMessageId?: string }
  | { status: 'failed'; error: string; retryable: boolean }; // error em linguagem clara, sem payload bruto

// lib/channels/channel.ts
export interface CommunicationChannel {
  readonly id: ChannelId;
  readonly capabilities: { maxMessageLength: number; deliveryReceipts: false };
  validateRecipient(externalId: string): boolean;
  sendMessage(ctx: ChannelContext, recipient: ChannelRecipient, content: string): Promise<SendOutcome>;
}

// ChannelContext traz credenciais resolvidas (decriptadas) do tenant — o adapter não acessa o banco.
```

`receiveMessage`/`getStatus` não existem na interface: recebimento é push de webhook (cada adapter expõe `parseInboundEvent` para `inbound.ts`) e status é parte do `SendOutcome` — não forçar interface artificial (ADR-004).

**Serviço de envio** (contrato consumido pelo domínio):

```ts
// lib/channels/message-service.ts
export async function sendCaseMessage(params: {
  caseId: string;
  content: string;
  database: SupabaseClient; // admin client (webhooks/crons) — service role
  tenantId: string;
  senderRole?: 'ai' | 'human';
}): Promise<{ status: 'sent' | 'failed' | 'skipped'; channel?: ChannelId; error?: string }>;
```

`sendCaseMessage` resolve: caso → `active_channel` → `client_channels` do cliente → canal do registry com config do tenant. Fallback legado durante o rollout: sem `client_channels`, usa `cases.telegram_chat_id` (Telegram) ou `cases.phone` (WhatsApp). Persiste a mensagem em `messages` com `channel`, `send_status` (`sent`/`failed`), `status_error` e `sent_at`.

**Processamento de entrada** (`lib/channels/inbound.ts`): `processInboundEvent(event: InboundEvent)` — assinaturas de caller: webhooks. Etapas: idempotência (`webhook_events`), resolução de cliente por `client_channels.external_id` (fallback legado), busca do caso elegível (`not_started|in_negotiation|needs_attention`, mais recente), insert em `messages` (role `user`, `send_status='received'`, `external_message_id`), guarda de quarentena, rate limit por chat (5/60s, existente), `processChat` quando o caso não está em `needs_attention`. Lógica hoje duplicada nos dois webhooks vira uma só.

### Modelo de Dados

Migration `supabase_channel_platform.sql` (aplicação manual, padrão do projeto):

```sql
-- 1. Config de canal por tenant
CREATE TABLE public.channel_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp','telegram')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  -- Telegram
  bot_username TEXT,
  bot_token_enc TEXT,            -- ai_encrypt
  webhook_secret_enc TEXT,       -- ai_encrypt (enviado ao setWebhook)
  webhook_secret_hash TEXT UNIQUE, -- sha256(secret), lookup do webhook
  webhook_url TEXT,
  webhook_status TEXT NOT NULL DEFAULT 'unregistered', -- unregistered|active|error
  webhook_last_error TEXT,
  -- WhatsApp (Z-API)
  zapi_instance TEXT,
  zapi_key_enc TEXT,             -- ai_encrypt
  zapi_client_token_enc TEXT,    -- ai_encrypt
  migrated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, channel)
);

-- 2. Identidade de canal por cliente
CREATE TABLE public.client_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp','telegram')),
  external_id TEXT NOT NULL,     -- estável: chat_id (Telegram) / dígitos do telefone (WhatsApp)
  username TEXT,                 -- Telegram: metadado descritivo, nunca identificador
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, client_id, channel),
  UNIQUE (tenant_id, channel, external_id)
);

-- 3. Tokens de vinculação (uso único, expiração 48h)
CREATE TABLE public.channel_link_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'telegram',
  token_hash TEXT NOT NULL UNIQUE, -- sha256 do token opaco (token nunca fica em claro)
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Evolução de messages (ADR-006) e cases
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS channel TEXT,
  ADD COLUMN IF NOT EXISTS external_message_id TEXT,
  ADD COLUMN IF NOT EXISTS send_status TEXT,  -- sent|failed|received|pending
  ADD COLUMN IF NOT EXISTS status_error TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS messages_external_id_uniq
  ON public.messages (tenant_id, channel, external_message_id)
  WHERE external_message_id IS NOT NULL;

ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS active_channel TEXT; -- whatsapp|telegram|null(legado)

-- 5. RLS: mesmo padrão tenant_isolation do tenant_model.sql (can_access_tenant)
-- 6. Backfill (não-destrutivo):
--    client_channels a partir de clients.phone (whatsapp) e cases.telegram_chat_id → client (telegram);
--    cases.active_channel = 'telegram' onde telegram_chat_id IS NOT NULL, senão 'whatsapp' onde phone IS NOT NULL.
```

Backfill reporta inconsistências (casos com `telegram_chat_id` sem client vinculado) via SELECT de verificação no `supabase_channel_platform_verify.sql`; esses casos continuam atendidos pelo fallback legado.

### Endpoints de API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/tenants/[id]/channel-configs` | Lista configs mascaradas (flags `bot_token_set`, `zapi_key_set` etc., `bot_username`, `webhook_status`, `enabled`). Dispara migração one-shot se `migrated_at IS NULL` (copia do owner via `get_user_ai_keys`, re-cifra com `ai_encrypt`). |
| PUT | `/api/tenants/[id]/channel-configs` | Upsert por `body.channel`. Segredo em branco preserva ciphertext (padrão `ai-config`). Para Telegram: valida token via `getMe`, gera `webhook_secret` novo (se ausente), chama `setWebhook` (`${APP_URL}/api/webhook/telegram`, `secret_token`), grava `webhook_status`. Permissão: `requireRole(req, 'admin')`. Auditoria `CHANNEL_CONFIG_UPDATED`. |
| DELETE | `/api/tenants/[id]/channel-configs?channel=` | Desabilita e remove: Telegram chama `deleteWebhook`; segredos zerados. Auditoria. |
| POST | `/api/clients/[id]/channel-links` | Gera token de vinculação (body `{ channel: 'telegram' }`). Retorna `{ link: 'https://t.me/<bot>?start=<token>', expires_at }`. Permissão: `requireRole(req, 'gestor')`. Rate limit de geração por cliente (10/h). |
| DELETE | `/api/clients/[id]/channels/[channel]` | Remove vinculação do canal do cliente (correção de associação indevida). |
| PATCH | `/api/cases/[id]` | Whitelist existente ganha `active_channel` (`whatsapp`\|`telegram`, validado contra canais vinculados do cliente). |
| POST | `/api/webhook/telegram` | Refatorado: header `X-Telegram-Bot-Api-Secret-Token` → lookup `channel_configs.webhook_secret_hash` (tenant + canal + enabled). Fallback demo: `WEBHOOK_SECRET` global + `TELEGRAM_BOT_TOKEN` env. Trata `/start <token>` (novo fluxo de vinculação), `/start case_<base64>` (legado, transição), mensagens de texto, `my_chat_member` (bloqueio → log + registro no caso). |
| POST | `/api/webhook/whatsapp` | Refatorado: mantém `X-Webhook-Secret` global; processamento delegado a `inbound.ts`. |

Fluxo de vinculação (`/start <token>`): hash do token → `channel_link_tokens` → valida `used_at IS NULL` e `expires_at > now()` → upsert `client_channels` (external_id = chat_id; username salvo como metadado) → marca `used_at` → responde confirmação ao devedor. Token ausente/expirado/usado → mensagem clara sugerindo novo link. O token é opaco (128 bits aleatórios) e nunca é persistido em claro.

### Pontos de Integração

**Telegram Bot API** (`https://api.telegram.org/bot<token>/METHOD`):
- `getMe` — validação do token na configuração e captura do `bot_username`.
- `setWebhook` / `deleteWebhook` — registro automático com `secret_token` por tenant; `drop_pending_updates=true` no primeiro registro.
- `sendMessage` — envio; `parse_mode: 'HTML'` mantido (status quo, sem regressão de formatação). Erros mapeados: `400` → mensagem inválida/muito grande; `403` (blocked) → "devedor bloqueou o bot" (não retentável); `429` → rate limit com `retry_after` (sem retry automático no MVP — ADR-001; registra falha); `401` → token inválido. Timeout 10s (AbortController, existente).
- Mensagem > 4096 chars → falha pré-envio com `status_error` claro (sem truncamento de saída).
- Idempotência de reentrega: `webhook_events.id = 'tg:<update_id>'` (existente).

**Z-API**: adapter preserva comportamento do `lib/whatsapp.ts` atual (normalização de telefone com prefixo 55, timeout 10s, `Client-Token` opcional). Config lida de `channel_configs` (migrada de profiles) em vez de `profiles`.

**Criptografia**: reuso das funções existentes `ai_encrypt`/`ai_decrypt` (service role only) para `bot_token_enc`, `webhook_secret_enc`, `zapi_key_enc`, `zapi_client_token_enc`. O `webhook_secret_hash` é SHA-256 calculado em Node antes de gravar (lookup indexável sem expor o secret).

## Análise de Impacto

| Componente | Impacto | Descrição e Risco | Ação |
|---|---|---|---|
| `lib/channels/*` (novo) | new | Módulo completo (types, channel, registry, adapters, message-service, inbound) | Implementar |
| `lib/whatsapp.ts`, `lib/telegram.ts` | deprecated | Lógica absorvida pelos adapters; risco: callers diretos | Remover após migrar callers |
| `lib/messaging.ts` | modified | Vira fachada que delega a `message-service` (transição) | Reescrever corpo, manter assinatura |
| `lib/agent.ts:497-512` | modified | Troca `telegram_chat_id \|\| phone` por `sendCaseMessage`; grava `channel`/`send_status` | Refatorar com fallback legado |
| `app/api/webhook/{telegram,whatsapp}/route.ts` | modified | Controladores viram adaptadores finos; risco: regressão em produção | Refatorar sobre `inbound.ts` |
| `app/api/agent-message`, `start-negotiation`, `cron/{follow-up,protests,negativations}` | modified | `sendMessage(destination,...)` → `sendCaseMessage` | Ajustar calls |
| `app/(dashboard)/settings/page.tsx` | modified | Nova aba `channels` no union type + painel `components/channel-config-panel.tsx` | Estender tabs |
| `app/(dashboard)/clients/page.tsx` | modified | Botão "Vincular Telegram" + modal com link copiável | Adicionar |
| `app/(dashboard)/cases/[id]/page.tsx` | modified | Indicador de canal ativo + troca (PATCH `active_channel`) | Adicionar |
| `lib/types.ts` | modified | `Message` ganha `channel?`, `send_status?`, `external_message_id?`; `Case` ganha `active_channel?` | Estender |
| `middleware.ts` | unchanged | `/api/webhook` já é prefixo público | Nada |
| `.env.example` | modified | Documentar `APP_URL` como base do webhook; TELEGRAM_BOT_TOKEN/WEBHOOK_SECRET como fallback demo | Atualizar |
| `supabase_channel_platform.sql` + `_verify.sql` (novo) | new | Migration + verificação (RLS, unique constraints, backfill) | Escrever |

## Estratégia de Testes

O projeto não possui suite automatizada; a validação segue o padrão existente (tsc + lint + build + scripts SQL de verificação manual):

- **Verify SQL** (`supabase_channel_platform_verify.sql`, padrão do `collection_case_core_verify.sql`): RLS das 3 tabelas novas (membro do tenant lê; usuário de outro tenant não lê; anon bloqueado), unique constraints (`webhook_secret_hash`, `(tenant_id, channel, external_id)`, `(tenant_id, client_id, channel)`, `messages` external id), backfill consistente (contagem de casos legados sem canal ativo esperada), expiração/uso único de token (UPDATE com WHERE `used_at IS NULL` afeta 0 linhas na segunda vez).
- **Typecheck/lint/build**: `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- **Checklist manual** (documentado na task final): fluxo de vinculação de ponta a ponta com bot real de teste, idempotência (reenvio do mesmo update), devedor bloqueia o bot → falha registrada, WhatsApp sem regressão, aba Canais mascarando segredos (inspecionar resposta da API e logs).

## Sequenciamento do Desenvolvimento

### Ordem de Build

1. **SQL migration** (`supabase_channel_platform.sql`: tabelas, colunas, índices, RLS, backfill) — sem dependências.
2. **`lib/channels/types.ts` + `channel.ts`** (interface e tipos) — sem dependências.
3. **Adapters `whatsapp-channel.ts` e `telegram-channel.ts`** — depende de 2 (absorvem `lib/whatsapp.ts`/`lib/telegram.ts`, agora recebendo `ChannelContext` com credenciais resolvidas).
4. **`registry.ts`** (resolução canal+config por tenant, decriptação via `ai_decrypt`, cache por request) — depende de 1, 3.
5. **`message-service.ts`** (`sendCaseMessage`) + `lib/messaging.ts` vira fachada — depende de 4.
6. **`inbound.ts`** + refatoração dos dois webhooks para delegar — depende de 4.
7. **Migração dos callers do domínio** (`agent.ts`, `agent-message`, `start-negotiation`, crons) para `sendCaseMessage`; remoção de `lib/whatsapp.ts`/`lib/telegram.ts` — depende de 5.
8. **Rota `/api/tenants/[id]/channel-configs`** (GET/PUT/DELETE com one-shot, getMe, setWebhook) — depende de 4.
9. **Vinculação**: rota `/api/clients/[id]/channel-links`, `DELETE /api/clients/[id]/channels/[channel]`, handler `/start <token>` no webhook Telegram, `PATCH active_channel` — depende de 1, 6, 8.
10. **UI aba Canais** (`components/channel-config-panel.tsx` + tab em settings) — depende de 8.
11. **UI vinculação** (modal na listagem de clientes + indicador/troca de canal no caso) — depende de 9.
12. **Verify SQL + `.env.example` + AGENTS.md (novos padrões)** — depende de todos.

### Dependências Técnicas

- Migration SQL aplicada manualmente ao Supabase antes de qualquer código que leia as tabelas novas (padrão do projeto).
- `ai_encrypt`/`ai_decrypt` já aplicados (`supabase_ai_keys_encryption.sql`) — pré-requisito existente.
- `APP_URL` deve apontar para URL pública HTTPS para o `setWebhook` funcionar em produção.

## Monitoramento e Observabilidade

- **Logger estruturado** (`lib/logger.ts`): eventos `channel_message_sent` / `channel_message_failed` com `{ tenantId, caseId, channel, sendStatus }` — **nunca** token, secret ou conteúdo da mensagem. Erros de webhook com `updateId` (sem payload).
- **Auditoria** (`recordAuditAction`): `CHANNEL_CONFIG_UPDATED`, `CHANNEL_CONFIG_DELETED`, `CLIENT_CHANNEL_LINKED` (via webhook, ator = sistema), `EXTERNAL_MESSAGE_RECEIVED` (existente).
- `channel_configs.webhook_status`/`webhook_last_error` expostos na aba Canais como indicador operacional (getWebhookInfo na leitura do PUT é opcional; status derivado do último setWebhook).
- Alerta existente de cron (`alert-admin`) pode consumir falhas de envio acumuladas por caso no futuro — fora do escopo.

## Considerações Técnicas

### Decisões Chave

- **Interface mínima** (`sendMessage` + `validateRecipient` + capacidades): recebimento é push de webhook, status é parte do resultado — sem interface artificial (ADR-004).
- **secret_token por tenant** (ADR-005): autentica origem e resolve tenant numa consulta (hash SHA-256 indexado; secret cifrado para o setWebhook).
- **Evoluir `messages`** em vez de tabela separada (ADR-006): UI e pipeline de IA continuam lendo uma única fonte.
- **Dual-read legado** (`cases.telegram_chat_id`/`cases.phone`) durante o rollout: sem regressão para tenants que não rodaram o backfill.
- **Sem parse_mode novo / sem truncamento de saída**: manter `HTML` (status quo); mensagem > 4096 falha com motivo claro.
- **Fallback demo**: sem `channel_configs` e com env vars globais, os adapters operam com `TELEGRAM_BOT_TOKEN`/`ZAPI_*` (comportamento de desenvolvimento atual preservado).

### Riscos Conhecidos

- **Backfill incompleto** (casos sem client, telefones divergentes): mitigado por fallback legado + relatório no verify SQL.
- **setWebhook falha na configuração** (APP_URL inválido, SSL): PUT retorna sucesso parcial com `webhook_status: 'error'` e mensagem clara — config salva, webhook para re-registrar.
- **Concorrência no webhook** (Telegram reenvia enquanto o primeiro processa): `webhook_events` com PK + tratamento de `23505` (padrão já usado) cobre duplicidade; upsert de `client_channels` idempotente.
- **Telegram 429 em rajadas de follow-up**: sem retry no MVP; falha registrada com motivo; crons já espaçam disparos.

## Registros de Decisões de Arquitetura

- [ADR-001: Plataforma de Canais unificada para WhatsApp e Telegram](adrs/adr-001.md) — WhatsApp e Telegram migram juntos para a abstração comum, sem fila assíncrona.
- [ADR-002: Identidade de canal por cliente com canal ativo por caso](adrs/adr-002.md) — Vinculações por cliente com identificador estável; caso define canal ativo.
- [ADR-003: Configuração de canal por tenant com migração one-shot](adrs/adr-003.md) — Credenciais saem de `profiles` para `channel_configs` cifrada por tenant.
- [ADR-004: Módulo `lib/channels/` com interface de canal e registry](adrs/adr-004.md) — Strategy/Adapter com fronteira explícita entre domínio e adapters.
- [ADR-005: Webhook do Telegram autenticado por secret_token por tenant](adrs/adr-005.md) — Hash indexado resolve autenticidade e tenant numa consulta.
- [ADR-006: Evoluir a tabela `messages`](adrs/adr-006.md) — Colunas de canal/resultado na tabela existente; direção derivada de `role`.
