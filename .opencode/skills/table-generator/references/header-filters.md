# Bloco FILTRO NO HEADER (busca) — opcional

Formulário de busca acima da tabela, com campo de texto e/ou selects lado a lado.
Busca server-side: o valor é enviado como query param e a API route filtra no Supabase.

> Gerar **apenas** os campos que o usuário indicou para o formulário de busca.

## Busca simples (texto único)

```tsx
{/* No cabeçalho, entre o título e a tabela */}
<div className="flex flex-col sm:flex-row gap-3 px-6 py-3 border-b border-white/10">
  <div className="flex-1">
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
      <input
        type="text"
        placeholder="Buscar por nome, telefone ou documento..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        className="w-full rounded-lg border border-white/10 bg-white/5 pl-10 pr-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
      />
    </div>
  </div>
  {search && (
    <button
      onClick={() => { setSearch(''); setPage(1); }}
      className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
    >
      Limpar
    </button>
  )}
</div>
```

## Busca com múltiplos campos

```tsx
<div className="px-6 py-3 border-b border-white/10">
  <div className="flex flex-col sm:flex-row gap-3">
    {/* Campo de texto */}
    <div className="flex-1">
      <label className="block text-xs text-slate-500 mb-1">Nome</label>
      <input
        type="text"
        placeholder="Buscar por nome..."
        value={searchName}
        onChange={(e) => { setSearchName(e.target.value); setPage(1); }}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
      />
    </div>

    {/* Select de status */}
    <div>
      <label className="block text-xs text-slate-500 mb-1">Status</label>
      <select
        value={searchStatus}
        onChange={(e) => { setSearchStatus(e.target.value); setPage(1); }}
        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
      >
        <option value="">Todos</option>
        <option value="not_started">Não iniciado</option>
        <option value="in_negotiation">Em negociação</option>
        <option value="closed">Encerrado</option>
      </select>
    </div>

    {/* Campo de data */}
    <div>
      <label className="block text-xs text-slate-500 mb-1">Vencimento</label>
      <input
        type="date"
        value={searchDate}
        onChange={(e) => { setSearchDate(e.target.value); setPage(1); }}
        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
      />
    </div>

    {/* Botão limpar filtros */}
    <div className="flex items-end">
      <button
        onClick={clearFilters}
        className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap"
      >
        Limpar Filtros
      </button>
    </div>
  </div>
</div>
```

### Estado e métodos

```tsx
const [searchName, setSearchName] = useState('');
const [searchStatus, setSearchStatus] = useState('');
const [searchDate, setSearchDate] = useState('');

const clearFilters = () => {
  setSearchName('');
  setSearchStatus('');
  setSearchDate('');
  setPage(1);
};
```

### Adaptação do hook SWR

```typescript
interface Use{{Entidade}}Params {
  page?: number;
  searchName?: string;
  searchStatus?: string;
  searchDate?: string;
}

export function use{{Entidade}}({
  page = 1,
  searchName = '',
  searchStatus = '',
  searchDate = ''
}: Use{{Entidade}}Params = {}) {
  const params = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), limit: '10' });
    if (searchName.trim()) p.set('name', searchName.trim());
    if (searchStatus) p.set('status', searchStatus);
    if (searchDate) p.set('date', searchDate);
    return p.toString();
  }, [page, searchName, searchStatus, searchDate]);

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

## Notas

- O grid usa `flex-col sm:flex-row` para empilhar em mobile e alinhar em desktop
- Cada mudança de filtro reseta `page` para 1
- O hook SWR usa `useMemo` para reconstruir params somente quando as dependências mudam
- O botão "Limpar Filtros" reseta todos os campos de busca
- A API route deve ler os query params correspondentes (ver `app/api/cases/route.ts`)
- O filtro no header **pode** coexistir com paginação
- Ícone de busca (`Search`) vem do `lucide-react`
- O botão "Limpar" individual (busca simples) só aparece quando há texto digitado
