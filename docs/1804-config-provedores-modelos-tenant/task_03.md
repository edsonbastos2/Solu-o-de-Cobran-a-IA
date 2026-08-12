---
status: done
title: API app/api/tenants/[id]/ai-config (GET+PUT + migração lazy)
type: backend
complexity: high
dependencies:
  - task_01
  - task_02
---

# Task 03: API `/api/tenants/[id]/ai-config` — GET + PUT + lazy migration

## Overview

Cria o endpoint que alimenta a nova aba de Settings: GET retorna os três buckets com flags de segredo (sem expor ciphertext) e dispara a migração lazy na primeira chamada; PUT valida e persiste um bucket por vez, criptografando o segredo do provedor selecionado via `ai_encrypt`.

<critical>
- ALWAYS READ the PRD and TechSpec before starting.
- REFERENCE TECHSPEC 'API Endpoints' section for the request/response shapes and the validation rules.
- FOCUS ON "WHAT" — declare the contract and validation; the UI lives in task_07.
- MINIMIZE CODE — show the response envelope and the lazy-migration SQL guard, not full handlers.
- TESTS REQUIRED — manual + static checks, including the migration idempotency guard.
</critical>

<requirements>
- MUST implement `GET /api/tenants/[id]/ai-config` (and the query-param `?tenant_id=` variant consistent with `requireTenantContext`) returning `{ assistant: TenantAIBucket, pdf_extraction: TenantAIBucket, agents: TenantAIBucket, migrated_at }` where each bucket carries `*_api_key_set` booleans (never `*_enc`).
- MUST require `role >= 'admin'` via `requireRole(req, 'admin', requestedTenantId)`; returns 403 otherwise.
- MUST perform the lazy migration in the GET path BEFORE returning config: if `tenants.ai_migrated_at IS NULL`, fetch the tenant's `owner_user_id`, run `get_user_ai_keys(owner_user_id)`, and when at least one AI field is non-null, `UPDATE tenants SET settings.ai.assistant = {provider, model, ollama_base_url, <provider>_api_key_enc} , ai_migrated_at = now() WHERE id = $ AND ai_migrated_at IS NULL` (conditional UPDATE for concurrency idempotency).
- MUST NOT stamp `ai_migrated_at` when the owner's `profiles` AI fields are all null (so the tenant can keep falling back to system/hardcoded).
- MUST implement `PUT /api/tenants/[id]/ai-config` accepting body `{ bucket, provider, model, ollama_base_url?, <provider>_api_key? }`; validate `bucket ∈ {assistant,pdf_extraction,agents}` and `provider` against the six supported providers.
- MUST reject `pdf_extraction` providers not in `VISION_CAPABLE` with 400 `{ error: 'Provedor não suporta visão de documento.' }`.
- MUST encrypt a non-empty secret via `admin.rpc('ai_encrypt', { plain })` and store it as `<provider>_api_key_enc` inside `settings.ai.<bucket>`; empty/undefined secret MUST be omitted to preserve existing secret.
- MUST update `tenants.settings` using a JSONB merge that preserves other buckets (e.g. `jsonb_set(settings, '{ai,<bucket>}', <$bucketJson> )`).
- MUST `recordAuditAction` with `entityType: 'ai_config'`, `action: 'AI_CONFIG_UPDATED'`, `metadata: { bucket, provider, model }` on PUT.
</requirements>

## Subtasks
- [ ] 03.1 Create `app/api/tenants/[id]/ai-config/route.ts` with `requireRole('admin')`.
- [ ] 03.2 Implement GET: read `tenants.settings.ai`, mask secrets into `*_api_key_set` booleans.
- [ ] 03.3 Implement the lazy migration step (read `ai_migrated_at` + owner `profiles`; conditional UPDATE).
- [ ] 03.4 Implement PUT with provider/model validation, `pdf_extraction` vision-capable guard, `ai_encrypt` write, JSONB merge via `jsonb_set`.
- [ ] 03.5 Add `recordAuditAction` on PUT; return secret flags on GET only.
- [ ] 03.6 Manual verification: migrate once; second GET skips migration; PUT one bucket preserves the others.

## Implementation Details

Use `getSupabaseAdmin()` for the encrypted writes (service role) and the `ai_encrypt`/`ai_decrypt`/`get_user_ai_keys`/`get_tenant_ai_keys` RPCs. Mirror the secret-masking pattern already used in `app/api/settings/route.ts` (`SECRET_FIELDS` + `*_set` flags). The route lives at `app/api/tenants/[id]/ai-config/route.ts`; expose the query-param variant by also accepting `?tenant_id=` (consistent with how `/api/agents` consumes it).

### Relevant Files
- `lib/api-auth.ts` — `requireRole(req, 'admin', requestedTenantId)` + `TenantContext.tenantId`.
- `app/api/settings/route.ts` — the `SECRET_FIELDS` masking and `ai_encrypt` write pattern to mirror.
- `app/api/agents/route.ts` — tenant-scoped GET/POST with `requireRole(admin)` + `?tenant_id=`.
- `lib/audit.ts` — `recordAuditAction`.
- `lib/api-validate.ts` — `validateFields`.
- `lib/ai-config.ts` (task_02) — `VISION_CAPABLE` for `pdf_extraction` validation.

### Dependent Files
- `app/(dashboard)/settings/page.tsx` (task_07) consumes this endpoint.
- `lib/ai-config.ts` (task_02) consumes the buckets written here.

### Related ADRs
- [ADR-002: Tenant AI config in tenants.settings JSONB; system defaults in a dedicated table](../adrs/adr-002.md) — JSONB merge via `jsonb_set`; secret masking.
- [ADR-004: Lazy one-shot migration from profiles AI columns to tenants.settings.ai](../adrs/adr-004.md) — First-GET migration.

## Deliverables
- `app/api/tenants/[id]/ai-config/route.ts` with GET + PUT handlers.
- Manual notes: lazy migration runs once per tenant and is idempotent under concurrent GETs.
- `npx tsc --noEmit` clean.

## Tests
- Manual:
  - [ ] GET without admin role → 403.
  - [ ] GET with admin role on a tenant whose owner had `profiles` AI config → returns migrated `assistant` bucket + `migrated_at` set.
  - [ ] Second GET returns the same config and does NOT re-run the migration (verify by checking `ai_migrated_at` unchanged).
  - [ ] GET on a tenant whose owner had no AI config → buckets all empty, `migrated_at` NULL; subsequent bucket chain falls to system/hardcoded.
  - [ ] PUT `{ bucket: 'assistant', provider: 'openai', model: 'gpt-4o-mini', openai_api_key: 'sk-...' }` → 200; GET returns `openai_api_key_set: true`.
  - [ ] PUT `{ bucket: 'pdf_extraction', provider: 'ollama', ... }` → 400 with vision-capable message.
  - [ ] PUT with empty secret string → existing secret preserved (GET still shows `*_set: true`).
- Static:
  - [ ] `npx tsc --noEmit` passes; `npm run lint` passes.

## Success Criteria
- Owner/admin reads buckets; member gets 403.
- Lazy migration runs exactly once per qualifying tenant.
- PUT validates provider/model, rejects vision-incapable `pdf_extraction` providers, preserves untouched secrets and other buckets.
- Static checks green.