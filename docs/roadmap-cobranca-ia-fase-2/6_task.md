---
status: pending
title: Scoring de propensão a pagamento
type: ai
complexity: high
dependencies: [1, 2]
---

# Scoring de propensão a pagamento

## Visão Geral

O agente `analise_credito` já existe mas só gera texto descritivo (risco baixo/médio/alto). Evoluir para scoring quantitativo persistido: cada caso/cliente recebe `propensity_score` (0-1) que prioriza atribuição e ajusta agressividade da abordagem. Tendência forte (Experian: predictive analytics é o maior ROI). Começar incremental com heurística (dias atraso + histórico de pagamento + resposta anterior) e evoluir para embedding/cluster depois.

<critical>
- Leia o PRD e a TechSpec antes de implementar.
- Referencie as seções relevantes da TechSpec.
- Score DEVE ser persistido na coluna `cases.propensity_score` — não calculado on-the-fly em cada query.
- Recálculo DEVE ser assíncrono via cron, não bloquear criação de caso.
- Score NÃO DEVE substituir julgamento humano — é sinal auxiliar.
- Execute `npm run lint && npm run build`.
</critical>

<requirements>
1. Nova coluna `cases.propensity_score` (NUMERIC, nullable) e `cases.propensity_updated_at` (TIMESTAMPTZ).
2. Cron `/api/cron/score-propensity` recalcula scores para casos ativos semanalmente.
3. Algoritmo inicial (heurística): combina dias de atraso, histórico de pagamento do cliente, número de respostas anteriores, existência de acordos anteriores, estágio.
4. Score exibido no detalhe do caso e na lista de casos (badge de cor).
5. Lista de casos DEVE poder ordenar por `propensity_score` para priorizar.
6. Documentar fórmula heurística em `lib/propensity.ts`.
</requirements>

## Subtarefas

- [ ] Adicionar colunas `propensity_score` e `propensity_updated_at` em `cases` (migration).
- [ ] Criar `lib/propensity.ts` com `calculatePropensityScore(caseId)`.
- [ ] Implementar heurística inicial documentada.
- [ ] Criar cron `/api/cron/score-propensity/route.ts`.
- [ ] Exibir badge de score na lista e detalhe do caso.
- [ ] Permitir ordenação por score na lista de casos.

## Detalhes de Implementação

### Arquivos a Criar

- `lib/propensity.ts`
- `app/api/cron/score-propensity/route.ts`
- Migration SQL adicionando colunas.

### Arquivos a Modificar

- `app/cases/page.tsx` — badge e ordenação.
- `app/cases/[id]/page.tsx` — exibição do score.
- `lib/types.ts` — tipo `Case` com `propensity_score`.

### Arquivos Relevantes

- `lib/finance.ts` — `getDaysOverdue`, `getCollectionStage`.
- `financial_titles` — histórico de pagamento do cliente.

## Testes

### Testes de Integração

- [ ] Caso com título pago anteriormente recebe score mais alto.
- [ ] Caso com 0 respostas anteriores recebe score mais baixo.
- [ ] Cron recalcula sem erro para N casos.
- [ ] Score varia entre 0 e 1.

## Critérios de Sucesso

- [ ] Score persistido e recalculado via cron.
- [ ] Lista ordenável por propensão.
- [ ] Heurística documentada.
- [ ] `npm run lint && npm run build` sem erros.