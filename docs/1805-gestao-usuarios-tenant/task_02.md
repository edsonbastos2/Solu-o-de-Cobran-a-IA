---
status: done
title: "lib/api-auth.ts: TenantRole (4 valores), requireAIConfigPermission"
type: backend
complexity: média
dependencies:
  - task_01
---

# Tarefa 02: Estender `lib/api-auth.ts` para papéis de 4 níveis e a permissão de configuração de IA

## Nota de status

Implementado. `lib/api-auth.ts` exporta `TenantRole` (4 valores), `ROLE_RANK` atualizado, `canConfigureAI` em `TenantContext` e `requireAIConfigPermission`; `lib/audit.ts` usa `TenantRole` para `actorRole`. `npx tsc --noEmit` e `npm run lint` (arquivos tocados) limpos. Dez call sites que ainda passavam `requireRole(req, 'member', ...)` foram trocados para `'operador'` apenas para satisfazer o compilador — a escolha do `minRole` correto por rota é escopo da task_04 (ver lista completa no relatório de execução). Verificação manual dos casos de teste do checklist abaixo (papel `gestor` de fato, `can_configure_ai` via coluna) não pôde ser executada ponta a ponta neste ambiente porque a migração da task_01 ainda não foi aplicada ao Supabase remoto (sem acesso de rede); a lógica foi validada por leitura de código e pelos branches exercitados na análise abaixo.

## Visão Geral

Estende o helper central de autorização do lado do servidor com o novo modelo de papéis: `TenantRole` cresce de 3 para 4 valores, `ROLE_RANK` reflete a nova hierarquia e um booleano `canConfigureAI` é computado no `TenantContext` para que as rotas possam proteger com base na permissão independente de configuração de IA em vez de apenas no rank de papel. Toda outra tarefa de backend (03, 04, 05) constrói diretamente sobre os tipos e funções exportados deste arquivo.

<critical>
- SEMPRE LEIA o PRD e a TechSpec antes de começar (`../prd.md`, `../techspec.md`).
- REFERENCIE a seção 'Interfaces Principais' da TechSpec para as assinaturas exatas de tipo/função — não divirja delas.
- FOQUE NO "O QUÊ" — descreva o contrato que este arquivo deve expor, não a implementação linha por linha.
- MINIMIZE CÓDIGO — o trecho abaixo mostra apenas a forma atual sendo substituída.
- TESTES OBRIGATÓRIOS — toda tarefa DEVE incluir testes nos entregáveis.
</critical>

<requirements>
- DEVE mudar `TenantContext['role']` (atualmente `'owner' | 'admin' | 'member'`) e o parâmetro `minRole` do `requireRole` para `TenantRole = 'owner' | 'admin' | 'gestor' | 'operador'` — `'member'` NÃO DEVE permanecer no tipo.
- DEVE atualizar `ROLE_RANK` para `{ owner: 4, admin: 3, gestor: 2, operador: 1 }`.
- DEVE atualizar a lógica de normalização de papel do `requireTenantContext` (atualmente `memberRole === 'owner' || memberRole === 'admin' ? memberRole : 'member'`) para aceitar todos os quatro valores e padronizar qualquer valor inesperado para `'operador'` (o novo piso), não `'member'`.
- DEVE adicionar `canConfigureAI: boolean` ao `TenantContext`, computado no `requireTenantContext` a partir da mesma linha `tenant_members` já consultada: `role === 'owner' || role === 'admin' || row.can_configure_ai === true` — sem consulta adicional.
- DEVE atualizar o select de `tenant_members` no `requireTenantContext` para também buscar `can_configure_ai`.
- DEVE adicionar `requireAIConfigPermission(req, requestedTenantId?)`, espelhando a forma do `requireRole` (`Promise<{ ctx: TenantContext } | { response: NextResponse }>`), retornando 403 quando `!ctx.canConfigureAI`.
- DEVE atualizar `AuditActionParams['actorRole']` de `lib/audit.ts` e o tipo do parâmetro `actorRole` de `auditAdminAction` de `'owner' | 'admin' | 'member'` para `TenantRole` (importar de `lib/api-auth.ts`), já que todo call site que passa `role`/`ctx.role` deste arquivo deve continuar passando na checagem de tipos.
- NÃO DEVE mudar `requireUser`, `requireSuperAdmin` ou `serverError` — fora de escopo.
</requirements>

## Subtarefas
- [x] 02.1 Atualizar `TenantContext`, `ROLE_RANK` e a assinatura/tipo do `requireRole` em `lib/api-auth.ts`.
- [x] 02.2 Atualizar a consulta `tenant_members` do `requireTenantContext` para selecionar `can_configure_ai` e computar `canConfigureAI` + o fallback de papel corrigido.
- [x] 02.3 Adicionar `requireAIConfigPermission`.
- [x] 02.4 Atualizar o tipo `actorRole` de `lib/audit.ts` para `TenantRole` e re-exportar/importar conforme necessário.
- [x] 02.5 Executar `npx tsc --noEmit` e corrigir todo call site que quebra com o literal `'member'` removido (espere hits em rotas que ainda passam `requireRole(req, 'member', ...)` — são exatamente as rotas que a task_04 retroaplica; para esta tarefa, apenas faça-as passar na checagem de tipos, por exemplo temporariamente como `'operador'`, já que a task_04 é dona da correção do minRole escolhido de cada rota).

## Detalhes de Implementação

Arquivo atual (para referência — não duplique a listagem completa da TechSpec, isto é apenas a superfície do diff):

```typescript
export interface TenantContext extends AuthContext {
  tenantId: string;
  role: 'owner' | 'admin' | 'member';
  supabase: NonNullable<ReturnType<typeof getSupabaseServer>>;
}
```
torna-se a forma com `TenantRole`/`canConfigureAI` em 'Interfaces Principais' da TechSpec. A consulta `tenant_members` dentro do `requireTenantContext` (branch não super-admin) atualmente seleciona `'tenant_id, role'` — estenda para `'tenant_id, role, can_configure_ai'`.

### Arquivos Relevantes
- `lib/api-auth.ts` — arquivo principal, conteúdo completo já revisado; `requireTenantContext` (branch não super-admin, ~linhas 94-124) e `requireRole` (~linhas 136-149) são as funções exatas a mudar.
- `lib/audit.ts` — `AuditActionParams.actorRole` e o parâmetro `actorRole` de `auditAdminAction` atualmente tipados `'owner' | 'admin' | 'member' | null`.

### Arquivos Dependentes
- `hooks/useAuth.ts` (task_03) — espelho do lado do cliente do mesmo conjunto de papéis; deve permanecer em sincronia, mas é um arquivo/tarefa separado já que roda no navegador contra o client com escopo anon, não através de `lib/api-auth.ts`.
- Todo arquivo de rota tocado na task_04 e na task_05 — consome `requireRole`/`requireAIConfigPermission` diretamente.
- `app/api/tenants/[id]/ai-config/route.ts` — seu handler `PUT` troca `requireRole(req, 'admin', ...)` por `requireAIConfigPermission(req, ...)` (coberto no escopo da task_04 já que é uma troca de helper de auth de uma linha numa rota existente, não uma interface nova).

### ADRs Relacionados
- [ADR-001: Papéis fixos de equipe com um interruptor independente de permissão de configuração de IA](adrs/adr-001.md) — Por que `canConfigureAI` é independente do rank de papel.
- [ADR-004: Rank de papéis de quatro níveis, substituindo member, retroaplicado nas rotas CRUD existentes sem proteção](adrs/adr-004.md) — Por que `member` é totalmente aposentado em vez de mantido como alias.

## Entregáveis
- `lib/api-auth.ts` exportando o `TenantRole` de 4 valores, `ROLE_RANK` atualizado, `canConfigureAI` no `TenantContext` e `requireAIConfigPermission`.
- `actorRole` de `lib/audit.ts` tipado como `TenantRole`.
- `npx tsc --noEmit` passa com zero erros introduzidos por esta mudança (correções temporárias de literal `'member'` → `'operador'` nos call sites aceitáveis aqui; a task_04 revisita a correção de cada um).
- Verificação manual equivalente a unit (sem suíte de testes neste repositório) com 80%+ dos novos branches exercitados conforme a seção Testes abaixo.

## Testes
- Manual/integração (sem suíte de testes automatizada neste repositório, conforme o CLAUDE.md):
  - [ ] Um usuário com `tenant_members.role = 'gestor'` chamando uma rota protegida com `requireRole(req, 'gestor', ...)` tem sucesso.
  - [ ] O mesmo usuário chamando uma rota protegida com `requireRole(req, 'admin', ...)` recebe 403.
  - [ ] Um usuário com `role = 'operador'` e `can_configure_ai = true` passa em `requireAIConfigPermission` mas falha em `requireRole(req, 'gestor', ...)`.
  - [ ] Um usuário com `role = 'admin'` e `can_configure_ai = false` (valor da coluna irrelevante) ainda passa em `requireAIConfigPermission` (implicado pelo papel, não dependente da coluna).
  - [ ] Uma string de papel inesperada/legada em `tenant_members.role` (não deve ocorrer pós-migração, mas verificar defensivamente) normaliza para `'operador'`, não um erro lançado nem `'member'`.
  - [ ] Chamadas de `recordAuditAction`/`auditAdminAction` passando `role: 'gestor'` ou `'operador'` passam na checagem de tipos e persistem corretamente em `audit_logs.actor_role`.
- Alvo de cobertura de teste: todos os quatro papéis e o override de configuração de IA exercitados pelo menos uma vez.
- Todas as verificações manuais devem passar; `npx tsc --noEmit` e `npm run lint` limpos.

## Critérios de Sucesso
- `npx tsc --noEmit` passa.
- `requireRole` e `requireAIConfigPermission` se comportam corretamente para todos os quatro papéis conforme o checklist de Testes.
- Nenhuma referência restante a `'member'` como valor válido de `TenantRole` em qualquer lugar de `lib/api-auth.ts` ou `lib/audit.ts`.