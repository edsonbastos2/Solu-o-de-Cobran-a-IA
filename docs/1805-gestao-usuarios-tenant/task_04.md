---
status: done
title: "Retroaplicar requireRole('gestor', ...) nas rotas de mutação existentes"
type: backend
complexity: alta
dependencies:
  - task_02
---

# Tarefa 04: Retroaplicar a proteção de mínimo `gestor` nas rotas de mutação existentes

## Visão Geral

Um levantamento de todo o repositório (registrado na Análise de Impacto da TechSpec) constatou que cerca de metade das rotas de mutação de negócio não têm nenhuma verificação de papel hoje — qualquer membro ativo do tenant, incluindo o novo `operador`, ainda poderia criar/editar/excluir clientes, casos, contratos, negociações, títulos financeiros e processos legais sem esta tarefa. Sem ela, a funcionalidade entrega um modelo de papéis e uma interface que implicam que o `operador` é restrito enquanto as APIs subjacentes permanecem amplamente abertas — esta tarefa é o que torna a restrição real de fato.

<critical>
- SEMPRE LEIA o PRD e a TechSpec antes de começar (`../prd.md`, `../techspec.md`).
- REFERENCIE a tabela 'Análise de Impacto' da TechSpec para a lista autoritativa de arquivos/métodos e sua verificação de auth atual vs. alvo — este arquivo de tarefa a resume, mas a tabela é a fonte da verdade se elas divergirem.
- FOQUE NO "O QUÊ" — troque a chamada do helper de auth; não refatore a lógica de negócio circundante.
- MINIMIZE CÓDIGO — cada mudança é um diff de 1-3 linhas por handler (trocar `requireTenantContext` → `requireRole(req, 'gestor', tenantId)`, ou `requireRole(req, 'member', ...)` → `requireRole(req, 'gestor', ...)`).
- TESTES OBRIGATÓRIOS — toda rota alterada precisa de uma verificação de `operador`-recebe-403 e de `gestor`-tem-sucesso.
</critical>

<requirements>
- DEVE mudar estes handlers atualmente sem proteção (apenas `requireTenantContext`) para `requireRole(req, 'gestor', tenantId)`:
  - `app/api/clients/route.ts` — `POST` (criar cliente)
  - `app/api/clients/[id]/route.ts` — `PUT` (editar), `DELETE` (excluir)
  - `app/api/cases/route.ts` — `POST` (criar caso)
  - `app/api/cases/[id]/route.ts` — `PATCH` (mudança de status/atribuição), `DELETE` (encerrar caso)
  - `app/api/case-status/route.ts` — `POST` (duplica a lógica de transição de status do PATCH de `cases/[id]` — DEVE ser protegido de forma idêntica, ou o `operador` poderia contornar a restrição de `cases/[id]` através desta rota)
  - `app/api/contracts/route.ts` — `POST` (criar contrato; o PUT/DELETE de `contracts/[id]` já são protegidos com `admin` e NÃO DEVEM ser tocados)
  - `app/api/negotiations/route.ts` — `POST` (criar negociação), `app/api/negotiations/[id]/route.ts` — `PATCH` (aceitar/cumprir/padrão/expirado)
  - `app/api/financial-titles/[id]/route.ts` — `PATCH` (quitar/cancelar; maior raio de impacto financeiro deste grupo — cascateia para negativação/protesto/negociação)
- DEVE mudar estes handlers atualmente com `requireRole(req, 'member', ...)` (funcionalmente irrestritos sob o rank antigo) para `requireRole(req, 'gestor', ...)`:
  - `app/api/legal-processes/route.ts` — `POST`
  - `app/api/legal-processes/[id]/route.ts` — `PATCH`
- DEVE trocar o handler `PUT` de `app/api/tenants/[id]/ai-config/route.ts` de `requireRole(req, 'admin', ...)` para `requireAIConfigPermission(req, ...)` (da task_02), para que um `gestor`/`operador` com o interruptor de configuração de IA concedido possa de fato usá-lo — sem esta troca, o requisito do interruptor independente do ADR-001 é inaplicável independentemente do que a interface permita.
- NÃO DEVE mudar nenhuma rota já protegida com `requireRole(req, 'admin', ...)` (policies, agents, quarantines, protests, negativations, message-templates, `contracts/[id]` PUT/DELETE, `import/debtors`) — conforme o ADR-004, `admin` (rank 3) já exclui `gestor`(2)/`operador`(1) sob o novo rank, então estas estão corretas como estão.
- NÃO DEVE mudar `app/api/start-negotiation/route.ts`, `app/api/chat/route.ts`, `app/api/agent-message/route.ts` — estas são rotas de envio de mensagens e DEVEM permanecer disponíveis ao `operador` (o baseline incondicional do PRD). Não as proteja em `gestor` por analogia com o restante desta tarefa.
- NÃO DEVE mudar `app/api/notifications/[id]/route.ts` (auto-restrita, corretamente `requireRole(req, 'member', ...)` hoje — atualize o literal para um `TenantRole` válido, por exemplo `'operador'`, já que `'member'` não passa mais na checagem de tipos após a task_02, mas NÃO eleve a restrição efetiva dela) nem `app/api/message-templates/[id]/preview/route.ts` (preview sem persistência, mesmo tratamento).
- DEVE deixar um comentário de uma linha em `app/api/agents/simulate/route.ts` notando a constatação de verificação de auth ausente pré-existente do levantamento da TechSpec, sem corrigi-la — é um problema não relacionado, acompanhado separadamente, fora do escopo deste ticket.
</requirements>

## Subtarefas
- [x] 04.1 Retroaplicar as rotas de `clients` (POST/PUT/DELETE) e `cases`/`case-status` (POST/PATCH/DELETE).
- [x] 04.2 Retroaplicar as rotas de `contracts` (apenas POST), `negotiations` (POST/PATCH) e `financial-titles/[id]` (PATCH).
- [x] 04.3 Retroaplicar `legal-processes` (POST/PATCH), substituindo o literal `'member'` agora inválido.
- [x] 04.4 Trocar o PUT de `tenants/[id]/ai-config` para `requireAIConfigPermission`.
- [x] 04.5 Corrigir o literal `'member'` agora inválido no PATCH de `notifications/[id]` e no POST de `message-templates/[id]/preview` para `'operador'` sem mudar o acesso efetivo delas (irrestrito-além-da-associação-ao-tenant). — Já corrigido pela task_02; confirmado nesta tarefa sem mudança adicional.
- [x] 04.6 Verificar que toda rota já protegida com `admin` está intocada (revisão de diff) e que toda rota de envio de mensagens está intocada.

## Nota de Status

Implementação concluída nesta sessão. `npx tsc --noEmit` e `npm run lint` rodaram limpos (0 erros; apenas warnings pré-existentes não relacionados). Sem acesso a um Supabase remoto neste ambiente de subagente, a verificação manual da matriz papel×rota (checklist da seção Testes) não pôde ser exercitada ponta a ponta — fica documentada abaixo para verificação humana posterior:

| Rota | Método | `operador` | `gestor` | `admin`/`owner` |
|---|---|---|---|---|
| `/api/clients` | POST | 403 | 201 | 201 |
| `/api/clients/[id]` | PUT | 403 | 200 | 200 |
| `/api/clients/[id]` | DELETE | 403 | 200 | 200 |
| `/api/cases` | POST | 403 | 201 | 201 |
| `/api/cases/[id]` | PATCH | 403 | 200 | 200 |
| `/api/cases/[id]` | DELETE | 403 | 200 | 200 |
| `/api/case-status` | POST | 403 | 200 | 200 |
| `/api/contracts` | POST | 403 | 201 | 201 |
| `/api/negotiations` | POST | 403 | 201 | 201 |
| `/api/negotiations/[id]` | PATCH | 403 | 200 | 200 |
| `/api/financial-titles/[id]` | PATCH | 403 | 200 | 200 |
| `/api/legal-processes` | POST | 403 | 201 | 201 |
| `/api/legal-processes/[id]` | PATCH | 403 | 200 | 200 |
| `/api/start-negotiation`, `/api/chat`, `/api/agent-message` | POST | 200 (inalterado) | 200 | 200 |
| `/api/notifications/[id]` (própria notificação) | PATCH | 200 (inalterado) | 200 | 200 |
| `/api/policies` (regressão) | POST | 403 (inalterado) | 403 (inalterado) | 200 |
| `/api/tenants/[id]/ai-config` | PUT | 403 sem `can_configure_ai`; 200 com `can_configure_ai=true` | 403 sem `can_configure_ai`; 200 com `can_configure_ai=true` | 200 sempre |

## Detalhes de Implementação

Cada mudança segue a mesma forma já usada em todo o codebase (ver `app/api/policies/route.ts` ou `app/api/agents/route.ts` para o padrão alvo com `requireRole`, e `app/api/clients/[id]/route.ts` para o padrão atual apenas-`requireTenantContext` sendo substituído):

```typescript
// Antes (ex.: PUT de app/api/clients/[id]/route.ts)
const tenantContext = await requireTenantContext(req, new URL(req.url).searchParams.get('tenant_id'));
if ('response' in tenantContext) return tenantContext.response;
const { supabase, tenantId, role, userId } = tenantContext.ctx;

// Depois
const tenantContext = await requireRole(req, 'gestor', new URL(req.url).searchParams.get('tenant_id'));
if ('response' in tenantContext) return tenantContext.response;
const { supabase, tenantId, role, userId } = tenantContext.ctx;
```
As chamadas `recordAuditAction(supabase, { ..., actorRole: role, ... })` já presentes nestes handlers não precisam de mudança além da atualização de tipo que a task_02 já fez.

Para `case-status/route.ts` e o PATCH de `cases/[id]/route.ts`, confirme que ambos usam o mesmo gate de `STATUS_TRANSITIONS`/`TRANSITIONS` de forma consistente — a TechSpec sinaliza essa duplicação como risco especificamente porque proteger um e não o outro deixa uma brecha.

### Arquivos Relevantes
- `app/api/clients/route.ts`, `app/api/clients/[id]/route.ts` — handler PUT completo já revisado (usa `requireTenantContext`, `validateFields`, `recordAuditAction`).
- `app/api/cases/route.ts`, `app/api/cases/[id]/route.ts`, `app/api/case-status/route.ts` — lógica de transição de status duplicada, ambas precisam do mesmo gate.
- `app/api/contracts/route.ts` (apenas POST — o PUT/DELETE de `[id]` já estão corretos).
- `app/api/negotiations/route.ts`, `app/api/negotiations/[id]/route.ts`.
- `app/api/financial-titles/[id]/route.ts`.
- `app/api/legal-processes/route.ts`, `app/api/legal-processes/[id]/route.ts`.
- `app/api/tenants/[id]/ai-config/route.ts` — handler PUT, atualmente `requireRole(req, 'admin', ...)`.
- `app/api/notifications/[id]/route.ts`, `app/api/message-templates/[id]/preview/route.ts` — correção de literal apenas.
- `app/api/policies/route.ts` — referência para o padrão de chamada `requireRole` já corretamente usado em outro lugar.

### Arquivos Dependentes
- `lib/api-auth.ts` (task_02) — esta tarefa consome `requireRole`/`requireAIConfigPermission` dele; deve ser mesclada primeiro.
- `components/team-management-panel.tsx` / páginas relevantes de listagem/detalhe (task_06 e além deste ticket) — ocultação no lado da interface dos botões agora com 403 para o `operador` é um follow-up nice-to-have, não exigido para a conclusão desta tarefa (o 403 em nível de API é a fronteira de segurança real).

### ADRs Relacionados
- [ADR-004: Rank de papéis de quatro níveis, substituindo member, retroaplicado nas rotas CRUD existentes sem proteção](adrs/adr-004.md) — Justificativa completa exatamente desta lista de rotas e de quais rotas são explicitamente excluídas.

## Entregáveis
- Todos os ~13 handlers de rota listados atualizados conforme os requisitos.
- `npx tsc --noEmit` e `npm run lint` passam.
- Matriz de verificação manual (papel × rota) documentada conforme a seção Testes.

## Testes
- Integração (manual, conforme convenção do projeto — sem suíte automatizada):
  - [ ] `operador` recebe 403 em: `POST /api/clients`, `PUT /api/clients/[id]`, `DELETE /api/clients/[id]`, `POST /api/cases`, `PATCH /api/cases/[id]`, `DELETE /api/cases/[id]`, `POST /api/case-status`, `POST /api/contracts`, `POST /api/negotiations`, `PATCH /api/negotiations/[id]`, `PATCH /api/financial-titles/[id]`, `POST /api/legal-processes`, `PATCH /api/legal-processes/[id]`.
  - [ ] `gestor` tem sucesso em toda rota da lista acima.
  - [ ] `operador` ainda tem sucesso em `POST /api/start-negotiation`, `POST /api/chat`, `POST /api/agent-message` (acesso base não afetado).
  - [ ] `operador` ainda tem sucesso no `PATCH /api/notifications/[id]` da própria notificação.
  - [ ] Rotas protegidas com `admin` (ex.: `POST /api/policies`) ainda rejeitam `gestor` (comportamento inalterado — verificação de regressão).
  - [ ] `operador` com `can_configure_ai = true` tem sucesso no `PUT /api/tenants/[id]/ai-config`; `gestor` com `can_configure_ai = false` recebe 403 na mesma rota; `admin` tem sucesso independentemente do valor da coluna.
- Alvo de cobertura de teste: todo handler alterado exercitado com tanto um papel permitido quanto um bloqueado.

## Critérios de Sucesso
- Toda rota da lista de requisitos aplica o papel mínimo documentado.
- Zero regressão nas rotas já protegidas com `admin` ou nas rotas de envio de mensagens (revisão de diff antes/depois explícita).
- `npx tsc --noEmit` e `npm run lint` limpos.