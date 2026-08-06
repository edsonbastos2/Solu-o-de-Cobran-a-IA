---
status: completed
title: Implementar backfill determinístico
type: supabase
complexity: medium
dependencies: ["3_task"]
---

# Implementar backfill determinístico

## Visão Geral

Relacionar casos históricos a títulos somente quando a correspondência for única e comprovável. Casos ambíguos ou sem correspondência permanecerão disponíveis com indicação de contexto legado incompleto.

<critical>
- Leia a TechSpec e o ADR-003.
- Nunca use fallback para escolher o primeiro tenant ou título.
- O backfill DEVE ser idempotente.
- Preserve mensagens e auditoria.
- Execute `npm run lint && npm run build`.
</critical>

<requirements>
1. O backfill DEVE atualizar somente correspondências únicas.
2. Casos ambíguos DEVEM permanecer sem vínculo canônico.
3. Casos sem vínculo DEVEM ser marcados como contexto legado incompleto.
4. A execução repetida DEVE produzir o mesmo resultado.
</requirements>

## Subtarefas

- [x] Definir critérios de correspondência determinística.
- [x] Marcar o estado legado inicial.
- [x] Atualizar somente correspondências únicas.
- [x] Produzir contagens de vinculados, incompletos e ambíguos.

## Detalhes de Implementação

### Arquivos a Criar

- Nenhum; implementar na migração canônica.

### Arquivos a Modificar

- `supabase_collection_case_core.sql` — incluir o backfill seguro.

### Arquivos Relevantes

- `supabase_tenant_model.sql` — regras de tenant existentes.
- `supabase_audit_logs.sql` — histórico que não pode ser alterado.

### Arquivos Dependentes

- `5_task.md` — função de criação deverá aceitar apenas contexto novo completo.
- `15_task.md` — workspace exibirá o estado legado.

### ADRs Relacionados

- [ADR-003](adrs/adr-003.md) — regra de backfill seguro.

## Entregáveis

- [x] Backfill idempotente.
- [x] Estado incompleto visível para leituras.
- [x] Relatório de contagens do backfill.

## Testes

### Testes Unitários

- [x] Não aplicável; validar cenários SQL.

### Testes de Integração

- [x] Correspondência única cria vínculo.
- [x] Correspondência ambígua não cria vínculo.
- [x] Caso sem correspondência continua legível.
- [x] Segunda execução não muda resultados.
- [x] Mensagens e auditoria mantêm contagens.

## Critérios de Sucesso

- [x] Nenhum vínculo especulativo criado.
- [x] Casos legados incompletos são identificáveis.
- [x] Backfill repetível e auditável.
- [x] `npm run lint` sem erros.
- [x] `npm run build` sem erros.
