---
status: pending
title: "Componentes do board (`CrmBoard`, `CrmColumn`, `CrmCaseCard`, `CrmCardActions`, `CrmTransferDialog`)"
type: frontend
complexity: high
dependencies:
  - task_06
  - task_07
---

# Task 08: Componentes do board Kanban

## Overview

A interface do Kanban: board com `@dnd-kit` (DndContext + colunas droppable), card enxuto com indicadores (IA/humano, prioridade), ações do card (mover por teclado/menu, transferir, abrir conversa, abrir detalhes) e diálogo de transferência. UI pura — dados e regras vêm dos hooks e do domínio.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST `components/crm/crm-board.tsx` compor `DndContext` (PointerSensor + `KeyboardSensor` com coordenadas acessíveis) e renderizar as colunas a partir de `CRM_STAGE_META` — nunca lista hardcoded de etapas no componente
- MUST `crm-column.tsx` ser droppable por etapa: header com label, contagem real (`total`) e visualização distinta para colunas de exceção (`kind: 'exception'`); botão "Carregar mais" quando `page < totalPages`
- MUST `crm-case-card.tsx` exibir: nº do caso, indicador de prioridade, nome do cliente, documento mascarado, valor da dívida (moeda pt-BR), vencimento, último contato (relativo), badge IA 🤖/humano 👤 (via `controller`) e operador responsável quando informado
- MUST drag-and-drop acessível: `KeyboardSensor` do dnd-kit ativo + alternativa textual via `CrmCardActions` ("Mover para etapa..." com apenas as etapas permitidas por `canTransition`)
- MUST `crm-card-actions.tsx` oferecer: mover etapa, transferir (abre `CrmTransferDialog`), abrir conversa (link para `/conversations` com o caso selecionado), abrir detalhes (link para `/cases/[id]`)
- MUST `crm-transfer-dialog.tsx` coletar operador destino (lista via prop) e motivo opcional, enviando `expectedVersion` (buscado do detalhe do caso) ao endpoint de transferência da 1807; feedback de sucesso/erro com mensagem clara
- MUST o board não conhecer API, autenticação, regras de negócio, negociação, transferência ou chat — apenas composição (requisito do PRD "Componentização"); toda ação delegada via callbacks/props dos hooks
- MUST feedback de erro de movimentação visível (ex.: toast) incluindo o caso 409 ("caso atualizado por outro operador — atualizando board")
</requirements>

## Subtasks
- [ ] 8.1 `crm-board.tsx` com DndContext + colunas a partir dos metadados
- [ ] 8.2 `crm-column.tsx` (droppable, contagem, exceções, carregar mais)
- [ ] 8.3 `crm-case-card.tsx` (informações do card + drag handle)
- [ ] 8.4 `crm-card-actions.tsx` (menu acessível de ações + mover por teclado)
- [ ] 8.5 `crm-transfer-dialog.tsx`
- [ ] 8.6 Testes de renderização, interação e acessibilidade

## Implementation Details

Cards use `useSortable` (dnd-kit); columns use `useDroppable` keyed by `CrmStage`. Visual language follows `components/conversations/*` (badges, empty states, dialogs). Optimistic move is already in the hook (task 06) — board only calls `moveCase`. See TechSpec section "Frontend" e PRD seções 9, 10 e 18.

### Relevant Files
- `components/conversations/transfer-dialog.tsx` — padrão de diálogo de transferência
- `components/conversations/message-bubble.tsx`, `conversation-list-item.tsx` — padrões visuais de badges/itens
- `lib/crm/stages.ts` — `CRM_STAGE_META`, `canTransition` (etapas permitidas no menu)
- `hooks/use-crm-board.ts` — `moveCase`, `loadMore` (task 06)

### Dependent Files
- Task 09 (página compõe o board)

### Related ADRs
- [ADR-004: @dnd-kit](../adrs/adr-004.md)
- [ADR-001](../adrs/adr-001.md)

## Deliverables
- 5 componentes em `components/crm/` + testes co-localizados

## Tests
- Unit tests:
  - [ ] Board renderiza 11 colunas na ordem de `CRM_STAGE_META`, com header e contagem
  - [ ] Coluna de exceção recebe estilo distinto de coluna de fluxo
  - [ ] Card exibe valor formatado, documento mascarado, badge IA/humano e prioridade
  - [ ] Card sem `assignee` não renderiza operador
  - [ ] "Carregar mais" visível apenas quando `page < totalPages` e chama `loadMore(stage)`
  - [ ] Menu "Mover para etapa..." lista apenas etapas permitidas por `canTransition` a partir da etapa atual
  - [ ] Diálogo de transferência exige operador; motivo opcional; envia `expectedVersion`
  - [ ] Simulação de drop em coluna chama `moveCase` com a etapa destino
  - [ ] Movimentação com erro exibe feedback e o card permanece na coluna original (rollback)
- Integration tests:
  - [ ] N/A (e2e manual na task 09)
- Test coverage target: >=80% dos componentes
- All tests must pass

## Success Criteria
- All tests passing; mover caso funciona por mouse e por teclado/menu
- Nenhuma regra de transição, permissão ou chamada de API dentro dos componentes de UI
