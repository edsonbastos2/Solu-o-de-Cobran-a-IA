---
status: completed
title: Criar RPC transacional de criação
type: supabase
complexity: high
dependencies: ["2_task", "3_task", "4_task"]
---

# Criar RPC transacional de criação

## Visão Geral

Centralizar no banco a criação de casos baseados em títulos financeiros. A função deve validar sessão, tenant, vencimento, status e duplicidade antes de inserir o caso canônico.

<critical>
- Leia a TechSpec e o ADR-002.
- A função DEVE validar identidade dentro do próprio banco.
- Não aceitar dados financeiros livres como autoridade.
- Tratar concorrência com índice/locking adequado.
- Testes SQL são obrigatórios.
</critical>

<requirements>
1. A função DEVE receber somente `financial_title_id` e contexto administrativo validado quando necessário.
2. A função DEVE retornar códigos estáveis de erro.
3. Título futuro, pago ou cancelado NÃO PODE gerar caso.
4. Duas criações concorrentes NÃO PODEM gerar dois casos ativos.
5. O caso criado DEVE conter contexto canônico do título, contrato, cliente e tenant.
</requirements>

## Subtarefas

- [x] Implementar resolução de tenant e membership.
- [x] Implementar consulta e regra de elegibilidade.
- [x] Implementar proteção de duplicidade concorrente.
- [x] Inserir o caso e registrar a ação.

## Detalhes de Implementação

### Arquivos a Criar

- Nenhum; adicionar à migração canônica.

### Arquivos a Modificar

- `supabase_collection_case_core.sql` — função transacional e códigos.

### Arquivos Relevantes

- `supabase_tenant_model.sql` — funções de membership.
- `supabase_audit_logs.sql` — auditoria existente.

### Arquivos Dependentes

- `6_task.md`, `8_task.md` e `9_task.md` — consomem o contrato da função.

### ADRs Relacionados

- [ADR-002](adrs/adr-002.md) — validação única e atômica.
- [ADR-004](adrs/adr-004.md) — título obrigatório.

## Entregáveis

- [x] RPC transacional documentada.
- [x] Códigos `TITLE_NOT_FOUND`, `TITLE_NOT_OVERDUE`, `TITLE_NOT_COLLECTIBLE` e `ACTIVE_CASE_EXISTS`.
- [x] Registro de criação sem dados sensíveis desnecessários.

## Testes

### Testes Unitários

- [x] Não aplicável; validar a função no banco.

### Testes de Integração

- [x] Título futuro rejeitado.
- [x] Título vencendo hoje rejeitado pela regra inicial.
- [x] Título vencido elegível criado.
- [x] Título pago e cancelado rejeitados.
- [x] Título de outro tenant não encontrado.
- [x] Caso ativo duplicado retorna código esperado.
- [x] Duas chamadas concorrentes criam no máximo um caso.

## Critérios de Sucesso

- [x] Nenhuma criação válida depende de dados livres enviados pelo cliente.
- [x] Regra é reutilizável por API e automações.
- [x] Cenários de concorrência passam.
- [x] `npm run lint` sem erros.
- [x] `npm run build` sem erros.
