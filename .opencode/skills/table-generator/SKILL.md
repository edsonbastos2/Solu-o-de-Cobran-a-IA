---
name: table-generator
description: >
  Gera componentes de tabela/CRUD para o projeto Next.js 15 + React 19 + Tailwind CSS 4.1.
  Use quando a tarefa for listagem tabular — tabela, grid ou CRUD com ou sem modal,
  filtros e paginação. Não use para formulários, dashboards ou páginas sem tabela.

  Stack: Next.js 15, React 19, TypeScript 5.7, Tailwind CSS 4.1, SWR.
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep]
---

# Table Generator Skill

Gera tabelas CRUD completas usando SWR + Tailwind CSS.

## Perguntas de Refinimento (uma por vez)

Antes de gerar, pergunte ao usuário nesta ordem:

1. "A tabela terá modal de criação/edição? A) Sim, modal completo B) Não, apenas listagem"
2. "Precisa de filtros? A) Filtros no cabeçalho (search, selects) B) Filtros nas colunas C) Ambos D) Nenhum"
3. "Paginação e ordenação? A) Server-side com componente Pagination B) Apenas paginação C) Nenhum"

## Arquivos Gerados

| Perguntas | Arquivos |
|-----------|----------|
| Base (sempre) | `components/nome-tabela.tsx`, `hooks/useNome.ts` |
| Modal (A) | `components/nome-modal.tsx` |
| Filtros coluna (B ou C) | `components/nome-filters.tsx` |
| Filtros header (A ou C) | `components/nome-header.tsx` |

## Padrão Base

```tsx
// components/nome-tabela.tsx
'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';

export default function NomeTabela() {
  const { data, error, isLoading } = useSWR('/api/nome', fetcher);

  if (isLoading) return <div>Carregando...</div>;
  if (error) return <div>Erro: {error.message}</div>;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="p-3 text-left text-sm font-medium">Nome</th>
            <th className="p-3 text-right text-sm font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {data?.items?.map((item) => (
            <tr key={item.id} className="border-b">
              <td className="p-3 text-sm">{item.name}</td>
              <td className="p-3 text-right">{/* ações */}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

## Regras

- Componentes são `.tsx` com `'use client'`
- Dados via SWR com `fetcher` de `lib/api.ts`
- Estado local com `useState` (página, busca, filtros)
- Paginação via `components/pagination.tsx` do projeto
- Modal: Tailwind overlay (`fixed inset-0 z-50 bg-black/60`)
- Tabela: responsiva com `overflow-x-auto`
- Sem dependências de DataTable/Dialog externos

## Checklist

- [ ] `'use client'` no topo de cada `.tsx`
- [ ] SWR com null guard (se parâmetros podem ser vazios)
- [ ] Estados: loading, error, empty, success
- [ ] Responsividade: tabela com `overflow-x-auto`
- [ ] Modal fecha com Esc e clique fora
- [ ] Paginação: componente reutilizado de `components/pagination.tsx`
- [ ] `npm run lint && npm run build` sem erros
- [ ] `npx tsc --noEmit` sem erros
