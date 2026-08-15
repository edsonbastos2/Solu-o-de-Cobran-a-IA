---
status: pending
title: "Rotas de API de gestão de equipe (app/api/tenants/[id]/members/*)"
type: backend
complexity: alta
dependencies:
  - task_01
  - task_02
---

# Tarefa 05: Rotas de API de gestão de equipe

## Visão Geral

Implementa as cinco rotas que permitem ao `owner`/`admin` de um tenant convidar, listar, editar, reenviar e remover membros da equipe. Todas as mutações passam pelo client admin de service role com autorização aplicada inteiramente no handler (conforme o ADR-002), seguindo o padrão existente de `app/api/admin/users` em vez de contar com a RLS de `tenant_members`. A entrega do convite é nativa do Supabase Auth (`inviteUserByEmail` + os metadados que o trigger da task_01 lê) — sem tabela nova, sem lógica personalizada de token/expiração.

<critical>
- SEMPRE LEIA o PRD e a TechSpec antes de começar (`../prd.md`, `../techspec.md`).
- REFERENCIE as seções 'Endpoints da API' e 'Pontos de Integração' da TechSpec para as formas exatas de requisição/resposta e semânticas de erro — não invente uma forma de endpoint diferente.
- FOQUE NO "O QUÊ" — os contratos e garantias das rotas, não a implementação chamada a chamada de `@supabase/supabase-js`.
- MINIMIZE CÓDIGO — o trecho abaixo ilustra o precedente de client-auth a seguir (`app/api/admin/users/route.ts`), não o handler novo completo.
- TESTES OBRIGATÓRIOS — toda rota precisa de cobertura owner/admin-tem-sucesso e gestor/operador-403, mais os casos de borda específicos de convite abaixo.
</critical>

<requirements>
- DEVE implementar `GET /api/tenants/[id]/members` — qualquer membro ativo (`requireTenantContext`, sem papel elevado) pode listar os membros do tenant (ativos + pendentes), usando o client normal com escopo de tenant (conta com a política RLS `tenant_members_select` existente, que já permite que qualquer membro ativo leia a lista completa — nenhum client admin é necessário nesta rota).
- DEVE implementar `POST /api/tenants/[id]/members/invite` — `requireRole(req, 'admin', tenantId)`. Corpo: `{ email: string, role: 'admin'|'gestor'|'operador', canConfigureAI?: boolean }` (validar com `validateFields`; rejeitar `role: 'owner'` explicitamente — ninguém pode convidar um segundo owner). Chama `supabaseAdmin.auth.admin.inviteUserByEmail(email, { data: { invited_tenant_id: tenantId, invited_role: role, invited_can_configure_ai: !!canConfigureAI } })`. Em um erro de "usuário já registrado" do Supabase, retornar 409 com uma mensagem clara (não reatribuir silenciosamente o tenant de um usuário existente). Em qualquer outra falha de convite (por exemplo, SMTP não configurado no projeto Supabase), retornar um 4xx/5xx com uma mensagem que distingue "entrega de e-mail indisponível" de um erro genérico. Em sucesso, chamar `recordAuditAction` com `action: 'TEAM_MEMBER_INVITED'`, `entityType: 'tenant_member'`.
- DEVE implementar `PATCH /api/tenants/[id]/members/[memberId]` — `requireRole(req, 'admin', tenantId)`. Corpo: `{ role?: 'admin'|'gestor'|'operador', canConfigureAI?: boolean }`. DEVE retornar 403 se o `memberId` alvo resolver para `role === 'owner'` (o owner é imune a modificação por qualquer pessoa, incluindo outro admin) — buscar a linha alvo primeiro e verificar antes de aplicar qualquer atualização. DEVE rejeitar definir `role: 'owner'` em qualquer membro (nenhum caminho de promoção via esta rota). Chama `recordAuditAction` com `action: 'TEAM_MEMBER_UPDATED'`, snapshots `before`/`after`.
- DEVE implementar `DELETE /api/tenants/[id]/members/[memberId]` — `requireRole(req, 'admin', tenantId)`. DEVE retornar 403 se o alvo for `role === 'owner'`. Exclui a linha `tenant_members`; se o `status` do alvo for `=== 'pending'`, DEVE também chamar `supabaseAdmin.auth.admin.deleteUser(userId)` para liberar o e-mail para um convite futuro (uma linha `auth.users` órfã não confirmada bloquearia permanentemente o reconvite daquele endereço). Chama `recordAuditAction` com `action: 'TEAM_MEMBER_REMOVED'`.
- DEVE implementar `POST /api/tenants/[id]/members/[memberId]/resend` — `requireRole(req, 'admin', tenantId)`. DEVE retornar 400 se o `status` do alvo for `!== 'pending'` (nada a reenviar para um membro ativo). Re-invoca `supabaseAdmin.auth.admin.inviteUserByEmail` para o mesmo e-mail (o Supabase reenvia sem criar uma linha `auth.users` duplicada para um endereço já convidado e ainda não confirmado). Chama `recordAuditAction` com `action: 'TEAM_MEMBER_INVITE_RESENT'`.
- DEVE aplicar limite de taxa em `POST /invite` e `POST /resend` via `lib/rate-limit.ts` (`rateLimit`), com chave por tenant, para conter spam/abuso de convites.
- DEVE filtrar toda consulta do client admin explicitamente por `.eq('tenant_id', tenantId)` (sem rede de segurança da RLS no client admin, conforme a convenção de client admin do CLAUDE.md).
- NÃO DEVE criar uma tabela separada `tenant_invitations` nem nenhum schema novo além do que a task_01 já adicionou (ADR-003).
</requirements>

## Subtarefas
- [ ] 05.1 `GET /api/tenants/[id]/members` — listar membros ativos + pendentes com email/name/role/canConfigureAI/status.
- [ ] 05.2 `POST /api/tenants/[id]/members/invite` — validação, tratamento de e-mail duplicado, chamada `inviteUserByEmail`, auditoria.
- [ ] 05.3 `PATCH /api/tenants/[id]/members/[memberId]` — verificação de imunidade do owner, atualização de papel/permissão, auditoria com before/after.
- [ ] 05.4 `DELETE /api/tenants/[id]/members/[memberId]` — verificação de imunidade do owner, branch de limpeza pendente-vs-ativo, auditoria.
- [ ] 05.5 `POST /api/tenants/[id]/members/[memberId]/resend` — guarda apenas-pendente, re-convite, auditoria.
- [ ] 05.6 Conectar `rateLimit` em invite/resend.

## Detalhes de Implementação

Siga o precedente de client-admin + autorização em camada de aplicação de `app/api/admin/users/route.ts` (já revisado por completo):
```typescript
const r = await requireRole(req, 'admin', tenantId);
if ('response' in r) return r.response;
const supabaseAdmin = getSupabaseAdmin();
if (!supabaseAdmin) return NextResponse.json({ error: 'Supabase admin não configurado.' }, { status: 500 });
// ... .eq('tenant_id', tenantId) em toda consulta ...
await recordAuditAction(supabaseAdmin, { tenantId, entityType: 'tenant_member', entityId: memberId, actorUserId: r.ctx.userId, actorRole: r.ctx.role, action: '...', ... });
```
Para a rota de convite especificamente, distinga o erro de "já registrado" do Supabase (verifique a mensagem/status de erro que o Supabase retorna para `inviteUserByEmail` em um e-mail existente) das outras falhas antes de escolher o status da resposta.

Para resolver `tenantId` a partir do segmento de caminho `[id]` de forma consistente com o restante do codebase, siga o padrão já usado em `app/api/tenants/[id]/ai-config/route.ts` para ler o parâmetro de caminho e passá-lo ao `requireRole`.

### Arquivos Relevantes
- `app/api/admin/users/route.ts` — precedente completo de client-admin + auth em camada de aplicação + `auditAdminAction` já revisado.
- `app/api/tenants/[id]/ai-config/route.ts` — precedente para a estrutura de uma rota de tenant com escopo `[id]`.
- `lib/supabase-admin.ts` — `getSupabaseAdmin()`.
- `lib/api-auth.ts` (task_02) — `requireRole`, `requireTenantContext`.
- `lib/audit.ts` — assinatura de `recordAuditAction(client, params)` já revisada (`tenantId`, `entityType`, `entityId`, `actorUserId`, `actorRole`, `action`, `before`/`after`, `metadata`).
- `lib/rate-limit.ts` — `rateLimit(key, max, windowMs): Promise<boolean>` já revisado.
- `lib/api-validate.ts` — `validateFields(body, required)` já revisado; suporta `'string'|'number'|'boolean'|'uuid'`.

### Arquivos Dependentes
- `components/team-management-panel.tsx` (task_06) — o único consumidor destes cinco endpoints.
- `supabase_tenant_team_management.sql` (task_01) — o payload de metadados da rota de convite (`invited_tenant_id`, `invited_role`, `invited_can_configure_ai`) deve corresponder exatamente ao que o trigger lê.

### ADRs Relacionados
- [ADR-002: Mutações de gestão de equipe passam pelo client admin de service role](adrs/adr-002.md) — Por que toda mutação aqui usa `getSupabaseAdmin()` em vez de RLS.
- [ADR-003: Convite via metadados do Supabase Auth, tenant_members como armazenamento único do estado do convite](adrs/adr-003.md) — Semânticas exatas de convite/reenvio/revogação que esta tarefa implementa.

## Entregáveis
- Cinco arquivos de rota sob `app/api/tenants/[id]/members/` implementando os endpoints acima.
- `npx tsc --noEmit` e `npm run lint` passam.
- Verificação manual conforme a seção Testes, incluindo os casos de borda de e-mail duplicado e limpeza de pendente.

## Testes
- Integração (manual, sem suíte automatizada neste repositório):
  - [ ] `owner` e `admin` podem convidar um `gestor` e um `operador`; o próprio `gestor`/`operador` recebe 403 em `POST /invite`.
  - [ ] Convidar `role: 'owner'` é rejeitado com 400.
  - [ ] Convidar um e-mail que já é usuário em qualquer lugar do sistema retorna 409, não um sucesso silencioso.
  - [ ] `PATCH` mirando um membro com `role === 'owner'` retorna 403, tanto para `admin` quanto (se algum dia alcançável) outro ator.
  - [ ] `PATCH` tentando definir `role: 'owner'` em um membro não-owner é rejeitado.
  - [ ] `PATCH` alternando `canConfigureAI` em um membro `operador` persiste e é refletido na próxima verificação `requireAIConfigPermission` daquele usuário.
  - [ ] `DELETE` em um `gestor` ativo remove a linha `tenant_members`; `DELETE` em `role === 'owner'` retorna 403.
  - [ ] `DELETE` em um membro `pending` também exclui a linha `auth.users` (verifique via `supabaseAdmin.auth.admin.getUserById` retornando não-encontrado depois), e o mesmo e-mail pode ser reconvidado com sucesso depois.
  - [ ] `POST /resend` em um membro `pending` tem sucesso e não cria uma linha `tenant_members` duplicada; em um membro `active` retorna 400.
  - [ ] `GET /members` retorna linhas tanto `active` quanto `pending` a qualquer membro ativo do tenant, e retorna 404/403 para um usuário solicitando o `id` de outro tenant.
  - [ ] O limite de taxa dispara após exceder o `max` de convites configurado dentro de `windowMs` e retorna uma resposta equivalente a 429.
  - [ ] Toda mutação bem-sucedida produz uma linha em `audit_logs` com o `action` e `actor_role` corretos.
- Alvo de cobertura de teste: todos os cinco endpoints, todos os quatro papéis como ator quando relevante, mais todo caso de borda listado acima.

## Critérios de Sucesso
- Todos os cinco endpoints implementados e verificados manualmente conforme o checklist de Testes.
- Nenhuma rota consulta `tenant_members`/`profiles`/`auth.users` via client admin sem um filtro `tenant_id` explícito.
- `npx tsc --noEmit` e `npm run lint` limpos.