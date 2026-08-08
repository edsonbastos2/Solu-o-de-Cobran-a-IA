---
status: pending
title: Observabilidade e logging estruturado
type: infra
complexity: medium
dependencies: []
---

# Observabilidade e logging estruturado

## Visão Geral

Apenas `console.error`/`console.warn` sem estrutura. Substituir por logging estruturado (Sentry ou Logflare via Supabase) com níveis, contexto de tenant/user, e correlação de requisições. Necessário para debugar em produção.

<critical>
- Leia o PRD e a TechSpec antes de implementar.
- Referencie as seções relevantes da TechSpec.
- Logs NÃO DEVEM conter dados sensíveis (chaves AI, tokens, senhas).
- DEVE incluir `tenant_id`, `user_id`, `request_id` em cada log.
- Erros de LLM e webhooks DEVEM ser capturados.
- Execute `npm run lint && npm run build`.
</critical>

<requirements>
1. Criar `lib/logger.ts` com níveis (debug/info/warn/error) e contexto.
2. Substituir `console.error/warn` em `lib/agent.ts`, webhooks, crons e rotas de API.
3. Integração com Sentry (se `SENTRY_DSN` configurado) ou fallback em console estruturado.
4. `request_id` gerado por middleware e propagado.
5. Documentar `SENTRY_DSN` em `.env.example`.
</requirements>

## Subtarefas

- [ ] Criar `lib/logger.ts` com níveis e contexto.
- [ ] Adicionar `request_id` em `middleware.ts`.
- [ ] Substituir `console.*` em pontos críticos.
- [ ] Integrar Sentry (opcional, com fallback).
- [ ] Documentar em `.env.example`.

## Detalhes de Implementação

### Arquivos a Criar

- `lib/logger.ts`

### Arquivos a Modificar

- `middleware.ts` — `request_id`.
- `lib/agent.ts`, webhooks, crons, rotas de API — usar logger.
- `.env.example`.

## Testes

### Critérios

- [ ] Logs estruturados em JSON com contexto.
- [ ] `request_id` propagado.
- [ ] Nenhum dado sensível nos logs.

## Critérios de Sucesso

- [ ] Logger estruturado funcional.
- [ ] `npm run lint && npm run build` sem erros.