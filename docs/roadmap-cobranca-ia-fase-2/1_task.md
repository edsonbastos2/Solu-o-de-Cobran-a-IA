---
status: implemented
title: Corrigir dashboard de métricas (legacy status)
type: api
complexity: medium
dependencies: []
---

# Corrigir dashboard de métricas (legacy status)

## Visão Geral

O `GET /api/dashboard/metrics` referencia status legados (`in_progress`/`paid`/`agreed`) que **não existem** no enum real de `cases` (`not_started`/`in_negotiation`/`needs_attention`/`closed`), fazendo as métricas retornarem sempre zeradas. Reescrever o endpoint cruzando os status reais, `financial_titles.status` e (assim que existir) `negotiations`, com funil de cobrança e aging por bucket.

<critical>
- Leia o PRD e a TechSpec antes de implementar.
- Referencie as seções relevantes da TechSpec.
- Use `requireTenantContext` para isolar por tenant.
- Nunca consulte `installments.status` como fonte de verdade — use `financial_titles.status`.
- KPIs devem refletir o funil: preventiva → amigável → negocial → especializada → acordo → quitado.
- Execute `npm run lint && npm run build` como verificação.
</critical>

<requirements>
1. O endpoint DEVE retornar total_cases, active_cases, recovered_amount, pending_amount, success_rate consistentes com os status reais de `cases`.
2. O endpoint DEVE calcular `recovered_amount` somando `financial_titles.current_value` onde `status='paid'` E `paid_at IS NOT NULL`.
3. O endpoint DEVE expor aging por bucket (0-30/31-90/91-180/180+) usando `getDaysOverdue`.
4. O endpoint DEVE expor distribuicao por estágio (`getCollectionStage`) e por canal de mensageria.
5. O endpoint DEVE calcular tempo médio de resolução (`created_at` → `updated_at` para `status='closed'`).
6. O endpoint NÃO DEVE usar os status `in_progress`, `paid` ou `agreed` em nenhuma query.
</requirements>

## Subtarefas

- [ ] Auditar queries atuais em `app/api/dashboard/metrics/route.ts`.
- [ ] Mapear enumeradores reais de `cases.status` e `financial_titles.status`.
- [ ] Reescrever agregações usando os status canônicos.
- [ ] Adicionar aging por bucket via `getDaysOverdue`.
- [ ] Adicionar distribuição por estágio via `getCollectionStage`.
- [ ] Adicionar tempo médio de resolução e taxa de acordo (placeholder — completo quando tarefa 2 existir).
- [ ] Garantir isolamento por tenant.

## Detalhes de Implementação

### Arquivos a Modificar

- `app/api/dashboard/metrics/route.ts` — reescrever agregações.

### Arquivos Relevantes

- `lib/finance.ts` — `getDaysOverdue`, `getCollectionStage`.
- `lib/api-auth.ts` — `requireTenantContext`.
- `components/dashboard-charts.tsx` — consumidor dos novos campos.

### Arquivos Dependentes

- `2_task.md` — acordos formais enriquecem `success_rate` e `recovered_amount`.
- `6_task.md` — scoring usa aging por bucket.
- `14_task.md` — exportação reutiliza agregações.

## Testes

### Testes de Integração

- [ ] Dashboard com zero casos retorna zeros consistentes (não NaN).
- [ ] Dashboard com casos em cada status real retorna contagens corretas.
- [ ] Caso fechado (acordo) não aparece como ativo.
- [ ] Título pago soma em `recovered_amount`.

## Critérios de Sucesso

- [ ] `GET /api/dashboard/metrics` retorna números não-nulos em ambiente populado.
- [ ] Nenhuma referência a `in_progress`/`paid`/`agreed` em queries.
- [ ] `npm run lint` sem erros.
- [ ] `npm run build` sem erros.