# TechSpec: Central de Conversas de Cobrança

## Resumo Executivo

A Central de Conversas é implementada como um módulo novo (`/conversations`) sobre o caso de cobrança existente (ADR-001): duas colunas novas em `cases` (`controller`, `conversation_version`), duas tabelas de apoio (`conversation_events`, `conversation_reads` — ADR-002), um recurso REST dedicado `/api/conversations` para leitura agregada e ações com concorrência otimista (ADR-003), e um pipeline de IA ajustado para pausar/retomar por condutor explícito. O frontend extrai o chat da página de caso para componentes reutilizáveis em `components/conversations/` com hooks SWR + realtime no padrão já usado pelo projeto. Introduz-se Vitest + RTL como primeira suite de testes (ADR-004).

**Trade-off principal:** tocar o pipeline de IA em produção (`inbound.ts`, `agent-message`, crons) para respeitar o condutor explícito — risco de regressão em casos legados, mitigado por derivação retrocompatível (`controller IS NULL` → status atual) e testes.

## Arquitetura do Sistema

### Visão de Componentes

| Componente | Responsabilidade | Fronteira |
|---|---|---|
| `app/(dashboard)/conversations/page.tsx` | Página-shell da Central (3 colunas responsivas) | Renderiza `ConversationsPage` |
| `components/conversations/*` | UI pura: lista, filtros, chat, composer, takeover, transferência, contexto | Sem acesso a dados; recebe props de hooks |
| `hooks/use-conversations.ts`, `hooks/use-conversation.ts` | Data fetching (SWR), realtime subscription, ações (takeover/return/transfer/read/send) | Única ponte UI ↔ API |
| `app/api/conversations/*` | Rotas REST: lista agregada, detalhe, ações | Chamam `lib/conversation-service.ts` |
| `lib/conversation-service.ts` | Domínio: transições de condutor, eventos, validações (permissão/tenant/concorrência), query agregada | Escreve em `cases`, `conversation_events`, `conversation_reads`, `audit_logs` |
| `lib/types.ts` | Tipos do domínio de conversa | Compartilhado |
| `lib/channels/inbound.ts`, `lib/agent.ts`, crons | Pipeline existente, ajustado a respeitar `controller` | Lê `cases.controller` |
| `app/(dashboard)/cases/[id]/page.tsx` | Perde o painel de chat; ganha link "Abrir conversa" | — |
| `lib/navigation.ts` | Item "Conversas" na seção Operação | — |

**Fluxo de dados (mensagem do devedor):** webhook → `processInboundEvent` → persiste `messages` + `conversation_events(MESSAGE_RECEIVED)` → se `controller='ai'` → `processChat` → resposta IA via `sendCaseMessage`. Realtime (`postgres_changes` em `messages`/`cases`) revalida SWR na Central.

## Design de Implementação

### Interfaces Principais

```typescript
// lib/types.ts
export type ConversationController = 'ai' | 'human';

export type ConversationEventType =
  | 'MESSAGE_RECEIVED' | 'HUMAN_TAKEOVER' | 'RETURNED_TO_AI'
  | 'TRANSFERRED' | 'NEGOTIATION_CREATED' | 'PROPOSAL_ACCEPTED'
  | 'PROPOSAL_REJECTED' | 'CONVERSATION_COMPLETED';

export interface ConversationEvent {
  id: string;
  tenant_id: string;
  case_id: string;
  type: ConversationEventType;
  performed_by?: string | null;      // profiles.id
  payload?: Record<string, unknown>; // { fromOperatorId, toOperatorId, reason }
  created_at: string;
}

export interface ConversationListItem {
  case: Case;
  lastMessage: Pick<Message, 'role' | 'content' | 'created_at' | 'send_status'> | null;
  controller: ConversationController;
  currentOperator: { id: string; name: string } | null;
  channel: 'whatsapp' | 'telegram' | null;
  unreadCount: number;
}

export interface ConversationPermissions {
  canView: boolean;      // todos os membros
  canSend: boolean;      // humano conduz + (atribuído a mim || role >= gestor)
  canTakeOver: boolean;  // qualquer membro ativo
  canReturnToAI: boolean;
  canTransfer: boolean;  // role >= gestor
  canComplete: boolean;  // role >= admin
}
```

```typescript
// lib/conversation-service.ts (assinaturas principais)
export async function listConversations(db, tenantId, userId, params: ConversationListParams): Promise<ConversationsListResponse>;
export async function getConversation(db, tenantId, userId, caseId): Promise<ConversationDetailResponse | null>;
export async function takeOverConversation(db, tenantId, userId, caseId, expectedVersion): Promise<ConversationActionResult>;
export async function returnConversationToAI(db, tenantId, userId, caseId, expectedVersion): Promise<ConversationActionResult>;
export async function transferConversation(db, tenantId, userId, caseId, { toOperatorId, reason, expectedVersion }): Promise<ConversationActionResult>;
```

`ConversationActionResult` = `{ ok: true; conversation: ConversationDetail } | { ok: false; error_code: 'NOT_FOUND' | 'FORBIDDEN' | 'VERSION_CONFLICT' | 'INVALID_STATE' | 'INVALID_OPERATOR' }`.

### Modelo de Dados

Migração `supabase_conversations.sql` (aplicação manual, padrão do projeto):

```sql
ALTER TABLE cases
  ADD COLUMN controller TEXT CHECK (controller IN ('ai','human')),
  ADD COLUMN conversation_version INTEGER NOT NULL DEFAULT 1;

-- Backfill: preserva semântica atual do pipeline
UPDATE cases SET controller = CASE WHEN status = 'needs_attention' THEN 'human' ELSE 'ai' END;

CREATE TABLE conversation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  performed_by UUID REFERENCES profiles(id),
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX conversation_events_case_idx ON conversation_events (tenant_id, case_id, created_at);

CREATE TABLE conversation_reads (
  tenant_id UUID NOT NULL,
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, case_id, user_id)
);
```

RLS nas duas tabelas espelhando `messages` (isolamento por `can_access_tenant`). Não lidas = `messages` com `role='user'` e `created_at > last_read_at` (sem row = tudo não lido).

### Endpoints de API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/conversations?page&limit&search&filter&assignee&tenant_id` | Lista paginada server-side. `filter`: `all\|unread\|ai\|human\|waiting_debtor\|waiting_operator\|negotiating\|closed\|mine`. `assignee` (gestor+): `userId\|unassigned\|ai`. Busca: nome, documento, nº contrato, nº cobrança, conteúdo de mensagem (debounce 300ms no cliente). 200 `{conversations, total, page, totalPages}` |
| GET | `/api/conversations/[caseId]` | Detalhe: mensagens (asc), eventos, caso+cliente+contrato+título+negociação, permissões derivadas, `conversation_version`, não lidas. 200/404 |
| POST | `/api/conversations/[caseId]/takeover` | Body `{expectedVersion}`. Seta `controller='human'`, `assigned_user_id=userId`, `conversation_version+1`, evento `HUMAN_TAKEOVER`, auditoria. 200/404/403/409 |
| POST | `/api/conversations/[caseId]/return-to-ai` | Body `{expectedVersion}`. Seta `controller='ai'`, `assigned_user_id=null`, evento `RETURNED_TO_AI`. IA **não** dispara mensagem automática; retoma na próxima mensagem do devedor. 200/403/409 |
| POST | `/api/conversations/[caseId]/transfer` | Body `{toOperatorId, reason?, expectedVersion}`. `requireRole('gestor')`. Valida destinatário (mesmo tenant, `tenant_members.status='active'`, role apta), `controller` permanece `human`. Evento `TRANSFERRED` com payload de/para/motivo + auditoria. 200/403/404/409 |
| POST | `/api/conversations/[caseId]/read` | Upsert `conversation_reads.last_read_at=now()`. 200 |

Concorrência otimista: todo UPDATE de ação inclui `.eq('conversation_version', expectedVersion)`; zero linhas → `409 VERSION_CONFLICT` ("conversa alterada por outro operador"). `POST /api/agent-message` permanece o endpoint de envio humano, ajustado: quando `controller='human'`, não força `status='needs_attention'`.

**Derivação de status de espera** (sem reescrever máquina de estados): `waiting_debtor` = última mensagem do caso é do devedor... invertido — última mensagem é `ai`/`human` (aguardando resposta do devedor); `waiting_operator` = última mensagem é `user` e (`controller='human'` sem nova resposta ou `needs_attention`). Computado na query agregada.

### Ajustes no Pipeline (condutor explícito)

- `lib/channels/inbound.ts`: substitui a checagem `status==='needs_attention'` por função `isAIPaused(case)`: `controller==='human'` || (`controller IS NULL` && `status==='needs_attention'`). Pausado → persiste mensagem + evento `MESSAGE_RECEIVED` + auditoria, sem `processChat`.
- `processChat` (inbound path) e crons automatizados (follow-up, protesto, negativação): guard `isAIPaused` antes de enviar mensagem automática (skip auditado).
- Função única de transição em `lib/conversation-service.ts` — nenhum outro ponto escreve `controller`.

## Pontos de Integração

- **Supabase Realtime**: subscription `postgres_changes` em `messages` (filtro por tenant não suportado — revalidar lista inteira via `mutate()`) e `cases`; padrão idêntico ao de `cases/[id]` atual. Polling de segurança: 10s lista, 4s conversa aberta.
- **Canais** (`lib/channels/`): sem mudança — todo envio continua por `sendCaseMessage`.
- **Notificação de atribuição**: sem serviço novo — badge "Nova atribuição" derivado de `assigned_user_id === eu` + sem `conversation_reads` do destinatário + último evento `TRANSFERRED`.

## Análise de Impacto

| Componente | Impacto | Descrição e Risco | Ação |
|---|---|---|---|
| `supabase_conversations.sql` | novo | Migração manual; backfill de `controller` | Aplicar no Supabase antes do deploy |
| `lib/conversation-service.ts` | novo | Domínio central; ponto único de transição de condutor | — |
| `app/api/conversations/*` | novo | 6 rotas | — |
| `lib/channels/inbound.ts` | modificado | Critério de pausa da IA muda (risco médio) | Derivação retrocompatível + testes |
| `app/api/agent-message/route.ts` | modificado | Não forçar `needs_attention` com humano conduzindo | Teste de regressão |
| `lib/agent.ts` + crons | modificado | Guard `isAIPaused` em envios automáticos | Teste de regressão |
| `app/(dashboard)/cases/[id]/page.tsx` | modificado | Remoção do chat monolítico (~700 linhas); risco de perder ações (canal ativo, status, dossiê) | Manter ações na página; link para a Central |
| `lib/navigation.ts` | modificado | Item "Conversas" | — |
| `lib/types.ts` | modificado | Tipos novos | — |
| `package.json` | modificado | Vitest + RTL (devDeps) e scripts de teste | — |

## Estratégia de Testes

### Unitários (Vitest)

- `conversation-service` (mock do cliente Supabase): transições de condutor, `VERSION_CONFLICT`, validações de transferência (tenant/role/status), derivação de permissões por role, contagem de não lidas.
- `isAIPaused`: casos legados (NULL) vs explícitos.
- `MessageComposer`: Enter envia, Shift+Enter quebra, disabled, loading, erro com retry.
- `ConversationList`/`ListItem`: renderização, seleção, badge de não lidas, indicador de condutor.
- `ChatWindow`: bolhas por `role` (devedor/IA/humano), eventos de sistema centralizados, loading/erro/vazio.
- `TakeoverBar` + `TransferDialog`: confirmações, cancelamento, estados de erro (409).

### Integração

- Sem ambiente de integração automatizado no projeto; fluxos end-to-end validados por checklist manual (lint + build + test) no fechamento da task.

## Sequenciamento do Desenvolvimento

### Ordem de Build

1. **Migração + tipos** — `supabase_conversations.sql`, tipos em `lib/types.ts`. Sem dependências.
2. **`lib/conversation-service.ts`** — domínio + `isAIPaused`. Depende de 1.
3. **Pipeline** — `inbound.ts`, `agent-message`, crons respeitando condutor. Depende de 2.
4. **API `/api/conversations`** — 6 rotas finas sobre o service. Depende de 2.
5. **Infra de testes** — Vitest + RTL + config + scripts. Sem dependências (paralelizável com 2–4).
6. **Hooks** — `use-conversations`, `use-conversation` (SWR + realtime + ações). Depende de 4.
7. **Componentes + página** — `components/conversations/*`, `/conversations`, navigation. Depende de 6.
8. **Refatoração da página de caso** — remover chat, link para a Central. Depende de 7.
9. **Testes dos componentes/fluxos**. Depende de 5 e 7.
10. **Fechamento** — `npm run lint && npm run build && npm test`. Depende de todos.

### Dependências Técnicas

- Migração aplicada manualmente ao Supabase antes do primeiro deploy com o código novo.
- Sem dependências externas novas em runtime.

## Monitoramento e Observabilidade

- Toda ação grava `audit_logs` (`HUMAN_TAKEOVER`, `RETURNED_TO_AI`, `TRANSFERRED`) com before/after — rastreabilidade de quem/quando/para quem/por quê.
- Eventos `VERSION_CONFLICT` (409) monitoráveis via logs de rota; frequência alta indica contenção real de operadores.

## Considerações Técnicas

### Decisões-Chave

- **Concorrência otimista por versão** em vez de locks/transações complexas: operações raras e humanas; conflito resolvido com refresh. Alternativa rejeitada: locking pessimista (overkill).
- **Não lidas por `last_read_at`** em vez de receipts por mensagem: uma row por operador/conversa, contagem por comparação de timestamp. Alternativa rejeitada: tabela de leitura por mensagem (volume alto, sem caso de uso).
- **Transferência não desperta a IA**: entre humanos, `controller` permanece `human` (requisito explícito do PRD).
- **Realtime revalida via `mutate()`**: UI desacoplada do mecanismo de chegada (preparado para WebSocket/SSE futuros).

### Riscos Conhecidos

- **Regressão no inbound legado** (likelihood média): derivação por status + testes de ambos os cenários.
- **Remoção do chat da página de caso** (likelihood média): ações não-chat (canal ativo, status, dossiê) permanecem na página; validação manual do fluxo completo.
- **Realtime sem filtro por tenant em `postgres_changes`**: revalidação conservadora da lista (mesmo padrão atual); carga aceitável para o MVP.

## Registros de Decisão de Arquitetura

- [ADR-001: Central de Conversas modelada sobre o caso de cobrança existente](adrs/adr-001.md) — Conversa = caso enriquecido; sem entidade `conversations` separada.
- [ADR-002: Modelo de dados — colunas em `cases` + `conversation_events` + `conversation_reads`](adrs/adr-002.md) — Condutor/versão no caso, eventos tipados como histórico, leitura por operador.
- [ADR-003: Recurso `/api/conversations` e condutor explícito no pipeline de IA](adrs/adr-003.md) — API dedicada com concorrência otimista; IA pausa/retoma por `controller`.
- [ADR-004: Vitest + React Testing Library com testes co-localizados](adrs/adr-004.md) — Primeira suite de testes do projeto.
