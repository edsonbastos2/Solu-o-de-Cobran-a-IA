---
status: pending
title: Migration SQL supabase_channel_platform.sql (tabelas, colunas, RLS, backfill)
type: supabase
complexity: high
dependencies: []
---

# Migration SQL supabase_channel_platform.sql (tabelas, colunas, RLS, backfill)

## Visão Geral

Cria a base de dados da plataforma de canais: `channel_configs` (config por tenant com segredos cifrados), `client_channels` (identidade estável de canal por cliente), `channel_link_tokens` (vinculação segura), evolução de `messages` e `cases`, RLS no padrão do projeto e backfill não-destrutivo dos dados legados.

<critical>
- Leia PRD e TechSpec antes de implementar
- Referencie a seção "Modelo de Dados" do TechSpec
- Foque no QUÊ entregar, não no COMO
- Minimize alterações de código ao necessário
- Testes são obrigatórios
- Execute `npm run lint && npm run build` como pipeline de verificação
</critical>

<requirements>
1. O arquivo `supabase_channel_platform.sql` DEVE criar as tabelas `channel_configs`, `client_channels` e `channel_link_tokens` exatamente com as colunas, CHECKs e uniques definidos na seção "Modelo de Dados" do TechSpec.
2. A migration DEVE adicionar a `messages` as colunas `channel`, `external_message_id`, `send_status`, `status_error`, `sent_at` e a `cases` a coluna `active_channel`, todas nullable.
3. A migration DEVE criar o índice único parcial `messages_external_id_uniq ON messages (tenant_id, channel, external_message_id) WHERE external_message_id IS NOT NULL`.
4. RLS DEVE seguir o padrão `tenant_isolation` de `supabase_tenant_model.sql` (linhas 861-876): `USING (public.can_access_tenant(tenant_id)) WITH CHECK (public.can_access_tenant(tenant_id))` para as três tabelas novas; `webhook_events` permanece service-role only.
5. O backfill DEVE ser idempotente (`IF NOT EXISTS` / `ON CONFLICT DO NOTHING`) e não-destrutivo: popular `client_channels` a partir de `clients.phone` (canal whatsapp, external_id = dígitos do telefone sem prefixo 55 quando aplicável) e de `cases.telegram_chat_id` → cliente do caso (canal telegram); definir `cases.active_channel = 'telegram'` onde `telegram_chat_id IS NOT NULL`, senão `'whatsapp'` onde `phone IS NOT NULL`.
6. O backfill NÃO DEVE falhar para casos sem cliente: usar LEFT JOIN e deixar esses casos para o fallback legado da aplicação.
7. Segredos (`bot_token_enc`, `webhook_secret_enc`, `zapi_key_enc`, `zapi_client_token_enc`) DEVERIAM ser TEXT nullable — a cifragem é feita pela aplicação via `ai_encrypt`, nunca em SQL.
8. A migration DEVE incluir `updated_at` triggers ou confiar no padrão já usado pelo projeto (verificar `supabase_tenant_model.sql` para o padrão de trigger `set_updated_at`).
9. Comentários em pt-BR no SQL, seguindo o estilo dos arquivos `supabase_*.sql` existentes.
</requirements>

## Subtarefas

- [ ] Criar `supabase_channel_platform.sql` com as três tabelas (CHECKs de channel, uniques, FKs para tenants/clients com ON DELETE CASCADE)
- [ ] ALTER TABLE em `messages` e `cases` + índice único parcial
- [ ] Policies `tenant_isolation` para as três tabelas (mesmo formato do loop DO de `supabase_tenant_model.sql:861-876`)
- [ ] Backfill idempotente de `client_channels` e `cases.active_channel`
- [ ] SELECT de verificação no fim do arquivo reportando inconsistências (casos com `telegram_chat_id` sem client; casos sem canal ativo)
- [ ] RevisarGrant/revoke: nenhuma policy para anon/authenticated além do padrão (can_access_tenant já cobre authenticated)

## Detalhes de Implementação

### Arquivos a Criar

- `supabase_channel_platform.sql` — migration completa (aplicação manual no SQL Editor do Supabase, padrão do projeto)

### Arquivos a Modificar

- Nenhum (migration puramente aditiva)

### Arquivos Relevantes

- `supabase_tenant_model.sql:861-876` — padrão de policy `tenant_isolation` a replicar
- `supabase_tenant_model.sql:583-627` — helpers `can_access_tenant`/`current_tenant_id` (já existem, reutilizar)
- `supabase_webhook_events.sql` — padrão de tabela service-role only e índice de limpeza
- `supabase_ai_keys_encryption.sql:54-87` — `ai_encrypt`/`ai_decrypt` (referência de como os segredos serão cifrados pela aplicação)
- `docs/1806-integracao-canais-comunicacao/techspec.md` — seção "Modelo de Dados" (fonte da verdade do schema)

### Arquivos Dependentes

- `lib/channels/registry.ts` (tarefa 4) — lê `channel_configs`
- `app/api/tenants/[id]/channel-configs/route.ts` (tarefa 8) — escreve `channel_configs`
- `app/api/clients/[id]/channel-links/route.ts` (tarefa 9) — lê/escreve `channel_link_tokens` e `client_channels`
- `supabase_channel_platform_verify.sql` (tarefa 13) — valida esta migration

### ADRs Relacionados

- [ADR-002: Identidade de canal por cliente com canal ativo por caso](adrs/adr-002.md) — origem das tabelas `client_channels` e `cases.active_channel`
- [ADR-003: Configuração de canal por tenant](adrs/adr-003.md) — origem de `channel_configs`
- [ADR-005: Webhook autenticado por secret_token por tenant](adrs/adr-005.md) — colunas `webhook_secret_hash`/`webhook_secret_enc`
- [ADR-006: Evoluir a tabela messages](adrs/adr-006.md) — colunas novas de `messages`

## Entregáveis

- [ ] `supabase_channel_platform.sql` completo e aplicável de forma idempotente
- [ ] Backfill com relatório de inconsistências embutido
- [ ] Script testado no SQL Editor do Supabase (evidência: saída dos SELECTs de verificação)

## Testes

### Testes Unitários

- Não se aplica (SQL); validação fica a cargo do verify SQL da tarefa 13 e da aplicação manual.

### Testes de Integração

- [ ] Aplicar a migration duas vezes seguidas — segunda execução não cria nem altera nada (idempotência)
- [ ] `INSERT` em `client_channels` com `(tenant_id, client_id, channel)` duplicado falha com 23505
- [ ] `INSERT` em `channel_configs` com `webhook_secret_hash` duplicado falha com 23505
- [ ] Após backfill: todo caso com `telegram_chat_id` e client vinculado possui linha em `client_channels` (canal telegram)
- [ ] `active_channel` populado conforme regra do requisito 5

## Critérios de Sucesso

- [ ] Migration aplicada sem erros no Supabase de desenvolvimento
- [ ] Idempotência confirmada (re-execução sem efeito)
- [ ] Uniques e RLS presentes (confirmar via `\d` ou query em pg_policies)
- [ ] Backfill relata inconsistências sem falhar
