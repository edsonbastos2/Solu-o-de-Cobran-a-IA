---
status: pending
title: Rota /api/tenants/[id]/channel-configs (GET/PUT/DELETE)
type: api
complexity: high
dependencies: ["4_task"]
---

# Rota /api/tenants/[id]/channel-configs (GET/PUT/DELETE)

## Visão Geral

CRUD da configuração de canal por tenant: GET com migração one-shot e mascaramento, PUT com validação `getMe` e registro automático de webhook (`setWebhook`), DELETE com `deleteWebhook` e limpeza de segredos.

<critical>
- Leia PRD e TechSpec antes de implementar
- Referencie as seções "Endpoints de API" e "Pontos de Integração" do TechSpec
- Foque no QUÊ entregar, não no COMO
- Minimize alterações de código ao necessário
- Testes são obrigatórios
- Execute `npm run lint && npm run build` como pipeline de verificação
</critical>

<requirements>
1. GET DEVE usar `requireTenantContext(req, id)` (membros podem ler), retornar configs de todos os canais mascaradas: `channel`, `enabled`, `bot_username`, `webhook_status`, `webhook_last_error`, `webhook_url`, `zapi_instance`, flags booleanas `bot_token_set`, `webhook_secret_set`, `zapi_key_set`, `zapi_client_token_set`, `migrated_at` — NUNCA ciphertext nem secret.
2. GET DEVE disparar a migração one-shot (padrão `ai-config`): para cada canal sem config e com `migrated_at IS NULL`, copiar as credenciais de mensageria do owner do tenant (via RPC `get_user_ai_keys`) re-cifradas com `ai_encrypt`, e gravar `migrated_at` com UPDATE condicional `.is('migrated_at', null)` para idempotência.
3. PUT DEVE exigir `requireRole(req, 'admin')` e aceitar `body.channel` (`whatsapp`|`telegram`), `enabled`, e segredos opcionais (`bot_token`, `zapi_key`, `zapi_client_token`, `zapi_instance`): segredo vazio/ausente preserva o ciphertext existente (padrão `ai-config` linhas 301-304).
4. PUT do Telegram com `bot_token` fornecido DEVE validar via `getMe`: token inválido → 400 com mensagem clara; válido → persistir `bot_username` e prosseguir.
5. PUT do Telegram DEVE gerar `webhook_secret` (crypto aleatório, charset `A-Za-z0-9_-`, 32+ chars) quando não existir, gravar hash SHA-256 + ciphertext, e chamar `setWebhook` com `url = ${APP_URL}/api/webhook/telegram` e `secret_token`; sucesso → `webhook_status='active'`; falha → `webhook_status='error'` + `webhook_last_error`, respondendo 200 com o status de erro explícito (config salva, webhook pendente).
6. PUT do Telegram DEVERIA usar `drop_pending_updates=true` apenas no primeiro registro (config nova).
7. DELETE DEVE exigir `requireRole(req, 'admin')`, receber `?channel=`, chamar `deleteWebhook` (Telegram) quando aplicável, zerar segredos e `enabled=false`, com auditoria `CHANNEL_CONFIG_DELETED`.
8. Toda escrita DEVE gravar auditoria via `recordAuditAction` (`CHANNEL_CONFIG_UPDATED`/`CHANNEL_CONFIG_DELETED`) e `updated_at`.
9. Sem `APP_URL` configurada, PUT do Telegram DEVE retornar 400 orientando configurar a variável antes de registrar o webhook.
10. Erros de `ai_encrypt` (infra não aplicada) DEVEM retornar 503 com instrução de aplicar `supabase_ai_keys_encryption.sql` (padrão `ai-config` linhas 292-298).
</requirements>

## Subtarefas

- [ ] GET com mascaramento + one-shot migration
- [ ] PUT com validação getMe, geração de secret, setWebhook
- [ ] DELETE com deleteWebhook + auditoria
- [ ] Compilar e lintar

## Detalhes de Implementação

### Arquivos a Criar

- `app/api/tenants/[id]/channel-configs/route.ts` — handlers GET/PUT/DELETE

### Arquivos a Modificar

- Nenhum

### Arquivos Relevantes

- `app/api/tenants/[id]/ai-config/route.ts` — padrão completo a espelhar: requireTenantContext/requireAIConfigPermission, one-shot, `ai_encrypt`, mascaramento, auditoria, 503 da cifragem
- `lib/api-auth.ts:149` — `requireRole(req, minRole, requestedTenantId)`
- `lib/channels/registry.ts` (tarefa 4) — formato da config consumida
- `lib/audit.ts` — `recordAuditAction`
- `docs/1806-integracao-canais-comunicacao/adrs/adr-005.md` — geração/hash do webhook secret

### Arquivos Dependentes

- `components/channel-config-panel.tsx` (tarefa 11) — consome esta rota
- `lib/channels/registry.ts` — lê o que esta rota grava

### ADRs Relacionados

- [ADR-003: Configuração de canal por tenant com migração one-shot](adrs/adr-003.md) — one-shot e cifragem
- [ADR-005: Webhook autenticado por secret_token por tenant](adrs/adr-005.md) — setWebhook com secret por tenant

## Entregáveis

- [ ] Rota com os três handlers no padrão `ai-config`
- [ ] One-shot migration testada com perfil de owner contendo credenciais legadas
- [ ] setWebhook chamado com secret por tenant

## Testes

### Testes de Integração

- [ ] GET sem config + owner com `profiles.telegram_bot_token` → config criada com `bot_token_set=true` e `migrated_at` preenchido; segundo GET não re-migra
- [ ] PUT com `bot_token` inválido → 400 e nada gravado
- [ ] PUT com token válido (bot de teste) → `bot_username` preenchido, `webhook_status='active'` (com APP_URL válida) 
- [ ] PUT sem `APP_URL` → 400 com orientação
- [ ] PUT sem campos de segredo → ciphertexts preservados (flags continuam true)
- [ ] GET/PUT como membro `gestor` → 403; GET como membro comum → 200
- [ ] DELETE → segredos zerados, `enabled=false`, `deleteWebhook` chamado (bot de teste)

## Critérios de Sucesso

- [ ] `npm run build` compila
- [ ] `npm run lint` sem erros
- [ ] Resposta do GET inspecionada: nenhum campo de segredo/ciphertext presente
