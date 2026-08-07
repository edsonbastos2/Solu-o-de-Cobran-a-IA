---
status: pending
title: Baixa de títulos e gestão de pagamentos
type: api
complexity: medium
dependencies: [1]
---

# Baixa de títulos e gestão de pagamentos

## Visão Geral

`financial_titles.status` e `paid_at` existem mas ninguém atualiza. Criar endpoint de baixa (quitado/parcial/cancelado) com auditoria, UI de gestão de pagamentos no contrato, e fundamento para conciliação futura (retorno CNAB/PIX). Sem isso, todo o cálculo de `recovered_amount` e `success_rate` é manual.

<critical>
- Toda baixa DEVE validar que o título pertence ao tenant do operador.
- Baixa parcial DEVE recalcular `current_value` e manter `status='partial'`.
- Toda mutação DEVE registrar `audit_logs`.
- Não permita baixar título já cancelado.
- Execute `npm run lint && npm run build`.
</critical>

<requirements>
1. `PATCH /api/financial-titles/[id]` DEVE aceitar `status` (`paid`, `partial`, `cancelled`), `paid_at`, `paid_amount` (para parcial), `metadata`.
2. Baixa total DEVE setar `paid_at=now()`, `status='paid'` e zerar saldo pendente.
3. Baixa parcial DEVE diminuir `current_value` e setar `status='partial'`.
4. Cancelamento DEVE setar `status='cancelled'` e impedir reabertura.
5. A UI do contrato DEVE permitir baixa individual e em massa (seleção múltipla).
6. Se título tem caso ativo com `negotiation` aceita, a baixa total DEVE marcar `negotiation.status='fulfilled'`.
7. Toda mutação DEVE registrar auditoria.
</requirements>

## Subtarefas

- [ ] Criar `app/api/financial-titles/[id]/route.ts` com PATCH.
- [ ] Adicionar validação de pertença ao tenant.
- [ ] Implementar lógica de baixa parcial (recalcular `current_value`).
- [ ] Conectar baixa total à transição `negotiation → fulfilled` (requer tarefa 2).
- [ ] UI no contrato: checkboxes + botão "Baixar selecionados".
- [ ] Registrar auditoria em cada mutação.

## Detalhes de Implementação

### Arquivos a Criar

- `app/api/financial-titles/[id]/route.ts`

### Arquivos a Modificar

- `app/contracts/[id]/page.tsx` — UI de baixa.
- `lib/types.ts` — tipo `FinancialTitle` com `paid_amount`, `partial`.
- `lib/finance.ts` — `getFinancialTitleEligibility` trata `partial`.

### Arquivos Relevantes

- `supabase_tenant_model.sql` — schema de `financial_titles`.
- `lib/audit.ts`, `lib/api-auth.ts`.

### Arquivos Dependentes

- `1_task.md` — `recovered_amount` depende de `status='paid'`.
- `2_task.md` — baixa total marca `negotiation` como `fulfilled`.

## Testes

### Testes de Integração

- [ ] Baixa total seta `status='paid'` e `paid_at`.
- [ ] Baixa parcial diminui `current_value` e mantém `status='partial'`.
- [ ] Cancelamento impede nova baixa.
- [ ] Baixa em título com `negotiation` aceita marca `negotiation='fulfilled'`.
- [ ] Tenant A não consegue baixar título do tenant B.

## Critérios de Sucesso

- [ ] Baixa manual funciona via UI.
- [ ] `recovered_amount` do dashboard reflete baixas.
- [ ] `npm run lint && npm run build` sem erros.