# AGENTS.md

## Commands

```bash
npm run dev          # Next.js dev server on port 3000
npm run build        # production build (runs typecheck, NOT lint)
npm run lint         # ESLint (next/core-web-vitals + next/typescript)
npm run clean        # `next clean` — clears .next cache
```

ESLint is skipped during builds (`eslint.ignoreDuringBuilds: true` in `next.config.ts`).
No test suite, no formatter, no CI/CD configured.

## Documentation language

**All documentation (docs, PRDs, TechSpecs, ADRs, task files, README, comments in `.md` files) must be written in Brazilian Portuguese (pt-BR).** Never write documentation in English. Technical terms, identifiers, code blocks, and file paths must stay in their original form (English); only the prose is translated.

## Architecture

- **Next.js 15 App Router** with React 19, TypeScript 5.7 (strict), Tailwind CSS 4.1
- **Path alias**: `@/*` maps to project root (not `src/`)
- **Auth**: Supabase cookie-based session via `@supabase/ssr`
- **DB**: Supabase with Row-Level Security (multi-tenant via `user_id` column)
- **Package manager**: npm (package-lock.json) and bun (bun.lock) both present

### Directory map

| Path | Purpose |
|------|---------|
| `app/` | Next.js App Router pages and API routes |
| `app/api/` | REST API route handlers (cases, clients, contracts, agents, chat, webhook, cron, etc.) |
| `app/admin/` | Super-admin-only dashboard |
| `app/cases/`, `app/clients/`, `app/contracts/` | Core CRUD pages |
| `app/agents/`, `app/policies/`, `app/settings/` | Configuration pages |
| `components/` | Shared React components (5 files) |
| `hooks/` | `useAuth.ts` (session + profile) and `use-mobile.ts` |
| `lib/` | All business logic — Supabase clients, AI agents, canais de comunicação (`lib/channels/`), tenant, types, utilities |

### Supabase client patterns (three tiers)

1. **Browser client** (`lib/supabase.ts`): `createBrowserClient` for client components — reads cookies
2. **Server client** (`lib/supabase-server.ts`): `getSupabaseServer(req)` for route handlers — reads cookies from `NextRequest`
3. **Admin client** (`lib/supabase-admin.ts`): `getSupabaseAdmin()` — service role, bypasses RLS

Both server and admin return `null` when env vars are missing (graceful degradation in demo mode).

### Auth flow

- **Middleware** (`middleware.ts`): Enforces Supabase session on all routes except `/login`, `/api/webhook/*`, `/api/cron/*`, `/api/extract-contract/*`. Returns 401 JSON for API routes, redirects to `/login` for pages.
- **Client guard**: `AuthGuard` in root layout wraps all pages, redirects to `/login` when loading finishes without a user.
- **API auth helpers** (`lib/api-auth.ts`): `requireUser()` returns userId + superAdmin flag + currentTenantId; `requireSuperAdmin()` returns 403 for non-admins; `requireTenantContext(req, requestedTenantId?)` resolves the tenant — super-admin uses the explicit `?tenant_id=` override or falls back to the persisted `profiles.current_tenant_id` (set via `PUT /api/tenants/current`, listed via `GET /api/tenants`); regular users use their active `tenant_members` row. Use these in every API route handler.
- **Super admin**: Flag stored in `profiles.is_super_admin`. When true, the server-side `getSupabaseServerWithAdminFallback` returns the admin (service role) client, bypassing RLS.
- **Multi-tenant isolation**: Regular tenants can only access rows where `user_id` matches. Never forget the `user_id` filter when querying on behalf of a non-admin user.

### AI negotiation pipeline (`lib/agent.ts`)

The `processChat(caseId, message)` function implements a multi-agent workflow:
1. **Supervisor** classifies the debtor's message and picks a specialist
2. **Specialist** (cobranca, negociacao, financeiro, juridico, or analise_credito) drafts a response
3. **Quality** agent audits for CDC compliance and discount margin limits, correcting if needed

Falls back to single-agent mode if no supervisor is configured. AI provider/model/keys are read per-user from the `profiles` table (supports Gemini, OpenAI, Anthropic, OpenRouter, Ollama). Keys may be encrypted — always try the `get_user_ai_keys` RPC first.

### Canais de comunicação (`lib/channels/`)

O domínio envia mensagens exclusivamente via `sendCaseMessage`/`sendClientMessage` de `lib/channels/message-service.ts` — nunca chame os adapters (WhatsApp/Telegram) diretamente. Novos canais implementam a interface `CommunicationChannel` (`lib/channels/types.ts`) e se registram em `lib/channels/registry.ts`. Segredos de canal (bot token do Telegram, credenciais Z-API, webhook secret) vivem em `channel_configs` por tenant, cifrados via `ai_encrypt` — as env vars (`TELEGRAM_BOT_TOKEN`, `ZAPI_*`) são apenas fallback de demo/desenvolvimento. Em produção, a configuração é feita por tenant na aba Canais (`components/channel-config-panel.tsx`).

### Collection stages (`lib/finance.ts`)

`getCollectionStage(dueDate, maxDiscountMargin, status)` classifies debts into: preventiva (not overdue), amigavel (1-30 days), negocial (31-180 days), especializada (>180 days or needs_attention). Each stage has its own max discount cap.

### Data fetching on the client

Uses **SWR** (`swr`). The `fetcher` helper in `lib/api.ts` uses `fetchWithAuth` which attaches the Supabase access token via `Authorization: Bearer` header. The middleware then validates this session on API routes.

### Input validation

Use `validateFields(body, required)` from `lib/api-validate.ts` in API routes. Returns a 400 `NextResponse` on failure or `null` on success.

### Rate limiting

`lib/rate-limit.ts` provides an in-memory fixed-window rate limiter: `rateLimit(key, max, windowMs)`. Not suitable for multi-instance deployments without Redis.

## Gotchas

- **`eslint.ignoreDuringBuilds: true`** — `npm run build` runs typecheck but skips ESLint. Run `npm run lint` separately.
- **No `tsc` typecheck script** — type errors only surface during `npm run build` or through IDE. Consider running `npx tsc --noEmit` for a quick check.
- **SQL migrations** are in root `supabase_*.sql` files — they must be applied manually to the Supabase project.
- **`motion` is a transpiled package** (in `next.config.ts` `transpilePackages`) — don't add it to externals.
- **`DISABLE_HMR` env var**: When set to `true`, webpack ignores all file changes. This is for AI Studio's hosted environment; don't set it in local dev.
- **Supabase env vars are optional** — the app runs in demo mode without them (`supabase` client returns `null`, middleware allows all requests). If adding features, always guard against `null` clients.
- **`.env*` is gitignored** except `.env.example` — new env vars must be documented there.
- **No `src/` directory** — everything is at project root (Next.js 15 convention with `app/` directory).
