---
status: pending
title: Pipeline jurídico (`legal_processes`)
type: backend
complexity: high
dependencies: [2]
---

# Pipeline jurídico (`legal_processes`)

## Visão Geral

A tabela `legal_processes` existe no schema mas sem implementação. Implementar UI e API com andamento formal: nº processo, vara, tipo (execução/monitória/cobrança), advogado, status. Disparada quando estágio `especializada` ultrapassa X dias sem acordo → auto-cria `legal_process` vinculado ao caso. Auditoria dupla (sistema + manual do advogado).

<critical>
- Leia o PRD e a TechSpec antes de implementar.
- Referencie as seções relevantes da TechSpec.
- Auto-criação DEVE respeitar prazo configurável (default 60 dias em especializada sem acordo).
- DEVE vincular caso, contrato e título financeiro.
- Advogado externo pode atualizar status (via token ou pelo operador).
- Execute `npm run lint && npm run build`.
</critical>

<requirements>
1. `GET/POST /api/legal-processes` e `PATCH /api/legal-processes/[id]`.
2. Cron `/api/cron/legal-escalation` identifica casos em `especializada` há ≥ X dias sem acordo e cria `legal_process`.
3. Campos: `process_number`, `process_type` (execução/monitória/cobrança), `court`, `filing_date`, `lawyer_name`, `lawyer_contact`, `status` (open/in_progress/judgment_won/judgment_lost/closed).
4. UI `/legal` com lista filtrável por status, advogado, vara.
5. Atualizações manuais registram auditoria.
6. Vitória judicial (`judgment_won`) DEVE sugerir baixa do título (tarefa 3).
</requirements>

## Subtarefas

- [ ] CRUD `/api/legal-processes` e `/api/legal-processes/[id]`.
- [ ] Cron `/api/cron/legal-escalation/route.ts`.
- [ ] UI `app/legal/page.tsx` (lista + formulário).
- [ ] Detalhe do caso: seção jurídica quando `legal_process` existir.
- [ ] Conectar `judgment_won` à sugestão de baixa.

## Detalhes de Implementação

### Arquivos a Criar

- `app/api/legal-processes/route.ts`, `app/api/legal-processes/[id]/route.ts`
- `app/api/cron/legal-escalation/route.ts`
- `app/legal/page.tsx`

### Arquivos a Modificar

- `app/cases/[id]/page.tsx` — seção jurídica.
- `components/header.tsx` — navegação.

### Arquivos Relevantes

- `supabase_tenant_model.sql` — schema `legal_processes`.
- `lib/finance.ts` — `getCollectionStage`.

## Testes

### Testes de Integração

- [ ] Caso em `especializada` há 60 dias sem acordo cria `legal_process`.
- [ ] Vitória judicial sugere baixa do título.
- [ ] Tenant isolado.
- [ ] Atualização manual registra auditoria.

## Critérios de Sucesso

- [ ] Processos jurídicos listáveis e editáveis.
- [ ] Escalonamento automático funcionando.
- [ ] `npm run lint && npm run build` sem erros.