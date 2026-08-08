---
status: pending
title: Negativação (Serasa/SPC/Boa Vista)
type: backend
complexity: high
dependencies: [2]
---

# Negativação (Serasa/SPC/Boa Vista)

## Visão Geral

A tabela `negativations` existe no schema mas sem implementação. Implementar UI e API com controle de prazos legais (CDC Art. 43 — notificação prévia de 5 dias antes de negativar), fila de negativação baseada em `override_days_to_negative` do contrato, e integração mock com Serasa/SPC/Boa Vista (substituível por integração real depois). Ferramenta de pressão regulada que falta ao Especialista/Jurídico.

<critical>
- Leia o PRD e a TechSpec antes de implementar.
- Referencie as seções relevantes da TechSpec.
- DEVE notificar o devedor com 5 dias de antecedência (CDC Art. 43).
- DEVE respeitar `override_days_to_negative` do contrato (ou da política).
- A tabela `negativations` NÃO possui `notified_at` — criar migration adicionando a coluna (e checando se o status default `'pending'` deve evoluir para `'pending_notification'`).
- Status: `pending_notification` → `notified` → `requested` → `completed` → `removed`.
- Remoção DEVE ocorrer em até 2 dias úteis após quitação (CDC).
- Execute `npm run lint && npm run build`.
</critical>

<requirements>
1. `GET/POST /api/negativations` e `PATCH /api/negativations/[id]`.
2. Cron `/api/cron/negativations` identifica títulos elegíveis (dias de atraso ≥ limite) e cria `negotiation` com `status='pending_notification'`.
3. Cron envia notificação ao devedor via mensageria e marca `notified` com `notified_at`.
4. Após 5 dias de `notified`, status → `requested` (integração mock grava `external_reference`).
5. Após confirmação do provedor, status → `completed` com `completed_at`.
6. Baixa do título (tarefa 3) DEVE disparar remoção (`status='removed'`, `removed_at=now()`).
7. UI `/negativations` com fila, status e prazos.
</requirements>

## Subtarefas

- [ ] Migration: adicionar `notified_at TIMESTAMPTZ` em `negativations` (e validar enum de status).
- [ ] CRUD `/api/negativations` e `/api/negativations/[id]`.
- [ ] Cron `/api/cron/negativations/route.ts` (elegibilidade + notificação + transição).
- [ ] Implementar provider mock (`lib/negativation-provider.ts`).
- [ ] Conectar baixa de título (tarefa 3) à remoção automática.
- [ ] UI `app/negativations/page.tsx`.
- [ ] Adicionar alerta no detalhe do caso quando negativação ativa.

## Detalhes de Implementação

### Arquivos a Criar

- `app/api/negativations/route.ts`, `app/api/negativations/[id]/route.ts`
- `app/api/cron/negativations/route.ts`
- `lib/negativation-provider.ts`
- `app/negativations/page.tsx`

### Arquivos a Modificar

- `app/api/financial-titles/[id]/route.ts` (tarefa 3) — disparar remoção.
- `app/cases/[id]/page.tsx` — alerta de negativação.
- `components/header.tsx` — navegação.

### Arquivos Relevantes

- `supabase_tenant_model.sql` — schema `negativations`.
- `lib/finance.ts` — `getDaysOverdue`.
- `lib/messaging.ts` — notificação.

## Testes

### Testes de Integração

- [ ] Título com 60 dias de atraso vira `pending_notification`.
- [ ] Notificação enviada marca `notified`.
- [ ] Após 5 dias, status → `requested`.
- [ ] Baixa do título dispara `removed`.
- [ ] Título com 30 dias não vira `pending_notification` se limite é 60.

## Critérios de Sucesso

- [ ] Fila de negativação visível e funcional.
- [ ] Prazo legal de 5 dias respeitado.
- [ ] Remoção automática na baixa.
- [ ] `npm run lint && npm run build` sem erros.