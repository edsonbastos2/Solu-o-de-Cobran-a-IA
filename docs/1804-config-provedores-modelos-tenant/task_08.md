---
status: done
title: UI Admin — página app/(dashboard)/admin/ai-defaults
type: frontend
complexity: medium
dependencies:
  - task_04
---

# Task 08: UI Admin — página `/admin/ai-defaults`

## Overview

Cria a página de defaults de sistema (super-admin): dois buckets (`Assistente`, `Extração de PDF`) com fields de provider/model/secret, visível só para `is_super_admin`. Adiciona o link na navegação admin.

<critical>
- ALWAYS READ the PRD and TechSpec before starting.
- REFERENCE TECHSPEC 'System Architecture → UI (new)' and the existing admin/users page pattern.
- FOCUS ON "WHAT" — declare the page layout; reuse the BucketEditor-like styling from task_07.
- MINIMIZE CODE — show only the entry-point route + nav link.
- TESTS REQUIRED — manual role gating + save/load.
</critical>

<requirements>
- MUST create `app/(dashboard)/admin/ai-defaults/page.tsx` reachable only when `useAuth().profile.is_super_admin === true`; redirect to `/` otherwise (mirror `app/(dashboard)/admin/users/page.tsx` client guard).
- MUST render two bucket editors (`Assistente`, `Extração de PDF`) — same field shape as the tenant editor (provider select, model select/input, secret input with `*_set` badge).
- MUST load via `GET /api/admin/ai-defaults` and save via `PUT /api/admin/ai-defaults` per bucket, using `fetchWithAuth`.
- MUST reject `pdf_extraction` providers not vision-capable client-side (mirrors server validation) by disabling them in the select.
- MUST add a navigation link from the admin section (the existing `app-sidebar` admin area or the `/admin/users` header), labelled "Padrões de IA".
</requirements>

## Subtasks
- [ ] 08.1 Create `app/(dashboard)/admin/ai-defaults/page.tsx` with the super-admin client guard.
- [ ] 08.2 Render two bucket editors (provider, model, secret + "salvo" badge) via SWR + PUT.
- [ ] 08.3 Disable non-vision-capable providers for `pdf_extraction`.
- [ ] 08.4 Add a nav entry to the admin area ("Padrões de IA") linking to `/admin/ai-defaults`.
- [ ] 08.5 Manual: save one bucket; non-super-admin redirected; vision-capable guard enforced.

## Implementation Details

Reuse the same field shell and styling already in `app/(dashboard)/settings/page.tsx`'s IA tab (and, post task_07, the BucketEditor). Keep the page lean: SWR keyed by `['admin-ai-defaults']`.

### Relevant Files
- `app/(dashboard)/admin/users/page.tsx` — super-admin client guard pattern (lines 56-63) + page shell.
- `hooks/use-active-tenant.ts` + `hooks/useAuth.ts` — `profile.is_super_admin`.
- `components/app-sidebar.tsx` — admin nav area to add the link (line 31 area).
- `lib/api.ts` — `fetcher`/`fetchWithAuth`.
- `app/api/admin/ai-defaults/route.ts` (task_04) — endpoint contract.
- `lib/ai-config.ts` (task_02) — `VISION_CAPABLE` mirror for client.

### Dependent Files
- `app/api/admin/ai-defaults/route.ts` (must be deployed first; declared dep).

### Related ADRs
- [ADR-001](../adrs/adr-001.md) — Admin page placement decision.
- [ADR-005](../adrs/adr-005.md) — `pdf_extraction` vision-capable constraint mirrored client-side.

## Deliverables
- `app/(dashboard)/admin/ai-defaults/page.tsx`.
- Admin nav link added.
- `npm run build` clean.

## Tests
- Manual:
  - [ ] Super-admin opens `/admin/ai-defaults` → page renders with 2 bucket editors.
  - [ ] Non-super-admin opens `/admin/ai-defaults` → redirected to `/`.
  - [ ] Save `assistant` bucket provider/model/secret → "salvo" badge; GET re-confirms.
  - [ ] `pdf_extraction` provider select disables `ollama`/`openrouter`.
- Static:
  - [ ] `npm run build` passes; `npm run lint` passes.

## Success Criteria
- Super-admin-only page renders; saves load via the new endpoint.
- Vision-capable client guard enforced for `pdf_extraction`.
- Static checks green.