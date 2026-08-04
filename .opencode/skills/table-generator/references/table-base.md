# Bloco BASE — Container + Tabela HTML (sempre)

Padrão mínimo de uma tabela de listagem. Inclui: cabeçalho com título e botão "Adicionar",
tabela HTML com Tailwind, coluna de **Ações** (editar/remover) e integração com hook SWR.
Os outros blocos (modal, filtros, paginação) **acrescentam** elementos sobre esta base.

> Este código é genérico e autocontido — copie daqui, não de componentes do projeto.

## Componente

```tsx
'use client';

import { useState } from 'react';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { use{{Entidade}} } from '@/hooks/use{{Entidade}}';
import { {{Tipo}} } from '@/lib/types';
import { fetchWithAuth } from '@/lib/api';
import { Pagination } from '@/components/pagination';
// Modal: incluir somente se o bloco "modal" foi escolhido
import { Modal{{Entidade}} } from '@/components/Modal{{Entidade}}';

export function Table{{Entidade}}() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { {{entidades}}, totalPages, total, isLoading, error, mutate } =
    use{{Entidade}}({ page, search });

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este item?')) return;
    try {
      const res = await fetchWithAuth(`{{endpoint}}?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao remover');
      mutate();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingId(undefined);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingId(undefined);
    mutate();
  };

  return (
    <>
      {/* Modal: incluir somente se o bloco "modal" for escolhido */}
      {isModalOpen && (
        <Modal{{Entidade}}
          {{entidade}}Id={editingId}
          onClose={handleModalClose}
        />
      )}

      <div className="rounded-xl border border-white/10 bg-[#111318] overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex flex-row flex-wrap justify-between items-center px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">{{Titulo}}</h2>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </div>

        {/* Busca (opcional — ver header-filters.md) */}
        {/* BUSCA_PLACEHOLDER */}

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                {/* COLUNAS: uma <th> por campo informado */}
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {{HeaderColuna}}
                </th>
                {/* Coluna de Ações (editar/remover) */}
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider w-24">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-sm text-slate-400">
                    Carregando...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-sm text-red-400">
                    Erro ao carregar dados.
                  </td>
                </tr>
              ) : {{entidades}}.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-sm text-slate-400">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                {{entidades}}.map((item: {{Tipo}}) => (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-sm text-white">
                      {item.{{field}}}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleEdit(item.id)}
                          className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2 text-slate-400 hover:text-red-400 transition-colors rounded-lg hover:bg-white/5"
                          title="Remover"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação (opcional — ver pagination-sorting.md) */}
        {/* PAGINATION_PLACEHOLDER */}
      </div>
    </>
  );
}
```

## Hook SWR correspondente

```typescript
// hooks/use{{Entidade}}.ts
'use client';

import useSWR from 'swr';
import { useMemo } from 'react';
import { fetcher } from '@/lib/api';
import { {{Tipo}} } from '@/lib/types';

interface Use{{Entidade}}Params {
  page?: number;
  search?: string;
}

export function use{{Entidade}}({ page = 1, search = '' }: Use{{Entidade}}Params = {}) {
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

- O componente usa `'use client'` porque contém hooks (`useState`, SWR) e handlers de evento
- `id` é o identificador padrão das entidades (conforme `lib/types.ts`)
- O hook SWR retorna `isLoading`, `error`, `mutate` para controle completo no componente
- Ícones são do `lucide-react` (`Pencil`, `Trash2`, `Plus`)
- A paginação usa o componente `Pagination` existente em `components/pagination.tsx`
- Se **não** houver modal, remova `<Modal{{Entidade}}>`, o estado `isModalOpen`/`editingId`,
  e deixe `handleCreate`/`handleEdit` como placeholders ou remova
- Se **não** houver paginação, remova o `<Pagination>` e os estados `page`/`setPage`
- Estilo: fundo escuro `bg-[#111318]`, bordas `border-white/10`, texto `text-slate-*`, foco `ring-emerald-500/50`
- `overflow-x-auto` no wrapper da tabela garante scroll horizontal em mobile
