# Frontend Reference — Next.js 15 / React 19 / Tailwind CSS / SWR / Supabase

## Principles

- React components with **strict TypeScript** (`.tsx` extension)
- **`'use client'`** on line 1 of any component that uses hooks, state, events, or browser APIs
- Server Components by default — add `'use client'` only when necessary
- Explicit typing via `interface` for props (never `React.FC<>`)
- Business logic delegated to custom hooks (`hooks/`) or functions in `lib/`
- Server data via **SWR** + `fetcher` (`lib/api.ts`)
- Mutations use `fetchWithAuth` + `useSWRConfig().mutate` for cache invalidation
- Auth via **Supabase** cookie-based session, accessed via `useAuth()` hook
- Import path alias: `@/` maps to project root (no `src/`)

## Component Directory Structure

```
components/
  ui/             ← Generic reusable components (Button, Modal, Input, Select)
  cases/          ← Domain-specific components for "cases"
  clients/        ← Domain-specific components for "clients"
  contracts/      ← Domain-specific components for "contracts"
  agents/         ← Domain-specific components for "agents"
  shared/         ← Components shared across domains
```

Naming: PascalCase `.tsx` files, named exports. One component per file.

## Frontend Checklist

- [ ] `'use client'` on line 1 of any component using hooks/state/events
- [ ] Props typed via `interface XxxProps` (never `React.FC<>`)
- [ ] SWR for server data; `fetchWithAuth` + `mutate` for mutations
- [ ] `useSWR` with conditional key (`id ? url : null`) to avoid unnecessary fetches
- [ ] Loading, error, and empty states always handled in JSX
- [ ] Business logic in custom hooks (`hooks/`) or `lib/` functions
- [ ] `mutate()` after successful mutations to revalidate cache
- [ ] Tables have `overflow-x-auto` wrapper and `min-w-[Npx]`
- [ ] Modals use `max-w-*` and `w-full` (never fixed px width)
- [ ] Form grids use `grid grid-cols-12` with responsive `col-span-*`
- [ ] Icons from `lucide-react`
- [ ] No `style={{ width: '350px' }}` — use Tailwind classes
- [ ] `cn()` from `lib/utils.ts` for conditional class merging
- [ ] `npm run lint && npm run build` pass without errors
- [ ] No direct Supabase calls in Client Components — use API routes
- [ ] Super admin: user_id filter bypassed correctly
- [ ] Auth: every protected route uses `requireUser()`
