---
status: implemented
title: Protesto em cartório
type: backend
complexity: high
dependencies: [8]
---

# Protesto em cartório

## Visão Geral

A tabela `protests` existe no schema mas sem implementação. Implementar UI e API análoga à negativação, com controle de `override_days_to_protest` do contrato, integração mock com cartório, e cancelamento automático na quitação. Etapa posterior à negativação no arsenal legal. Concorrentes no mercado BR (Neofin, CobreAI, Protesto Online) tratam a **intenção de protesto** (comunicação prévia ao devedor) como etapa obrigatória do fluxo, evitando custo de cartório e constrangimento desnecessário — manter a mesma etapa aqui.

<critical>
- Leia o PRD e a TechSpec antes de implementar.
- Referencie as seções relevantes da TechSpec.
- DEVE respeitar `override_days_to_protest` (ou da política).
- DEVE comunicar a intenção de protesto ao devedor antes de requisitar (prazo padrão de 3 dias úteis — Lei 9.492/97, art. 12).
- Status: `pending_notification` → `notified` → `requested` → `completed` → `cancelled`.
- A tabela `protests` NÃO possui `notified_at` — criar migration adicionando a coluna.
- Cancelamento DEVE ocorrer na quitação do título.
- Requer negativação ativa ou já tentada (encadeamento legal).
- Execute `npm run lint && npm run build`.
</critical>

<requirements>
1. `GET/POST /api/protests` e `PATCH /api/protests/[id]`.
2. Cron `/api/cron/protests` identifica títulos elegíveis (dias ≥ limite de protesto) e cria `protest` com `status='pending_notification'`.
3. Cron envia mensagem de intenção de protesto ao devedor e marca `notified` com `notified_at`.
4. Após 3 dias úteis de `notified` (ou confirmação manual), status → `requested`.
5. Transição `requested → completed` após retorno do cartório (mock).
6. Baixa do título (tarefa 3) DEVE disparar cancelamento (`status='cancelled'`, `cancelled_at`).
7. UI `/protests` com fila e status.
8. DEVE exigir que negativação (tarefa 8) esteja `completed` ou foi tentada antes de protestar.
</requirements>

## Subtarefas

- [ ] Migration: adicionar `notified_at TIMESTAMPTZ` em `protests` (e validar enum de status).
- [ ] CRUD `/api/protests` e `/api/protests/[id]`.
- [ ] Cron `/api/cron/protests/route.ts` (elegibilidade + intenção + transição).
- [ ] Implementar provider mock de cartório.
- [ ] Conectar baixa de título ao cancelamento.
- [ ] Validar encadeamento com negativação.
- [ ] UI `app/protests/page.tsx`.

## Detalhes de Implementação

### Arquivos a Criar

- `app/api/protests/route.ts`, `app/api/protests/[id]/route.ts`
- `app/api/cron/protests/route.ts`
- `lib/protest-provider.ts`
- `app/protests/page.tsx`

### Arquivos a Modificar

- `app/api/financial-titles/[id]/route.ts` (tarefa 3) — cancelamento.
- `app/cases/[id]/page.tsx` — alerta de protesto.

### Arquivos Relevantes

- `supabase_tenant_model.sql` — schema `protests`.
- `lib/finance.ts` — `getDaysOverdue`.

## Testes

### Testes de Integração

- [ ] Título com dias ≥ limite vira `pending_notification`.
- [ ] Intenção de protesto enviada marca `notified`.
- [ ] Após 3 dias úteis de `notified`, status → `requested`.
- [ ] Cancelamento automático na baixa.
- [ ] Protesto bloqueado se negativação não foi tentada.
- [ ] Tenant isolado.

## Critérios de Sucesso

- [ ] Fila de protesto visível e funcional.
- [ ] Encadeamento com negativação respeitado.
- [ ] `npm run lint && npm run build` sem erros.