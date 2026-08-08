---
status: done
title: Validação final: typecheck, lint, build e checklist manual
type: test
complexity: low
dependencies:
  - task_6
---

# Validação final: typecheck, lint, build e checklist manual

## Visão Geral

Validação de fechamento da feature: roda `npx tsc --noEmit`, `npm run lint` e `npm run build` como evidência fresca e executa o checklist manual do PRD (desktop/mobile, RBAC, multi-tenant, tour). Confirma que nada do Header foi regredido (auth, tenant, tour, rotas).

## Requisitos

1. `npx tsc --noEmit` DEVE sair com 0 erros.
2. `npm run lint` DEVE passar.
3. `npm run build` DEVE concluir (inclui typecheck).
4. Checklist manual DEVE cobrir os fluxos do PRD (histórias de usuário).
5. Nenhuma dependência nova no `package.json`.

## Subtasks

- [ ] 7.1 Rodar `npx tsc --noEmit` e corrigir erros.
- [ ] 7.2 Rodar `npm run lint` e corrigir avisos.
- [ ] 7.3 Rodar `npm run build`.
- [ ] 7.4 Executar checklist manual (desktop, mobile, RBAC, tenant, tour).
- [ ] 7.5 Revisar `git status`/`git diff` para validar o escopo (inclui `git mv` das páginas).

## Testes (checklist manual)

- [ ] Desktop: sidebar expandida por padrão; `cmd/ctrl+b` e trigger alternam; colapsa para ícones.
- [ ] Mobile: hambúrguer abre drawer; Esc/clique fora fecha; navegar fecha; conteúdo em tela cheia.
- [ ] Ativo: `/cases` e `/cases/[id]` marcam "Casos (Ao Vivo)".
- [ ] RBAC: super-admin vê Painel Admin + TenantSwitcher; regular não.
- [ ] Tour: dispara preservando todos os `data-tour`.
- [ ] Tenant: troca reflete `?tenant_id=` e a rota ativa.
- [ ] Auth/404 sem regressão (`/login` público, rotas protegidas).

## Entregáveis

- Evidência: saídas de `tsc`, `lint`, `build` sem erros.
- Diff pronto para revisão (sem commit automático).

## Critérios de Sucesso

- Todos os comandos de validação passando.
- Checklist manual concluído.
- Sem dependências novas; diff confinado à feature.