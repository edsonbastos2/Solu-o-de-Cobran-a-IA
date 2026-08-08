---
status: implemented
title: Implementar acordos formais (`negotiations`)
type: api
complexity: high
dependencies: [1]
---

# Implementar acordos formais (`negotiations`)

## Visão Geral

A tabela `negotiations` já existe no `supabase_tenant_model.sql` mas não tem API nem UI. Hoje a IA emite a tag `[ACORDO_FECHADO]` e apenas troca o status do caso para `closed` — sem persistir o acordo. Implementar CRUD de acordos com persistência formal (valor original, proposto, acordado, desconto %, parcelas, expira em, aceito em) e conectar o pipeline de IA para registrar acordo automaticamente quando a tag for detectada. A "promessa de pagamento" sem persistência formal é a maior fonte de perda em cobrança.

<critical>
- Leia o PRD e a TechSpec antes de implementar.
- Referencie as seções relevantes da TechSpec.
- O registro de acordo DEVE ser atomicamente vinculado ao caso e ao título financeiro.
- O pipeline de IA DEVE criar o `negotiation` automaticamente ao detectar `[ACORDO_FECHADO]`.
- A transição `negotiation.status` (open → accepted → expired → fulfilled → defaulted) DEVE registrar auditoria.
- Execute `npm run lint && npm run build`.
</critical>

<requirements>
1. A API `POST /api/negotiations` DEVE validar tenant, cliente/contrato/título/caso opcionais, e persistir `original_value`, `proposed_value`, `agreed_value`, `discount_percent`, `installment_count`, `expires_at`.
2. A API `PATCH /api/negotiations/[id]` DEVE suportar transições de status (`accept`, `fulfill`, `default`, `expire`) com validação.
3. O pipeline `processChat` em `lib/agent.ts` DEVE, ao detectar `[ACORDO_FECHADO]`, extrair valor/parcelas/desconto da resposta da IA e criar `negotiation` antes de fechar o caso.
4. Acordos expirados (`expires_at < now` e `status='accepted'`) DEVEN ser sinalizados como `defaulted` por cron.
5. A UI DEVE listar acordos por caso/cliente e permitir marcação manual de cumprimento.
6. Toda mutação DEVE registrar `audit_logs` via `recordAuditAction`.
</requirements>

## Subtarefas

- [ ] Criar `app/api/negotiations/route.ts` (GET lista, POST cria).
- [ ] Criar `app/api/negotiations/[id]/route.ts` (GET detalhe, PATCH transições).
- [ ] Adicionar parser de acordo na resposta da IA em `lib/agent.ts` (extrai valor, parcelas, desconto).
- [ ] Conectar criação de `negotiation` ao fluxo `[ACORDO_FECHADO]` em `lib/agent.ts`.
- [ ] Criar cron `/api/cron/negotiations-expiry` para expirar acordos vencidos.
- [ ] Criar página `app/negotiations/page.tsx` listando acordos por status.
- [ ] Adicionar seção de acordos no detalhe do caso `app/cases/[id]/page.tsx`.
- [ ] Cobrir RLS em `negotiations` (já existe no tenant_model — validar).

## Detalhes de Implementação

### Arquivos a Criar

- `app/api/negotiations/route.ts`
- `app/api/negotiations/[id]/route.ts`
- `app/api/cron/negotiations-expiry/route.ts`
- `app/negotiations/page.tsx`

### Arquivos a Modificar

- `lib/agent.ts` — parser e criação de `negotiation`.
- `app/cases/[id]/page.tsx` — seção de acordos.
- `lib/types.ts` — tipo `Negotiation` completo.

### Arquivos Relevantes

- `supabase_tenant_model.sql` — schema de `negotiations`.
- `lib/api-auth.ts`, `lib/api-validate.ts`, `lib/audit.ts`.

### Arquivos Dependentes

- `1_task.md` — `success_rate` e `recovered_amount` usam `negotiations`.
- `4_task.md` — insights usam histórico de acordos.
- `7_task.md` — campanhas de acompanhamento pós-acordo.

## Testes

### Testes de Integração

- [ ] Acordo criado manualmente aparece na lista e detalhe do caso.
- [ ] Pipeline de IA com `[ACORDO_FECHADO]` cria `negotiation` automaticamente.
- [ ] Transição `accept` registra auditoria.
- [ ] Acordo expirado vira `defaulted` via cron.
- [ ] Tenant A não vê acordos do tenant B.

## Critérios de Sucesso

- [ ] Acordo formal persistido ao detectar `[ACORDO_FECHADO]`.
- [ ] UI lista e atualiza acordos.
- [ ] Cron de expiração funcionando.
- [ ] `npm run lint && npm run build` sem erros.