---
status: done
title: Migration SQL: tenants.ai_migrated_at, system_ai_defaults, RPCs get_tenant_ai_keys/get_system_ai_keys
type: infra
complexity: medium
dependencies: []
---

# Task 01: Migration SQL — tenants AI storage primitives

## Overview

Cria o substrato de persistência que todas as demais tarefas consomem: nova coluna `tenants.ai_migrated_at`, tabela `system_ai_defaults`, e os RPCs que descriptografam secrets por tenant e por sistema. É aditivo e reutiliza a infraestrutura de Vault já existente (`ai_encrypt`/`ai_decrypt`).

<critical>
- ALWAYS READ the PRD and TechSpec before starting (`../prd.md`, `../techspec.md`).
- REFERENCE TECHSPEC 'Data Models' section for the exact SQL — do not duplicate field types.
- FOCUS ON "WHAT" — declare the migration objects, not the Postgres internals.
- MINIMIZE CODE — the SQL block is illustrative; the implementing agent mirrors the TechSpec.
- TESTS REQUIRED — manual verification that the migration applies idempotently.
</critical>

<requirements>
- MUST add `public.tenants.ai_migrated_at TIMESTAMPTZ` (nullable).
- MUST create `public.system_ai_defaults` with PK on `bucket` ∈ `{assistant, pdf_extraction}` and per-provider secret columns, mirroring the field set of `profiles` AI columns.
- MUST grant `system_ai_defaults` access to `service_role` only; REVOKE from anon/authenticated.
- MUST create `public.get_tenant_ai_keys(p_tenant_id UUID)` returning one row per bucket present in `tenants.settings->'ai'`, decrypting the active provider's secret via `ai_decrypt`.
- MUST create `public.get_system_ai_keys()` returning the two bucket rows with decrypted secrets.
- MUST REVOKE public/anon/authenticated EXECUTE on both RPCs and GRANT to `service_role`.
- MUST be idempotent (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`).
</requirements>

## Subtasks
- [ ] 01.1 Author `supabase_ai_config_tenant.sql` at project root with `tenants.ai_migrated_at`.
- [ ] 01.2 Define `system_ai_defaults` table (PK `bucket`, provider, model, six provider-secret columns + `ollama_base_url`, `updated_by`, `updated_at`).
- [ ] 01.3 Implement `get_tenant_ai_keys(p_tenant_id)` iterating `jsonb_each(tenants.settings->'ai')` and decrypting the matching `<provider>_api_key_enc` column per row.
- [ ] 01.4 Implement `get_system_ai_keys()` decrypting the per-row secret.
- [ ] 01.5 Apply the migration to the Supabase project (SQL Editor or MCP `apply_migration`) and confirm via `\d`/advisor check that no RLS gaps exist on `system_ai_defaults`.

## Implementation Details

Mirror verbatim the SQL from TechSpec 'Data Models'. The migration file sits next to the existing `supabase_ai_keys_encryption.sql` and `supabase_tenant_model.sql`. After applying, run `supabase_get_advisors` (security) to confirm no policy regressions on `tenants`/`profiles`.

### Relevant Files
- `supabase_ai_keys_encryption.sql` — source of `ai_encrypt`/`ai_decrypt` and the `get_user_ai_keys(p_user_id)` pattern to mirror.
- `supabase_tenant_model.sql` — `tenants` schema and `settings JSONB` definition.
- `.env.example` — no change in this task (env documentation is task_09).

### Dependent Files
- `lib/ai-config.ts` (task_02) — consumes the new RPCs.
- `app/api/tenants/[id]/ai-config/route.ts` (task_03) — reads `ai_migrated_at` and writes `settings.ai`.
- `app/api/admin/ai-defaults/route.ts` (task_04) — writes `system_ai_defaults`.

### Related ADRs
- [ADR-002: Tenant AI config in tenants.settings JSONB; system defaults in a dedicated table](../adrs/adr-002.md) — Storage layer split and RPC shapes.

## Deliverables
- `supabase_ai_config_tenant.sql` applied to the project.
- `system_ai_defaults` rows insertable/selectable by `service_role` only (manual check).
- `get_tenant_ai_keys` and `get_system_ai_keys` callable by `service_role` returning decrypted secrets.
- Manual verification notes: re-running the SQL is idempotent (no errors on second apply).

## Tests
- Manual SQL:
  - [ ] `SELECT ai_migrated_at FROM tenants LIMIT 1` returns NULL (new column exists, nullable).
  - [ ] `INSERT INTO system_ai_defaults (bucket, provider, model) VALUES ('assistant','opencode','deepseek-v4-flash')` succeeds as service role; selecting as authenticated client returns permission error.
  - [ ] `SELECT * FROM get_tenant_ai_keys(<tenant_id>)` returns empty set when `tenants.settings->'ai'` is absent; returns rows after a fixture insert.
  - [ ] `SELECT * FROM get_system_ai_keys()` returns the seeded assistant row with decrypted secrets.
- Idempotency:
  - [ ] Re-running the migration SQL yields no errors (all `IF NOT EXISTS`/`OR REPLACE`).
- Security advisor:
  - [ ] `supabase_get_advisors` (security) shows no new high/critical findings on `system_ai_defaults`.

## Success Criteria
- Migration applied with no errors; idempotent re-run pass.
- Service-role-only access to `system_ai_defaults` and the two RPCs confirmed.
- Security advisor clean for the new objects.