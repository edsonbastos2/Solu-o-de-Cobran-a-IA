---
status: done
title: Wire rotas de extração ao resolver (extract-contract + debtors/extract-pdf com auth+tenant)
type: backend
complexity: high
dependencies:
  - task_01
  - task_02
---

# Task 06: Wire rotas de extração ao resolver + hardening `/api/debtors/extract-pdf`

## Overview

Substitui o hardcoded `minimax-m3`/`process.env.OPENCODE_API_KEY` das duas rotas de extração por `resolveAIConfig({ bucket: 'pdf_extraction', tenantId })`. Adiciona autenticação + contexto de tenant em `/api/debtors/extract-pdf` (ADR-005), fecha o gap de segurança do endpoint público e normaliza as duas rotas para usarem o mesmo resolvedor.

<critical>
- ALWAYS READ the PRD and TechSpec before starting.
- REFERENCE TECHSPEC 'Integration Points' and 'Impact Analysis' for the Anthropic-SDK-over-OpenCode call shape that is preserved.
- FOCUS ON "WHAT" — relocate resolution; preserve the document/image content block usage.
- MINIMIZE CODE — show only the resolver invocation + base-url switch.
- TESTS REQUIRED — manual extraction with a real PDF under each configured provider.
</critical>

<requirements>
- MUST replace `const apiKey = process.env.OPENCODE_API_KEY;` and `const MODEL = 'minimax-m3';` in `app/api/extract-contract/route.ts` and `app/api/debtors/extract-pdf/route.ts` with `const ai = await resolveAIConfig({ client, tenantId, bucket: 'pdf_extraction' })`, threading the tenant from `requireTenantContext`.
- MUST keep the Anthropic-SDK-over-OpenCode call shape; switch base URL to native Anthropic (`https://api.anthropic.com`) when `ai.provider === 'anthropic'`, otherwise keep `OPENCODE_BASE_URL = 'https://opencode.ai/zen/go'` for `opencode`/`openai`/`gemini` since the resolver constrains `pdf_extraction` providers to the vision-capable set (ADR-005).
- MUST enrich the audit `metadata` with `provider` and `source` from the resolved config (the existing `model` field stays).
- MUST add `requireUser(req)` + `requireTenantContext(req)` at the top of `/api/debtors/extract-pdf/route.ts`, matching `/api/extract-contract/route.ts` (which already authenticates), and apply the 10/min `rateLimit` keyed by `userId`.
- MUST verify `middleware.ts` does NOT carve out `/api/debtors/extract-pdf` from authentication (it currently only exempts `/api/extract-contract/*`, `/api/webhook/*`, `/api/cron/*`); confirm and document, no carve-out added.
- MUST guard at runtime: if `ai.provider` lands outside the vision-capable set despite the write validator (e.g. legacy env-only fallback reaches `opencode`), keep the OpenCode base URL which remains vision-capable for `minimax-m3`.
</requirements>

## Subtasks
- [ ] 06.1 In `app/api/extract-contract/route.ts`: replace the hardcoded `apiKey`/`MODEL` lines with the resolver call; thread `tenantId` from `requireTenantContext`; switch base URL on `provider==='anthropic'`.
- [ ] 06.2 In `app/api/debtors/extract-pdf/route.ts`: add `requireUser` + `requireTenantContext` + `rateLimit('extract-pdf-debtor:'+userId, 10, 60_000)`; replace the env-key/MODEL with the resolver; add `recordAuditAction` with `tenantId`.
- [ ] 06.3 Verify `middleware.ts` carve-outs; ensure `/api/debtors/extract-pdf` is authenticated; if it was inadvertently exempt, remove the exemption.
- [ ] 06.4 Audit in-app callers of `/api/debtors/extract-pdf` (likely `app/(dashboard)/debtors/...` page via `fetchWithAuth`) — confirm all use an authenticated session.
- [ ] 06.5 Enrich audit `metadata` with `provider` + `source`.
- [ ] 06.6 Manual extraction: upload a real PDF on a tenant whose `pdf_extraction` bucket is set to Anthropic/claude-3-5-sonnet; verify success + audit row; repeat with bucket empty + system default set.

## Implementation Details

The Anthropic-SDK call shape (`anthropic.messages.create({ model, system, messages:[{role,content:[document|image,text]}], max_tokens, temperature:0 })`) is unchanged. Only `apiKey`, `baseURL`, and `model` come from the resolver now. The base URL switch:
```ts
const baseURL = ai.provider === 'anthropic' ? 'https://api.anthropic.com' : OPENCODE_BASE_URL;
const anthropic = new Anthropic({ apiKey: ai.apiKey, baseURL });
// model: ai.model
```

### Relevant Files
- `app/api/extract-contract/route.ts` — already authenticated; replace env-key/MODEL.
- `app/api/debtors/extract-pdf/route.ts` — add auth + tenant + resolver; currently unauthenticated.
- `middleware.ts` — verify carve-outs (no `/api/debtors/extract-pdf` exemption).
- `lib/ai-config.ts` (task_02) — resolver + `VISION_CAPABLE`.
- `lib/api-auth.ts` — `requireUser`, `requireTenantContext`.
- `lib/rate-limit.ts` — `rateLimit`.
- `lib/audit.ts` — `recordAuditAction`.

### Dependent Files
- `lib/ai-config.ts` (validated `pdf_extraction` providers come from the bucket written by task_03 and the system row written by task_04).
- Any code calling `/api/debtors/extract-pdf` (audited in 06.4).

### Related ADRs
- [ADR-003: Single AI config resolver](../adrs/adr-003.md) — `pdf_extraction` chain.
- [ADR-005: Authenticate and tenant-scope /api/debtors/extract-pdf](../adrs/adr-005.md) — security gap closure + vision-capable constraint.

## Deliverables
- Both extraction routes wired to `resolveAIConfig({ bucket: 'pdf_extraction' })`.
- `/api/debtors/extract-pdf` authenticated and tenant-scoped; rate-limited + audited.
- `npx tsc --noEmit` and `npm run build` clean.

## Tests
- Manual:
  - [ ] `/api/debtors/extract-pdf` unauthenticated → 401.
  - [ ] `/api/debtors/extract-pdf` with session + tenant whose `pdf_extraction` = Anthropic → 200 with extracted JSON; audit row has `provider='anthropic'`, `source='tenant'`.
  - [ ] `/api/extract-contract` with `pdf_extraction` empty + system default = Anthropic → 200; `source='system'`.
  - [ ] Both empty → 200 via hardcoded OpenCode/minimax-m3; `source='hardcoded'`.
  - [ ] Vision-capable guard: PUT a `pdf_extraction` bucket with `openrouter` is rejected earlier (task_03/04); runtime never sees a non-vision provider.
- Static:
  - [ ] `npx tsc --noEmit` passes; `npm run build` passes; `npm run lint` passes.

## Success Criteria
- Both routes resolve via the resolver; `/api/debtors/extract-pdf` is authenticated and tenant-scoped.
- Audit records include `provider` + `source`; no public spend path remains.
- Static checks green.