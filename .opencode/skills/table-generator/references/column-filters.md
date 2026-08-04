# Bloco FILTRO POR COLUNA — opcional

Filtro por coluna com input inline abaixo do header. Cada coluna filtrável ganha
um input de busca que filtra os dados via parâmetros SWR.

> Este projeto usa filtro server-side via query params no SWR, não filtro client-side.

## Busca no header da tabela (simplificado)

O padrão mais comum no projeto é um campo de busca global no header (ver `header-filters.md`).
Para filtro por coluna específica, adicione inputs abaixo de cada header da coluna:

```tsx
{/* Adicionar inputs de filtro na segunda linha do thead */}
<thead>
  <tr className="border-b border-white/10 bg-white/5">
    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
      Nome
    </th>
    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
      Status
    </th>
    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider w-24">
      Ações
    </th>
  </tr>
  <tr className="border-b border-white/10 bg-white/[0.02]">
    <th className="px-4 py-2">
      <input
        type="text"
        placeholder="Filtrar nome..."
        value={filterName}
        onChange={(e) => { setFilterName(e.target.value); setPage(1); }}
        className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
      />
    </th>
    <th className="px-4 py-2">
      <select
        value={filterStatus}
        onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
        className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
      >
        <option value="">Todos</option>
        <option value="active">Ativo</option>
        <option value="inactive">Inativo</option>
      </select>
    </th>
    <th className="px-4 py-2" />
  </tr>
</thead>
```

### Estado e integração com SWR

```tsx
// No componente Table{{Entidade}}.tsx:
const [filterName, setFilterName] = useState('');
const [filterStatus, setFilterStatus] = useState('');

// Adaptar o hook SWR para aceitar filtros adicionais:
const { {{entidades}}, totalPages, isLoading, error, mutate } =
  use{{Entidade}}({ page, search, filterName, filterStatus });
```

### Hook SWR com filtros por coluna

```typescript
// hooks/use{{Entidade}}.ts
interface Use{{Entidade}}Params {
  page?: number;
  search?: string;
  filterName?: string;
  filterStatus?: string;
}

export function use{{Entidade}}({
  page = 1,
  search = '',
  filterName = '',
  filterStatus = ''
}: Use{{Entidade}}Params = {}) {
  const params = useMemo(() => {
    const p = new URLSearchParams({
      page: String(page),
      limit: '10'
    });
    if (search.trim()) p.set('search', search.trim());
    if (filterName.trim()) p.set('name', filterName.trim());
    if (filterStatus.trim()) p.set('status', filterStatus);
    return p.toString();
  }, [page, search, filterName, filterStatus]);

  const { data, error, isLoading, mutate } = useSWR<{
    data: {{Tipo}}[];
    totalPages: number;
    total: number;
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

### Limpar todos os filtros

```tsx
const clearFilters = () => {
  setFilterName('');
  setFilterStatus('');
  setPage(1);
};
```

## Notas

- Filtros são **server-side**: o parâmetro é enviado na query string, a API route filtra no Supabase
- Cada mudança de filtro reseta `page` para 1 (evita ficar em página vazia)
- O hook SWR inclui os filtros como dependências de `useMemo` para revalidar automaticamente
- Para filtro por texto, a API usa `ilike` com `%term%`
- Para filtro por select, a API usa `eq('status', value)`
- Inputs usam `text-xs` e padding reduzido (`px-2 py-1`) para caberem na linha de header
- O `<select>` nativo do HTML recebe classes Tailwind para consistência visual
- Ver `app/api/cases/route.ts` como exemplo de implementação de filtros na API route
