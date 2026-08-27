# CRM de Cobrança — Task List

Specs: [PRD](prd.md) · [TechSpec](techspec.md) · ADRs em [adrs/](adrs/)

## Tasks

| # | Title | Status | Complexity | Dependencies |
|---|-------|--------|------------|--------------|
| 01 | Migração SQL `supabase_crm_board.sql` + domínio de etapas `lib/crm/stages.ts` + tipos TS | completed | medium | — |
| 02 | `lib/crm/stage-service.ts` + `PATCH /api/cases/[id]/stage` | completed | high | task_01 |
| 03 | `lib/crm/board-service.ts` + `GET /api/crm/board` + `GET /api/crm/stats` | completed | high | task_01 |
| 04 | Transferência 1807 estendida (operador titular pode transferir) | completed | medium | task_01 |
| 05 | `PATCH /api/cases/[id]` com `priority` + GET estendido (`stage_history`) | completed | medium | task_01 |
| 06 | `@dnd-kit` + hooks `use-crm-board`/`use-crm-stats` (SWR, realtime, move otimista) | pending | high | task_02, task_03 |
| 07 | Componentes de filtros + stats (`CrmFilters`, `CrmStats`) | pending | medium | task_06 |
| 08 | Componentes do board (`CrmBoard`, `CrmColumn`, `CrmCaseCard`, `CrmCardActions`, `CrmTransferDialog`) | pending | high | task_06, task_07 |
| 09 | Página `/crm` + navegação | pending | medium | task_07, task_08 |
| 10 | Enriquecimento da página de detalhes do caso | pending | medium | task_05 |

## Ordem de execução

```
01 (SQL+domínio) ─┬─> 02 (stage service/API) ──┐
                  ├─> 03 (board service/API) ──┼─> 06 (dnd-kit+hooks) ─> 07 (filtros/stats) ─> 08 (board) ─> 09 (página)
                  ├─> 04 (transferência)       │
                  └─> 05 (priority+GET) ───────────────────────────────────────────────────────────────> 10 (detalhe do caso)
```
