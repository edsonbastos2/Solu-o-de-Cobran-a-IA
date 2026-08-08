---
status: done
title: Garantir a11y, responsividade e preservação do tour guiado
type: frontend
complexity: low
dependencies:
  - task_5
---

# Garantir a11y, responsividade e preservação do tour guiado

## Visão Geral

Polimento final: garante acessibilidade de teclado no drawer (foco, Escape), `aria` corretos em todos os triggers, tooltips nos itens do Ickes sidebar colapsado e a preservação de todos os `data-tour` do tour guiado. Revisa contraste em + dark.

## Requisitos

1. O drawer mobile DEVE abrir com foco gerenciado, fechar com `Esc` e retornar o foco ao trigger.
2. `aria-label`, `aria-expanded`, `aria-modal` DEVEM estar corretos no drawer e no trigger.
3. Em sidebar colapsado (ícones), `SidebarMenuButton` DEVE exibir tooltip com o label (ex.: atributo `title` ou overlay leve), conforme estilo do shadcn.
4. Todos os `data-tour` DEVERÃO continuar resolvendo: `mobile-menu-trigger`, `app-logo`, `agents-nav-desktop`, `agents-nav-mobile`, `policies-nav-desktop`, `policies-nav-mobile`, `header-settings`, `guided-tour-trigger`.
5. Estado `active` deve manter contraste AA sobre fundo dark (emerald/dark conforme app).
6. Ao navegar por item do drawer, `setOpenMobile(false)` deve disparar (sem regressão).

## Subtasks

- [ ] 6.1 Revisar foco/Esc/aria do drawer mobile.
- [ ] 6.2 Adicionar tooltips para itens em estado colapsado.
- [ ] 6.3 Conferir que todos os `data-tour` resolvem no DOM.
- [ ] 6.4 Ajustar contraste de itens ativos (emerald/dark).
- [ ] 6.5 Rodar `npx tsc --noEmit` e corrigir.

## Detalhes de Implementação

- Arquivos: `components/ui/sidebar.tsx`, `components/app-sidebar.tsx`, `components/header.tsx`.
- Referência TechSpec: "Pontos de Integração" (tour) e "Strategia de Teste" (a11y).
- Conferir seletores em `components/guided-tour.tsx`.

### Arquivos Relevantes
- `components/guided-tour.tsx` — define os `[data-tour=...]` seletores.
- `components/ui/sidebar.tsx` — gerência de foco/aria/drawer.
- `components/app-sidebar.tsx` — tooltips e itens colapsados.

### Arquivos Dependentes
- Nenhum — polimento sobre o shell já montado.

### ADRs Relacionados
- [ADR-001: Shell shadcn do zero](../adrs/adr-001.md) — a11y/teclado como requisito de produto.

## Entregáveis

- Drawer acessível (foco, Esc, aria) e tooltips.
- Todos os `data-tour` preservados (prova manual).
- Validação: `npx tsc --noEmit` **(REQUERIDO)**; `npm run lint` **(REQUERIDO)**.

## Testes

- Unitários (via build/lint):
  - [ ] `npx tsc --noEmit` compila sem erros.
- Integração/manual:
  - [ ] Tab percorre os itens; Esc fecha o drawer; foco volta ao trigger.
  - [ ] Tooltip aparece em ícone colapsado.
  - [ ] Tour guiado dispara e encontra todos os pontos.
- Target de cobertura: não aplicável (sem suite).

## Critérios de Sucesso

- Navegação por teclado funcional.
- Tooltips em estado colapsado.
- Tour guiado sem regressão.