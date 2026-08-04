---
name: bug-investigator
description: >
  Use para investigar bugs e comportamentos inesperados no projeto Next.js 15 / React 19 / Supabase.
  Ative esta skill quando o usuário:
  - Descrever um comportamento inesperado ("não está funcionando", "quebrou", "está errado")
  - Colar um stack trace, erro de console, erro TypeScript ou erro de build
  - Perguntar "por que X não funciona?" ou "o que está causando esse erro?"
  - Mencionar regressão após uma mudança recente
  - Descrever um bug de UI (componente não renderiza, dado não aparece, ação não dispara)
  - Relatar bug de estado (hook com valor incorreto, loading preso, SWR retornando cache antigo)
  - Relatar bug de API (requisição não sai, payload errado, erro HTTP não tratado, RLS bloqueando)
  - Relatar bug de SSR/RSC ("use client" faltando, hydration mismatch, `window is not defined`)
  - Erro do Supabase (RLS, policies, token expirado, session ausente)

  Esta skill investiga a causa raiz antes de propor qualquer correção.
  Nunca aplica um fix sem ter identificado o layer e o motivo real do bug.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

# Bug Investigator Skill

Investiga bugs no projeto Next.js 15 App Router / React 19 / Supabase seguindo uma metodologia
de camadas: sintoma → hipótese → confirmação → causa raiz → fix.

**Nunca aplique correções antes de completar a investigação.**

---

## Arquitetura de camadas do projeto (para navegação de bugs)

```
Browser (Client Components)
  └─ React 19 (hooks, state, effects)
      └─ SWR (cache, revalidação, fetchWithAuth)
          └─ fetchWithAuth (token Bearer do Supabase)
              └─ HTTP → Next.js middleware (valida sessão)
                  └─ API Route Handler (requireUser, validateFields)
                      └─ Supabase Client (RLS via user_id)
                          └─ Supabase Database

Next.js Server (RSC / SSR)
  └─ Server Components (render no servidor, sem JS no cliente)
  └─ getSupabaseServer(cookies) — client com token do usuário
  └─ middleware.ts — validação de sessão, redirect /login
```

Um bug pode ocorrer em qualquer interseção entre estas camadas.

---

## Fase 1 — Coleta de sintomas

Antes de abrir qualquer arquivo, responda internamente:

```
Sintoma descrito: [o que o usuário relatou]
Reproduzível? [sim / não / desconhecido]
Aparece em: [desenvolvimento / produção / todos]
Após qual mudança? [commit, PR, deploy — se informado]
Mensagem de erro: [stack trace / mensagem do console / erro TS]
```

Se faltar informação crítica para investigar, pergunte ao usuário **uma coisa de cada vez**.

---

## Fase 2 — Identificação do layer

Classifique o bug em uma das camadas abaixo. Um bug pode cruzar camadas, mas sempre começa em uma.

| Layer | Sintomas típicos |
|-------|-----------------|
| **Componente (React 19)** | Não renderiza, dado não aparece, evento não dispara, condicional errada, children não propagam |
| **Hook / Estado** | Estado incorreto, SWR retorna dado antigo, useEffect loop infinito, useState não atualiza UI, useCallback stale closure |
| **API / SWR** | Requisição não sai (key null), payload errado, erro HTTP não tratado, FetchError, 401/403 não autorizado |
| **Server vs Client** | Erro `window is not defined`, `document is not defined`, hydration mismatch, "use client" faltando |
| **TypeScript** | Erro de compilação, type assertion incorreta, interface desatualizada, `strict: true` violações |
| **SSR / RSC** | Erro só no servidor, conteúdo muda entre server e client, import de módulo client-only sem 'use client', cookies() em Client Component |
| **Supabase RLS / Auth** | 401/403 em rotas que antes funcionavam, dados não aparecem (array vazio), `user_id` incorreto, session expirada |
| **Middleware / Rotas** | Middleware não executa, redirect incorreto, params ausentes, 404 inesperado, loop de redirect |
| **Tailwind CSS 4** | Classe não aplica, conflito de estilos, breakpoint não funciona, dark mode inesperado |

---

## Fase 3 — Investigação por layer

### Bug de Componente React

```bash
# Encontrar o componente
rg "NomeDoComponente" components/ app/ --type tsx
```

Verifique nesta ordem:
1. O componente está usando a variável correta? (prop vs state vs dado do SWR)
2. O render condicional (`&&`, ternário, `if (!data) return null`) está bloqueando a renderização?
3. O componente recebe as props esperadas? A interface do parâmetro está correta?
4. Algum `useEffect` ou `useSWR` deveria popular um dado mas não está sendo chamado?
5. O `'use client'` está presente quando o componente usa hooks, state ou eventos? (Server Components não podem usar hooks)
6. O componente está sendo importado corretamente? (named vs default export)
7. Existe um problema de key em listas? (keys duplicadas ou ausentes em `.map()`)

### Bug de Hook / Estado

```bash
# Encontrar hooks customizados
rg "use[A-Z]" hooks/ lib/ --type ts --type tsx
```

Verifique nesta ordem:
1. O `useEffect` tem dependências corretas? (array de deps ausente, incompleto ou com referência instável)
2. O `useState` está sendo atualizado com o setter, não por mutação direta?
3. O SWR está com cache stale? (verificar `revalidateOnMount`, `dedupingInterval`, `fallbackData`)
4. O `useCallback`/`useMemo` tem as dependências corretas?
5. O cleanup do `useEffect` está sendo feito (retornar função de limpeza para subscriptions/timers)?
6. Existe stale closure? (função capturou valor antigo de state/prop em callback/event handler)
7. `useRef` está sendo usado como mutável mas a UI não reflete a mudança? (ref não dispara re-render)

### Bug de API / SWR

```bash
# Encontrar endpoints e chamadas
rg "useSWR|fetcher|fetchWithAuth" components/ app/ hooks/ --type tsx --type ts -l
```

Verifique nesta ordem:
1. A URL do endpoint bate com a rota em `app/api/`? (ex.: `/api/cases` → `app/api/cases/route.ts`)
2. O payload enviado tem todos os campos obrigatórios? (ver `validateFields` no route handler)
3. O `fetcher` está sendo usado ou a chamada usa `fetch` cru (sem token)?
4. O status da resposta está sendo verificado com `res.ok`?
5. O token Bearer está sendo enviado? (verificar se Supabase session existe, não expirou)
6. O `user_id` está sendo filtrado corretamente pelo RLS? (dados não aparecem = possível RLS bloqueando)
7. A key do SWR é `null` quando parâmetros obrigatórios estão ausentes?
8. A key do SWR está mudando a cada render? (ex.: criando novo objeto/URLSearchParams a cada render)

### Bug de Server vs Client Component

Indicadores clássicos:
- `window is not defined` → código de browser rodando no servidor (falta `'use client'` ou guard `typeof window !== 'undefined'`)
- `document is not defined` → mesmo que acima, acesso ao DOM no servidor
- Hydration mismatch → estado inicial difere entre server e client (ex.: `localStorage`, `Math.random()`, `Date.now()` no render inicial)
- `cookies()` ou `headers()` chamados em Client Component → essas APIs são só para Server Components
- Componente não renderiza em Server Component → import de módulo client-only sem `'use client'`
- Erro "You're importing a component that needs useState" → faltou `'use client'`

```bash
# Procurar por acesso a APIs do browser
rg "window\." components/ app/ --type tsx --type ts
rg "document\." components/ app/ --type tsx --type ts
rg "localStorage" components/ app/ --type tsx --type ts
rg "navigator\." components/ app/ --type tsx --type ts
rg "addEventListener" components/ app/ --type tsx --type ts
```

Solução padrão para `window is not defined`:
```typescript
// Opção 1: Adicionar 'use client' (se o componente precisa de interatividade)
'use client';

// Opção 2: Guard condicional (se só uma pequena parte usa browser API)
const [isClient, setIsClient] = useState(false);
useEffect(() => { setIsClient(true); }, []);
if (!isClient) return null;

// Opção 3: typeof check (para valores que não variam)
const origin = typeof window !== 'undefined' ? window.location.origin : '';

// Opção 4: next/dynamic com ssr: false (para componentes pesados que dependem do browser)
import dynamic from 'next/dynamic';
const Chart = dynamic(() => import('@/components/chart'), { ssr: false });
```

### Bug de TypeScript

```bash
# Verificar erros TS
npx tsc --noEmit 2>&1 | head -80
```

Verifique:
1. Interface em `lib/types.ts` está desatualizada em relação ao que a API retorna?
2. `as Tipo` está mascarando um erro real? (substituir por type guard ou validação)
3. Prop opcional tratada como obrigatória (falta `?` ou operador `?.`)?
4. Retorno de função assíncrona declarado incorretamente? (falta `Promise<T>`)
5. `strict: true` está ativo no tsconfig — verifique `strictNullChecks` em especial
6. Tipos do SWR estão corretos? (`useSWR<Tipo>(...)` — o genérico bate com o retorno da API?)
7. O path alias `@/*` está configurado corretamente? (aponta para raiz, não `src/`)

### Bug de SSR / RSC (Server Components)

```bash
# Procurar Server Components que importam módulos client-only
rg "from ['\"]@/components/" app/ --type tsx | rg -v "'use client'"
```

Verifique:
1. Server Component está importando um Client Component que usa hooks sem `'use client'`?
2. `async` Server Component está fazendo fetch sem tratar erro? (erro no servidor quebra a página inteira)
3. `generateStaticParams` está retornando array vazio? (página dinâmica sem fallback)
4. `cookies()` do `next/headers` está sendo chamado corretamente? (síncrono no App Router)
5. `revalidate` ou `dynamic` configurados corretamente para dados que mudam?
6. Erro de serialização: passando função, Date, ou objeto circular como prop de Server para Client Component?

### Bug de Supabase RLS / Auth

Sintomas: dados não aparecem (array vazio mesmo com dados), 401/403, criação de registro falha sem erro claro.

```bash
# Verificar arquivos de migração RLS
rg "policy|RLS|user_id" supabase_*.sql
```

Verifique:
1. A tabela tem RLS enabled? (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
2. A policy permite SELECT/INSERT para o `user_id` do usuário autenticado?
3. O `user_id` está sendo inserido ao criar registros? (ver `app/api/*/route.ts` — `requireUser` fornece `userId`)
4. O usuário está autenticado? (verificar se o token Bearer está sendo enviado, session não expirou)
5. O superadmin está usando `getSupabaseServerWithAdminFallback` (bypassa RLS)? Se não, mesmo admin vê só os próprios dados.
6. O client Supabase é `null`? (env vars ausentes — app roda em "demo mode" sem Supabase)
7. A tabela existe? (migration SQL não foi aplicada no ambiente)

### Bug de Middleware / Rotas

```bash
# Verificar middleware
cat middleware.ts
rg "export.*function" app/api/ --type ts -l
```

Verifique:
1. A rota está na lista de exclusões do middleware? (`/api/webhook/*`, `/api/cron/*`, `/api/extract-contract/*`)
2. O middleware está retornando 401 para API routes ou redirect para `/login` para páginas?
3. A rota dinâmica está usando `[param]` corretamente? O `params` está sendo acessado como Promise no Next.js 15?
4. `generateStaticParams` está definido para rotas dinâmicas que precisam de pre-rendering?
5. Existe conflito entre rotas? (ex.: `/api/cases/[id]` vs `/api/cases/stats` — rotas mais específicas devem vir primeiro)

---

## Fase 4 — Hipóteses e confirmação

Após a investigação, liste as hipóteses em ordem de probabilidade:

```
Hipótese 1 (mais provável): [descrição]
  → Evidência: [o que no código suporta essa hipótese]
  → Verificar: [arquivo:linha a ler para confirmar]

Hipótese 2: [descrição]
  → Evidência: ...
  → Verificar: ...
```

Leia os arquivos identificados e **confirme** antes de prosseguir.

---

## Fase 5 — Relatório de causa raiz

Após confirmar a causa, gere um relatório conciso:

```
## Bug Investigation Report

**Sintoma:** [o que o usuário relatou]
**Layer afetado:** [componente / hook / API / RLS / SSR / middleware / ...]
**Arquivo(s):** `path/do/arquivo.tsx`, linha XX

**Causa raiz:**
[Uma ou duas frases explicando o porquê real do problema]

**Por que não foi detectado antes:**
[teste ausente / caso de borda / dependência externa / timing / cache stale]

**Correção proposta:**
[descrição precisa da mudança necessária]

**Verificações a adicionar:**
[quais cenários precisam de validação manual]
```

---

## Fase 6 — Handoff para implementação do fix

Após identificar a causa raiz, implemente a correção ou delegue:

| Tipo de correção | Onde implementar |
|-----------------|-----------------|
| Correção em componente React | Editar `components/*.tsx` ou `app/**/page.tsx` |
| Correção em hook personalizado | Editar `hooks/*.ts` |
| Correção em chamada de API / SWR | Aplicar padrões de `api-integration` skill |
| Correção em API route handler | Editar `app/api/**/route.ts` |
| Correção em RLS / migration | Editar `supabase_*.sql` |
| Correção em middleware | Editar `middleware.ts` |
| Correção em tipos | Editar `lib/types.ts` |

---

## Atalhos de diagnóstico rápido

### Stack trace com "Cannot read properties of undefined"

Causa mais comum: dado ainda não carregado quando o componente renderiza, ou SWR key retornando `undefined` data.

```bash
# Onde o dado é usado?
rg "nomeDoAtributo\." app/ components/ hooks/ --type tsx --type ts -l
```

Solução provável: operador `?.` no JSX, guard `if (!data) return null`, ou SWR key condicional (`id ? url : null`).

### "Hydration mismatch" no console

```bash
# Procurar por render não-determinístico no servidor
rg "useEffect|useState|Date\.now|Math\.random|localStorage|new Date\(\)" app/ --type tsx
```

Solução: garantir que o estado inicial é determinístico no server e client. Usar `useEffect` para inicializar valores que dependem do browser, ou usar `suppressHydrationWarning` apenas como último recurso.

### SWR retorna cache antigo após mutation

Causa: `mutate()` não é chamado após POST/PUT/DELETE.

```bash
rg "mutate\(" components/ app/ --type tsx
```

Solução: chamar `mutate()` após toda mutation bem-sucedida, ou usar `mutate(key)` com a key específica para revalidar.

### Erro 401 em rota de API

Causa comum: sessão expirada, token não enviado, `requireUser()` falhando, ou middleware bloqueando.

```bash
# Verificar se a rota usa requireUser
rg "requireUser" app/api/ --type ts -l
# Verificar configuração do middleware
rg "api/" middleware.ts
```

Solução: verificar se o token está sendo enviado (fetchWithAuth anexa automaticamente), se a sessão não expirou, e se a rota não está na lista de exclusão do middleware.

### "useSWR is not defined" ou "useSWR can only be used in client components"

Causa: SWR está sendo usado em um Server Component (sem `'use client'`).

```bash
rg "useSWR" app/ --type tsx | rg -v "'use client'"
```

Solução: adicionar `'use client'` no topo do arquivo, ou mover a lógica de data fetching para um Client Component filho.

### Dados retornam array vazio sem erro

Causa provável: RLS bloqueando o acesso (user_id não confere), ou o client Supabase é `null` (demo mode).

```bash
# Verificar se supabase client tem null guard
rg "supabase\?" app/api/ --type ts -A 2
# Verificar RLS policies
rg "CREATE POLICY|ENABLE ROW LEVEL" supabase_*.sql
```

Solução: verificar se o usuário está autenticado, se a tabela tem RLS enabled, e se as policies cobrem o user_id correto.

### "Objects are not valid as a React child"

Causa: tentando renderizar um objeto diretamente no JSX (ex.: `{data}` em vez de `{data.name}`).

```bash
rg "\{data\}\b" components/ app/ --type tsx
```

Solução: acessar a propriedade específica do objeto. Se `data` é o objeto do SWR, use `data.cases` ou o campo relevante.

---

## Anti-padrões de diagnóstico

```typescript
// ❌ RUIM: aplicar fix sem entender a causa
// "Vou só adicionar um ?. aqui para parar de dar erro"
// Isso mascara o problema real — o dado pode estar undefined por RLS, SWR key null, etc.

// ✅ BOM: entender POR QUÊ o dado está undefined antes de usar ?.
// A causa pode ser: SWR ainda carregando, key do SWR é null,
// API retornando 204, RLS bloqueando os dados, session expirada.

// ❌ RUIM: adicionar suppressHydrationWarning sem corrigir a causa
<div suppressHydrationWarning>...</div>

// ✅ BOM: garantir que o estado inicial é determinístico no server e client
// Usar useEffect para valores que dependem do browser (localStorage, window, etc.)

// ❌ RUIM: adicionar 'use client' em tudo para "funcionar"
// Transforma Server Components em Client Components desnecessariamente, piora performance

// ✅ BOM: apenas componentes que usam hooks, estado ou eventos precisam de 'use client'
// Server Components são o default no App Router

// ❌ RUIM: adicionar setTimeout para "esperar o dado carregar"
setTimeout(() => { /* usar dado */ }, 1000);

// ✅ BOM: usar os estados de loading/error do SWR ou useEffect com dependências corretas
if (isLoading) return <Spinner />;

// ❌ RUIM: ignorar erros do Supabase com .catch(() => [])
const { data } = await supabase.from('cases').select('*'); // erro é engolido

// ✅ BOM: verificar error e retornar resposta apropriada
const { data, error } = await supabase.from('cases').select('*');
if (error) return NextResponse.json({ error: error.message }, { status: 500 });
```
