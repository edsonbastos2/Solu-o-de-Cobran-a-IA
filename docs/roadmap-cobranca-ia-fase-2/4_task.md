---
status: implemented
title: Insights longitudinais do histórico de mensagens
type: ai
complexity: high
dependencies: [2]
---

# Insights longitudinais do histórico de mensagens

## Visão Geral

O `Supervisor` classifica a intenção da mensagem atual, mas falta análise longitudinal de todo o histórico de um caso. Criar endpoint `/api/cases/[id]/insights` que usa LLM para gerar: heatmap de sentimento ao longo do tempo, principais objeções levantadas, probabilidade atual de acordo, e temas recorrentes. Alimenta o painel lateral do operador humano com contexto estratégico. Tendência forte na indústria (Experian: predictive analytics é o maior ROI).

<critical>
- Leia o PRD e a TechSpec antes de implementar.
- Referencie as seções relevantes da TechSpec.
- Use as chaves do dono do caso (RPC `get_user_ai_keys`).
- Limite o token budget — envie apenas resumo, não o histórico completo se >50 mensagens.
- Pipeline deve ser read-only (não muta caso).
- Execute `npm run lint && npm run build`.
</critical>

<requirements>
1. `GET /api/cases/[id]/insights` DEVE retornar JSON com: `sentiment_trend` (array de {date, score -1..1}), `main_objections` (top 5), `theme_summary` (string), `agreement_probability` (0-1), `recommended_tone` (string).
2. O endpoint DEVE ser read-only (não insere mensagens nem muda status).
3. O endpoint DEVE usar LLM do provedor do dono do caso com fallback para opencode.
4. A UI do detalhe do caso DEVE renderizar gráfico de sentimento e cartões de objeções.
5. O endpoint DEVE ter cache de 5 minutos para evitar custo excessivo de LLM.
6. O schema DEVE incluir caso + mensagens + estágio atual + histórico de acordos (tarefa 2).
</requirements>

## Subtarefas

- [ ] Criar `lib/case-insights.ts` com função `generateCaseInsights(caseId)`.
- [ ] Criar `app/api/cases/[id]/insights/route.ts` com cache simples (in-memory, TTL 5min).
- [ ] Implementar prompt de análise longitudinal com formato JSON esperado.
- [ ] UI no detalhe do caso: gráfico de linha (Recharts) + cartões de objeções.
- [ ] Truncar histórico >50 mensagens para os últimos 50 com resumo dos primeiros.
- [ ] Validar isolamento por tenant.

## Detalhes de Implementação

### Arquivos a Criar

- `lib/case-insights.ts`
- `app/api/cases/[id]/insights/route.ts`

### Arquivos a Modificar

- `app/cases/[id]/page.tsx` — painel de insights.
- `lib/types.ts` — tipo `CaseInsights`.

### Arquivos Relevantes

- `lib/agent.ts` — `callLLM`, resolução de chaves.
- `messages` table — fonte de histórico.

## Testes

### Testes de Integração

- [ ] Caso com 30 mensagens retorna insights coerentes.
- [ ] Caso sem mensagens retorna resposta vazia estruturada (não erro).
- [ ] Cache serve resposta idêntica em 2 chamadas em 5min.
- [ ] Tenant A não acessa insights de caso do tenant B.

## Critérios de Sucesso

- [ ] Insight longitudinal exibido no detalhe do caso.
- [ ] Probabilidade de acordo visível ao operador.
- [ ] `npm run lint && npm run build` sem erros.