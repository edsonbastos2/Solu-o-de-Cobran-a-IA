---
status: completed
title: Migração SQL `supabase_crm_board.sql` + domínio de etapas `lib/crm/stages.ts` + tipos TS
type: backend
complexity: medium
dependencies: []
---

# Task 01: Migração SQL + domínio de etapas + tipos TS

## Overview

Fundação do CRM: colunas `crm_stage` e `priority` em `cases` com backfill, tabela de histórico `case_stage_history` com RLS, e o módulo de domínio puro das etapas (metadados, transições permitidas, sincronização etapa↔status) que API e UI consumirão. Sem dependências de outras tarefas.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST criar migração `supabase_crm_board.sql` na raiz do projeto com o DDL exato da seção "Modelo de Dados" do TechSpec (colunas com CHECK, backfill por status, tabela `case_stage_history`, índices `case_stage_history_idx` e `cases_crm_board_idx`)
- MUST aplicar RLS em `case_stage_history` espelhando a policy de `cases` (`can_access_tenant(tenant_id)`), incluindo INSERT com `changed_by = auth.uid()` na policy de escrita
- MUST implementar `lib/crm/stages.ts` conforme a seção "Interfaces Principais" do TechSpec: `CRM_STAGES`, `CrmStage`, `CrmStageMeta`, `CRM_STAGE_META` (ordem das colunas do board, `kind: flow|exception`), `STAGE_TRANSITIONS`, `canTransition`, `statusForStage`, além de `CRM_PRIORITIES` (`alta|media|baixa`)
- MUST o mapa de transições e a sincronização etapa→status refletirem exatamente as listas da seção "Modelo de Dados" do TechSpec
- MUST adicionar em `lib/types.ts` os tipos de leitura do TechSpec (`CrmBoardCase`, `CrmBoardColumn`, `CrmStats`, `CaseStageHistoryEntry`) e estender `Case`/`CaseDetailsResponse` com `crm_stage` e `priority`
- SHOULD o módulo ser puro (sem I/O, sem import de Supabase) para consumo seguro por componentes de UI
</requirements>

## Subtasks
- [ ] 1.1 Migração SQL (DDL + backfill + RLS + índices) e aplicação manual ao Supabase
- [ ] 1.2 `lib/crm/stages.ts` com metadados, transições, sincronização e prioridades
- [ ] 1.3 Tipos TS em `lib/types.ts`
- [ ] 1.4 Testes unitários do domínio (transições e sincronização)

## Implementation Details

Migration file at project root following `supabase_*.sql` convention (manual application — document the file in the same style as previous migrations). Domain module in `lib/crm/stages.ts` as pure constants/functions. See TechSpec sections "Interfaces Principais" and "Modelo de Dados".

### Relevant Files
- `supabase_conversations.sql`, `supabase_collection_case_core.sql` — padrão de migração e de RLS/trigger
- `lib/types.ts` — tipos existentes de `Case` e `CaseDetailsResponse`
- `lib/finance.ts` — exemplo de módulo de domínio puro com estágios derivados

### Dependent Files
- Tasks 02–10 (todas consomem os tipos e o domínio de etapas)

### Related ADRs
- [ADR-002: Domínio em código + tabela dedicada de histórico](../adrs/adr-002.md)

## Deliverables
- `supabase_crm_board.sql` aplicado
- `lib/crm/stages.ts` + `lib/types.ts` estendidos
- Testes unitários `lib/crm/stages.test.ts`

## Tests
- Unit tests:
  - [ ] `canTransition`: todas as arestas permitidas do TechSpec retornam true
  - [ ] `canTransition`: transições proibidas retornam false (ex.: `PAGAMENTO_CONFIRMADO → NOVO`, `ENCERRADO → EM_NEGOCIACAO`, qualquer saída de `ENCERRADO`)
  - [ ] `statusForStage`: mapeia os 11 estágios para os 4 statuses conforme TechSpec
  - [ ] `CRM_STAGE_META`: 11 entradas, ordem correta (fluxo antes das exceções), labels em pt-BR
- Integration tests:
  - [ ] N/A (validação da migração via checklist manual no Supabase Studio)
- Test coverage target: >=80% do `lib/crm/stages.ts`
- All tests must pass

## Success Criteria
- All tests passing; migração aplicada sem erro
- Nenhum componente futuro precisa conhecer transições fora de `lib/crm/stages.ts`
