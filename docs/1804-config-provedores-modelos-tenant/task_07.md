---
status: done
title: UI Settings — aba "Configurações do Tenant" + IA por-usuário read-only + banner de migração
type: frontend
complexity: high
dependencies:
  - task_03
---

# Task 07: UI Settings — aba "Configurações do Tenant"

## Overview

Adiciona a nova aba "Configurações do Tenant" em `app/(dashboard)/settings/page.tsx` com edição dos três buckets, usando `useActiveTenant` para resolver/gatear o `tenantQuery` e o papel (`isAdmin`). A aba "IA" existente (per-user em `profiles`) torna-se read-only com banner "Migrada para o tenant". Membros comuns veem os campos como somente leitura.

<critical>
- ALWAYS READ the PRD and TechSpec before starting.
- REFERENCE TECHSPEC 'System Architecture → UI (modified)' and the existing Settings IA tab for the field structure.
- FOCUS ON "WHAT" — declare the tab contract; do not redesign the rest of Settings.
- MINIMIZE CODE — show only the bucket form skeleton.
- TESTS REQUIRED — manual flows per role + bucket.
</critical>

<requirements>
- MUST add a third tab "Configurações do Tenant" to `app/(dashboard)/settings/page.tsx`, shown to every authenticated user; editing fields gated by `useActiveTenant().isAdmin` (read-only when false).
- MUST render three sub-sections (`Assistente`, `Extração de PDF`, `Agentes`), each with provider select (six options), model select/input valid for the provider, ollama base url (for `ollama`), and one secret input per provider (showing a "salvo" badge when `*_api_key_set === true`; never pre-filling the secret).
- MUST use the existing model whitelists per provider (consolidated in `lib/ai-config.ts` via task_02; for the client, import a small plain object mirror or fetch from the resolver's exported whitelist where reachable from client).
- MUST load via `GET /api/tenants/[id]/ai-config?<tenantQuery>` using `fetchWithAuth` from `lib/api.ts`, and POST via `PUT /api/tenants/[id]/ai-config?<tenantQuery>` for the edited bucket.
- MUST display a one-time banner "Sua configuração de IA foi migrada para este tenant" when `migrated_at` is newly set since the previous load (use a local SWR key + a dismiss state).
- MUST make the existing IA per-user tab read-only (inputs `disabled` + `readOnly`) with a static note "Esta configuração foi migrada para o tenant. Edite em 'Configurações do Tenant'." The save handler for that tab becomes a no-op (or hidden), to avoid writing back to `profiles`.
- MUST reflect the resolved `source` for each bucket (e.g. a small badge "usando configuração do tenant" / "usando padrão de sistema" / "fallback") when the bucket's provider+model aren't explicitly given — computed client-side from the empty-or-present bucket values returned by GET.
- MUST respect accessibility: labelled fields, badge text not color-only; keyboard-navigable selects.
</requirements>

## Subtasks
- [ ] 07.1 Add the "Configurações do Tenant" tab button + panel, gated by `useActiveTenant()` for `tenantQuery` and `isAdmin`.
- [ ] 07.2 Implement a `BucketEditor` sub-component (provider select, model select/input, secret input with "salvo" badge, save button) reused by the three buckets.
- [ ] 07.3 Wire GET (SWR keyed by `['tenant-ai-config', tenantQuery]`) and PUT per bucket; preserve other buckets via the server-side JSONB merge.
- [ ] 07.4 Render the migration banner on first `migrated_at` set; persist dismissal in component state.
- [ ] 07.5 Make the IA per-user tab read-only with the migration note; disable its `PUT /api/settings` AI-marked fields.
- [ ] 07.6 Render the resolved-source badge per bucket using empty-bucket detection from GET.
- [ ] 07.7 Manual: as owner/admin edit a bucket and see "salvo"; as member, fields are read-only; as super-admin via `?tenant_id=`, the same controls target the selected tenant.

## Implementation Details

Import `useActiveTenant` from `@/hooks/use-active-tenant` and `fetcher`/`fetchWithAuth` from `lib/api.ts`. Mirror styling from the existing IA tab (the `<select>`/`<input>` scaffolding already there). The model whitelist per provider can be a tiny TS constant copied from `lib/ai-config.ts`'s whitelist (exported as a plain object) to avoid pulling server-only code into the client bundle.

### Relevant Files
- `app/(dashboard)/settings/page.tsx` — add the tab + make IA per-user tab read-only (lines 12 tab state, 38-55 whitelists, 333-510 IA panel).
- `hooks/use-active-tenant.ts` — `tenantQuery`, `isAdmin`, `profile`.
- `lib/api.ts` — `fetcher` + `fetchWithAuth` (SWR).
- `lib/ai-config.ts` (task_02) — `AIProvider` + model whitelists (mirror for the client).
- `app/api/tenants/[id]/ai-config/route.ts` (task_03) — endpoint contract.
- `app/api/settings/route.ts` — underlying per-user endpoint that becomes read-only on the AI fields.

### Dependent Files
- `app/api/tenants/[id]/ai-config/route.ts` (must be deployed first; declared dep).
- The existing per-user IA fields remain in `profiles` but stop being the source of truth (ADR-004).

### Related ADRs
- [ADR-001](../adrs/adr-001.md) — Settings UI placement decision.
- [ADR-004](../adrs/adr-004.md) — IA per-user tab becomes read-only after migration.

## Deliverables
- New "Configurações do Tenant" tab with 3 `BucketEditor` sub-sections.
- Read-only IA per-user tab + migration banner.
- Resolved-source badges per bucket.
- `npm run build` (with the new client code) clean.

## Tests
- Manual:
  - [ ] Owner/admin opens Settings → new tab visible; can edit each bucket's provider/model/secret; "salvo" badge appears.
  - [ ] Member opens Settings → new tab fields read-only.
  - [ ] First-load on a migrated tenant → banner "Migrada para o tenant"; dismissible; does not reappear after dismiss.
  - [ ] IA per-user tab inputs disabled; migration note shown; no PUT to `/api/settings` AI fields from this tab.
  - [ ] Super-admin with `?tenant_id=<other>` → controls target the selected tenant; `tenantQuery` reflected in the request URL.
  - [ ] Bucket with `provider` unselected → badge "usando padrão de sistema" or "fallback".
  - [ ] `pdf_extraction` provider select rejects `ollama`/`openrouter` client-side (mirrors server validation).
- Static:
  - [ ] `npm run build` passes (typecheck); `npm run lint` passes.

## Success Criteria
- New tenant tab works for owner/admin; read-only for members.
- IA per-user tab degraded to read-only with the migration banner.
- Buckets save/load via the new endpoint; source badges correct.
- Static checks green.