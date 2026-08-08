# Documento de Requisitos do Produto: Sidebar de Navegação

## Visão Geral

A navegação principal (Dashboard, Casos, Acordos, Contratos, Clientes, Agentes IA, Políticas) mora hoje no `components/header.tsx` como links de topo e **já não cabe mais no header**: cada novo módulo disputa espaço horizontal com a marca, o seletor de tenant (super-admin) e as ações de usuário. Esta funcionalidade introduz um **menu lateral (sidebar) de navegação persistente** no padrão do componente shadcn `Sidebar` (colapsível em ícones no desktop, drawer/overlay no mobile), implementado **do zero** — o projeto não utiliza shadcn, então o componente é construído manualmente seguindo a especificação e o comportamento do shadcn como referência. O público-alvo é o advogado/operador que usa o painel CobrançaIA todos os dias (usuário regular) e o super-admin. O valor é organizar, escalar e manter alcançável toda a navegação em qualquer tamanho de tela, sem duplicar lógica entre desktop e mobile.

## Objetivos

- Dar um lar organizado e escalável para a navegação principal, que hoje não cabe no header.
- Implementar o comportamento de referência shadcn: **colapsar para ícones no desktop** e **drawer lateral no mobile**, com a mesma configuração de menus.
- Manter a escolha de layout (colapsado/expandido) persistente entre páginas.
- Não introduzir dependências novas de UI: implementar do zero com as libs já presentes (`class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`).
- Não quebrar fluxos existentes: multi-tenant (super-admin), tour guiado (`data-tour`) e páginas atuais.

## Histórias de Usuário

- Como **advogado/operador que usa o painel no desktop**, quero o menu lateral sempre presente, colapsável para ícones quando precisar de espaço, para navegar sem esticar o header e ganhar mais área de conteúdo.
- Como **advogado/operador no celular**, quero abrir o mesmo menu por um drawer lateral, para chegar a qualquer módulo com poucos toques e ver o conteúdo em tela cheia quando o drawer está fechado.
- Como **super-admin**, quero ver o seletor de tenant e o link do Painel Admin disponíveis no sidebar (e não no header), para controlar o contexto sem perder a navegação.
- Como **usuário de qualquer perfil**, quero entender à primeira vista onde estão as seções (operação vs. configuração), para localizar funcionalidades sem ler todos os itens.
- Como **usuário com tela grande**, quero estado ativo destacado no item em uso, para saber onde estou a cada momento.

## Funcionalidades Principais

### P0: Sidebar persistente em todas as páginas autenticadas

- Aparece em todas as páginas que hoje renderizam o `<Header>`, incluindo admin e o chat de caso.
- Composição no padrão do shadcn de referência: `SidebarProvider` (estado global), `Sidebar`, `SidebarHeader` (marca + seletor de tenant), `SidebarContent` (scrollável), `SidebarGroup` (seções), `SidebarMenu`/`SidebarMenuItem`/`SidebarMenuButton` e `SidebarFooter` (usuário/ações).

### P0: Navegação config-driven com seções

- Menu definido em **configuração única tipada** (seção, label, href, ícone, flag de admin). Uma única fonte de verdade alimenta desktop e mobile — sem duplicar listas.
- **Seções com labels** (decisão do usuário): grupo **"Operação"** (Dashboard, Casos (Ao Vivo), Acordos, Contratos, Clientes) e **"Configuração"** (Agentes IA, Políticas, Configurações).
- Itens sensíveis a perfil: **Painel Admin** e **seletor de tenant** visíveis apenas para super-admin.
- Item ativo destacado por rota atual (ex.: `/cases` → item Casos ativo; subpáginas como `/cases/[id]` mantêm o item de seção pai ativo).

### P0: Comportamento responsivo (desktop colapsa, mobile drawer)

- **Desktop**: sidebar expandida por padrão, com botão `SidebarTrigger` (e atalho de teclado `cmd/Ctrl+B` para alternar) que colapsa para **ícones** e volta.
- **Mobile**: o sidebar vira **drawer** que desliza da esquerda em modo overlay; o hambúرger do header abre, fecha ao clicar fora/fechar, e fecha ao navegar.
- Mesma config de navegação nos dois modos.

### P0: Header slim

- O header deixa de carregar a lista de links; fica com: trigger do drawer (mobile), marca (se houver), nome do usuário, botão de tour guiado e logout.
- Logo, branding e seletor de tenant passam a viver no `SidebarHeader`.

### P0: Acessibilidade e atalho

- Contraste, estados de foco visíveis, `aria` em pontos de interação (trigger, drawer, itens de menu).
- Atalho de teclado `cmd/Ctrl+B` para alternar expanded/collapsed.

## Experiência do Usuário

- **Primeiro acesso**: o usuário é recebido pelo painel clássico — sidebar expandida à esquerda com a marca no topo, seções legíveis e o conteúdo logo à direita; nada se esconde atrás de múltiplos cliques.
- **Uso diário no desktop**: com pouca espaço, pressiona `cmd/Ctrl+B` ou o botão do trigger e o sidebar encolhe para ícones; passa o mouse para ver tooltip/expandir quando precisar.
- **No celular**: toca no hamburger para abrir o drawer; escolhe a tela; o drawer fecha e o conteúdo assume toda a largura.
- **Super-admin**: o seletor de tenant fica no topo do sidebar e o "Painel Admin" aparece na seção de configuração, destacado em verde; o contexto é trocar de tenant afeta o item ativo (revalida path via `tenant_id`).
- **Acessibilidade**: quem navega por teclado alterna o sidebar com `cmd/Ctrl+B` e percorre os itens com Tab; todos os itens têm rótulos visíveis (não só ícone).

## Requisitos Técnicos de Alto Nível

Limites que moldam o produto sem prescrever implementação:
- **Não** instalar shadcn/Radix e não adicionar novas dependências de runtime — componente nativo reutilizando `cva`, `clsx`, `tailwind-merge`, `lucide-react` já presentes (decisão do usuário).
- Manter a lógica de autenticação e proteção de rotas atual (Supabase + `requireUser`); o sidebar não muda o controle de acesso das rotas.
- Preservar multi-tenant: `TenantSwitcher` e links com `tenantPath` (`?tenant_id=`) inalterados em comportamento.
- Preservar o tour guiado: manter os mesmos atributos `data-tour` hoje usados (`app-logo`, `agents-nav-*`, `policies-nav-*`, `mobile-menu-trigger`, `header-settings`).
- Dark theme contínuo com o design system atual (`#111318`, bordas `white/5`, accent `emerald-500`).

## Não-Objetivos (Fora de Escopo)

- **Não** criar novas rotas/páginas; somente reorganizar a navegação existente.
- **Não** instalar o pacote shadcn/ui (nem Radix) — implementação nativa (decisão explícita do usuário; ver ADR-001).
- **Não** adicionar breadcrumbs, pesquisa global, menu do usuário dropdown, nem ícone de notificações.
- **Não** implementar submenus colapsáveis aninhados (ex.: subitens dentro de Contratos) no MVP — seções com labels aprovadas como abordagem (ADR-001).

## Plano de Entrega em Fases

### MVP (Fase 1)

- Sidebar persistente em todas as páginas autenticadas com composição shadcn nativa.
- Config única de navegação com seções "Operação"/"Configuração", flag de admin e item ativo.
- Colapsável para ícones no desktop (`cmd/Ctrl+B` + trigger) e drawer no mobile.
- Header slim; marca e tenant na SidebarHeader.
- **Critérios de sucesso**: `npm run lint` e `npm run build` passam; tour guiado e tenant switcher funcionando; navigation desktop+mobile correta em teste manual.

### Fase 2

- Criação de um painel de usuário/avatar no footer do sidebar (logout, perfil) — item de backlog, fora do MVP.

### Fase 3

- (Opcional) Badges dinâmicos por item (ex.: "Ao Vivo") e persistência de preferência (expandido vs colapsado) — melhoria contínua.

## Métricas de Sucesso

- Build (`npm run build`) e lint sem erros.
- Nenhum regressão funcional: tour guiado dispara nos mesmos `data-tour`, super-admin troca de tenant, páginas renderizam como hoje.
- Navegação completa (7 itens) alcançável no desktop com sidebar—sem overflow no header.
- Mobile: todos os itens alcançáveis via drawer; conteúdo em tela cheia com drawer fechado.
- Zero novas dependências de runtime adicionadas.

## Riscos e Mitigações

- **Regressão visual do multi-tenant**: mitigar mantendo `TenantSwitcher` e admin-item condicionais e testando o fluxo de troca de tenant.
- **Perda do tour guiado**: mitigar preservando os atributos `data-tour` e homologando no build.
- **Estado do CD colapsado não persistir entre páginas**: mitigar colocando o `SidebarProvider` no layout raiz (estado global React) — o mobile drawer fecha ao navegar (contrato esperado no shadcn).
- **Fricção de adoção**: usuários acostumados com o menu no topo podem estranhar; mitigar mantendo a marca e ações principais no header enxuto e o sidebar expandido por padrão no desktop.

## Arquitetura Decision Records

- [ADR-001: Shell sidebar no padrão shadcn, implementado do zero](adrs/adr-001.md) — sidebar colapsável nativo (sem instalar shadcn), config-driven com seções, persistência via `SidebarProvider` no raiz.

## Questões em Aberto

- Distribuição exata dos itens/palavras das seções ("Operação"/"Configuração") a confirmar visualmente com o usuário na implementação.
- Destino do seletor de tenant no lazy do header vs sidebar header em mobile — validar na implementação que o drawer comporta a troca de empresa sem fricção.
- Definir contraste/ações do footer quando um usuário admin e modesto coexiste (não afeta MVP).