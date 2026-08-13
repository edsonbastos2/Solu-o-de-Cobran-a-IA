# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A multi-tenant SaaS for AI-driven debt collection ("Sistema de Cobrança Inteligente com IA"). An AI agent negotiates payment with debtors over WhatsApp/Telegram, following strict discount-margin and compliance rules; operators monitor and can take over conversations from a dashboard. See `README.md` for the full product description.

## Commands

```bash
npm run dev          # Next.js dev server on port 3000
npm run build         # production build (runs typecheck, NOT lint)
npm run lint          # ESLint (next/core-web-vitals + next/typescript)
npm run clean          # `next clean` — clears .next cache
npx tsc --noEmit       # standalone typecheck (no dedicated script exists)
```

- ESLint is skipped during builds (`eslint.ignoreDuringBuilds: true` in `next.config.ts`) — run `npm run lint` separately.
- No test suite, no formatter, and no CI/CD are configured in this repo.
- Both `package-lock.json` and `bun.lock` are present; `npm` is the documented package manager.
- SQL migrations live as numbered `supabase_*.sql` files at the repo root and must be applied manually to the Supabase project (no migration runner).

## Architecture

- **Next.js 15 App Router**, React 19, TypeScript 5.7 (`strict: true`), Tailwind CSS 4.1.
- **No `src/` directory** — `app/`, `components/`, `lib/`, `hooks/` all sit at the repo root. Path alias `@/*` maps to the project root.
- Pages live under `app/(dashboard)/...` (cases, clients, contracts, negotiations, negativations, protests, legal, quarantines, templates, policies, agents, import, settings, admin/*) and `app/login/`. API routes live under `app/api/`.

### Multi-tenancy model

- Core tables: `tenants`, `tenant_members` (user↔tenant with `role`: owner/admin/member), `profiles` (`is_super_admin`, `current_tenant_id`), plus tenant-scoped business tables (`cases`, `clients`, `contracts`, `financial_titles`, `negotiations`, `negativations`, `protests`, `legal_processes`, `quarantines`, `agents`, `collection_policies`, `message_templates`, `audit_logs`, etc.) that all carry a `tenant_id` column.
- RLS is enabled on every tenant-scoped table via a dynamic loop in `supabase_tenant_model.sql` (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + a single `tenant_isolation` policy using `can_access_tenant(tenant_id)`). New tables that hold tenant data must be added to that loop or given equivalent RLS.
- `lib/tenant.ts` (`getTenantAccess`) is legacy/superseded code from an earlier `profiles.tenant_id`-only model — do not extend it. The current pattern is `lib/api-auth.ts`.

### Auth flow — always use `lib/api-auth.ts` in route handlers

- **Middleware** (`middleware.ts`): enforces a Supabase session on every route except `/login`, `/api/webhook/*`, and `/api/cron/*` (those use their own secret-based checks). Returns 401 JSON for `/api/*`, redirects to `/login` for pages.
- **Client guard**: `AuthGuard` in the root layout is a UX-only redirect for logged-out users; it is not a security boundary — every API route must independently enforce auth/tenant checks.
- **`lib/api-auth.ts` helpers** — use these in every route handler instead of querying Supabase directly for auth:
  - `requireUser(req)` → 401 if no session; returns `{ userId, isSuperAdmin, currentTenantId }`.
  - `requireSuperAdmin(req)` → 403 if not super admin.
  - `requireTenantContext(req, requestedTenantId?)` → resolves the active tenant. Super admins may pass `?tenant_id=` (validated against `tenants`) or fall back to `profiles.current_tenant_id`; regular users are resolved from their active `tenant_members` row and a mismatched `requestedTenantId` is rejected (404, not 403, to avoid confirming tenant existence). Returns `ctx.supabase`, already the right client for the caller.
  - `requireRole(req, minRole, requestedTenantId?)` → same as above plus a `owner > admin > member` rank check.
- **Admin (service role) client** (`lib/supabase-admin.ts`, `getSupabaseAdmin()`) bypasses RLS entirely. It's used by cron jobs, webhooks, and `getSupabaseServerWithAdminFallback` (only when the caller is already confirmed super admin). Every query against it must manually filter `.eq('tenant_id', ...)` — there's no RLS safety net.
- Both the server client and admin client return `null` when Supabase env vars are missing (graceful "demo mode" degradation) — guard against `null` when adding features.
- Pattern to copy for any new `[id]` route: resolve tenant via `requireTenantContext`/`requireRole`, then filter every query by `.eq('id', id).eq('tenant_id', ctx.tenantId)` and treat "not found" and "belongs to another tenant" identically (generic 404) rather than leaking existence.

### AI provider resolution (`lib/ai-config.ts`)

Central resolver for which LLM provider/model/key to use, per tenant and per "bucket" (`assistant`, `pdf_extraction`, `agents`). Resolution chain: tenant's saved config for that bucket → `system_ai_defaults` (super-admin-set system defaults) → hardcoded fallback (`opencode` + `OPENCODE_API_KEY`). Provider keys are stored encrypted (pgcrypto/Vault, `ai_encrypt`/`ai_decrypt` SQL functions) and only decrypted server-side via `service_role` RPCs (`get_tenant_ai_keys`, `get_user_ai_keys`) — never fetch key columns directly from a table, always go through `resolveAIConfig` / the RPCs. `lib/ai-config-client.ts` is a client-safe mirror of the *non-secret* constants (provider labels, model whitelists) — keep it in sync manually if `lib/ai-config.ts` changes, and never add secret-touching code to it (it's bundled to the browser).

### AI negotiation pipeline (`lib/agent.ts`)

`processChat(caseId, message, supabaseAdmin, tenantId)` runs a multi-agent workflow: a **supervisor** classifies the debtor's message and picks a specialist (cobranca, negociacao, financeiro, juridico, analise_credito) via `lib/multi-agent.ts`, the specialist drafts a reply, and a **quality** agent audits it for CDC (consumer protection) compliance and discount-margin limits before sending. Falls back to single-agent mode if no supervisor is configured for the tenant. Parses agreed amounts/discounts/deadlines out of the AI's own reply text (regex-based, `lib/agent.ts` top) to detect when a negotiation was reached.

### Messaging integrations

- **WhatsApp** (`lib/whatsapp.ts`) via Z-API; **Telegram** via `app/api/webhook/telegram/route.ts`. Both webhooks are entered through `app/api/webhook/*` (public per middleware) and authenticate via a shared `WEBHOOK_SECRET` header, not a Supabase session.
- `lib/webhook-tenant.ts` (`resolveWebhookTenant`) maps an inbound webhook to a `tenant_id` by instance ID / bot token (and, for Telegram case-linking deep links, by case ID) — this is the only tenant boundary for unauthenticated inbound messages, so any new webhook-driven write must go through it and still filter by the resolved `tenant_id`.
- Credentials can be global (env vars) or per-tenant/user (`profiles` table, encrypted). Phone numbers are normalized/auto-prefixed with `55` (Brazil).

### Collection stages (`lib/finance.ts`)

`getCollectionStage(dueDate, maxDiscountMargin, status)` classifies a debt into `preventiva` (not yet due), `amigavel` (1–30 days overdue), `negocial` (31–180 days), or `especializada` (>180 days or `needs_attention`). Each stage caps the discount the AI is allowed to offer — this cap is enforced both in the system prompt and by the quality agent in `lib/agent.ts`.

### Other shared `lib/` conventions

- **Input validation**: `validateFields(body, required)` from `lib/api-validate.ts` — returns a 400 `NextResponse` on failure, `null` on success.
- **Rate limiting**: `rateLimit(key, max, windowMs)` from `lib/rate-limit.ts` — uses Upstash Redis (`UPSTASH_REDIS_REST_URL`/`_TOKEN`) when configured, otherwise an in-memory fixed-window fallback (fine for demo/single-instance only).
- **Audit trail**: `recordAuditAction(supabaseClient, { tenantId, entityType, entityId, actorUserId, action, before, after, metadata })` from `lib/audit.ts` — call this for any state-changing mutation on a tenant-owned entity; it writes to `audit_logs` (also RLS-scoped by tenant).
- **Client data fetching**: SWR (`swr`). `fetcher`/`fetchWithAuth` in `lib/api.ts` attach the Supabase access token as `Authorization: Bearer` so API routes can validate it.
- **Reports** (`app/api/reports/*`): CSV/PDF export routes (`pdfkit`, dynamic import, `runtime = 'nodejs'`) — still tenant-scoped through the same `requireTenantContext` pattern.

### Security headers

`next.config.ts` sets CSP and other security headers (`X-Frame-Options: DENY`, `nosniff`, etc.) for all routes. The CSP `connect-src` allowlist must be updated there whenever a new external API (LLM provider, messaging provider) is called from the client.

## Planning docs convention

Feature work is tracked under `docs/<ticket-id>-<slug>/` (e.g. `docs/1804-config-provedores-modelos-tenant/`), each containing `prd.md`, `techspec.md`, `tasks.md` (or numbered `N_task.md` files), and an `adrs/` folder. Code comments frequently reference these by ticket number or ADR (e.g. "ADR-003", "ticket 1804") — check the matching `docs/` folder for the design rationale before changing that area.

## Gotchas

- `motion` is in `next.config.ts` `transpilePackages` — don't move it to externals.
- `DISABLE_HMR=true` disables webpack file watching; it's for the AI Studio hosted environment only, don't set it locally.
- `.env*` is gitignored except `.env.example` — any new env var must be documented there.
- Supabase env vars are optional (demo mode runs without them); always null-check `getSupabaseServer`/`getSupabaseAdmin` results.
