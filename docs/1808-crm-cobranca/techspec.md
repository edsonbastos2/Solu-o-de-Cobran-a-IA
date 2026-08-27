# TechSpec: CRM de Cobrança — Board Kanban

## Resumo Executivo

O CRM é implementado como um módulo novo (`/crm`) sobre os casos de cobrança existentes (ADR-001 do PRD): duas colunas novas em `cases` (`crm_stage`, `priority`), uma tabela de histórico dedicada (`case_stage_history` — ADR-002), etapas/transições/sincronização etapa↔status como domínio em código (`lib/crm/stages.ts`), leitura agregada e indicadores em endpoints dedicados `/api/crm/*`, movimentação de etapa em `PATCH /api/cases/[id]/stage` com concorrência otimista via `expectedStageId`, e transferência reutilizando o mecanismo da Central de Conversas com permissão relaxada (ADR-003). O frontend usa `@dnd-kit` (ADR-004) com atualização otimista e rollback, alternativa por teclado/menu, SWR + Realtime no padrão do projeto.

**Trade-off principal:** a extensão da permissão de transferência da 1807 (operador titular passa a poder transferir) toca código em produção validado — risco de regressão na Central mitigado por testes cobrindo operador titular, operador não titular e gestor.

## Arquitetura do Sistema

### Visão de Componentes

| Componente | Responsabilidade | Fronteira |
|---|---|---|
| `app/(dashboard)/crm/page.tsx` | Página-shell do CRM | Renderiza board, stats e filtros |
| `components/crm/*` | UI pura: board, colunas, card, filtros, stats, diálogo de transferência, ações do card | Sem acesso a dados/regras; recebe props de hooks |
| `hooks/use-crm-board.ts`, `hooks/use-crm-stats.ts` | Data fetching (SWR), realtime, movimentação otimista com rollback | Única ponte UI ↔ API |
| `app/api/crm/board/route.ts`, `app/api/crm/stats/route.ts` | Leitura agregada do board e indicadores | Chamam `lib/crm/board-service.ts` |
| `app/api/cases/[id]/stage/route.ts` | Movimentação de etapa (operação de domínio) | Chama `lib/crm/stage-service.ts` |
| `lib/crm/stages.ts` | Domínio: etapas, transições, sincronização etapa↔status | Puro, sem I/O; consumido por API e UI |
| `lib/crm/board-service.ts` | Consulta agregada (colunas paginadas, totais, indicadores) | Lê `cases`, `clients`, `financial_titles`, `messages`, `negotiations` |
| `lib/crm/stage-service.ts` | Movimentação: validações (tenant/role/posse/transição/concorrência), histórico, auditoria, sincronização | Escreve em `cases`, `case_stage_history`, `audit_logs` |
| `app/api/conversations/[caseId]/transfer/route.ts` + `lib/conversation-service.ts` | Transferência (1807) estendida: operador titular pode transferir | Única via de transferência |
| `app/(dashboard)/cases/[id]/page.tsx` | Detalhe do caso enriquecido: etapa, prioridade, histórico de movimentação, ações | — |
| `lib/navigation.ts` | Item "CRM" no menu | — |

**Fluxo de dados (movimentação):** drop no card → `useCrmBoard().moveCase()` → mutação otimista SWR → `PATCH /api/cases/[id]/stage` → `stage-service` valida → atualiza `crm_stage`+`status` → grava `case_stage_history` + `audit_logs` → realtime (`postgres_changes` em `cases`) revalida o board dos outros operadores.

## Design de Implementação

### Interfaces Principais

```typescript
// lib/crm/stages.ts
export const CRM_STAGES = [
  'NOVO', 'EM_CONTATO', 'EM_NEGOCIACAO', 'AGUARDANDO_PAGAMENTO',
  'PAGAMENTO_CONFIRMADO', 'NEGOCIACAO_CONCLUIDA',
  'SEM_CONTATO', 'NEGOCIACAO_RECUSADA', 'PROMESSA_NAO_CUMPRIDA',
  'ESCALADO', 'ENCERRADO',
] as const;
export type CrmStage = (typeof CRM_STAGES)[number];

export interface CrmStageMeta {
  id: CrmStage; label: string; kind: 'flow' | 'exception'; order: number;
}

export function canTransition(from: CrmStage, to: CrmStage): boolean;
export function statusForStage(stage: CrmStage): CaseStatus; // regra de sincronização
export const CRM_STAGE_META: CrmStageMeta[]; // colunas do board em ordem
```

```typescript
// lib/crm/stage-service.ts
export type StageActionResult =
  | { ok: true; case: Case }
  | { ok: false; error_code: 'NOT_FOUND' | 'FORBIDDEN' | 'INVALID_TRANSITION'
                        | 'STAGE_CONFLICT' | 'VALIDATION_ERROR'; message: string };

export async function moveCaseStage(db, ctx: TenantContext, caseId: string,
  input: { stageId: CrmStage; expectedStageId?: CrmStage; reason?: string }
): Promise<StageActionResult>;
```

```typescript
// lib/types.ts (novos tipos de leitura)
export interface CrmBoardCase {
  id: string; caseNumber: string; clientName: string; clientDocumentMasked: string;
  currentValue: number; dueDate: string; lastContactAt: string | null;
  controller: 'ai' | 'human' | null; priority: 'alta' | 'media' | 'baixa';
  assignee: { id: string; name: string } | null;
}
export interface CrmBoardColumn { stage: CrmStage; total: number; page: number; totalPages: number; cases: CrmBoardCase[]; }
export interface CrmStats { totalCases; negotiating; awaitingPayment; negotiationsCreated; negotiationsAccepted; promises; paymentsConfirmed; recoveredValue: number; }
```

### Modelo de Dados

Migração `supabase_crm_board.sql` (aplicação manual, padrão do projeto):

```sql
ALTER TABLE cases
  ADD COLUMN crm_stage TEXT CHECK (crm_stage IN ('NOVO','EM_CONTATO','EM_NEGOCIACAO',
    'AGUARDANDO_PAGAMENTO','PAGAMENTO_CONFIRMADO','NEGOCIACAO_CONCLUIDA','SEM_CONTATO',
    'NEGOCIACAO_RECUSADA','PROMESSA_NAO_CUMPRIDA','ESCALADO','ENCERRADO')) NOT NULL DEFAULT 'NOVO',
  ADD COLUMN priority TEXT CHECK (priority IN ('alta','media','baixa')) NOT NULL DEFAULT 'media';

-- Backfill por correspondência do status atual
UPDATE cases SET crm_stage = CASE status
  WHEN 'in_negotiation' THEN 'EM_NEGOCIACAO'
  WHEN 'needs_attention' THEN 'ESCALADO'
  WHEN 'closed' THEN 'ENCERRADO'
  ELSE 'NOVO' END;

CREATE TABLE case_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  changed_by UUID REFERENCES profiles(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX case_stage_history_idx ON case_stage_history (tenant_id, case_id, created_at);
CREATE INDEX cases_crm_board_idx ON cases (tenant_id, crm_stage, priority);
```

RLS em `case_stage_history` espelhando `cases` (`can_access_tenant(tenant_id)`).

**Transições permitidas** (`STAGE_TRANSITIONS` em `lib/crm/stages.ts`):
- `NOVO → EM_CONTATO | SEM_CONTATO | ESCALADO | ENCERRADO`
- `EM_CONTATO → EM_NEGOCIACAO | SEM_CONTATO | ESCALADO | ENCERRADO`
- `EM_NEGOCIACAO → AGUARDANDO_PAGAMENTO | NEGOCIACAO_RECUSADA | SEM_CONTATO | ESCALADO | ENCERRADO`
- `AGUARDANDO_PAGAMENTO → PAGAMENTO_CONFIRMADO | PROMESSA_NAO_CUMPRIDA | EM_NEGOCIACAO | ESCALADO | ENCERRADO`
- `PAGAMENTO_CONFIRMADO → NEGOCIACAO_CONCLUIDA | ENCERRADO`
- `NEGOCIACAO_CONCLUIDA → ENCERRADO`
- `SEM_CONTATO → EM_CONTATO | EM_NEGOCIACAO | ESCALADO | ENCERRADO`
- `NEGOCIACAO_RECUSADA → EM_NEGOCIACAO | ESCALADO | ENCERRADO`
- `PROMESSA_NAO_CUMPRIDA → EM_NEGOCIACAO | AGUARDANDO_PAGAMENTO | ESCALADO | ENCERRADO`
- `ESCALADO → EM_CONTATO | EM_NEGOCIACAO | ENCERRADO`
- `ENCERRADO → ∅` (terminal)

**Sincronização etapa→status** (`statusForStage`): `NOVO|EM_CONTATO|SEM_CONTATO → not_started`; `EM_NEGOCIACAO|AGUARDANDO_PAGAMENTO|NEGOCIACAO_RECUSADA|PROMESSA_NAO_CUMPRIDA → in_negotiation`; `ESCALADO → needs_attention`; `PAGAMENTO_CONFIRMADO|NEGOCIACAO_CONCLUIDA|ENCERRADO → closed`.

### Endpoints de API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/crm/board?search&operator&priority&stage&page&limit&tenant_id` | Board agregado. Sem `stage`: todas as colunas com primeiro lote (limit padrão 20) + `total`/`totalPages` reais por coluna. Com `stage`: paginação de uma coluna ("carregar mais"). `operator` (gestor+): `userId\|unassigned\|all`. Busca server-side: nome, documento, nº do caso. Escopo: operador vê só seus casos; gestor+ todos do tenant. 200 `{ columns: CrmBoardColumn[] }` |
| GET | `/api/crm/stats?tenant_id` | Indicadores no escopo de acesso: total de casos, em negociação (etapa), aguardando pagamento, negociações criadas/aceitas (`negotiations`), promessas (`AGUARDANDO_PAGAMENTO`), pagamentos confirmados, valor recuperado (soma `agreed_value` de negociações `accepted\|fulfilled`). 200 `{ stats: CrmStats }` |
| PATCH | `/api/cases/[id]/stage` | Body `{ stageId, expectedStageId?, reason? }`. Valida tenant (contexto autenticado), permissão (operador: `assigned_user_id = userId`; gestor+: qualquer), transição e concorrência (`crm_stage ≠ expectedStageId` → 409 com etapa atual). Grava `case_stage_history` + `audit_logs` (`CASE_STAGE_CHANGED`, before/after). 200 `{ case }` / 400/403/404/409 |
| PATCH | `/api/cases/[id]` (existente) | Passa a aceitar `priority` (auditoria `CASE_PRIORITY_CHANGED`) |
| POST | `/api/conversations/[caseId]/transfer` (existente, estendida) | Permissão: gestor+ **ou operador titular do caso**. Continua sendo a única via de transferência (atualiza responsável, evento `TRANSFERRED`, auditoria, `conversation_version`) |
| GET | `/api/cases/[id]` (existente) | Resposta estendida: `crm_stage`, `priority`, `stage_history: CaseStageHistoryEntry[]` |

### Frontend

- `components/crm/`: `crm-board.tsx` (composição: DndContext + colunas), `crm-column.tsx` (droppable + "carregar mais"), `crm-case-card.tsx` (card enxuto + indicadores IA/humano e prioridade), `crm-card-actions.tsx` (menu: mover etapa por teclado, transferir, abrir conversa, abrir detalhes), `crm-filters.ts` composto por `crm-operator-filter.tsx`, `crm-priority-filter.tsx`, `crm-search-input.tsx`, `crm-stats.tsx`, `crm-transfer-dialog.tsx`.
- `hooks/use-crm-board.ts`: SWR no board; `moveCase` com `mutate` otimista e `rollbackOnError`; subscription realtime (`postgres_changes` UPDATE em `cases` do tenant) revalidando o board.
- Acessibilidade: `KeyboardSensor` do dnd-kit + ação "Mover para etapa..." no menu do card; foco visível; anúncios de resultado via toast.
- Navegação: item "CRM" em `lib/navigation.ts` (seção Operação).

## Pontos de Integração

- **Central de Conversas (1807)**: "Abrir conversa" roteia para `/conversations` com o caso selecionado (parâmetro de URL já suportado pela Central); transferência compartilha endpoint.
- **Supabase Realtime**: canal `realtime-crm-board` no padrão já usado em `/cases` e no detalhe do caso.
- **Supabase Admin/Server clients**: `requireTenantContext` resolve cliente e tenant autenticado — nenhum endpoint aceita tenant do body/query sem validação (super-admin usa override `?tenant_id=` existente).

## Análise de Impacto

| Componente | Impacto | Descrição e Risco | Ação |
|---|---|---|---|
| `cases` (tabela) | modified | Colunas `crm_stage`, `priority` + backfill; risco baixo (defaults) | Migração manual |
| `app/api/cases/[id]/route.ts` | modified | PATCH aceita `priority`; GET retorna etapa/prioridade/histórico | Estender com validação e auditoria |
| `app/api/conversations/[caseId]/transfer/route.ts`, `lib/conversation-service.ts` | modified | Permissão relaxada; risco de regressão na Central | Testes de permissão (titular/não titular/gestor) |
| `app/(dashboard)/cases/[id]/page.tsx` | modified | Etapa, prioridade, histórico de movimentação, ações | Enriquecimento incremental |
| `lib/navigation.ts` | modified | Novo item "CRM" | Baixo |
| `package.json` | modified | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` | Instalação npm |
| Novos arquivos (`lib/crm/`, `app/api/crm/`, `components/crm/`, `hooks/use-crm-*`, `app/(dashboard)/crm/`) | new | Módulo do CRM | — |

## Abordagem de Testes

### Testes Unitários (Vitest, padrão 1807)

- `lib/crm/stages.ts`: transições permitidas/proibidas (todas as arestas), sincronização etapa→status, metadados de colunas.
- `lib/crm/stage-service.ts` (db mockado): operador titular/não titular, gestor, transição inválida, `expectedStageId` divergente (409), gravação de histórico e auditoria.
- Componentes (`components/crm/`): board renderiza colunas/cards; card indica IA/humano e prioridade; filtros compõem query params; diálogo de transferência valida obrigatórios.

### Testes de Integração

- `PATCH /api/cases/[id]/stage`: fluxo feliz, 403, 409, 404, caso de outro tenant (isolamento).
- Transferência estendida: operador titular transfere (200), operador não titular (403), gestor (200).

## Sequenciamento de Desenvolvimento

### Ordem de Build

1. Migração `supabase_crm_board.sql` + `lib/crm/stages.ts` + tipos em `lib/types.ts` — sem dependências.
2. `lib/crm/stage-service.ts` + `PATCH /api/cases/[id]/stage` + testes — depende de 1.
3. `lib/crm/board-service.ts` + `GET /api/crm/board` + `GET /api/crm/stats` — depende de 1.
4. Extensão da transferência 1807 (permissão) + testes — depende de 1 (roles).
5. `PATCH /api/cases/[id]` com `priority` + GET estendido — depende de 1.
6. Instalar `@dnd-kit` + `hooks/use-crm-board.ts`/`use-crm-stats.ts` + `components/crm/` (filtros, stats, board com DnD otimista, card, ações, diálogo) + `app/(dashboard)/crm/page.tsx` + `lib/navigation.ts` — depende de 2 e 3.
7. Realtime do board + enriquecimento da página de detalhes do caso (etapa/prioridade/histórico/ações) — depende de 6 e 5.
8. Verificação final: `npm run lint`, `npm run build`, testes Vitest — depende de todos.

### Dependências Técnicas

- Migração aplicada ao Supabase antes dos testes de integração.
- `@dnd-kit/*` compatível com React 19 (verificar versões no install).

## Monitoramento e Observabilidade

- Toda mutação audita em `audit_logs` (`CASE_STAGE_CHANGED`, `CASE_PRIORITY_CHANGED`, `CASE_TRANSFERRED`) com before/after — rastreável por caso/tenant.
- Erros de API com `error_code` estável para telemetria e feedback de UI.
- Métricas futuras de tempo por etapa derivam de `case_stage_history` (sem instrumentação extra agora).

## Considerações Técnicas

### Decisões Chave

Cobertas pelos ADRs 002 (domínio em código + tabela de histórico), 003 (API dedicada + `expectedStageId` + transferência reutilizada) e 004 (`@dnd-kit`).

### Riscos Conhecidos

- **Consulta do board** (joins caso+cliente+título+última mensagem por coluna): mitido por índice `cases_crm_board_idx`, paginação por coluna e `limit` por padrão.
- **Regressão na permissão de transferência da 1807**: testes específicos de permissão antes de tocar o endpoint.
- **Realtime revalidando em excesso** (qualquer UPDATE de caso): revalidação debounced no hook, padrão já usado na lista de casos.

## Registros de Decisão de Arquitetura

- [ADR-001: Kanban operacional sobre os casos existentes com etapa CRM própria sincronizada](adrs/adr-001.md) — CRM como visão operacional dos casos; etapa nova sincronizada com status.
- [ADR-002: Etapas e transições como domínio em código, com tabela dedicada de histórico](adrs/adr-002.md) — `lib/crm/stages.ts` + `case_stage_history`.
- [ADR-003: API dedicada /api/crm, movimentação com expectedStageId e transferência reutilizando a 1807](adrs/adr-003.md) — Contratos próprios para board/stats/stage; concorrência otimista.
- [ADR-004: @dnd-kit para o drag-and-drop do Kanban](adrs/adr-004.md) — Acessível por teclado, update otimista com rollback.
