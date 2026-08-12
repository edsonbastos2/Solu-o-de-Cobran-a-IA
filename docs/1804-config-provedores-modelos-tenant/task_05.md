---
status: done
title: Wire chat call sites ao resolver (agent.ts, case-insights.ts, start-negotiation, help-chat)
type: backend
complexity: high
dependencies:
  - task_02
---

# Task 05: Wire chat call sites ao resolver

## Overview

Substitui os blocos de resolução per-user espalhados nos quatro call sites de chat pelo `resolveAIConfig({ bucket: 'assistant', ... })` (ou `'agents'` no pipeline multi-agente), removendo os ternários e os `process.env.<PROVIDER>_API_KEY` fallbacks. A migração para o resolvedor é mecânica: ele já codifica as cadeias de ADR-003.

<critical>
- ALWAYS READ the PRD and TechSpec before starting.
- REFERENCE TECHSPEC 'System Architecture → Data flow' and 'Impact Analysis' for the exact blocks to replace.
- FOCUS ON "WHAT" — relocate the resolution to the resolver; preserve existing `callLLM` semantics.
- MINIMIZE CODE — show a before/after snippet for one call site only.
- TESTS REQUIRED — manual end-to-end chat with each provider; typecheck clean.
</critical>

<requirements>
- MUST replace the resolution blocks in `lib/agent.ts` (lines 301-345), `lib/case-insights.ts` (202-238), `app/api/start-negotiation/route.ts` (78-112), `app/api/help-chat/route.ts` (196-219 + `DEFAULT_MODELS`/`VALID_MODELS`/`ENV_KEY_FIELDS`) with a single `resolveAIConfig({ client, tenantId, bucket })` invocation at request start.
- MUST resolve `bucket: 'assistant'` for the chat de cobrança (`processChat`) and help-chat; resolve `bucket: 'agents'` when the multi-agent run requires the agents chain. Inside `processChat`, when iterating supervisor/specialist/quality, the per-agent `model` MUST still override the resolved model (per ADR-003 document).
- MUST thread `tenantId` into the resolver using the resolved tenant already produced by `requireTenantContext` at the route boundary; where `processChat` is called from cron/webhook without a tenant (legacy path), fall back to the case's `tenant_id` (it is now non-null per `supabase_tenant_model.sql`).
- MUST remove the now-dead `process.env.GEMINI_API_KEY`/`OPENAI_API_KEY`/`ANTHROPIC_API_KEY`/`OPENROUTER_API_KEY` reads from these four files; they live only in `lib/ai-config.ts` as the final fallback layer.
- MUST consolidate `DEFAULT_MODELS`/`VALID_MODELS` from `help-chat/route.ts` into `lib/ai-config.ts` (task_02 already exports `VISION_CAPABLE` and the model whitelists); import them where the route still needs model options.
- MUST NOT change the external request/response shapes of any route or function — only the internal resolution path.
</requirements>

## Subtasks
- [ ] 05.1 In `lib/agent.ts`: replace lines 301-345 with `const ai = await resolveAIConfig({ client: admin, tenantId, bucket: 'assistant' });` and pass `{ ai.provider, ai.model, ai.apiKey, ai.ollamaBaseUrl }` to `callLLM`; for multi-agent calls use `bucket: 'agents'` and apply `agentRow.model` as `agentModelOverride`.
- [ ] 05.2 In `lib/case-insights.ts`: replace lines 202-238 with the same one-line resolver call.
- [ ] 05.3 In `app/api/start-negotiation/route.ts`: replace lines 78-112 with the resolver call (`bucket: 'assistant'`).
- [ ] 05.4 In `app/api/help-chat/route.ts`: replace `resolveModel` + `ENV_KEY_FIELDS` (lines 10-46, 196-219) with the resolver call; import model whitelists from `lib/ai-config.ts`.
- [ ] 05.5 Delete the dead ternaries and env-var reads; keep the error throw for `!apiKey` (now sourced from `ai.apiKey`).
- [ ] 05.6 Manual: send a chat message with a tenant whose `assistant` bucket is set to OpenAI and confirm `source='tenant'` in logs + a successful LLM response; repeat with bucket empty and system default set.

## Implementation Details

Before/after for one site (`lib/agent.ts`, lines 301-345):
```ts
// BEFORE: ~45 lines, ternary + get_user_ai_keys + 6 env fallbacks.
// AFTER:
const ai = await resolveAIConfig({ client: admin ?? database, tenantId: resolvedTenantId, bucket: 'agents' });
if (!ai.apiKey) throw new Error(`Chave de API não configurada ...`);
// ... callLLM(... ai.provider, agentRow.model || ai.model, ai.apiKey, ai.ollamaBaseUrl ...)
```
For the pure-assistant paths (`case-insights`, `start-negotiation`, `help-chat`), use `bucket: 'assistant'`. For `processChat` — the multi-agent pipeline — use `bucket: 'agents'` so the chain `agent.model → tenant.agents → tenant.assistant → system.assistant → hardcoded` applies, and pass `agentRow.model` per call.

### Relevant Files
- `lib/agent.ts` — chat pipeline (lines 280-345 + multi-agent call sites at 380, 421, 447, 469).
- `lib/case-insights.ts` — case insight generation (lines 202-238).
- `app/api/start-negotiation/route.ts` — negotiation kickoff (lines 78-112).
- `app/api/help-chat/route.ts` — help chat (lines 10-46, 196-219); consolidates whitelists.
- `lib/ai-config.ts` (task_02) — the resolver.

### Dependent Files
- `lib/ai-config.ts` (consumes nothing here; provides the resolver).
- `lib/multi-agent.ts` — `processMultiAgentSimulation` also keys off env-only OpenCode (`apiKey = ...OPENCODE_API_KEY`); updated in this task for consistency (switch to `resolveAIConfig({ bucket: 'agents' })`).

### Related ADRs
- [ADR-003: Single AI config resolver (lib/ai-config.ts) with per-function resolution chains](../adrs/adr-003.md) — chains applied here.

## Deliverables
- Four chat call sites wired to `resolveAIConfig`; `lib/multi-agent.ts` simulation wired too.
- All `process.env.<PROVIDER>_API_KEY` reads removed from these files (live only in `lib/ai-config.ts`).
- `npx tsc --noEmit` and `npm run build` clean.

## Tests
- Manual end-to-end:
  - [ ] Chat de cobrança with `assistant` bucket = OpenAI/gpt-4o-mini → LLM response; log shows `source='tenant'`.
  - [ ] Chat with `assistant` empty + system default = Gemini → log `source='system'`.
  - [ ] Chat with both empty → log `source='hardcoded'`, provider opencode.
  - [ ] Multi-agent run with an agent-row `model='claude-3-5-sonnet'` and tenant `agents` bucket = Anthropic → log uses Anthropic bucket + the agent model override.
  - [ ] start-negotiation and help-chat respond with a tenant-configured provider.
- Static:
  - [ ] `npx tsc --noEmit` passes; `npm run build` passes (typecheck).
  - [ ] `npm run lint` passes.

## Success Criteria
- All four chat paths resolve via the resolver; per-agent model override preserved.
- No `process.env.<PROVIDER>_API_KEY` reads remain in these files.
- Static checks green.