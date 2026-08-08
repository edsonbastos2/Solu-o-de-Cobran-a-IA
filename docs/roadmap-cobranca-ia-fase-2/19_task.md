---
status: pending
title: Suíte de testes automatizados
type: test
complexity: high
dependencies: []
---

# Suíte de testes automatizados

## Visão Geral

Não há suite de testes, nem script, nem CI. Priorizar testes sobre `processChat` (regressão de prompts), gatilhos RLS multi-tenant, e funções puras de `lib/finance.ts`. Configurar Vitest (compatível com Next.js) + testes de integração com Supabase local.

<critical>
- Leia o PRD e a TechSpec antes de implementar.
- Referencie as seções relevantes da TechSpec.
- Testes NÃO DEVEM chamar LLMs reais (mock `callLLM`).
- Testes de RLS DEVEM usar Supabase local (docker) ou emulador.
- Cobertura mínima: `lib/finance.ts`, `lib/agent.ts` (com mock), `lib/api-auth.ts`, RLS de tenant.
- Execute `npm run lint && npm run build`.
</critical>

<requirements>
1. Configurar Vitest com `vitest.config.ts`.
2. Adicionar scripts `test`, `test:watch`, `test:coverage` em `package.json`.
3. Testes unitários para `lib/finance.ts` (`calculateUpdatedValue`, `getDaysOverdue`, `getCollectionStage`, `getFinancialTitleEligibility`).
4. Testes unitários para `lib/agent.ts` com `callLLM` mockado (valida tags `[ACORDO_FECHADO]`, `[HANDOFF]`, transições de status).
5. Testes unitários para `lib/api-auth.ts` (`requireTenantContext`, `requireRole`).
6. Testes de integração para RLS multi-tenant (tenant A não vê dados de B).
7. CI roda testes (tarefa 20).
</requirements>

## Subtarefas

- [ ] Instalar Vitest + `@vitest/coverage-v8`.
- [ ] Criar `vitest.config.ts`.
- [ ] Adicionar scripts em `package.json`.
- [ ] Testes de `lib/finance.ts`.
- [ ] Testes de `lib/agent.ts` com mock de LLM.
- [ ] Testes de `lib/api-auth.ts`.
- [ ] Testes de RLS com Supabase local.
- [ ] Documentar como rodar em AGENTS.md.

## Detalhes de Implementação

### Arquivos a Criar

- `vitest.config.ts`
- `tests/finance.test.ts`
- `tests/agent.test.ts`
- `tests/api-auth.test.ts`
- `tests/rls.test.ts`

### Arquivos a Modificar

- `package.json` — scripts de teste.
- `AGENTS.md` — documentar comando de teste.

## Testes

### Critérios

- [ ] `npm test` roda sem erro.
- [ ] Cobertura ≥ 80% em `lib/finance.ts`.
- [ ] Mock de LLM valida tags de status.
- [ ] RLS testado entre tenants.

## Critérios de Sucesso

- [ ] Suite de testes funcional.
- [ ] Scripts documentados.
- [ ] `npm run lint && npm run build` sem erros.