---
status: implemented
title: Permissões granulares por role
type: backend
complexity: medium
dependencies: []
---

# Permissões granulares por role

## Visão Geral

`tenant_members.role` (owner/admin/member) existe mas nada checa além de super-admin. Implementar verificação de role em endpoints sensíveis: member não pode criar/editar políticas, não pode gerenciar usuários, não pode aprovar quarentena. Admin pode tudo exceto gerenciar owner.

<critical>
- Leia o PRD e a TechSpec antes de implementar.
- Referencie as seções relevantes da TechSpec.
- Owner é imune a remoção e pode tudo.
- Member não pode mutar políticas, agentes, usuários, workflows.
- Auditoria DEVE registrar o role do ator.
- Execute `npm run lint && npm run build`.
</critical>

<requirements>
1. Estender `requireTenantContext` para retornar `role` do usuário no tenant.
2. Helper `requireRole(req, minRole)` retorna 403 se role insuficiente.
3. Endpoints sensíveis (policies, agents, admin/users, workflows, quarantines approve) exigem `admin` ou `owner`.
4. UI esconde ações proibidas por role.
5. Auditoria registra `actor_role`.
</requirements>

## Subtarefas

- [ ] Estender `lib/api-auth.ts` com `role` no retorno e `requireRole`.
- [ ] Aplicar `requireRole` em rotas de policies, agents, admin/users, workflows, quarantines.
- [ ] UI esconde botões/links proibidos por role.
- [ ] Auditoria com `actor_role`.

## Detalhes de Implementação

### Arquivos a Modificar

- `lib/api-auth.ts` — `requireRole`, `role` no retorno.
- Rotas sensíveis em `app/api/`.
- `components/header.tsx` — esconder navegação por role.
- `hooks/useAuth.ts` — expor `role`.

### Arquivos Relevantes

- `supabase_tenant_model.sql` — schema `tenant_members.role`.

## Testes

### Testes de Integração

- [ ] Member recebe 403 ao criar política.
- [ ] Admin pode criar política mas não remover owner.
- [ ] Owner pode tudo.
- [ ] Auditoria registra role.

## Critérios de Sucesso

- [ ] Roles enforced em API e UI.
- [ ] `npm run lint && npm run build` sem erros.