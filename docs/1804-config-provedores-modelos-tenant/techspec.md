# TechSpec — Configuração de Provedores e Modelos de IA por Tenant

Ticket: `1804` · Slug: `config-provedores-modelos-tenant`

## Executive Summary

This TechSpec implements a tenant- and system-scoped AI provider/model/key configuration on the existing multi-tenant collection platform. Storage is split: per-tenant buckets (`assistant`, `pdf_extraction`, `agents`) live inside the existing `tenants.settings` JSONB using the existing `ai_encrypt`/`ai_decrypt` RPC for secrets; system defaults (`assistant`, `pdf_extraction`) live in a new `system_ai_defaults` table. A single server-side resolver `lib/ai-config.ts` replaces the scattered per-file ternaries and `process.env.<PROVIDER>_API_KEY` fallbacks across six call sites, consulted **once per request** and reused across multi-agent LLM calls. A lazy one-shot migration copies each owner's `profiles` AI config into `tenants.settings.ai.assistant` on first load of the new Settings tab, gated by a new `tenants.ai_migrated_at` column.

**Primary technical trade-off**: storing tenant secrets inside JSONB (rather than a strongly-typed child table) keeps the migration additive and schema-light but pushes provider/model validation and shape-consistency into app code, since JSONB has no native column types.

## System Architecture

### Component Overview

- **`lib/ai-config.ts`** (new) — the single resolver. Inputs: admin Supabase client, tenantId, bucket, optional `agentModelOverride`. Outputs: `{ provider, model, apiKey, ollamaBaseUrl, source }`. Reads `tenants.settings.ai.<bucket>`, decrypts via a new `get_tenant_ai_keys(p_tenant_id)` RPC, falls back to `system_ai_defaults`, then to hardcoded `opencode`/model-specific/`process.env.OPENCODE_API_KEY`.
- **`app/api/tenants/[id]/ai-config/route.ts`** (new) — `GET` (runs the lazy migration on first call, returns buckets + present-secret flags only) and `PUT` (owner/admin writes buckets; secrets pre-encrypted via `ai_encrypt`).
- **`app/api/admin/ai-defaults/route.ts`** (new) — `GET`/`PUT` super-admin-only; reads/writes `system_ai_defaults` rows; secrets pre-encrypted.
- **Existing call sites** (modified to call the resolver once, drop ternaries + env reads):
  - `lib/agent.ts` (`processChat`) — assistant bucket; consults agent-row `model` override within the agents chain.
  - `lib/case-insights.ts` — assistant bucket.
  - `app/api/start-negotiation/route.ts` — assistant bucket.
  - `app/api/help-chat/route.ts` — assistant bucket.
  - `app/api/extract-contract/route.ts` — pdf_extraction bucket; replace hard-fail on `OPENCODE_API_KEY` with resolver.
  - `app/api/debtors/extract-pdf/route.ts` — pdf_extraction bucket; **add** `requireUser` + `requireTenantContext` (ADR-005).
- **UI** (modified):
  - `app/(dashboard)/settings/page.tsx` — new "Configurações do Tenant" tab; reads/writes `/api/tenants/[id]/ai-config` (using the active tenant from `useActiveTenant`/the existing tenant switcher pattern). The existing "IA" per-user tab becomes read-only after migration (banner: "Migrada para o tenant").
  - `app/(dashboard)/admin/ai-defaults/page.tsx` (new) — super-admin page; reads/writes `/api/admin/ai-defaults`.
- **DB layer** (new) — `tenants.ai_migrated_at`, table `system_ai_defaults`, RPC `get_tenant_ai_keys(p_tenant_id)`, RPC `get_system_ai_keys()`. Reuses `ai_encrypt`/`ai_decrypt`.

**Data flow** (chat, `processChat`):
1. Request resolves auth + tenant (`requireTenantContext`).
2. Chat route calls `resolveAIConfig({ bucket: 'assistant', tenantId })` once; `processChat` receives the resolved config rather than reading `profiles`.
3. `fetchAgents(userId, db, tenantId)` returns agent rows (each may carry `model`).
4. `callLLM(... , aiProvider, agentRow.model || resolvedAssistant.model, apiKey, ...)` for supervisor/specialist/quality, using the assistants-bucket provider+key. For multi-agent runs, the resolver is called once with `bucket: 'agents'` and the same shape.

### Core Interfaces

```ts
// lib/ai-config.ts
export type AIBucket = 'assistant' | 'pdf_extraction' | 'agents';
export type AIProvider = 'opencode' | 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'ollama';
export interface AIResolved {
  provider: AIProvider;
  model: string;
  apiKey: string;
  ollamaBaseUrl: string;
  source: 'tenant' | 'system' | 'hardcoded';
}
export interface TenantAIBucket {
  provider?: AIProvider; model?: string; ollama_base_url?: string;
  opencode_api_key_set?: boolean; gemini_api_key_set?: boolean;
  openai_api_key_set?: boolean; anthropic_api_key_set?: boolean;
  openrouter_api_key_set?: boolean;
}
export interface TenantAIConfig {
  assistant: TenantAIBucket; pdf_extraction: TenantAIBucket; agents: TenantAIBucket;
  migrated_at?: string | null;
}
export async function resolveAIConfig(opts: {
  client: SupabaseClient;        // admin client (needs service role for decrypt RPC)
  tenantId: string; bucket: AIBucket; agentModelOverride?: string;
}): Promise<AIResolved>;
```

```ts
// Vision-capable whitelist shared by the pdf_extraction write validator + runtime guard.
export const VISION_CAPABLE: Record<AIProvider, boolean> = {
  opencode: true, anthropic: true, openai: true, gemini: true, openrouter: false, ollama: false,
};
```

### Data Models

**`tenants.settings.ai.<bucket>` JSONB shape (e.g. assistant)**:
```jsonc
{
  "ai": {
    "assistant": { "provider": "opencode", "model": "deepseek-v4-flash", "ollama_base_url": "...",
                   "opencode_api_key_enc": "<base64 ciphertext>" },
    "pdf_extraction": { "provider": "anthropic", "model": "claude-3-5-sonnet", "anthropic_api_key_enc": "..." },
    "agents": { "provider": "opencode", "model": "deepseek-v4-flash" }
  }
}
```
Only the matching provider's secret column is stored; others omitted. Read paths never return `*_enc` to the client (masked as `*_api_key_set` boolean).

**New SQL migration** (additive):
```sql
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS ai_migrated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.system_ai_defaults (
  bucket TEXT PRIMARY KEY,                         -- 'assistant' | 'pdf_extraction'
  provider TEXT NOT NULL DEFAULT 'opencode',
  model TEXT NOT NULL DEFAULT 'deepseek-v4-flash',
  opencode_api_key TEXT, gemini_api_key TEXT, openai_api_key TEXT,
  anthropic_api_key TEXT, openrouter_api_key TEXT,
  ollama_base_url TEXT DEFAULT 'http://localhost:11434',
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
REVOKE ALL ON public.system_ai_defaults FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_ai_defaults TO service_role;

-- Mirror of get_user_ai_keys for the tenant bucket (solution-role only).
CREATE OR REPLACE FUNCTION public.get_tenant_ai_keys(p_tenant_id UUID)
RETURNS TABLE (bucket TEXT, provider TEXT, model TEXT,
  opencode_api_key TEXT, gemini_api_key TEXT, openai_api_key TEXT,
  anthropic_api_key TEXT, openrouter_api_key TEXT, ollama_base_url TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE js jsonb;
BEGIN
  SELECT settings->'ai' FROM public.tenants WHERE id = p_tenant_id INTO js;
  IF js IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT k, (v->>'provider')::TEXT, (v->>'model')::TEXT,
    public.ai_decrypt(v->>'opencode_api_key_enc'),
    public.ai_decrypt(v->>'gemini_api_key_enc'),
    public.ai_decrypt(v->>'openai_api_key_enc'),
    public.ai_decrypt(v->>'anthropic_api_key_enc'),
    public.ai_decrypt(v->>'openrouter_api_key_enc'),
    COALESCE(v->>'ollama_base_url','http://localhost:11434')
  FROM jsonb_each(js) AS t(k, v);
END; $$;
REVOKE EXECUTE ON FUNCTION public.get_tenant_ai_keys(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_ai_keys(UUID) TO service_role;

-- System defaults decrypt (single row set, no param).
CREATE OR REPLACE FUNCTION public.get_system_ai_keys()
RETURNS TABLE (bucket TEXT, provider TEXT, model TEXT,
  opencode_api_key TEXT, gemini_api_key TEXT, openai_api_key TEXT,
  anthropic_api_key TEXT, openrouter_api_key TEXT, ollama_base_url TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT bucket, provider, model,
    public.ai_decrypt(opencode_api_key), public.ai_decrypt(gemini_api_key),
    public.ai_decrypt(openai_api_key), public.ai_decrypt(anthropic_api_key),
    public.ai_decrypt(openrouter_api_key), ollama_base_url
  FROM public.system_ai_defaults;
END; $$;
REVOKE EXECUTE ON FUNCTION public.get_system_ai_keys() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_system_ai_keys() TO service_role;
```

`REQUEST`/`RESPONSE` types for the new endpoints live in the route handlers; they mirror `TenantAIConfig` and `SystemAIDefaults`.

### API Endpoints

**`GET /api/tenants/[id]/ai-config`** (or `?tenant_id=` for query variant — see `requireTenantContext`) — runs the lazy migration on first call if `tenants.ai_migrated_at IS NULL` and the owner has AI fields in `profiles`; returns `TenantAIConfig` with secret-mask booleans (no `*_enc`).
- 200 `{ assistant: TenantAIBucket, pdf_extraction: TenantAIBucket, agents: TenantAIBucket, migrated_at }`
- 401/403 `{ error }` (per `requireRole('admin')`)
- 404 `{ error, code: 'TENANT_NOT_FOUND' }`

**`PUT /api/tenants/[id]/ai-config`** — owner/admin; body `{ bucket: AIBucket, provider, model, ollama_base_url?, opencode_api_key?, gemini_api_key?, ... }`. Validates provider/model; for `pdf_extraction`, validates `provider` ∈ `{opencode, anthropic, openai, gemini}` (vision-capable, see ADR-005). Encodes only the selected provider's key via `ai_encrypt`; empty secret strings are skipped (preserve existing). Writes back to `tenants.settings.ai.<bucket>`.
- 200 `{ ok: true }`; 400 `{ error }` (bad provider/model); 403/404 as above.

**`GET /api/admin/ai-defaults`** — `requireSuperAdmin`; returns both buckets with secret-mask booleans.
**`PUT /api/admin/ai-defaults`** — `requireSuperAdmin`; body `{ bucket, provider, model, *_api_key? }`; for `pdf_extraction`, same vision-capable constraint; encrypts secrets; writes the `system_ai_defaults` row by PK (UPSERT). 200 `{ ok: true }`.

**Modified routes** drop the in-file ternaries and `process.env.<PROVIDER>_API_KEY` reads; they call `resolveAIConfig` once at request start and pass the resolved `{ provider, model, apiKey, ollamaBaseUrl }` downstream. `/api/debtors/extract-pdf` gains `requireUser` + `requireTenantContext` plus the same rate-limit key + audit-log as `/api/extract-contract`.

## Integration Points

- **Supabase Vault / `ai_encrypt`/`ai_decrypt`** — reused unchanged; secrets at tenant and system scope are encrypted with the same Vault key. No new env secrets required beyond the (existing) `OPENCODE_API_KEY` final fallback.
- **Provider SDK clients** — `lib/agent.ts`/`case-insights.ts`/`start-negotiation`/`help-chat` already build their client from `{provider, model, apiKey, ollamaBaseUrl}` (the existing `callLLM` helper); they only need their input replaced. The two PDF extraction routes keep the Anthropic-SDK-over-OpenCode client and switch `baseURL` to Anthropic-native when `provider === 'anthropic'`; `openrouter` and `ollama` are rejected by the `pdf_extraction` write validator (ADR-005).

## Impact Analysis

| Component | Impact Type | Description and Risk | Required Action |
|-----------|-------------|----------------------|-----------------|
| `lib/ai-config.ts` | new | Central resolver; correctness-critical | Implement + unit-test all chains |
| `lib/agent.ts` | modified | Remove ternary + get_user_ai_keys block, call resolver | Replace lines 301–345 with `resolveAIConfig({ bucket: 'agents' }))`; pass per-agent `model` override |
| `lib/case-insights.ts` | modified | Same pattern | Replace 202–238 block |
| `app/api/start-negotiation/route.ts` | modified | Same pattern | Replace 78–112 block |
| `app/api/help-chat/route.ts` | modified | Same; opportunistically factor `DEFAULT_MODELS`/`VALID_MODELS` into ai-config | Replace `resolveModel` + ENV_KEY_FIELDS |
| `app/api/extract-contract/route.ts` | modified | Use pdf_extraction bucket; remove hard-fail on `OPENCODE_API_KEY` | Insert resolver at request start; keep Anthropic SDK + base-url switch |
| `app/api/debtors/extract-pdf/route.ts` | modified + hardened | Add auth + tenant scope; medium risk (callers not authenticated today) | Audit in-app callers; add `requireUser` + `requireTenantContext` |
| `app/(dashboard)/settings/page.tsx` | modified | New tab; existing IA tab read-only + banner | Add "Configurações do Tenant" tab; gate editing via `role` from useActiveTenant |
| `app/(dashboard)/admin/ai-defaults/page.tsx` | new | Super-admin UI | Link from admin sidebar/nav |
| `middleware.ts` | modified | Ensure `/api/debtors/extract-pdf` is NOT in unauthenticated carve-out | Verify; no new carve-out |
| `supabase_ai_config_tenant.sql` (new migration file) | new | Schema additions + RPCs | Apply manually to Supabase project |
| `.env.example` | modified | Document missing AI env vars; note final-fallback semantics | Add `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY` |
| `app/api/admin/users/route.ts` | unchanged | Still returns `ai_provider`/`ai_model` per-user (legacy display) | None — leave for one release |
| `lib/multi-agent.ts` (`processMultiAgentSimulation`) | modified | Use resolver instead of env-only OpenCode | Replace `apiKey = ...OPENCODE_API_KEY` line with `resolveAIConfig({ bucket: 'agents' })` |

## Testing Approach

No automated test suite exists in the project (per `AGENTS.md`); validation is via `npm run lint`, `npm run build` (typecheck), and manual checklist. Therefore:

### Manual "Unit" verification (per bucket)
- Build a matrix of bucket-states × {with/without tenant bucket} × {with/without system default} and for each combination, verify the resolved provider/model/key/source by inspecting a log line emitted by the resolver on a dev call.
- Empty-key tenant bucket with system-default set → resolves to system source.
- Empty both → resolves to hardcoded (opencode/deepseek-v4-flash or minimax-m3 for pdf) with `OPENCODE_API_KEY`.

### Manual "Integration" verification
- Tenant owner opens Settings → migration banner shows once → AI tab is read-only; bucket values reflect the migrated provider/model + present-secret badges.
- Owner edits `assistant` bucket to use OpenAI/gpt-4o-mini + own key → a `processChat` call logs resolved source `tenant`.
- Remove the secret → save → bucket falls back to system defaults (verify on a tenant without config).
- Super-admin edits `pdf_extraction` default to Anthropic/claude → a tenant without pdf bucket resolves via `system` source.
- `/api/debtors/extract-pdf` returns 401 unauthenticated; 200 with a session; uses tenant `pdf_extraction` bucket.

### Static checks (mandatory)
- `npm run lint` clean.
- `npm run build` clean (typecheck, ESLint skipped per `next.config.ts`).
- `npx tsc --noEmit` clean (the resolver types and SQL-RPC typings must typecheck).

## Development Sequencing

### Build Order

1. **DB migration `supabase_ai_config_tenant.sql`** — add `tenants.ai_migrated_at`, `system_ai_defaults`, RPCs `get_tenant_ai_keys`, `get_system_ai_keys` — no dependencies. Apply to the Supabase project manually.
2. **`lib/ai-config.ts` resolver** — depends on step 1 (RPCs); pure module, no UI.
3. **`app/api/tenants/[id]/ai-config/route.ts`** (GET+PUT, incl. lazy migration) — depends on step 2 (uses resolver for reads & same encrypt path).
4. **`app/api/admin/ai-defaults/route.ts`** (GET+PUT) — depends on step 1 (table + RPC).
5. **Wire existing call sites to the resolver** — depends on step 2. Replace the six blocks (agent, case-insights, start-negotiation, help-chat, extract-contract, debtors/extract-pdf). Order: chat sites first (agent → case-insights → start-negotiation → help-chat), then extract-contract, then debtors/extract-pdf (which depends on ADR-005 auth change).
6. **`app/api/debtors/extract-pdf` auth + tenant** — depends on step 5; add `requireUser` + `requireTenantContext` + audit + rate-limit; audit in-app callers.
7. **Settings UI: new tab** — depends on step 3; new "Configurações do Tenant" tab in `app/(dashboard)/settings/page.tsx`; gate by role; mark IA per-user tab read-only + migration banner.
8. **Admin UI: `app/(dashboard)/admin/ai-defaults/page.tsx`** — depends on step 4; super-admin nav entry.
9. **`.env.example` + lint/build verification** — depends on all; document env vars; run `npm run lint && npm run build && npx tsc --noEmit`.

### Technical Dependencies

- Supabase Vault secret `ai_keys_encryption_key` already configured (per `supabase_ai_keys_encryption.sql`) — verify before migration.
- No new npm dependencies.
- Middleware auth carve-outs: confirm `/api/debtors/extract-pdf` is not exempt (it isn't, per current `middleware.ts`).

## Monitoring and Observability

- The resolver emits a `logger.info('[ai-config] resolved', { tenantId, bucket, provider, model, source })` once per request — consumed by the existing `AuditLogs`/logs pipeline; lets ops see how often the system falls back.
- `PUT /api/tenants/[id]/ai-config` and `PUT /api/admin/ai-defaults` emit `recordAuditAction` with `entityType: 'ai_config'`, `action: 'AI_CONFIG_UPDATED'`, `metadata: { bucket, provider, model, source_level }`.
- Extraction route audit records `model` already (in current `metadata`); add `provider` and `source` after wiring the resolver.
- Alert threshold (manual for now): if `source === 'hardcoded'` rate exceeds 30% of LLM calls over a week, surface to the super-admin (out of MVP scope; noted for Phase 2 spend tracking).

## Technical Considerations

### Key Decisions
- **JSONB tenant buckets** (ADR-002): minimal schema cost, reuse `tenants.settings`; trade-off = loose typing, validation in app + contract tests.
- **Dedicated `system_ai_defaults` table** (ADR-002): typed, easy to grant service-role only; trade-off = a second storage primitive.
- **Per-request resolution** (ADR-003): avoids in-process cache invalidation; trade-off = one query per request (acceptable vs LLM latency).
- **Lazy migration on first GET** (ADR-004): zero-touch; trade-off = tenants never-visited by their owner stay on the system/hardcoded fallback (desired).
- **Vision-capable whitelist for `pdf_extraction`** (ADR-005): keeps the extraction client single-SDK; trade-off = tenants cannot pick openrouter/ollama for extraction at MVP.

### Known Risks
- **Old Anthropic SDK call shape**: extraction uses `Anthropic SDK with baseURL=opencode.ai/zen/go`; switching `provider` to native `anthropic` must keep the same `document`/`image` content block shape (it does — Anthropic SDK is the same client; only the apiKey + baseURL change). Validate end-to-end with a real PDF before merge.
- **Concurrent first-GET migration**: the `UPDATE tenants ... WHERE ai_migrated_at IS NULL` makes the migration idempotent; verify the SQL is conditional in the route handler.
- **Empty-bucket stamping**: never stamp `ai_migrated_at` for an owner with all-null `profiles` AI fields (else the tenant locks itself out of system fallback). Enforce in step 3.
- **Profiles deprecated reads**: any third path still reading `profiles.ai_provider`? `lib/whatsapp.ts`/`lib/telegram.ts` call `get_user_ai_keys` only for messaging secrets (Z-API/Telegram) — they are unaffected (those secret columns stay on `profiles`).

## Architecture Decision Records

- [ADR-001: Tenant-scoped AI provider/model configuration with per-function buckets and one-shot migration](adrs/adr-001.md) — Product-level decision: 3 tenant buckets + 2 system buckets + unified chain + one-shot migration, single MVP.
- [ADR-002: Tenant AI config in tenants.settings JSONB; system defaults in a dedicated table](adrs/adr-002.md) — Storage layer split and secret encryption reusing the Vault RPC.
- [ADR-003: Single AI config resolver (lib/ai-config.ts) with per-function resolution chains](adrs/adr-003.md) — One server-side resolver consulted once per request; defines the three chains.
- [ADR-004: Lazy one-shot migration from profiles AI columns to tenants.settings.ai](adrs/adr-004.md) — First-GET-triggered, conditional-UPDATE idempotent migration via `ai_migrated_at`.
- [ADR-005: Authenticate and tenant-scope /api/debtors/extract-pdf](adrs/adr-005.md) — Close the public-endpoint gap; constrain pdf_extraction to vision-capable providers at MVP.