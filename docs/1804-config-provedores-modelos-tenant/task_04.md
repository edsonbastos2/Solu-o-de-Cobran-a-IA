---
status: done
title: API app/api/admin/ai-defaults (GET+PUT, super-admin)
type: backend
complexity: medium
dependencies:
  - task_01
  - task_02
---

# Task 04: API `/api/admin/ai-defaults` — GET + PUT (super-admin)

## Overview

Cria o endpoint que alimenta a página admin: GET retorna os dois buckets de sistema (`assistant`, `pdf_extraction`) com flags de segredo; PUT upserta um bucket, validando provider/model e rejeitando provedores não-vision-capable em `pdf_extraction`.

<critical>
- ALWAYS READ the PRD and TechSpec before starting.
- REFERENCE TECHSPEC 'API Endpoints' section for the super-admin endpoint contract.
- FOCUS ON "WHAT" — declare inputs/outputs and validation; the UI lives in task_08.
- MINIMIZE CODE — show the validation envelope only.
- TESTS REQUIRED — manual role/permission + validation checks.
</critical>

<requirements>
- MUST implement `GET /api/admin/ai-defaults` returning `{ assistant: SystemDefaultsBucket, pdf_extraction: SystemDefaultsBucket }` where each bucket carries `*_api_key_set` booleans (never the secret).
- MUST require super-admin via `requireSuperAdmin(req)`; 401 when unauthenticated, 403 otherwise.
- MUST implement `PUT /api/admin/ai-defaults` accepting `{ bucket, provider, model, <provider>_api_key?, ollama_base_url? }`; bucket ∈ `{assistant, pdf_extraction}`.
- MUST reject `pdf_extraction` providers not in `VISION_CAPABLE` with 400.
- MUST UPSERT into `system_ai_defaults` (PK `bucket`) encrypting a non-empty secret via `ai_encrypt`; empty/undefined secrets preserve the existing ciphertext.
- MUST `recordAuditAction` with `entityType: 'ai_config'`, `action: 'AI_SYSTEM_DEFAULTS_UPDATED'`, `metadata: { bucket, provider, model }` on PUT.
</requirements>

## Subtasks
- [ ] 04.1 Create `app/api/admin/ai-defaults/route.ts` with `requireSuperAdmin`.
- [ ] 04.2 Implement GET: read both rows, mask secrets to `*_set` booleans.
- [ ] 04.3 Implement PUT: validate, encrypt the selected provider's secret, UPSERT by `bucket`.
- [ ] 04.4 Add `recordAuditAction` on PUT.
- [ ] 04.5 Manual checks: admin can read/write; regular user gets 403; vision-capable guard holds.

## Implementation Details

Use `getSupabaseAdmin()` (service role) for the `system_ai_defaults` writes; the table is service-role-only per task_01. Mirror the secret-masking from `app/api/settings/route.ts`.

### Relevant Files
- `app/api/admin/users/route.ts` — `requireSuperAdmin` + admin route pattern.
- `app/api/settings/route.ts` — `SECRET_FIELDS` masking + `ai_encrypt` write.
- `lib/audit.ts` — `recordAuditAction`.
- `lib/ai-config.ts` (task_02) — `VISION_CAPABLE`, reused on validation.

### Dependent Files
- `app/(dashboard)/admin/ai-defaults/page.tsx` (task_08) consumes this endpoint.
- `lib/ai-config.ts` reads the rows written here via `get_system_ai_keys()`.

### Related ADRs
- [ADR-002: Tenant AI config in tenants.settings JSONB; system defaults in a dedicated table](../adrs/adr-002.md) — `system_ai_defaults` storage.

## Deliverables
- `app/api/admin/ai-defaults/route.ts` with GET + PUT.
- `npx tsc --noEmit` clean.

## Tests
- Manual:
  - [ ] GET unauthenticated → 401; GET as non-super-admin → 403.
  - [ ] GET as super-admin → returns both buckets with `*_set` flags.
  - [ ] PUT `{ bucket: 'assistant', provider: 'gemini', model: 'gemini-3.5-flash', gemini_api_key: 'AI...' }` → 200; GET shows `gemini_api_key_set: true`.
  - [ ] PUT `{ bucket: 'pdf_extraction', provider: 'openrouter', ... }` → 400 vision-capable message.
  - [ ] PUT with empty secret preserves the existing secret (GET still `*_set` true).
- Static:
  - [ ] `npx tsc --noEmit` passes; `npm run lint` passes.

## Success Criteria
- Super-admin-only access enforced.
- UPSERT by `bucket`; vision-capable validation enforced for `pdf_extraction`.
- Static checks green.