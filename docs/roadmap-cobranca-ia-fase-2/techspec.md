# Especificação Técnica: Roadmap Cobrança IA — Fase 2

## Resumo Executivo

A implementação será incremental e aditiva, reutilizando o modelo de tenant, os tipos de `lib/types.ts`, as rotas de casos e o fluxo de conversa/IA da Fase 1. A Fase 2 ativa as tabelas de domínio avançado já existentes no `supabase_tenant_model.sql` (`negotiations`, `workflows`, `campaigns`, `quarantines`, `negativations`, `protests`, `legal_processes`), adiciona novas tabelas (`message_templates`, `notifications`, `cases.propensity_score`), e introduz camadas de IA preditiva (insights, NBA, scoring) sobre o pipeline existente.

O principal trade-off é ativar tabelas modeladas sem alterar o schema canônico da Fase 1, mantendo compatibilidade com o histórico. Para scoring e providers de negativação/protesto, a Fase 2 usa heurística e mocks substituíveis, abrindo mão de precisão de ML e integrações reais em favor de velocidade de entrega. Isso exige que os providers sejam interfaces substituíveis e que a heurística de scoring seja documentada e evolua incrementalmente.

## Arquitetura do Sistema

### Visão dos Componentes

| Componente | Responsabilidade | Relação |
|---|---|---|
| `app/api/dashboard/metrics/route.ts` | Reescrever agregações com status reais e aging | Evolui o endpoint da Fase 1 |
| `app/api/negotiations/*` | CRUD e transições de acordos formais | Ativa tabela existente em `supabase_tenant_model.sql` |
| `app/api/financial-titles/[id]/route.ts` | Baixa de títulos (total/parcial/cancelamento) | Novo endpoint |
| `lib/case-insights.ts` | Gerar insights longitudinais via LLM | Novo módulo de IA |
| `lib/nba.ts` | Gerar next-best-actions via LLM + regras | Novo módulo de IA |
| `lib/propensity.ts` | Calcular scoring heurístico de propensão | Novo módulo de analytics |
| `app/api/workflows/*`, `app/api/campaigns/*` | CRUD de workflows e campanhas | Ativa tabelas existentes |
| `lib/campaign-runner.ts` | Resolver audiência e disparar campanhas via cron | Novo runner |
| `app/api/negativations/*`, `app/api/protests/*` | CRUD e crons de negativação e protesto | Ativa tabelas existentes |
| `lib/negativation-provider.ts`, `lib/protest-provider.ts` | Providers mock substituíveis | Novas interfaces |
| `app/api/legal-processes/*` | CRUD e escalonamento jurídico | Ativa tabela existente |
| `app/api/quarantines/*` | CRUD de quarentena com guards | Ativa tabela existente |
| `app/api/message-templates/*` | CRUD de templates com preview | Nova tabela + endpoints |
| `app/api/import/debtors/route.ts` | Importação em massa CSV/XLSX | Novo endpoint |
| `app/api/reports/*` | Exportação CSV/PDF | Novos endpoints |
| `app/api/notifications/*` | CRUD de notificações in-app | Nova tabela + endpoints |
| `lib/api-auth.ts` | Estender com `role` e `requireRole` | Evolui módulo da Fase 1 |
| `lib/rate-limit.ts` | Migrar para Redis/Upstash com fallback | Evolui módulo existente |
| `lib/logger.ts` | Logging estruturado com contexto | Novo módulo |
| Vitest + `tests/` | Suíte de testes automatizados | Nova infraestrutura |
| `.github/workflows/ci.yml` | CI/CD com lint, typecheck, testes, build | Nova infraestrutura |
| Supabase Storage | Persistir PDFs de contrato | Ativa `contract_documents.storage_path` |

Fluxo de dados do loop de negócio:

```text
Dashboard (métricas reais)
  <- cases.status + financial_titles.status + negotiations.status
  <- baixa de títulos (PATCH /api/financial-titles/[id])
  <- acordos formais (POST /api/negotiations, criado pelo pipeline de IA)
  <- pipeline de IA (processChat detecta [ACORDO_FECHADO] → cria negotiation)
```

Fluxo de IA preditiva:

```text
Operador abre detalhe do caso
  -> GET /api/cases/[id]/insights (LLM + cache 5min)
  -> GET /api/cases/[id]/nba (LLM + regras + cache 2min)
  -> cases.propensity_score (recalculado via cron semanal)
```

Fluxo de automação proativa:

```text
Gestor cria campanha (audience_filter JSONB)
  -> Cron /api/cron/run-campaigns resolve audiência
  -> Verifica horário permitido + rate limit + quarentena
  -> Cria/reutiliza caso + dispara primeira mensagem via IA
```

Fluxo legal/compliance:

```text
Título vencido (dias ≥ override_days_to_negative)
  -> Cron cria negativation (pending_notification)
  -> Notifica devedor (5 dias CDC Art. 43)
  -> Status → requested → completed (provider mock)
  -> Baixa do título → removed automaticamente

Caso em especializada há ≥60 dias sem acordo
  -> Cron cria legal_process
  -> Advogado atualiza status
  -> Vitória → sugere baixa do título
```

A aplicação não deve usar o service role para contornar RLS em rotas comuns. O fallback administrativo somente poderá atuar quando houver tenant explícito e validado no contexto da operação — mesma regra da Fase 1.

## Design de Implementação

### Interfaces Principais

Tipos a adicionar ou ajustar em `lib/types.ts`:

```ts
// Grupo A — Fechar o loop
interface DashboardMetrics {
  total_cases: number;
  active_cases: number;
  recovered_amount: number;
  pending_amount: number;
  success_rate: number;
  aging_buckets: { bucket: string; count: number; amount: number }[];
  stage_distribution: { stage: CollectionStage; count: number; amount: number }[];
  channel_distribution: { channel: string; count: number }[];
  avg_resolution_days: number;
  payment_status_pie: { name: string; value: number }[];
  contracts_by_month_bar: { month: string; count: number }[];
}

type NegotiationStatus = "open" | "accepted" | "expired" | "fulfilled" | "defaulted";

interface Negotiation {
  id: string;
  tenant_id: string;
  client_id: string | null;
  contract_id: string | null;
  financial_title_id: string | null;
  case_id: string | null;
  status: NegotiationStatus;
  original_value: number | null;
  proposed_value: number | null;
  agreed_value: number | null;
  discount_percent: number | null;
  installment_count: number | null;
  expires_at: string | null;
  accepted_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

type FinancialTitleStatus = "open" | "partial" | "paid" | "cancelled";

interface FinancialTitlePatch {
  status?: FinancialTitleStatus;
  paid_at?: string;
  paid_amount?: number;
  metadata?: Record<string, unknown>;
}

// Grupo B — Diferencial de IA
interface CaseInsights {
  sentiment_trend: { date: string; score: number }[];
  main_objections: string[];
  theme_summary: string;
  agreement_probability: number;
  recommended_tone: string;
}

type ActionType =
  | "propose_installment"
  | "escalate_to_legal"
  | "send_reminder"
  | "schedule_callback"
  | "offer_discount"
  | "handoff_to_human"
  | "mark_unresponsive";

interface NextBestAction {
  action_type: ActionType;
  label: string;
  rationale: string;
  priority: number;
  payload: Record<string, unknown>;
}

// Grupo C — Escala proativa
type PaymentProfile = "good" | "doubtful" | "bad";

interface AudienceFilter {
  case_status?: CaseStatus[];
  days_overdue_min?: number;
  days_overdue_max?: number;
  stage?: CollectionStage[];
  contract_id?: string;
  payment_profile?: PaymentProfile[];
  propensity_score_min?: number;
}

interface Campaign {
  id: string;
  tenant_id: string;
  workflow_id: string | null;
  name: string;
  channel: "whatsapp" | "telegram";
  status: "draft" | "scheduled" | "running" | "paused" | "completed";
  starts_at: string | null;
  ends_at: string | null;
  audience_filter: AudienceFilter;
  metadata: Record<string, unknown>;
}

// Grupo D — Arsenal legal
type NegativationStatus =
  | "pending_notification"
  | "notified"
  | "requested"
  | "completed"
  | "removed";

type ProtestStatus =
  | "pending_notification"
  | "notified"
  | "requested"
  | "completed"
  | "cancelled";

type LegalProcessStatus =
  | "open"
  | "in_progress"
  | "judgment_won"
  | "judgment_lost"
  | "closed";

type QuarantineStatus = "pending_review" | "approved" | "released" | "permanent_block";

// Grupo E — Governança
interface MessageTemplate {
  id: string;
  tenant_id: string;
  name: string;
  channel: "whatsapp" | "telegram";
  stage: CollectionStage | "any";
  language: string;
  body: string;
  variables: string[];
  is_active: boolean;
}

// Grupo F — Diversificação
interface ImportResult {
  imported: number;
  skipped: number;
  errors: { line: number; reason: string }[];
}

interface Notification {
  id: string;
  tenant_id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  related_case_id: string | null;
  read_at: string | null;
  created_at: string;
}

// Grupo G — Fundação
interface RateLimitResult {
  success: boolean;
  remaining: number;
}
```

Convenções:

- Todas as novas tabelas seguem o padrão multi-tenant com `tenant_id` e RLS.
- Todas as mutações registram `audit_logs` via `recordAuditAction`.
- Erros de regra de negócio usam código estável, mensagem em português e status HTTP previsível.
- `403` para role insuficiente, `404` para recurso não acessível no tenant, `409` para conflito.
- Providers de negativação/protesto são interfaces substituíveis (`lib/negativation-provider.ts`, `lib/protest-provider.ts`).

### Modelos de Dados

#### Tabelas existentes a ativar (sem alteração de schema)

- `negotiations` — acordos formais (task 2).
- `workflows` — definições de automação (task 7).
- `campaigns` — campanhas segmentadas (task 7).
- `quarantines` — bloqueio de abordagens (task 11).
- `negativations` — fila de negativação (task 8).
- `protests` — fila de protesto (task 9).
- `legal_processes` — processos jurídicos (task 10).
- `contract_documents` — referência para PDFs no Storage (task 22).

#### Novas tabelas e colunas

- `cases.propensity_score NUMERIC` nullable + `cases.propensity_updated_at TIMESTAMPTZ` (task 6).
- `negativations.notified_at TIMESTAMPTZ` nullable (task 8) — faltante no tenant model.
- `quarantines.expires_at TIMESTAMPTZ` nullable (task 11) — faltante no tenant model.
- `protests.notified_at TIMESTAMPTZ` nullable (task 9) — comunicação prévia de intenção de protesto (Lei 9.492/97).
- `contracts.archived_at TIMESTAMPTZ` nullable (task 16) — soft delete para arquivamento.
- `message_templates` (task 12): id, tenant_id, name, channel, stage, language, body, variables JSONB, is_active, created_by, created_at, updated_at.
- `notifications` (task 15): id, tenant_id, user_id, type, title, body, related_case_id, read_at, created_at.
- `campaign_dispatches` (task 7): id, tenant_id, campaign_id, case_id, status, sent_at, error — log de disparos.
- Bucket `contract-documents` no Supabase Storage com RLS por tenant (task 22).

#### RLS

Todas as novas tabelas seguem o padrão `tenant_id = tenant_for_user()` das tabelas existentes. `notifications` filtra adicionalmente por `user_id`. Bucket de Storage filtra por `tenant_id` nos metadados do arquivo.

### Endpoints da API

#### Grupo A — Fechar o loop

`GET /api/dashboard/metrics` — reescrever com status reais, aging por bucket, distribuição por estágio e canal, tempo médio de resolução. Resposta `DashboardMetrics`.

`GET/POST /api/negotiations` — lista paginada por tenant; cria com validação de tenant e vínculos opcionais.

`GET/PATCH /api/negotiations/[id]` — detalhe e transições de status (`accept`, `fulfill`, `default`, `expire`) com auditoria.

`PATCH /api/financial-titles/[id]` — baixa total/parcial/cancelamento com auditoria. Baixa total com `negotiation` aceita marca `negotiation.status='fulfilled'`.

`GET /api/cron/negotiations-expiry` — expira acordos vencidos (`expires_at < now` e `status='accepted'` → `defaulted`).

#### Grupo B — Diferencial de IA

`GET /api/cases/[id]/insights` — retorna `CaseInsights` com cache 5min. Read-only. Usa chaves do dono do caso via `get_user_ai_keys`.

`GET /api/cases/[id]/nba` — retorna `NextBestAction[]` com cache 2min. Combina LLM + regras determinísticas (estágio, prazos, acordos).

`GET /api/cron/score-propensity` — recalcula `cases.propensity_score` para casos ativos semanalmente.

#### Grupo C — Escala proativa

`GET/POST /api/workflows`, `PUT/DELETE /api/workflows/[id]` — CRUD de workflows.

`GET/POST /api/campaigns`, `PATCH /api/campaigns/[id]` — CRUD de campanhas com transições de status.

`GET /api/cron/run-campaigns` — resolve audiência, verifica horário permitido e rate limit, dispara mensagens.

#### Grupo D — Arsenal legal

`GET/POST /api/negativations`, `PATCH /api/negativations/[id]` — CRUD com transições.

`GET /api/cron/negativations` — elegibilidade, notificação prévia (5 dias), transição `requested`.

`GET/POST /api/protests`, `PATCH /api/protests/[id]` — CRUD com transições. Exige negativação prévia.

`GET /api/cron/protests` — elegibilidade, comunicação prévia de intenção de protesto (3 dias úteis), transição `requested`.

`GET/POST /api/legal-processes`, `PATCH /api/legal-processes/[id]` — CRUD com status.

`GET /api/cron/legal-escalation` — auto-cria `legal_process` para casos em especializada há ≥60 dias sem acordo.

`GET/POST /api/quarantines`, `PATCH /api/quarantines/[id]` — CRUD com transições. Guard em `processChat` e `start-negotiation`.

#### Grupo E — Governança

`GET/POST /api/message-templates`, `PUT/DELETE /api/message-templates/[id]` — CRUD.

`POST /api/message-templates/[id]/preview` — preview com `case_id`, retorna body com variáveis substituídas.

#### Grupo F — Diversificação

`POST /api/import/debtors` — CSV/XLSX com mapeamento de colunas, retorna `ImportResult`.

`GET /api/reports/portfolio.csv`, `GET /api/reports/agreements.csv`, `GET /api/reports/recovery.pdf` — exportação com filtros.

`GET /api/notifications`, `PATCH /api/notifications/[id]` — lista e marcar lida.

`PUT/DELETE /api/contracts/[id]` — edição e arquivamento de contrato.

`POST /api/clients`, `DELETE /api/clients/[id]` — criação manual e exclusão com validação de integridade.

#### Grupo G — Fundação

`lib/api-auth.ts` — estender `requireTenantContext` para retornar `role`; adicionar `requireRole(req, minRole)`.

`lib/rate-limit.ts` — reescrever com Upstash Redis REST + fallback in-memory.

`lib/logger.ts` — níveis debug/info/warn/error com `tenant_id`, `user_id`, `request_id`.

`middleware.ts` — gerar e propagar `request_id`.

### Pipeline de IA — Modificações

`lib/agent.ts` (`processChat`) — modificações:

1. **Guard de quarentena** (task 11): antes de processar, checar `quarantines` ativa para o caso. Se ativa, não responder.
2. **Parser de acordo** (task 2): ao detectar `[ACORDO_FECHADO]`, extrair valor/parcelas/desconto da resposta e criar `negotiation` antes de fechar o caso.
3. **Fallback de template** (task 12): se `callLLM` falhar após retries, usar template ativo do estágio como fallback.

`lib/case-insights.ts` (novo, task 4):

- `generateCaseInsights(caseId)` carrega histórico de mensagens (últimas 50 + resumo das primeiras se >50), caso, estágio e acordos.
- Prompt LLM retorna JSON `CaseInsights`.
- Cache in-memory TTL 5min.

`lib/nba.ts` (novo, task 5):

- `generateNextBestActions(caseId)` combina insights (task 4) + estágio + regras de contrato + prazos legais + acordos.
- Prompt LLM retorna `NextBestAction[]` ordenado por prioridade.
- Regras determinísticas validam conformidade CDC (não sugerir negativação fora do prazo).
- Cache in-memory TTL 2min.

`lib/propensity.ts` (novo, task 6):

- `calculatePropensityScore(caseId)` — heurística documentada combina:
  - Dias de atraso (peso negativo: mais dias = menor score).
  - Histórico de pagamento do cliente (títulos anteriores pagos = score maior).
  - Número de respostas anteriores (mais respostas = engajamento = score maior).
  - Existência de acordos anteriores cumpridos (score maior).
  - Estágio atual (preventiva > amigável > negocial > especializada).
- Score normalizado 0-1.
- Persistido em `cases.propensity_score` via cron.

### Componentes Frontend

#### `app/page.tsx` (dashboard)

- Reescrever consumo de `/api/dashboard/metrics` para novos campos.
- Adicionar gráfico de aging por bucket (bar) e distribuição por estágio (pie).
- Adicionar KPIs: taxa de acordo, tempo médio de resolução.

#### `app/cases/[id]/page.tsx` (workspace do caso)

- Adicionar seção de acordos (`negotiations` do caso).
- Adicionar painel de insights (gráfico de sentimento + cartões de objeções).
- Adicionar cartão de NBA com botões acionáveis.
- Adicionar badge de propensão.
- Adicionar alertas de negativação/protesto ativos.
- Adicionar seção jurídica quando `legal_process` existir.

#### `app/cases/page.tsx` (lista de casos)

- Adicionar badge de propensão por caso.
- Permitir ordenação por `propensity_score`.

#### Novas páginas

- `app/negotiations/page.tsx` — lista de acordos por status.
- `app/workflows/page.tsx` — editor de workflows.
- `app/campaigns/page.tsx` — lista + formulário + cronograma.
- `app/negativations/page.tsx` — fila de negativação.
- `app/protests/page.tsx` — fila de protesto.
- `app/legal/page.tsx` — processos jurídicos.
- `app/quarantines/page.tsx` — fila de revisão.
- `app/templates/page.tsx` — editor de templates com preview.
- `app/import/page.tsx` — upload + mapeamento + resultado.
- `app/contracts/[id]/page.tsx` — adicionar UI de baixa de títulos e documentos.

#### `components/header.tsx`

- Adicionar navegação para novas páginas (negociações, workflows, campanhas, negativação, protesto, jurídico, quarentena, templates, importação).
- Adicionar sino de notificações com badge de não-lidas + dropdown.
- Esconder navegação por role (task 17).

### Tipagem e Estados

As respostas devem usar tipos compartilhados (`lib/types.ts`), tratar loading/erro/vazio e manter mensagens de erro em português. O estado de contexto legado não deve bloquear a leitura do caso histórico — mesma regra da Fase 1.

## Pontos de Integração

### Existentes (mantidos)

- WhatsApp (Z-API), Telegram (Bot API), provedores de IA (OpenCode, Gemini, OpenAI, Anthropic, OpenRouter, Ollama) — sem alteração.
- Supabase Auth, RLS, Realtime — estendido para novas tabelas e `notifications`.

### Novos

- **Supabase Storage** (task 22): bucket `contract-documents` com RLS por tenant.
- **Upstash Redis** (task 18): `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` — opcionais com fallback.
- **Sentry** (task 21): `SENTRY_DSN` — opcional com fallback em console estruturado.
- **Providers mock de negativação/protesto** (tasks 8-9): interfaces substituíveis (`NegativationProvider`, `ProtestProvider`) com implementação mock que grava `external_reference` fake.
- **Vitest** (task 19): nova infraestrutura de testes.
- **GitHub Actions** (task 20): CI/CD.

### Webhooks e Crons

- Webhooks existentes (WhatsApp, Telegram) — adicionar guard de quarentena (task 11) antes de disparar `processChat`.
- Crons existentes (`follow-up`, `alert-admin`) — `alert-admin` passa a criar `notifications` em vez de `console.log` (task 15).
- Novos crons: `negotiations-expiry`, `score-propensity`, `run-campaigns`, `negativations`, `protests`, `legal-escalation`.

## Análise de Impacto

| Componente | Tipo | Impacto e risco | Ação necessária |
|---|---|---|---|
| `app/api/dashboard/metrics/route.ts` | Modificado | Alto; métricas zeradas mascaradas | Reescrever queries com status reais |
| `lib/agent.ts` | Modificado | Alto; pipeline central | Adicionar guard de quarentena, parser de acordo, fallback de template |
| `lib/api-auth.ts` | Modificado | Alto; auth central | Estender com `role` e `requireRole` |
| `lib/rate-limit.ts` | Modificado | Médio; quebra em multi-instância | Migrar para Redis com fallback |
| `app/api/financial-titles/[id]/route.ts` | Novo | Médio; baixa de títulos | Validar pertença ao tenant e auditoria |
| `app/api/negotiations/*` | Novo | Alto; ativa tabela modelada | CRUD + transições + cron de expiração |
| `lib/case-insights.ts`, `lib/nba.ts` | Novo | Médio; custo de LLM | Cache + truncamento de histórico |
| `lib/propensity.ts` | Novo | Médio; heurística enviesada | Documentar fórmula e não substituir humano |
| `app/api/workflows/*`, `app/api/campaigns/*` | Novo | Alto; automação proativa | Runner com rate limit e horário permitido |
| `app/api/negativations/*`, `app/api/protests/*` | Novo | Alto; risco legal | Notificação prévia de 5 dias + encadeamento |
| `app/api/legal-processes/*` | Novo | Médio; auto-criação | Cron de escalonamento com prazo configurável |
| `app/api/quarantines/*` | Novo | Alto; bloqueia IA | Guard em `processChat` e `start-negotiation` |
| `app/api/message-templates/*` | Novo | Médio; conformidade CDC | Revisão obrigatória antes de ativar |
| `app/api/import/debtors/route.ts` | Novo | Médio; dados inconsistentes | Relatório de erros por linha |
| `app/api/reports/*` | Novo | Baixo; read-only | Filtros e encoding UTF-8 BOM |
| `app/api/notifications/*` | Novo | Médio; realtime | Realtime channel + substituir `console.log` |
| `lib/logger.ts` | Novo | Médio; dados sensíveis | Sanitizar chaves/tokens/senhas |
| `vitest.config.ts`, `tests/` | Novo | Médio; sem suite existente | Mock de LLM e RLS com Supabase local |
| `.github/workflows/ci.yml` | Novo | Baixo; infraestrutura | Cache de dependências |
| Supabase Storage bucket | Novo | Médio; RLS do bucket | Filtrar por `tenant_id` nos metadados |

## Estratégia de Testes

### Testes Unitários (task 19)

Priorizar funções puras e contratos:

- `lib/finance.ts` — `calculateUpdatedValue`, `getDaysOverdue`, `getCollectionStage`, `getFinancialTitleEligibility` (cobertura ≥80%).
- `lib/agent.ts` — com `callLLM` mockado: valida tags `[ACORDO_FECHADO]`, `[HANDOFF]`, transições de status, parser de acordo, guard de quarentena.
- `lib/api-auth.ts` — `requireTenantContext`, `requireRole` com roles diferentes.
- `lib/propensity.ts` — heurística com casos de teste (alto/baixo/médio potencial).
- Mapeamento de códigos de erro para status HTTP.
- Allowlist de campos do PATCH de `negotiations` e `financial-titles`.

### Testes de Integração e SQL

Cenários executáveis no Supabase local ou scripts SQL de verificação:

- Dois tenants com dados distintos, isolamento de usuário regular.
- Acordo criado pelo pipeline de IA aparece em `negotiations`.
- Baixa de título marca `negotiation` como `fulfilled`.
- Cron de expiração marca acordos vencidos como `defaulted`.
- Negativação respeita notificação prévia de 5 dias.
- Protesto bloqueado sem negativação prévia.
- Quarentena bloqueia `processChat`.
- Campanha `draft` não dispara; `running` dentro da janela dispara.
- Audiência com `days_overdue_min=30` só inclui casos com 30+ dias.
- Importação com documento duplicado é skipped.
- RLS: tenant A não vê dados de tenant B em todas as novas tabelas.

### Verificação de API e Frontend

- Dashboard com zero casos retorna zeros consistentes (não NaN).
- Insights e NBA com caso sem mensagens retornam resposta vazia estruturada.
- Cache de insights e NBA serve resposta idêntica em chamadas repetidas.
- NBA nunca sugere negativação fora do prazo legal.
- Exportação CSV abre no Excel com acentos corretos.
- Roles: member recebe 403 ao criar política; admin pode criar mas não remover owner.
- Executar `npm run lint` e `npm run build` ao final de cada tarefa.

## Sequenciamento de Desenvolvimento

### Ordem de Build por Grupo

1. **Grupo A — Fechar o loop** (tarefas 1-3) — sem dependências externas; prerequisite para medir ROI de tudo o resto.
2. **Grupo B — Diferencial de IA** (tarefas 4-6) — depende de acordos formais (tarefa 2) para insights completos.
3. **Grupo C — Escala proativa** (tarefa 7) — depende de métricas (tarefa 1) e acordos (tarefa 2).
4. **Grupo D — Arsenal legal** (tarefas 8-11) — depende de acordos (tarefa 2) e baixa (tarefa 3).
5. **Grupo E — Governança** (tarefa 12) — sem dependências; pode ser paralela.
6. **Grupo F — Diversificação** (tarefas 13-17) — algumas sem dependências; relatórios dependem de métricas (tarefa 1).
7. **Grupo G — Fundação** (tarefas 18-22) — sem dependências; pode ser paralela; CI/CD depende de testes (tarefa 19).

### Dependências Técnicas

- O projeto Supabase deve conter o baseline `supabase_tenant_model.sql` aplicado (já existente).
- O ambiente de verificação precisa suportar RLS, funções transacionais e dados de dois tenants.
- Upstash Redis é opcional (fallback in-memory para demo mode).
- Sentry é opcional (fallback em console estruturado).
- Vitest não interfere no build existente.
- Novas variáveis de ambiente (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SENTRY_DSN`) devem ser documentadas em `.env.example`.

## Monitoramento e Observabilidade

Registrar métricas e logs estruturados para:

- Acordos criados pelo pipeline de IA vs manual.
- Baixas de títulos por tipo (total/parcial/cancelamento).
- Tempo de resposta de insights e NBA (custo de LLM).
- Score de propensão recalculado por ciclo.
- Campanhas disparadas, taxa de resposta e conversão.
- Negativações notificadas, requisitadas e concluídas.
- Protestos requisitados e cancelados.
- Processos jurídicos auto-criados vs manuais.
- Casos em quarentena bloqueados.
- Fallback de template quando LLM falha.
- Importações com erro por linha.
- Notificações criadas e lidas.
- Erros 403 por role.
- Logs estruturados com `request_id`, `tenant_id`, `user_id` (sem dados sensíveis).

Alertar quando houver:

- Falha de auditoria em mutações.
- Aumento da taxa de erro do pipeline de IA.
- Tentativa de acesso sem tenant válido.
- Campanha disparando fora do horário permitido.
- Negativação sem notificação prévia de 5 dias.
- Logs contendo dados sensíveis.

## Considerações Técnicas

### Decisões Principais

- **Ativar tabelas modeladas sem alterar schema canônico:** aproveita o trabalho de modelagem já feito, reduz risco de breaking change. Requer validar RLS existente.
- **Scoring heurístico antes de ML:** entrega valor rapidamente, documenta fórmula, evolui incrementalmente. Abre mão de precisão.
- **Providers mock de negativação/protesto:** permite validar fluxo legal sem integração real. Requer interfaces substituíveis.
- **Cache de LLM para insights/NBA:** controla custo sem prejudicar experiência. TTL 5min/2min.
- **Redis com fallback in-memory:** suporta multi-instância sem quebrar demo mode. Requer `UPSTASH_REDIS_REST_URL` opcional.
- **NBA combina LLM + regras determinísticas:** garante conformidade CDC mesmo se LLM alucinar. Regras validam antes de exibir.
- **Notifications substituem `console.log` do cron:** fecha o loop de alerta ao operador. Requer Realtime channel.

### Riscos Conhecidos

- **Métricas zeradas mascaradas:** podem levar a decisões erradas. Mitigação: reescrever queries antes de qualquer outra evolução.
- **Acordos não persistidos pelo pipeline:** podem perder rastreio. Mitigação: conectar parser de acordo antes de depender do dashboard.
- **Custo de LLM em insights/NBA:** pode escalar mal. Mitigação: cache, truncamento de histórico e rate limit.
- **Scoring enviesado:** pode priorizar casos errados. Mitigação: documentar heurística, não substituir humano, evoluir para ML.
- **Campanhas com spam:** podem gerar reclamação. Mitigação: rate limit por destinatário, horário permitido e audiência filtrada.
- **Negativação fora do prazo legal:** risco jurídico. Mitigação: notificação prévia de 5 dias e controle por `override_days_to_negative`.
- **Templates não conformes:** risco CDC. Mitigação: revisão obrigatória antes de ativar.
- **Importação com dados inconsistentes:** pode criar registros inválidos. Mitigação: relatório de erros por linha e rollback parcial.
- **Roles mal configuradas:** podem expor dados. Mitigação: owner imune, admin não gerencia owner, auditoria registra role.
- **Rate limiter quebra em multi-instância:** pode permitir spam. Mitigação: Redis/Upstash com fallback.
- **Logs com dados sensíveis:** risco LGPD. Mitigação: sanitizar chaves/tokens/senhas em `lib/logger.ts`.

## Registros de Decisão de Arquitetura

- A definir conforme implementação avança. Potenciais ADRs:
  - ADR-005: Scoring heurístico vs ML para propensão a pagamento.
  - ADR-006: Providers mock substituíveis para negativação e protesto.
  - ADR-007: Cache de LLM para insights e NBA.
  - ADR-008: Redis/Upstash com fallback in-memory para rate limiting.
  - ADR-009: NBA combina LLM + regras determinísticas para conformidade CDC.
  - ADR-010: Notifications substituem `console.log` em crons de alerta.