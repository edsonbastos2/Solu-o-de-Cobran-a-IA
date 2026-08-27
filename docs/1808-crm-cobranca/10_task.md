---
status: pending
title: Enriquecimento da página de detalhes do caso
type: frontend
complexity: medium
dependencies:
  - task_05
---

# Task 10: Enriquecimento da página de detalhes do caso

## Overview

A página de detalhes do caso (`/cases/[id]`) passa a exibir a etapa atual do CRM, a prioridade (editável), o operador responsável, o histórico de movimentação de etapa (linha do tempo) e ações rápidas (abrir conversa, transferir, mover etapa) — sem duplicar a tela de detalhes.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST exibir etapa atual (`crm_stage` com label de `CRM_STAGE_META`) e prioridade no cabeçalho de contexto do caso
- MUST permitir editar prioridade inline ( PATCH `/api/cases/[id]` com `priority`), respeitando permissão (operador: só caso atribuído a si — a UI apenas oculta/previne; backend valida)
- MUST renderizar a linha do tempo de `stage_history` (de → para, autor, motivo, data/hora relativa) em card próprio ou junto ao `AuditActivityCard` existente
- MUST ações rápidas: "Abrir conversa" (link para a Central com o caso, já existente via `ConversationSummaryCard`), "Transferir" (reutiliza `CrmTransferDialog` do board) e "Mover etapa" (menu com etapas permitidas por `canTransition`, chamando `PATCH /api/cases/[id]/stage`)
- MUST atualizar os dados após ação (revalidação SWR/refresh no padrão da página)
- MUST a página manter os cards existentes intactos (estágio IA, resumo, contexto financeiro, jurídico, negociações, insights, auditoria)
</requirements>

## Subtasks
- [ ] 10.1 Badge de etapa CRM + prioridade editável no cabeçalho
- [ ] 10.2 Linha do tempo do histórico de etapa
- [ ] 10.3 Ações rápidas (mover etapa, transferir) reutilizando componentes do CRM
- [ ] 10.4 Testes

## Implementation Details

Enrich incrementally — the page is 1000+ lines of stacked cards; add a compact CRM context block and a history card following the existing card patterns (`AuditActivityCard`, `ObligationContextCard`). Reuse `CrmTransferDialog` and the stage-move menu logic (extracted or imported from `components/crm/`). See TechSpec "Análise de Impacto" e PRD seção 11.

### Relevant Files
- `app/(dashboard)/cases/[id]/page.tsx` — página a enriquecer
- `components/cases/` — padrões de cards existentes
- `components/crm/crm-transfer-dialog.tsx`, `lib/crm/stages.ts` — reuso
- `hooks/useAuth.ts` — perfil/role para UX de permissão

### Dependent Files
- — 

### Related ADRs
- [ADR-001](../adrs/adr-001.md)

## Deliverables
- Página de detalhes enriquecida + testes das partes novas

## Tests
- Unit tests:
  - [ ] Badge de etapa exibe label correto do `CRM_STAGE_META`
  - [ ] Edição de prioridade chama PATCH com valor válido e reflete no UI
  - [ ] Linha do tempo renderiza entradas de `stage_history` com de → para, autor e motivo
  - [ ] Menu "Mover etapa" lista apenas transições permitidas a partir da etapa atual
  - [ ] Erro do PATCH (403/409) exibe feedback sem corromper o estado da página
- Integration tests:
  - [ ] N/A (checklist manual na página real)
- Test coverage target: >=80% das partes novas
- All tests must pass

## Success Criteria
- All tests passing; operador consegue mover etapa e transferir a partir do detalhe do caso
- Nenhum card existente regrediu
