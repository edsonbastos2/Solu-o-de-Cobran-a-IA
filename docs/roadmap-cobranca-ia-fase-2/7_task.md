---
status: pending
title: Automação de workflows e campanhas
type: backend
complexity: high
dependencies: [1, 2]
---

# Automação de workflows e campanhas

## Visão Geral

As tabelas `workflows` e `campaigns` existem no `supabase_tenant_model.sql` mas sem runner nem UI. Implementar editor de workflows (trigger por vencimento, dias de atraso, status), segmentação de audiência por `audience_filter` JSONB, e runner via cron que enfileira disparos. Diferencia "negociação reativa" (atual) de "cobrança proativa programada" (indústria moderna). Casos de uso: campanha preventiva D-3 do vencimento; campanha pós-acordo de acompanhamento.

<critical>
- Leia o PRD e a TechSpec antes de implementar.
- Referencie as seções relevantes da TechSpec.
- O runner DEVE respeitar rate limit por canal e por destinatário (não spam).
- Audiência DEVE ser resolvida server-side via `audience_filter` JSONB (status, dias_atraso_min/max, estágio, contrato_id, perfil de pagador).
- Concorrentes BR (Neofin, Cobranças IA) segmentam a régua por perfil de pagador (bom/duvidoso/mau pagador) — derivar `payment_profile` do histórico de `financial_titles` do cliente (atrasos anteriores, quitações, acordos cumpridos) e permitir filtrar por ele.
- Campanha em status `draft` NÃO DEVE disparar.
- Logar cada disparo em `audit_logs` ou tabela de `campaign_dispatches`.
- Execute `npm run lint && npm run build`.
</critical>

<requirements>
1. `GET/POST /api/workflows` e `PUT/DELETE /api/workflows/[id]` para CRUD de workflows com `definition` JSONB (gatilho + sequência de passos).
2. `GET/POST /api/campaigns` e `PATCH /api/campaigns/[id]` (status: draft → scheduled → running → paused → completed).
3. `audience_filter` suporta: `case_status`, `days_overdue_min`, `days_overdue_max`, `stage`, `contract_id`, `payment_profile` (`good` | `doubtful` | `bad`, derivado do histórico do cliente — tarefa 6), `propensity_score_min` (tarefa 6).
4. Cron `/api/cron/run-campaigns` resolve audiência e dispara mensagens dentro da janela `starts_at`/`ends_at`.
5. Cada disparo cria ou reutiliza caso e envia primeira mensagem via IA.
6. UI `/workflows` (editor) e `/campaigns` (lista + cronograma).
7. Respeitar horário permitido (configurável, default 9h-18h dias úteis).
</requirements>

## Subtarefas

- [ ] CRUD `/api/workflows` e `/api/workflows/[id]`.
- [ ] CRUD `/api/campaigns` e `/api/campaigns/[id]`.
- [ ] Implementar resolvedor de audiência a partir de `audience_filter`.
- [ ] Derivar `payment_profile` do cliente (histórico de `financial_titles`: atrasos, quitações, acordos) e filtrar por ele.
- [ ] Criar cron `/api/cron/run-campaigns/route.ts`.
- [ ] Implementar controle de horário permitido e rate limit.
- [ ] UI `app/workflows/page.tsx` (editor de definição JSON com schema).
- [ ] UI `app/campaigns/page.tsx` (lista + formulário + cronograma).
- [ ] Logar disparos em `audit_logs`.

## Detalhes de Implementação

### Arquivos a Criar

- `app/api/workflows/route.ts`, `app/api/workflows/[id]/route.ts`
- `app/api/campaigns/route.ts`, `app/api/campaigns/[id]/route.ts`
- `app/api/cron/run-campaigns/route.ts`
- `lib/campaign-runner.ts`
- `app/workflows/page.tsx`, `app/campaigns/page.tsx`

### Arquivos a Modificar

- `lib/types.ts` — tipos `Workflow`, `Campaign` completos.
- `components/header.tsx` — adicionar navegação.

### Arquivos Relevantes

- `supabase_tenant_model.sql` — schemas de `workflows` e `campaigns`.
- `lib/agent.ts` — `processChat` reutilizado para primeira mensagem.
- `lib/messaging.ts` — `sendMessage`.

## Testes

### Testes de Integração

- [ ] Campanha `draft` não dispara.
- [ ] Campanha `running` dentro da janela dispara para audiência filtrada.
- [ ] Disparo fora do horário permitido é agendado, não executado.
- [ ] Audiência com `days_overdue_min=30` só inclui casos com 30+ dias.
- [ ] Audiência com `payment_profile='bad'` só inclui clientes com histórico de atrasos/quitações consistentes com o perfil.
- [ ] Campanha pausada não dispara até retomar.

## Critérios de Sucesso

- [ ] Workflow e campanha criáveis via UI.
- [ ] Cron dispara dentro da janela configurada.
- [ ] `npm run lint && npm run build` sem erros.