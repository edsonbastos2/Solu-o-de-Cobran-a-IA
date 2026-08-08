---
status: pending
title: CI/CD + lint no build
type: infra
complexity: medium
dependencies: [19]
---

# CI/CD + lint no build

## Visão Geral

`eslint.ignoreDuringBuilds: true` mascara problemas no build. Não há CI/CD. Configurar GitHub Actions rodando lint, typecheck, testes (tarefa 19) e build em cada PR. Considerar reativar lint no build depois que débitos técnicos forem resolvidos.

<critical>
- Leia o PRD e a TechSpec antes de implementar.
- Referencie as seções relevantes da TechSpec.
- CI DEVE falhar PR se lint, typecheck ou testes falharem.
- Não reativar lint no build prematuramente (pode quebrar deploys existentes).
- Cache de dependências para acelerar.
- Execute `npm run lint && npm run build`.
</critical>

<requirements>
1. Workflow GitHub Actions `.github/workflows/ci.yml` rodando em PR e push para main.
2. Steps: install, lint, typecheck (`npx tsc --noEmit`), test (tarefa 19), build.
3. Cache de `node_modules` e `.next/cache`.
4. Adicionar script `typecheck` em `package.json` (`tsc --noEmit`).
5. Documentar em AGENTS.md que CI roda lint + testes.
6. Status badge no README.
</requirements>

## Subtarefas

- [ ] Criar `.github/workflows/ci.yml`.
- [ ] Adicionar script `typecheck` em `package.json`.
- [ ] Configurar cache de dependências.
- [ ] Documentar em AGENTS.md.
- [ ] Badge no README.

## Detalhes de Implementação

### Arquivos a Criar

- `.github/workflows/ci.yml`

### Arquivos a Modificar

- `package.json` — script `typecheck`.
- `AGENTS.md` — documentar CI.
- `README.md` — badge.

### Arquivos Relevantes

- `19_task.md` — testes.

## Testes

### Critérios

- [ ] CI roda em PR e falha se lint/testes/build falharem.
- [ ] Typecheck script funciona.

## Critérios de Sucesso

- [ ] CI funcional em GitHub Actions.
- [ ] `npm run lint && npm run build` sem erros.