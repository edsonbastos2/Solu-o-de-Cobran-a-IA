---
status: implemented
title: Notificações in-app ao operador
type: frontend
complexity: medium
dependencies: []
---

# Notificações in-app ao operador

## Visão Geral

A aba "Notificações" em Settings é placeholder. O cron `alert-admin` só faz `console.log`. Implementar notificações in-app reais: badge no header, painel de notificações, e conexão com cron de alertas (casos parados há 48h, acordos expirando, negativações pendentes).

<critical>
- Leia o PRD e a TechSpec antes de implementar.
- Referencie as seções relevantes da TechSpec.
- Notificações DEVE ser em tempo real (Supabase Realtime) ou polling curto.
- Marcar como lida DEVE persistir.
- Conectar ao cron `alert-admin` existente (substituir `console.log`).
- Execute `npm run lint && npm run build`.
</critical>

<requirements>
1. Nova tabela `notifications` (migration): id, tenant_id, user_id, type, title, body, related_case_id, read_at, created_at.
2. Cron `alert-admin` cria notificações em vez de `console.log`.
3. Cron `negotiations-expiry` (tarefa 2) cria notificações para acordos expirando.
4. `GET /api/notifications` e `PATCH /api/notifications/[id]` (marcar lida).
5. UI: sino no header com badge de não-lidas + painel dropdown.
6. Realtime em `notifications` para atualização instantânea.
</requirements>

## Subtarefas

- [ ] Criar migration `notifications` + RLS.
- [ ] CRUD `/api/notifications` e `/api/notifications/[id]`.
- [ ] Substituir `console.log` em `alert-admin` por inserção de notificação.
- [ ] Conectar crons de expiração (tarefa 2) à criação de notificações.
- [ ] UI: sino + badge + dropdown no header.
- [ ] Realtime channel em `notifications`.

## Detalhes de Implementação

### Arquivos a Criar

- Migration SQL `notifications`.
- `app/api/notifications/route.ts`, `app/api/notifications/[id]/route.ts`

### Arquivos a Modificar

- `app/api/cron/alert-admin/route.ts` — inserir notificação.
- `components/header.tsx` — sino + dropdown.
- `lib/types.ts` — tipo `Notification`.

### Arquivos Relevantes

- `app/api/cron/follow-up/route.ts` — padrão de cron.

## Testes

### Testes de Integração

- [ ] Cron `alert-admin` cria notificação visível no header.
- [ ] Marcar como lida remove badge.
- [ ] Realtime atualiza badge sem refresh.
- [ ] Tenant isolado.

## Critérios de Sucesso

- [ ] Notificações funcionais em tempo real.
- [ ] Cron conectado.
- [ ] `npm run lint && npm run build` sem erros.