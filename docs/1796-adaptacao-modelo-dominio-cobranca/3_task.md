---
status: completed
title: Adicionar schema canônico de casos
type: supabase
complexity: high
dependencies: ["1_task"]
---

# Adicionar schema canônico de casos

## Visão Geral

Adicionar a estrutura mínima para ligar casos a títulos financeiros sem remover o histórico. A migração deve ser aditiva, tenant-safe e compatível com os casos antigos.

<critical>
- Leia a TechSpec e os ADRs 001 e 003.
- Siga as práticas de RLS, índices de foreign key e índices parciais.
- Não atribua dados legados de forma especulativa.
- Testes SQL são obrigatórios.
- Execute `npm run lint && npm run build` após mudanças relacionadas.
</critical>

<requirements>
1. A migração DEVE adicionar `financial_title_id`, `assigned_user_id` e `legacy_context` de forma compatível.
2. Foreign keys e colunas usadas por RLS DEVEM possuir índices adequados.
3. O banco DEVE impedir vínculos entre tenants.
4. Deve existir proteção contra múltiplos casos ativos para o mesmo título.
5. A migração NÃO DEVE excluir casos, mensagens ou auditoria.
</requirements>

## Subtarefas

- [x] Criar arquivo SQL aditivo.
- [x] Adicionar colunas, foreign keys e índices.
- [x] Adicionar consistência de tenant e política RLS.
- [x] Validar aplicação sobre dados legados.

## Detalhes de Implementação

### Arquivos a Criar

- `supabase_collection_case_core.sql` — schema, índices, políticas e bases para backfill.

### Arquivos a Modificar

- Nenhum SQL antigo deve ser alterado nesta tarefa.

### Arquivos Relevantes

- `supabase_tenant_model.sql` — funções e políticas canônicas.
- `supabase_audit_logs.sql` — estrutura existente de auditoria.

### Arquivos Dependentes

- `4_task.md` e `5_task.md` — usam os novos campos e constraints.

### ADRs Relacionados

- [ADR-003](adrs/adr-003.md) — mantém contexto legado incompleto.

## Entregáveis

- [x] Migração aditiva idempotente.
- [x] Índices e foreign keys documentados.
- [x] Políticas sem abertura cross-tenant.

## Testes

### Testes Unitários

- [x] Não aplicável; validar SQL em banco de teste.

### Testes de Integração

- [x] Aplicar migração sem perda de contagem de casos/mensagens.
- [x] Tentar inserir vínculo com título de outro tenant.
- [x] Confirmar índice parcial de casos ativos.
- [x] Confirmar que casos antigos continuam legíveis.

## Critérios de Sucesso

- [x] Migração aplicada sem erro no baseline.
- [x] RLS impede acesso cross-tenant.
- [x] Histórico permanece intacto.
- [x] `npm run lint` sem erros.
- [x] `npm run build` sem erros.
