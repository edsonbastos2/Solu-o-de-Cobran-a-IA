---
status: pending
title: Next-best-action para operador humano
type: ai
complexity: high
dependencies: [4]
---

# Next-best-action para operador humano

## Visão Geral

O painel lateral do detalhe do caso já mostra objetivos do estágio, mas é estático. Evoluir para recomendação dinâmica ("NBA"): próxma melhor ação sugerida ao operador humano. Ex: "Devedor mencionou dificuldade temporária em 3 mensagens; sugerir parcelamento em 4x até sexta", "Acordo expira em 12h", "Estamos no 31º dia — momento ideal para subir para negocial". Diferencial de IA que todo call center moderno busca.

<critical>
- Leia o PRD e a TechSpec antes de implementar.
- Referencie as seções relevantes da TechSpec.
- NBA DEVE considerar: estágio atual, dias até expiração de acordo, histórico de objeções (tarefa 4), propensão (tarefa 6), regras do contrato (negativação/protesto).
- NBA DEVE ser ação, não texto genérico ("faça X" com botão que já abre a ação).
- Execute `npm run lint && npm run build`.
</critical>

<requirements>
1. `GET /api/cases/[id]/nba` DEVE retornar array de ações sugeridas ordenadas por prioridade: `{action_type, label, rationale, priority, payload}`.
2. `action_type` inclui: `propose_installment`, `escalate_to_legal`, `send_reminder`, `schedule_callback`, `offer_discount`, `handoff_to_human`, `mark_unresponsive`.
3. NBA DEVE combinar insights (tarefa 4), estágio, regras de contrato e prazos legais.
4. NBA DEVE ter botão de ação na UI que já abre o modal/ação correspondente.
5. NBA NÃO DEVE sugerir violar CDC (ex: ameaçar negativação fora do prazo legal).
6. Cache de 2 minutos para evitar custo de LLM constante.
</requirements>

## Subtarefas

- [ ] Criar `lib/nba.ts` com função `generateNextBestActions(caseId)`.
- [ ] Criar `app/api/cases/[id]/nba/route.ts`.
- [ ] Implementar prompt que combina insights + estágio + regras + prazos.
- [ ] UI: cartão de NBA no painel lateral do detalhe do caso.
- [ ] Conectar botões de ação às ações existentes (enviar msg, escalar jurídico, criar acordo).
- [ ] Validar que NBA respeita prazos legais (CDC Art. 42/43).

## Detalhes de Implementação

### Arquivos a Criar

- `lib/nba.ts`
- `app/api/cases/[id]/nba/route.ts`

### Arquivos a Modificar

- `app/cases/[id]/page.tsx` — cartão NBA.

### Arquivos Relevantes

- `lib/case-insights.ts` (tarefa 4).
- `lib/finance.ts` — `getCollectionStage`.
- `lib/contract-rules.ts` (se criado) — prazos de negativação/protesto.

## Testes

### Testes de Integração

- [ ] Caso no estágio preventiva sugere abordagem amigável.
- [ ] Caso no dia 31 sugere escalar para negocial.
- [ ] Caso com acordo expirando em 12h sugere `send_reminder`.
- [ ] NBA nunca sugere negativação antes do prazo legal do contrato.

## Critérios de Sucesso

- [ ] NBA exibida com botão de ação acionável.
- [ ] Recomendação contextual ao caso.
- [ ] `npm run lint && npm run build` sem erros.