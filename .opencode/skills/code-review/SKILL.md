---
name: code-review
description: >
  Use para revisar código frontend antes de commitar ou abrir PR. Ative esta skill quando
  o usuário:
  - Pedir "revisa esse componente", "faz o review do PR", "tá pronto pra commitar?"
  - Compartilhar código React, hook ou página Next.js e perguntar se está correto/bom
  - Mencionar "code review", "PR", "pull request", "checklist" ou "revisão"
  - Terminar uma feature e querer validar antes de subir
  - Pedir para verificar qualidade, padrões ou problemas potenciais em código frontend

  Esta skill aplica os padrões do projeto Next.js 15 / React 19 / Supabase como critérios
  de revisão, cobrindo: TypeScript, React/Next.js patterns, SWR, Supabase RLS,
  Tailwind CSS 4, responsividade, acessibilidade e segurança multi-tenant.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

# Code Review Skill

Realiza revisão completa de código frontend aplicando os padrões do projeto.
Gera um relatório estruturado com problemas encontrados, severidade e sugestões de correção.

## Como usar esta skill

1. **Leia o(s) arquivo(s)** compartilhados pelo usuário
2. **Aplique os checklists** de cada categoria relevante
3. **Classifique os problemas** por severidade (🔴 Blocker / 🟡 Warning / 🟢 Suggestion)
4. **Gere o relatório** no formato padronizado abaixo
5. **Proponha correções** com código quando a mudança for clara
6. **Emita o veredicto final** — sempre a última linha do relatório

---

## Checklists de Revisão

### 🏗️ Estrutura do Componente React

- [ ] Arquivo `.tsx` com TypeScript estrito (extensão correta, não `.jsx`)
- [ ] `'use client'` na primeira linha quando usa hooks, state, eventos ou browser APIs
- [ ] **Sem** `'use client'` em Server Components (componentes puramente de renderização) — Server Components são o default no App Router
- [ ] Imports na ordem: React → next → lib internos → hooks → components → types
- [ ] Props tipadas inline no parâmetro da função (não `React.FC<>`)
- [ ] Lógica de negócio delegada a hooks customizados (`hooks/`) ou lib (`lib/`)
- [ ] Nenhum `useEffect` com lógica que poderia estar em um Server Component
- [ ] Funções de evento (`onClick`, `onSubmit`) definidas dentro do componente (não inline complexas)
- [ ] Export nomeado ou default consistente com o resto do projeto
- [ ] Componentes seguem Atomic Design: quarks (botões, inputs) → atoms → molecules → organisms → templates → pages

### 🔷 TypeScript

- [ ] Sem uso de `any` (usar `unknown` + type guard quando necessário)
- [ ] Interfaces/types estão em `lib/types.ts` (PascalCase, sem prefixo `I`, sem sufixo `Dto`)
- [ ] Props tipadas — nunca `any` ou `object` no parâmetro do componente
- [ ] Retornos de função assíncrona tipados (`Promise<Tipo>`)
- [ ] Sem type assertions desnecessárias (`as Tipo` sem validação prévia)
- [ ] Tipos de `useState<T>()` explícitos quando o TypeScript não infere corretamente
- [ ] `strict: true` — código não quebra com `strictNullChecks`, `noUncheckedIndexedAccess`
- [ ] Path alias `@/*` usado corretamente (aponta para raiz do projeto, não `src/`)

### 🪝 Hooks e SWR

- [ ] `useSWR` com key condicional (`id ? url : null`) para evitar fetch desnecessário
- [ ] Dados do SWR tratados com fallback: `data?.cases || []`
- [ ] Estados de carregamento e erro sempre tratados no JSX (`if (isLoading)`, `if (error)`)
- [ ] `mutate()` chamado após mutations (POST/PUT/DELETE)
- [ ] `keepPreviousData: true` em SWR para listas com paginação
- [ ] `useEffect` com cleanup quando necessário (subscriptions, timers, event listeners)
- [ ] Hooks customizados estão em `hooks/` com nome `use*` (ex.: `useCases`, `useAuth`)
- [ ] `useCallback`/`useMemo` quando a referência precisa ser estável (deps de outros hooks)
- [ ] Sem `useState` + `useEffect` para data fetching (usar SWR em vez disso)

### 🔐 Supabase e Multi-tenant

- [ ] `user_id` **nunca** é enviado manualmente em requisições de usuário comum
- [ ] Chamadas a `requireUser()` em todas as API routes que precisam de auth
- [ ] Superadmin usa `getSupabaseServerWithAdminFallback` quando precisa bypassar RLS
- [ ] Dados sensíveis não são expostos ao cliente sem filtro de `user_id`
- [ ] Session é verificada antes de acessar dados do usuário
- [ ] `supabase` client é null-guardado (`if (!supabase) return fallback`) — app roda em demo mode sem env vars
- [ ] Tokens e secrets nunca são expostos em Client Components ou logs
- [ ] API routes validam campos obrigatórios com `validateFields(body, required)` de `lib/api-validate.ts`

### 🎨 Tailwind CSS 4 e Estilização

- [ ] Classes Tailwind aplicadas diretamente no `className` (não há CSS modules, styled-components, nem arquivos `.css` por componente)
- [ ] `clsx` ou `tailwind-merge` (`cn` utility) para classes condicionais complexas
- [ ] `class-variance-authority` (`cva`) para variantes de componente quando necessário
- [ ] Sem classes CSS inline via `style={}` exceto para valores verdadeiramente dinâmicos (ex.: coordenadas, cores calculadas)
- [ ] Ícones são do `lucide-react` (não emoji, não SVG inline, não outro pacote de ícones)
- [ ] Tailwind v4: usar `@apply` com moderação; preferir classes utilitárias diretamente

### 📱 Responsividade

- [ ] Layout é mobile-first (classes sem prefixo = mobile)
- [ ] `flex-col` em mobile → `md:flex-row` em desktop quando necessário
- [ ] Grid usa `grid-cols-1` (ou equivalente v4) em mobile e expande com `md:` / `lg:`
- [ ] Modais/dialogs não têm largura fixa em `px` (usar `max-w-*` e `w-full`)
- [ ] Tabelas têm `overflow-x-auto` em container para scroll horizontal em mobile
- [ ] Sem larguras fixas em `px` que causem overflow em viewports menores que 375px
- [ ] Touch targets têm pelo menos 44x44px em mobile (`min-h-[44px] min-w-[44px]`)

### ⚡ Performance

- [ ] Componentes client-side com `'use client'` apenas quando necessário (hooks, estado, eventos, browser APIs)
- [ ] Server Components usados para conteúdo estático (sem `'use client'` desnecessário)
- [ ] `React.memo` em componentes puros que renderizam frequentemente com mesmas props
- [ ] `useMemo`/`useCallback` em cálculos caros ou referências passadas como deps de hooks
- [ ] SWR com `revalidateOnFocus: false` quando polling em tempo real não é necessário
- [ ] Sem imports de bibliotecas pesadas sem lazy loading (`next/dynamic` com `ssr: false`)
- [ ] Imagens usam `next/image` (não `<img>`) para otimização automática
- [ ] Links internos usam `<Link>` do `next/link` (não `<a href>`) para client-side navigation

### ♿ Acessibilidade (A11y)

- [ ] Inputs têm `label` associado (`htmlFor` / `id` ou `aria-label` via `label` explícito)
- [ ] Botões sem texto visível têm `aria-label` (ex.: botão só com ícone)
- [ ] Ícones decorativos têm `aria-hidden="true"` (não precisam ser anunciados por leitores de tela)
- [ ] Mensagens de erro estão associadas ao campo (`aria-describedby` apontando para o id da mensagem)
- [ ] Foco visível não foi removido sem substituto (`focus:ring-*`, `focus:outline-none` sempre com alternativa)
- [ ] Tabelas têm `<thead>`, `<tbody>`, e cabeçalhos com `scope="col"` ou `<th>`
- [ ] Contraste de cores adequado (Tailwind padrão geralmente atende)

### 🧪 Verificação de qualidade (projeto não tem suite de testes)

- [ ] Código compila sem erros TypeScript (`npx tsc --noEmit`)
- [ ] `npm run build` passa sem erros (lembrete: build roda typecheck, não ESLint)
- [ ] `npm run lint` passa sem erros ou warnings (ESLint com `next/core-web-vitals` + `next/typescript`)
- [ ] Funcionalidade testada manualmente em `npm run dev` (porta 3000)
- [ ] `.env.example` atualizado se novas env vars foram adicionadas

---

## Formato do Relatório

````markdown
## Code Review — NomeDoArquivo.tsx

### Resumo

- 🔴 Blockers: X
- 🟡 Warnings: Y
- 🟢 Suggestions: Z

---

### 🔴 Blockers (impedem merge)

#### 1. [Título curto do problema]

**Arquivo:** `path/do/arquivo.tsx`, linha XX
**Problema:** Descrição clara do que está errado e por que é um problema.
**Correção:**

```tsx
// código corrigido aqui
```
```

---

### 🟡 Warnings (devem ser corrigidos, mas não bloqueiam)

#### 1. [Título curto]

...

---

### 🟢 Suggestions (melhorias opcionais)

#### 1. [Título curto]

...

---

### ✅ O que está bem

- Item positivo 1
- Item positivo 2

---

### Veredicto

> ✅ **APROVADO** — Nenhum blocker encontrado. Pode commitar.

ou

> ❌ **REPROVADO** — X blocker(s) encontrado(s). Corrija antes de commitar.
> Blockers: [lista resumida dos títulos]

````

### Regra do veredicto

| Situação | Veredicto |
|---|---|
| Nenhum 🔴 Blocker | ✅ **APROVADO** |
| 1 ou mais 🔴 Blockers | ❌ **REPROVADO** |

Warnings e Suggestions **nunca** reprovam — devem ser endereçados mas não bloqueiam o commit.

---

## Severidade de problemas

| Severidade | Quando usar |
|------------|-------------|
| 🔴 Blocker | Bug real, quebra de padrão crítico, vazamento de dados entre tenants (`user_id` ausente), componente sem `'use client'` quando necessário, falta de tipagem que esconde erro, código que vai para produção com erro 401/403, exposição de secrets/tokens, `any` que mascara erro de tipo |
| 🟡 Warning | Código funcionando mas que viola padrões do projeto, dificulta manutenção ou cria dívida técnica (ex.: `style={}` em vez de Tailwind, função inline complexa no JSX, `fetch` cru em vez de `fetchWithAuth`, falta de validação de erro, import desorganizado) |
| 🟢 Suggestion | Melhorias de legibilidade, performance opcional, alternativas mais idiomáticas, `useMemo`/`useCallback` onde não é estritamente necessário mas melhora clareza |

---

## Exemplos de problemas comuns

### Blocker: fetch direto em vez de SWR + fetcher

```tsx
// 🔴 RUIM: fetch cru — perde token Bearer, sem cache, sem revalidação
const [data, setData] = useState([]);
useEffect(() => {
  fetch('/api/cases').then(r => r.json()).then(setData);
}, []);

// ✅ BOM: SWR com fetcher
const { data, error, isLoading } = useSWR('/api/cases', fetcher);
```

### Blocker: faltando 'use client' em componente com hooks

```tsx
// 🔴 RUIM: usa useState sem 'use client' — erro de SSR
import { useState } from 'react';
export function MyComponent() {
  const [open, setOpen] = useState(false);
  // ...
}

// ✅ BOM: 'use client' na primeira linha
'use client';
import { useState } from 'react';
export function MyComponent() {
  const [open, setOpen] = useState(false);
}
```

### Blocker: vazamento multi-tenant (user_id sendo exposto ou não sendo filtrado)

```tsx
// 🔴 RUIM: enviar user_id do cliente
const body = { name, phone, user_id: currentUserId };

// ✅ BOM: user_id resolvido pelo servidor via sessão
const body = { name, phone, due_date, original_value };
```

### Blocker: useSWR em Server Component

```tsx
// 🔴 RUIM: SWR (client-side hook) em Server Component
// app/cases/page.tsx
import useSWR from 'swr';
export default function CasesPage() {
  const { data } = useSWR('/api/cases', fetcher); // ERRO: só funciona no cliente
}

// ✅ BOM: Server Component busca dados direto, Client Component usa SWR
// app/cases/page.tsx
import { getSupabaseServer } from '@/lib/supabase-server';
import { CasesListClient } from './cases-list-client';

export default async function CasesPage() {
  const supabase = await getSupabaseServer();
  const { data: cases } = await supabase!.from('cases').select('*').limit(10);
  return <CasesListClient initialData={cases || []} />;
}

// components/cases-list-client.tsx
'use client';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';

export function CasesListClient({ initialData }: { initialData: Case[] }) {
  const { data } = useSWR('/api/cases?limit=10', fetcher, {
    fallbackData: { cases: initialData, totalPages: 1, total: initialData.length }
  });
  // ...
}
```

### Warning: loading preso no erro

```tsx
// 🟡 RUIM: loading fica true em caso de erro
async function handleSubmit() {
  setLoading(true);
  const res = await fetchWithAuth('/api/cases', { method: 'POST', body: ... });
  // se lançar exceção, loading nunca volta a false
  setLoading(false);
}

// ✅ BOM: try/finally garante que loading volta a false
async function handleSubmit() {
  setLoading(true);
  try {
    const res = await fetchWithAuth('/api/cases', { method: 'POST', body: ... });
    if (!res.ok) {
      const result = await res.json();
      setError(result.error || 'Erro');
      return;
    }
    // sucesso
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Erro de rede');
  } finally {
    setLoading(false);
  }
}

// ✅ MELHOR AINDA: SWR gerencia loading/error automaticamente para GET
const { data, error, isLoading } = useSWR('/api/cases', fetcher);
// loading gerido pelo SWR, error capturado automaticamente
```

### Warning: estilo inline em vez de Tailwind

```tsx
// 🟡 RUIM
<div style={{ width: '350px', padding: '16px' }}>

// ✅ BOM: Tailwind com classes utilitárias
<div className="w-full md:w-96 p-4">
```

### Warning: SWR key instável (novo objeto a cada render)

```tsx
// 🟡 RUIM: params recriado a cada render → SWR refetch desnecessário
function Component({ page, search }: { page: number; search: string }) {
  const params = new URLSearchParams({ page: String(page), search });
  const { data } = useSWR(`/api/cases?${params.toString()}`, fetcher);
  // ...
}

// ✅ BOM: useMemo estabiliza a key
function Component({ page, search }: { page: number; search: string }) {
  const key = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), search });
    return `/api/cases?${params.toString()}`;
  }, [page, search]);

  const { data } = useSWR(key, fetcher);
  // ...
}
```

### Suggestion: useMemo em vez de método no JSX

```tsx
// 🟢 Recomendado trocar
<div>{items.filter(i => i.active).map(i => <Item key={i.id} item={i} />)}</div>

// por:
const activeItems = useMemo(() => items.filter(i => i.active), [items]);
<div>{activeItems.map(i => <Item key={i.id} item={i} />)}</div>
```

### Suggestion: `next/link` em vez de `<a href>`

```tsx
// 🟢 Recomendado trocar
<a href="/cases">Ver casos</a>

// por:
import Link from 'next/link';
<Link href="/cases">Ver casos</Link>
// Client-side navigation preserva estado e é mais rápido
```

### Suggestion: `next/image` em vez de `<img>`

```tsx
// 🟢 Recomendado trocar
<img src="/logo.png" alt="Logo" width={200} height={50} />

// por:
import Image from 'next/image';
<Image src="/logo.png" alt="Logo" width={200} height={50} />
// Otimização automática, lazy loading, prevenção de layout shift
```

---

## Anti-padrões de code review

### O que NÃO marcar como problema

- **`any` em callbacks de evento**: `onClick={(e: React.MouseEvent) => ...}` — o tipo do evento é inferido, não precisa anotar
- **Falta de `return` explícito em arrow function**: `const fn = () => value` é válido e idiomático
- **Uso de `as` em `Object.fromEntries`**: `Object.fromEntries(formData)` retorna `Record<string, FormDataEntryValue>` — `as` para string é pragmático
- **`console.log` em desenvolvimento**: remover antes de produção, mas não é blocker ou warning em dev
- **Props desestruturadas inline**: `function Comp({ name, email }: Props)` é o padrão do projeto, não `props: Props` seguido de `props.name`
- **Conditional com `&&`**: `{condition && <Component />}` é idiomático no React, não é menos legível que ternário

### O que SEMPRE marcar

- **`fetch` cru**: sempre substituir por `fetcher` (GET) ou `fetchWithAuth` (POST/PUT/DELETE)
- **`user_id` no payload do cliente**: vazamento multi-tenant
- **Falta de tratamento de erro**: `res.json()` sem verificar `res.ok`
- **`'use client'` faltando**: em componente que usa hooks, estado ou eventos
- **`'use client'` desnecessário**: em Server Component que não usa nada do cliente
- **`any` mascarando erro**: quando um tipo real existe e está disponível
- **CSS inline para valores fixos**: usar Tailwind
