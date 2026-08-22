# Central de Conversas — Task List

Specs: [PRD](prd.md) · [TechSpec](techspec.md) · ADRs em [adrs/](adrs/)

## Tasks

| # | Title | Status | Complexity | Dependencies |
|---|-------|--------|------------|--------------|
| 01 | Infraestrutura de testes (Vitest + RTL + jsdom) | completed | low | — |
| 02 | Migração SQL `supabase_conversations.sql` + tipos TS de conversa | completed | medium | — |
| 03 | `lib/conversation-service.ts` — domínio da conversa | completed | high | task_01, task_02 |
| 04 | Pipeline respeita o condutor explícito | completed | high | task_03 |
| 05 | API de leitura `/api/conversations` | completed | high | task_03 |
| 06 | API de ações (takeover, return-to-ai, transfer, read) | completed | high | task_05 |
| 07 | Hooks de dados da Central | completed | medium | task_05, task_06 |
| 08 | Componentes de lista de conversas | completed | high | task_07 |
| 09 | Componentes da janela de conversa | completed | high | task_07 |
| 10 | Página `/conversations` + navegação | completed | high | task_08, task_09 |
| 11 | Refatoração da página de caso (chat → Central) | completed | medium | task_10 |

## Ordem de execução

```
01 (testes) ─┐
02 (SQL/tipos) ─┴─> 03 (domínio) ─> 04 (pipeline)
                          │
                          └─> 05 (API leitura) ─> 06 (API ações) ─> 07 (hooks) ─┬─> 08 (lista) ──┐
                                                                                    └─> 09 (chat) ────┤
                                                                                                      └─> 10 (página) ─> 11 (refatoração caso)
```
