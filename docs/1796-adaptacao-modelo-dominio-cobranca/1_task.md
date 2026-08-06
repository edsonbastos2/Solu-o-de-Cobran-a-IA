---
status: completed
title: Congelar baseline de dados e rotas
type: docs
complexity: medium
dependencies: []
---

# Congelar baseline de dados e rotas

## Visão Geral

Documentar o estado real das tabelas, políticas, status e consumidores atuais antes das alterações. A tarefa reduz o risco de aplicar a nova migração sobre um baseline incorreto ou misturar alterações paralelas do workspace.

<critical>
- Leia o PRD e a TechSpec antes de implementar.
- Referencie as seções relevantes da TechSpec.
- Não reverta alterações pré-existentes no workspace.
- Testes são obrigatórios.
- Execute `npm run lint && npm run build` como pipeline de verificação.
</critical>

<requirements>
1. O baseline DEVE identificar a ordem aplicável dos SQL de tenant, contratos, auditoria e casos.
2. O baseline DEVE registrar os status reais de `cases`, `financial_titles` e `installments`.
3. O baseline DEVE listar os consumidores de `POST /api/cases`.
4. A regra inicial DEVE ser documentada como `due_date < current_date`, com status não pago e não cancelado.
</requirements>

## Subtarefas

- [x] Comparar os SQL existentes e identificar o baseline atual.
- [x] Mapear políticas RLS e funções de tenant.
- [x] Mapear rotas e telas que criam ou alteram casos.
- [x] Registrar conflitos e decisões pendentes.

## Detalhes de Implementação

### Arquivos a Criar

- `docs/1796-adaptacao-modelo-dominio-cobranca/baseline.md` — registro do baseline validado.

### Arquivos a Modificar

- Nenhum arquivo de aplicação.

### Arquivos Relevantes

- `supabase_tenant_model.sql` — baseline canônico de tenant.
- `supabase_schema.sql` — políticas legadas a verificar.
- `app/api/cases/route.ts` — consumidor principal da criação.
- `app/contracts/[id]/page.tsx` — consumidor de parcelas e abertura de caso.

### Arquivos Dependentes

- `3_task.md` — depende da ordem e do schema confirmados.
- `5_task.md` — depende dos status e da regra de elegibilidade.

### ADRs Relacionados

- [ADR-001](adrs/adr-001.md) — preserva experiência e histórico.

## Entregáveis

- [x] `baseline.md` com ordem de SQL, status e rotas.
- [x] Lista de conflitos de políticas e tenant.
- [x] Casos de verificação documentados.

## Testes

### Testes Unitários

- [x] Não aplicável; a tarefa produz documentação de baseline.

### Testes de Integração

- [x] Consultar catálogo PostgreSQL e confirmar existência de `financial_titles`.
- [x] Confirmar comportamento de títulos vencendo hoje e títulos vencidos.
- [x] Confirmar que o baseline não altera dados.

## Critérios de Sucesso

- [x] Baseline revisado e consistente com a base.
- [x] Nenhuma alteração de dados realizada.
- [x] `npm run lint` sem erros.
- [x] `npm run build` sem erros.
