# Bloco PAGINAÇÃO — opcional

Acrescenta paginação server-side usando o componente `Pagination` do projeto
(`components/pagination.tsx`). A API route já suporta `page` e `limit` como query params.

## Componente Pagination do projeto

```tsx
// components/pagination.tsx — já existe no projeto, reutilizar
import { Pagination } from '@/components/pagination';

<Pagination
  currentPage={page}
  totalPages={totalPages}
  onPageChange={setPage}
/>
```

## Integração no componente de tabela

```tsx
'use client';

import { useState } from 'react';
import { use{{Entidade}} } from '@/hooks/use{{Entidade}}';
import { Pagination } from '@/components/pagination';

export function Table{{Entidade}}() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { {{entidades}}, totalPages, isLoading, error, mutate } =
    use{{Entidade}}({ page, search });

  return (
    <div className="rounded-xl border border-white/10 bg-[#111318] overflow-hidden">
      {/* cabeçalho + busca + tabela */}
      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
```

## Hook SWR com paginação

```typescript
// hooks/use{{Entidade}}.ts
import useSWR from 'swr';
import { useMemo } from 'react';
import { fetcher } from '@/lib/api';
import { {{Tipo}} } from '@/lib/types';

export function use{{Entidade}}({ page = 1, search = '' } = {}) {
  const params = useMemo(() => {
    const p = new URLSearchParams({
      page: String(page),
      limit: '10'
    });
    if (search.trim()) p.set('search', search.trim());
    return p.toString();
  }, [page, search]);

  const { data, error, isLoading, mutate } = useSWR<{
    data: {{Tipo}}[];
    totalPages: number;
    total: number;
    page: number;
  }>(
    `{{endpoint}}?${params}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    {{entidades}}: data?.data || [],
    totalPages: data?.totalPages || 1,
    total: data?.total || 0,
    error,
    isLoading,
    mutate
  };
}
```

## API Route com paginação

```typescript
// app/api/.../route.ts (exemplo do padrão)
export async function GET(req: NextRequest) {
  // ... autenticação e autorização
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10')));
  const offset = (page - 1) * limit;

  // query com .range() do Supabase
  const { data, count, error } = await supabase
    .from('table_name')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: data || [],
    totalPages: Math.ceil((count || 0) / limit) || 1,
    total: count || 0,
    page
  });
}
```

## Ordenação server-side (opcional)

Se necessário ordenação server-side por clique no header da coluna:

```tsx
// No componente: clique no <th> alterna ordenação
const [sortField, setSortField] = useState('created_at');
const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

const handleSort = (field: string) => {
  if (sortField === field) {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  } else {
    setSortField(field);
    setSortOrder('asc');
  }
  setPage(1);
};

// No thead:
<th
  onClick={() => handleSort('name')}
  className="cursor-pointer hover:text-white transition-colors select-none"
>
  Nome
  {sortField === 'name' && (
    <span className="ml-1">{sortOrder === 'asc' ? '\u2191' : '\u2193'}</span>
  )}
</th>
```

O hook SWR e a API route devem aceitar `sortField`/`sortOrder`:

```typescript
// No hook:
if (sortField) p.set('sortField', sortField);
if (sortOrder) p.set('sortOrder', sortOrder);

// Na API route:
const sortField = (searchParams.get('sortField') || 'created_at').slice(0, 50);
const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

const { data } = await query.order(sortField, { ascending: sortOrder === 'asc' });
```

## Notas

- O componente `Pagination` já existe em `components/pagination.tsx` — **usá-lo, não recriá-lo**
- A paginação é sempre server-side: `page` e `limit` vão como query params
- `SWR` revalida automaticamente quando a key (URL) muda (quando `page` ou `search` mudam)
- O `useMemo` reconstrói a URL de params de forma eficiente (só quando as deps mudam)
- `revalidateOnFocus: false` evita refetch ao trocar de aba (adequado para listas)
- Mostrar `Pagination` apenas quando `totalPages > 1`
- O `limit` default é 10, máximo é 100 (clamping na API route)
- Ordenação visual no header: seta para cima (asc) e para baixo (desc)
- `select-none` no header ordenável evita selecionar texto ao clicar
