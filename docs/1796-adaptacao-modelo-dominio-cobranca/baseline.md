# Baseline Validado

## Ordem De Aplicacao

1. `supabase_schema.sql` cria `cases` e `messages` com o modelo legado.
2. `supabase_debtors.sql` adiciona `debtors` e os campos legados do caso.
3. `supabase_contracts_model.sql` cria `clients`, `contracts` e `installments`.
4. `supabase_migration.sql` migra devedores/casos para clientes, contratos e parcelas.
5. `supabase_audit_logs.sql` cria os logs e triggers históricos.
6. `supabase_webhook_events.sql` cria a idempotência de webhooks.
7. `supabase_tenant_model.sql` é o baseline canônico de tenant: cria `tenants`, `tenant_members`, `financial_titles`, popula `tenant_id`, troca policies e adiciona funções de acesso/RLS.
8. `supabase_collection_case_core.sql` é a migração aditiva deste trabalho e deve ser aplicada depois do item 7.
9. `supabase_collection_case_core_verify.sql` deve ser executado depois do item 8 em uma sessão de verificação somente leitura; ele não é uma migração e não deve ser aplicado remotamente como DDL.

Os arquivos `supabase_unique_constraints.sql`, `supabase_tenant_isolation_fix.sql` e demais scripts antigos podem conter políticas ou constraints incompatíveis com o modelo canônico. Não são alterados por esta entrega e não devem ser reaplicados depois do baseline canônico.

## Estrutura Confirmada

- `cases`: `id`, `user_id`, `tenant_id`, `debtor_id`, `name`, `phone`, `original_value`, `updated_value`, `due_date`, `max_discount_margin` e `status`.
- `financial_titles`: `id`, `tenant_id`, `contract_id`, `client_id`, `installment_number`, `original_value`, `current_value`, `due_date`, `status`, `paid_at` e `legacy_installment_id`.
- `installments`: `id`, `tenant_id`, `contract_id`, `installment_number`, `original_value`, `due_date` e `status`. Continua sendo tabela de compatibilidade.
- `contracts`: possui `tenant_id`, `client_id`, `user_id` e `contract_number`.
- `clients`: possui `tenant_id`, `user_id`, `name`, `document`, `phone` e dados de contato.
- `messages`: possui `case_id` e `tenant_id`.
- `audit_logs`: possui `case_id`, `user_id` e, após o baseline de tenant, `tenant_id`, `entity_type`, `entity_id`, `actor_user_id` e `metadata`.

## Status Observados

- `cases`: `not_started`, `in_negotiation`, `needs_attention`, `closed`.
- `financial_titles`/`installments`: `pending`, `late`, `in_negotiation`, `paid`; a regra também trata `cancelled` e `canceled` como não recuperáveis quando presentes.
- Elegibilidade nova: `due_date < current_date` e status diferente de pago/quitado/cancelado. Vencimento hoje ainda não é vencido.

## Tenant E RLS

O acesso canônico usa `tenant_id` e `public.can_access_tenant(tenant_id)`. Usuários regulares são resolvidos por `tenant_members`; super-admins podem acessar qualquer tenant somente quando a operação recebe um tenant explícito validado. O cliente service role permanece restrito a webhooks/cron e não substitui a validação de vínculo.

## Consumidores De Casos

- `app/contracts/[id]/page.tsx` abre casos a partir de parcela/título.
- `app/cases/page.tsx` inicia negociação, consulta e anteriormente excluía casos.
- `app/cases/[id]/page.tsx` altera status e envia mensagens.
- `app/api/case-status/route.ts` altera status.
- `app/api/agent-message/route.ts` grava mensagem humana e pode assumir o caso.
- `app/api/chat/route.ts`, `app/api/start-negotiation/route.ts`, webhooks e cron são entradas automáticas.

O único consumidor controlado de criação da aplicação passa a enviar somente `financial_title_id`. Payloads legados de nome, telefone, valor e vencimento não são aceitos pelo novo POST.

## Verificacoes De Baseline

- Catalogar `financial_titles`, `cases`, `messages` e `audit_logs` antes e depois da migração, sem exclusões.
- Conferir títulos futuros, com vencimento hoje, vencidos, pagos e cancelados.
- Conferir isolamento de dois tenants com usuário regular e super-admin com tenant explícito.
- Conferir que backfill ambíguo permanece sem vínculo e que mensagens/auditoria não são reescritas.

## Verificação E Reversão Operacional

- A evidência SQL fica em `supabase_collection_case_core_verify.sql` e usa `BEGIN`, `SET TRANSACTION READ ONLY` e `ROLLBACK`; não cria fixtures persistentes nem altera o banco.
- Antes do rollout, executar o verificador e os comandos `npx tsc --noEmit`, `npm run lint`, `npm run build` e `git diff --check`.
- Se a migração principal precisar ser revertida, interromper o rollout, preservar o dump/base original e executar um rollback revisado pelo responsável do banco. Não remover `financial_title_id`, índices, políticas ou funções enquanto houver casos canônicos, mensagens ou auditoria dependentes; primeiro arquivar os vínculos e validar a restauração em ambiente isolado.
