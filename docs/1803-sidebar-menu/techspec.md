# Especificação Técnica: Sidebar de Navegação

## Resumo Executivo

Implementação de um sidebar colapsável no padrão shadcn, **do zero** (sem instalar shadcn/Radix), com `SidebarProvider` em React context (estado em memória), navegação **config-driven** por seções, e um route group `app/(dashboard)/` como ponto único do shell (ADR-001/ADR-002). O desktop colapsa para ícones (`collapsible="icon"`), o mobile vira drawer overlay; o `Header` é esvaziado da lista de links e a marca + seletor de tenant migram para o `SidebarHeader`.

O principal trade-off: **componente próprio de média complexidade vs. zero dependências novas** — aceito por decisão explícita do usuário (o projeto não tem shadcn e não se quer instalar). O trade-off secundário é **mover ~9 diretórios de páginas para o route group** (mecânico, sem mudança de URL) para ter layout único em vez de editar cada page.

## Arquitetura do Sistema

### Visão dos Componentes

| Componente | Responsabilidade | Relação |
|---|---|---|
| `app/(dashboard)/layout.tsx` | Monta o shell: `SidebarProvider` > `AppSidebar` + `SidebarInset`(Header + conteúdo) | Envolve todas as páginas autenticadas |
| `components/ui/sidebar.tsx` | Primitivas nativas: `SidebarProvider`, `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarGroup`, `SidebarMenu*`, `SidebarFooter`, `SidebarTrigger`, `SidebarRail`, `SidebarInset`, `useSidebar` | Única fonte das primitivas |
| `components/app-sidebar.tsx` | Config-driven: renderiza seções/menus a partir de `lib/navigation.ts`; usa `useActiveTenant` e `usePathname` | Consome `useSidebar` e o config |
| `lib/navigation.ts` | Config tipada das seções/itens (label, href, icon, adminOnly) | Fonte de verdade da navegação |
| `components/header.tsx` | Vira header slim: trigger do drawer mobile, nome do usuário, tour, logout (sem `navLinks`) | Dentro de `SidebarInset` |
| `components/tenant-switcher.tsx` | Seletor de tenant (super-admin) — move para `SidebarHeader` | Inalterado na lógica |
| `hooks/use-mobile.ts` | Hook `useIsMobile` (já existe) para distinguir desktop/mobile | Usado pelo provider |
| `app/layout.tsx` (raiz) | Mantém `AuthGuard` + `HelpChat` | Inalterado |

### Fluxo de dados

- **Config → UI**: `app-sidebar.tsx` importa `lib/navigation.ts`, filtra `adminOnly` quando o perfil não é super-admin, e renderiza seções.
- **Estado do layout**: `SidebarProvider` expõe `{ open, setOpen, openMobile, setOpenMobile, isMobile, toggleSidebar }` via context; `useSidebar` consome. `AppSidebar` e `Header` (trigger) leem/alteram o mesmo estado.
- **Rota ativa**: `app-sidebar.tsx` usa `usePathname()` e marca `isActive` no item cujo `href` casa com o pathname (e prefixo, para subpáginas como `/cases/[id]`).
- **Tenant (super-admin)**: `useActiveTenant` continua; `tenantPath` (`?tenant_id=`) aplicado aos links; `TenantSwitcher` no `SidebarHeader` (desktop) e dentro do drawer (mobile).

## Design de Implementação

### Interfaces Centrais

Config de navegação (uma interface única alimenta desktop e mobile):

```tsx
// lib/navigation.ts
export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  section: 'operacao' | 'configuracao';
};

export type NavSection = {
  id: 'operacao' | 'configuracao';
  label: string;
  items: NavItem[];
};
```

Contrato do context (exposto por `useSidebar`):

```tsx
type SidebarContextValue = {
  state: 'expanded' | 'collapsed';
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};
```

### Modelos de Dados

Sem mudanças de schema/banco/RLS. A única "estrutura" nova é a config em `lib/navigation.ts` (em memória).

### Primitivas do sidebar (estilo shadcn, nativas)

- `SidebarProvider`: `useState` para `open` (desktop) e `openMobile`; usa `useIsMobile()`; escuta teclado `cmd/ctrl+b` (`keydown`) para `toggleSidebar`; fornece context.
- `Sidebar`: renderiza duas apresentações — desktop (`hidden md:flex`, colapsável `icon`) e mobile (`Sheet`/drawer overlay manual com backdrop). Classes controladas por variáveis CSS `--sidebar-width`/`--sidebar-width-mobile` e `data-state`.
- `SidebarMenuButton`: suporta `asChild` (renderiza `<Link>` do Next) e `isActive` para estilo ativo.
- `SidebarTrigger`: botão ícone `PanelLeft` que chama `toggleSidebar`.
- `SidebarRail`: faixa fina na borda que também alterna o colapse no desktop.

### Responsividade

- Desktop (`md+`): fixa à esquerda, largura ~`16rem` expandido / ~`4rem` colapsado (ícones).
- Mobile (`<md`): drawer `fixed inset-y-0 left-0` com backdrop; abre pelo hambúrger do header; fecha ao clicar fora/Esc/após navegar (fecha automaticamente em clique de item, com `onClick` no menu).

## Pontos de Integração

- **Auth**: sem mudanças — middleware e `requireUser` continuam; o route group não altera URLs.
- **Supabase client**: inalterado; `useActiveTenant` e `useAuth` reutilizados.
- **Tour guiado**: preservar `data-tour` em: logo (`app-logo`), header (`header-settings`), itens Agentes (`agents-nav-desktop`/`agents-nav-mobile`) e Políticas (`policies-nav-desktop`/`policies-nav-mobile`) e trigger (`mobile-menu-trigger`). O config de navegação pode carregar `dataTour?: string` por item.

## Análise de Impacto

| Componente | Tipo de Impacto | Descrição e Risco | Ação Necessária |
|---|---|---|---|
| `components/ui/sidebar.tsx` | new | Primitivas nativas (risco: alto se divergir do contrato `useSidebar`) | Criar arquivo |
| `components/app-sidebar.tsx` | new | Sidebar config-driven (risco: baixo) | Criar arquivo |
| `lib/navigation.ts` | new | Config de navegação (risco: baixo) | Criar arquivo |
| `app/(dashboard)/layout.tsx` | new | Shell do route group (risco: médio — mover páginas) | Criar layout + mover páginas |
| `app/layout.tsx` (raiz) | none | Mantém AuthGuard/HelpChat | Sem mudança |
| `components/header.tsx` | modified | Remove `navLinks`, vira header slim (risco: médio — tour/tenant) | Refatorar |
| `components/tenant-switcher.tsx` | none | Move de local, lógica intacta | Sem mudança de lógica |
| `app/cases|clients|contracts|negotiations|agents|policies|settings|admin/` + `app/page.tsx` | moved | Páginas movidas para `(dashboard)` (risco: baixo — imports `@/` preservados, URLs iguais) | Mover arquivos |
| `hooks/use-mobile.ts` | none | Já existe | Reuso |
| `middleware.ts` | none | Sem mudança (URLs inalteradas) | — |

## Estratégia de Teste

### Testes Unitários

Não há suite de testes no projeto. Validação por compilação e lint:
- `npx tsc --noEmit` — tipagem estrita.
- `npm run lint` — ESLint (next/core-web-vitals + next/typescript).
- `npm run build` — typecheck + build de produção.

### Testes de Integração (manuais)

- Desktop: sidebar expandida por padrão; `cmd/ctrl+b` e trigger colapsam/expandem para ícones; tooltips nos ícones colapsados.
- Mobile: hambúrger abre drawer; clicar fora/Esc fecha; navegar fecha drawer; conteúdo ocupa tela cheia.
- Ativo: navegar `/cases` marca "Casos (Ao Vivo)"; subpágina `/cases/[id]` mantém o item pai ativo.
- RBAC: super-admin vê "Painel Admin" + `TenantSwitcher`; usuário regular não vê.
- Tour: clicar no botão de tour dispara os passos com `data-tour` preservados.
- Tenant: trocar tenant no `SidebarHeader` atualiza `?tenant_id=` e as rotas ativas.

## Sequenciamento de Desenvolvimento

### Ordem de Construção

1. **Criar `lib/navigation.ts`** — nenhuma dependência. Config tipada com seções/itens (inclui `dataTour`).
2. **Criar `components/ui/sidebar.tsx`** — depende de 1 (importa `cn`/`cva` e `use-mobile`). Primitivas + context + teclado.
3. **Criar `components/app-sidebar.tsx`** — depende de 1 e 2. Renderiza seções, ativo via `usePathname`, admin/tenant via `useActiveTenant`.
4. **Criar `app/(dashboard)/layout.tsx` e mover páginas** — depende de 2 e 3. Monta `SidebarProvider` + `AppSidebar` + `SidebarInset`(Header + children); move `page.tsx` e as pastas de módulos para dentro do grupo.
5. **Refatorar `components/header.tsx`** — depende de 4. Remove `navLinks`; mantém trigger mobile, nome, tour, logout; move marca/tenant para `SidebarHeader`.
6. **Ajustes de a11y/responsividade** — depende de 5. Validar foco, contraste, `aria`, tooltips e fechamento do drawer.
7. **Validação final** — depende de 6. `npx tsc --noEmit`, `npm run lint`, `npm run build`.

### Dependências Técnicas

- Nenhuma dependência nova de package.
- Route group exige mover arquivos de páginas (mecânico; usar `git mv` para preservar histórico).
- `@/` alias presente em todos os imports das páginas — não quebra ao mover.

## Monitoramento e Observabilidade

- Sem métricas instrumentadas novas.
- Sem logging novo; estados de erro de render seguirão o padrão atual (UI).
- Sem alertas novos.

## Considerações Técnicas

### Decisões Principais

| Decisão | Racional | Trade-off | Alternativas rejeitadas |
|---|---|---|---|
| Primitivas nativas em `components/ui/sidebar.tsx` (ADR-001) | Sem shadcn/Radix; zero deps | Manutenção do componente próprio | Instalar shadcn/Radix |
| Route group `(dashboard)` (ADR-002) | Ponto único de shell; state persiste | Mover páginas (mecânico) | Provider no root (contamina `/login`); editar cada page |
| Config-driven em `lib/navigation.ts` | Única fonte; RBAC; data-tour | — | Duas listas (desktop/mobile) |
| Context em memória (ADR-001) | Persistência entre páginas, sem storage | Não persiste entre sessões | localStorage |
| Header slim | Remove duplicação de nav | Header deixa de listar links | Manter nav no header |

### Riscos Conhecidos

- **Regressão do tour guiado**: atributos `data-tour` podem se perder na refatoração. Mitigação: `dataTour` no config + revisão do diff.
- **Quebra ao mover páginas**: imports relativos quebrados. Mitigação: `git mv` + revisão; páginas usam alias `@/`.
- **Colapse mobile/desktop conflitante**: `open` e `openMobile` são estados separados; garantir que `toggleSidebar` atue no estado certo conforme `isMobile`.
- **Foco/teclado**: sem Radix, precisamos de `aria-expanded`, `aria-label` e gerenciamento manual de Esc/foco no drawer.

## Arquitetura Decision Records

- [ADR-001: Shell sidebar no padrão shadcn, implementado do zero](adrs/adr-001.md) — primitivas nativas sem instalar shadcn/Radix; config-driven; sections; state em context.
- [ADR-002: Route group `(dashboard)` como ponto único do shell](adrs/adr-002.md) — `SidebarProvider` + `AppSidebar` no layout do grupo; páginas movidas sem mudança de URL.