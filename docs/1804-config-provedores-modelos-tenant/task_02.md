---
status: done
title: Resolver central lib/ai-config.ts (cadeias assistant/pdf_extraction/agents)
type: backend
complexity: high
dependencies:
  - task_01
---

# Task 02: Resolver central `lib/ai-config.ts`

## Overview

Implementa o único ponto de resolução de provider/model/key que substitui os ternários espalhados em seis arquivos. Expõe `resolveAIConfig(...)` que consulta o bucket do tenant, depois o default de sistema (quando aplicável), depois o fallback hardcoded, retornando `{ provider, model, apiKey, ollamaBaseUrl, source }`. Deve ser consultado uma vez por request e reutilizado.

<critical>
- ALWAYS READ the PRD and TechSpec before starting.
- REFERENCE TECHSPEC 'Core Interfaces' and 'System Architecture → Data flow' sections for the typed shape and the three chaining rules.
- FOCUS ON "WHAT" — define the resolved contract and the precedence; the call sites are wired in tasks 05/06.
- MINIMIZE CODE — show only the interface/types and the precedence pseudocode.
- TESTS REQUIRED — manual matrix of bucket states; this module is correctness-critical.
</critical>

<requirements>
- MUST expose `type AIBucket = 'assistant' | 'pdf_extraction' | 'agents'` and `AIProvider` union of the six supported providers.
- MUST expose `resolveAIConfig({ client, tenantId, bucket, agentModelOverride? })` returning `{ provider, model, apiKey, ollamaBaseUrl, source }` where `source ∈ {'tenant','system','hardcoded'}`.
- MUST resolve **assistant** as `tenant.ai.assistant → system.assistant → hardcoded (opencode/deepseek-v4-flash/process.env.OPENCODE_API_KEY)`.
- MUST resolve **pdf_extraction** as `tenant.ai.pdf_extraction → system.pdf_extraction → hardcoded (opencode/minimax-m3/process.env.OPENCODE_API_KEY)`.
- MUST resolve **agents** with the chain `agentModelOverride (model only) → tenant.ai.agents (provider+model+keys) → tenant.ai.assistant → system.assistant → hardcoded`; the agent override replaces only `model`, never `provider` or `apiKey`.
- MUST call the `get_tenant_ai_keys` and `get_system_ai_keys` RPCs (task_01) via the supplied admin client (service role). `source='tenant'` when a provider AND a key come from the tenant bucket; `source='system'` when from the system row; `source='hardcoded'` otherwise.
- MUST defend against missing env: when nothing resolves, returns `provider='opencode'`, `model=(bucket==='pdf_extraction' ? 'minimax-m3' : 'deepseek-v4-flash')`, `apiKey=process.env.OPENCODE_API_KEY ?? ''`.
- MUST log once per call `logger.info('[ai-config] resolved', { tenantId, bucket, provider, model, source })`.
- MUST NOT read `profiles.ai_provider`/`ai_model`/`*_api_key` — those are deprecated for AI (ADR-004).
- MUST define and export `VISION_CAPABLE: Record<AIProvider, boolean>` for reuse by tasks 03/06 validators.
</requirements>

## Subtasks
- [ ] 02.1 Create `lib/ai-config.ts` with the type unions and `AIResolved` interface per TechSpec 'Core Interfaces'.
- [ ] 02.2 Implement `resolveAIConfig`: fetch tenant rows via `get_tenant_ai_keys`; fetch system rows via `get_system_ai_keys`; pick by precedence per bucket; apply agent model override within the `agents` chain.
- [ ] 02.3 Implement the hardcoded fallback (opencode/model-by-bucket/`process.env.OPENCODE_API_KEY`) consistent with the original ternaries (see `lib/agent.ts` lines 301-345 and `app/api/extract-contract/route.ts` MODEL constant).
- [ ] 02.4 Emit the structured log line once per call; export `VISION_CAPABLE`.
- [ ] 02.5 Manually exercise the matrix (tenant set / system set / both empty) against a dev Supabase project and confirm `source` for each combination.

## Implementation Details

The resolver is a pure module consumed by chat call sites (task_05) and extraction routes (task_06). It takes the admin client to keep secret decryption server-side only. Use `logger` from `@/lib/logger`. Keep the precedence in one function per bucket for readability.

### Relevant Files
- `lib/agent.ts` (lines 301-345) — the current per-user ternary to replace; reference for the provider→default-model mapping.
- `lib/case-insights.ts` (lines 202-238) — same ternary; reference.
- `app/api/help-chat/route.ts` (DEFAULT_MODELS/VALID_MODELS) — consolidate these whitelists into `lib/ai-config.ts`.
- `app/api/extract-contract/route.ts` (`MODEL = 'minimax-m3'`) — source of the pdf hardcoded fallback model.
- `lib/supabase-admin.ts` — `getSupabaseAdmin()` provider for the admin client passed in.
- `lib/logger.ts` — logger import.

### Dependent Files
- All six call sites wired in tasks 05 and 06.
- `app/api/tenants/[id]/ai-config/route.ts` (task_03) reuses `VISION_CAPABLE` for write validation.

### Related ADRs
- [ADR-003: Single AI config resolver (lib/ai-config.ts) with per-function resolution chains](../adrs/adr-003.md) — Module contract and per-function chains.

## Deliverables
- `lib/ai-config.ts` exporting `resolveAIConfig`, `AIBucket`, `AIProvider`, `AIResolved`, `VISION_CAPABLE`.
- Manual resolution matrix (notes in PR): all bucket-state combinations resolve to the documented `source` and provider/model.
- `npx tsc --noEmit` clean.

## Tests
- Manual units (matrix per bucket):
  - [ ] assistant bucket set on tenant → `source='tenant'`, model = bucket model.
  - [ ] assistant bucket absent on tenant, system.assistant set → `source='system'`.
  - [ ] both absent → `source='hardcoded'`, provider opencode, model `deepseek-v4-flash`, key `process.env.OPENCODE_API_KEY`.
  - [ ] agents: tenant.agents absent, tenant.assistant present → resolves via `tenant.ai.assistant` with `source='tenant'`.
  - [ ] agents: agentModelOverride set → override replaces model only; provider/key still from the winning bucket.
  - [ ] pdf_extraction: tenant absent, system absent → `source='hardcoded'`, model `minimax-m3`.
- Static:
  - [ ] `npx tsc --noEmit` passes.
  - [ ] `npm run lint` passes.

## Success Criteria
- `resolveAIConfig` returns the documented precedence for every bucket-state combination.
- `npx tsc --noEmit` and `npm run lint` pass.
- No call to `profiles` AI columns inside the new module.