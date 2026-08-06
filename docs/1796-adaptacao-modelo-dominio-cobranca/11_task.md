---
status: completed
title: Corrigir pipeline de IA server-side
type: ai
complexity: high
dependencies: ["9_task", "10_task"]
---

# Corrigir pipeline de IA server-side

## Visão Geral

Corrigir o acesso a dados do agente para uso em rotas server-side e incluir o contexto canônico do caso nas conversas. A estratégia de negociação existente será preservada.

<critical>
- Leia a TechSpec e não redesenhe os agentes.
- Não usar cliente browser-only em servidor.
- Não usar service role para ignorar o tenant do caso.
- Rotas internas DEVEM exigir autenticação.
</critical>

<requirements>
1. `processChat` DEVE receber cliente server-side ou contexto carregado.
2. `/api/chat` e `/api/start-negotiation` DEVEM validar usuário e caso.
3. Prompts DEVEM receber cliente, contrato e título corretos.
4. Mensagens IA e mudanças de status DEVEM ser auditáveis.
</requirements>

## Subtarefas

- [x] Remover import browser-only do agente.
- [x] Ajustar assinatura e chamadas do pipeline.
- [x] Proteger rotas de chat/negociação.
- [x] Adicionar contexto e auditoria.

## Detalhes de Implementação

### Arquivos a Criar

- Nenhum.

### Arquivos a Modificar

- `lib/agent.ts` — acesso server-side e contexto.
- `lib/multi-agent.ts` — propagação do contexto quando necessário.
- `app/api/chat/route.ts` — autenticação.
- `app/api/start-negotiation/route.ts` — autenticação e escopo.

### Arquivos Relevantes

- `lib/supabase-server.ts` — cliente server-side.
- `lib/audit.ts` — ações IA.
- `lib/finance.ts` — estágio.

### Arquivos Dependentes

- `12_task.md` e `15_task.md`.

## Entregáveis

- [x] Pipeline sem cliente browser-only.
- [x] Contexto financeiro presente no processamento.
- [x] Rotas internas protegidas.

## Testes

### Testes Unitários

- [x] Contexto é serializado no prompt sem campos ausentes inesperados.
- [x] Falha de cliente server-side retorna erro controlado.

### Testes de Integração

- [x] Sem sessão retorna 401.
- [x] Caso de outro tenant não é processado.
- [x] Mensagem IA é persistida no caso correto.
- [x] Status e auditoria usam o tenant correto.

## Critérios de Sucesso

- [x] Chat funciona em runtime server-side.
- [x] Nenhum acesso arbitrário por case ID.
- [x] Estratégia de agentes existente preservada.
- [x] `npm run lint` sem erros.
- [x] `npm run build` sem erros.
