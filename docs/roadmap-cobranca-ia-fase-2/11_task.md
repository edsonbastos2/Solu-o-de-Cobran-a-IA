---
status: implemented
title: Quarentena de contas (`quarantines`)
type: backend
complexity: medium
dependencies: [2]
---

# Quarentena de contas (`quarantines`)

## Visão Geral

A tabela `quarantines` existe no schema mas sem implementação. Implementar bloqueio de abordagens para devedores em situações especiais: litígio em andamento, falecimento, pedido de não contato (CDC Art. 42 § único), revisão interna. Contas em quarentena não recebem disparos de campanhas nem mensagens automáticas da IA.

<critical>
- Leia o PRD e a TechSpec antes de implementar.
- Referencie as seções relevantes da TechSpec.
- Caso em quarentena DEVE bloquear `processChat`, `start-negotiation` e campanhas (tarefa 7).
- Status: `pending_review` → `approved` → `released` / `permanent_block`.
- Motivo DEVE ser obrigatório e registrado.
- A tabela `quarantines` NÃO possui `expires_at` — criar migration adicionando a coluna (nullable).
- Execute `npm run lint && npm run build`.
</critical>

<requirements>
1. `GET/POST /api/quarantines` e `PATCH /api/quarantines/[id]`.
2. `processChat` em `lib/agent.ts` DEVE checar quarentena ativa antes de responder.
3. `start-negotiation` DEVE checar quarentena antes de iniciar.
4. Campanhas (tarefa 7) DEVE excluir casos em quarentena da audiência.
5. UI `/quarantines` com fila de revisão.
6. Quarentena `permanent_block` nunca expira; outras têm `expires_at` opcional.
</requirements>

## Subtarefas

- [ ] Migration: adicionar `expires_at TIMESTAMPTZ` (nullable) em `quarantines`.
- [ ] CRUD `/api/quarantines` e `/api/quarantines/[id]`.
- [ ] Guard em `lib/agent.ts` (checa quarentena antes de `processChat`).
- [ ] Guard em `app/api/start-negotiation/route.ts`.
- [ ] Filtro em resolvedor de audiência (tarefa 7).
- [ ] UI `app/quarantines/page.tsx`.

## Detalhes de Implementação

### Arquivos a Criar

- `app/api/quarantines/route.ts`, `app/api/quarantines/[id]/route.ts`
- `app/quarantines/page.tsx`

### Arquivos a Modificar

- `lib/agent.ts` — guard de quarentena.
- `app/api/start-negotiation/route.ts` — guard.
- `lib/campaign-runner.ts` (tarefa 7) — exclusão.

### Arquivos Relevantes

- `supabase_tenant_model.sql` — schema `quarantines`.

## Testes

### Testes de Integração

- [ ] Caso em quarentena não responde a `processChat`.
- [ ] Caso em quarentena não inicia negociação.
- [ ] Quarentena expirada permite retomar contato.
- [ ] `permanent_block` nunca libera.

## Critérios de Sucesso

- [ ] Quarentena bloqueia abordagens.
- [ ] UI de revisão funcional.
- [ ] `npm run lint && npm run build` sem erros.