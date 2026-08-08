# Sidebar de Navegação — Lista de Tarefas

## Tasks

| # | Título | Status | Complexidade | Dependências |
|---|---|---|---|---|
| 1 | Criar config de navegação `lib/navigation.ts` | done | low | — |
| 2 | Implementar primitivas do sidebar em `components/ui/sidebar.tsx` | done | high | 1 |
| 3 | Implementar `components/app-sidebar.tsx` (config-driven) | done | medium | 1, 2 |
| 4 | Criar route group `(dashboard)` e mover páginas autenticadas | done | high | 2, 3 |
| 5 | Refatorar `components/header.tsx` para header slim | done | medium | 4 |
| 6 | Garantir a11y, responsividade e preservação do tour guiado | done | low | 5 |
| 7 | Validação final: typecheck, lint, build e checklist manual | done | low | 6 |