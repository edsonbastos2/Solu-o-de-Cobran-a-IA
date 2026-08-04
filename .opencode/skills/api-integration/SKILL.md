---
name: api-integration
description: >
  Use quando precisar integrar o frontend com endpoints da API. Ative quando o usuário:
  - Mencionar SWR, fetcher, fetchWithAuth, endpoint, API, REST, HTTP
  - Pedir para criar ou ajustar chamada de API (hooks, componentes, SWR)
  - Perguntar sobre tratamento de erro HTTP (400, 401, 403, 404, 500)
  - Pedir paginação, filtros ou listagem com server-side sort
  - Mencionar "Bearer token", FetchError ou erros de rede

  Cobre: tipagem de respostas, SWR + fetcher/fetchWithAuth, tratamento de erro,
  paginação server-side, query params, multi-tenant Supabase RLS.
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep]
---

# API Integration Skill

Guia de integração frontend ↔ API para Next.js 15 + Supabase com SWR + `fetchWithAuth`.

## Regra de ouro: `fetcher` + SWR, nunca `fetch` cru

Toda chamada HTTP usa `fetcher` de `lib/api.ts`. O `fetcher` injeta `Authorization: Bearer <token>`.

```typescript
import useSWR from 'swr';
import { fetcher } from '@/lib/api';

const { data, error, isLoading, mutate } = useSWR('/api/cases', fetcher);
```

Para mutations (POST, PUT, DELETE), use `fetchWithAuth`:

```typescript
import { fetchWithAuth } from '@/lib/api';

const res = await fetchWithAuth('/api/cases', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, phone, original_value, due_date })
});
const result = await res.json();
if (!res.ok) throw new Error(result.error || 'Erro');
```

## Estrutura de Tipos

Tipos em `lib/types.ts` — PascalCase, sem prefixo `I`:

```typescript
// lib/types.ts
export interface Case {
  id: string;
  created_at: string;
  name: string;
  phone: string;
  original_value: number;
  updated_value: number;
  due_date: string;
  max_discount_margin: number;
  status: 'not_started' | 'in_negotiation' | 'needs_attention' | 'closed';
}
```

## Padrões SWR

### GET com paginação e filtros

```typescript
'use client';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';

export function useCases(page: number, search: string, status: string) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', '10');
  if (search.trim()) params.set('search', search.trim());
  if (status.trim() && status !== 'all') params.set('status', status);

  const { data, error, isLoading, mutate } = useSWR<{
    cases: Case[];
    totalPages: number;
    total: number;
  }>(`/api/cases?${params.toString()}`, fetcher);

  return { cases: data?.cases || [], totalPages: data?.totalPages || 1, total: data?.total || 0, error, isLoading, mutate };
}
```

### GET por ID com null guard

```typescript
const { data, error, isLoading } = useSWR<Case>(
  id ? `/api/cases/${id}` : null,
  fetcher
);
```

### Mutação otimista com SWR

```typescript
const { mutate } = useSWR('/api/cases', fetcher);

async function handleDelete(id: string) {
  await deleteCase(id);
  mutate(); // revalida cache após exclusão
}
```

## Tratamento de Erros

```typescript
if (isLoading) return <Spinner />;
if (error) return <ErrorMessage message={error.message} />;
return <CasesList cases={data?.cases || []} />;
```

## Multi-tenant: filtro `user_id`

- **Nunca** envie `user_id` manualmente para usuários comuns
- O `requireUser()` extrai `userId` da sessão, Supabase aplica RLS automaticamente

## Checklist

- [ ] Tipos em `lib/types.ts` (PascalCase)
- [ ] Dados via `useSWR(url, fetcher)`
- [ ] Mutations via `fetchWithAuth` + `mutate()` após sucesso
- [ ] Null guard na key do SWR: `id ? url : null`
- [ ] Loading, error e empty states tratados
- [ ] Query params com `URLSearchParams`
- [ ] Nunca enviar `user_id` em requisições não-admin

## Anti-padrões

```typescript
// RUIM: fetch cru
const data = await fetch('/api/cases').then(r => r.json());

// RUIM: key sem null guard
const { data } = useSWR(`/api/cases/${id}`, fetcher); // id pode ser undefined

// BOM: null guard
const { data } = useSWR(id ? `/api/cases/${id}` : null, fetcher);

// RUIM: ignorar erro
return <CasesList cases={data?.cases || []} />;

// BOM: tratar loading e erro
if (isLoading) return <Spinner />;
if (error) return <ErrorMessage message={error.message} />;

// RUIM: não chamar mutate após mutation
await createCase(form);

// BOM: revalidar cache
await createCase(form);
await mutate();
```
