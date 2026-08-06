---
status: completed
title: Migrar GET/POST /api/cases
type: api
complexity: medium
dependencies: ["5_task", "6_task", "7_task"]
---

# Migrar GET/POST /api/cases

## Visão Geral

Transformar a criação de casos em uma operação baseada em título financeiro, preservando listagem, busca, filtros e paginação. A API deve traduzir os códigos da RPC para respostas acionáveis.

<critical>
- Leia ADR-004 e o contrato de API da TechSpec.
- O POST NÃO DEVE aceitar payload financeiro livre.
- Preserve a forma da resposta GET quando possível.
- Use `requireUser()` e não bypass de RLS.
</critical>

<requirements>
1. POST DEVE exigir `financial_title_id`.
2. POST DEVE chamar a RPC transacional.
3. `TITLE_NOT_OVERDUE` e `TITLE_NOT_COLLECTIBLE` DEVEM retornar 400.
4. `TITLE_NOT_FOUND` DEVE retornar 404.
5. `ACTIVE_CASE_EXISTS` DEVE retornar 409.
6. GET DEVE incluir resumo de título, contrato e cliente.
</requirements>

## Subtarefas

- [x] Validar payload e autenticação.
- [x] Chamar RPC e mapear códigos.
- [x] Preservar GET e ampliar contexto.
- [x] Atualizar respostas de erro.

## Detalhes de Implementação

### Arquivos a Criar

- Nenhum.

### Arquivos a Modificar

- `app/api/cases/route.ts` — POST canônico e GET contextual.

### Arquivos Relevantes

- `lib/api-auth.ts` — usuário/tenant.
- `lib/types.ts` — entrada e erros.
- `supabase_collection_case_core.sql` — RPC.

### Arquivos Dependentes

- `13_task.md` e `14_task.md`.

### ADRs Relacionados

- [ADR-002](adrs/adr-002.md) — RPC transacional.
- [ADR-004](adrs/adr-004.md) — título obrigatório.

## Entregáveis

- [x] POST baseado em título.
- [x] GET com contexto resumido.
- [x] Códigos HTTP estáveis.

## Testes

### Testes Unitários

- [x] Corpo sem título retorna 400.
- [x] UUID inválido retorna 400.
- [x] Cada código RPC mapeia para o status correto.

### Testes de Integração

- [x] Título elegível cria caso 201.
- [x] Título não vencido retorna 400.
- [x] Título inacessível retorna 404.
- [x] Caso ativo duplicado retorna 409.
- [x] GET mantém paginação e inclui contexto.

## Critérios de Sucesso

- [x] Não é possível criar novo caso sem título.
- [x] Consumidores recebem mensagens acionáveis.
- [x] GET existente não perde paginação/filtros.
- [x] `npm run lint` sem erros.
- [x] `npm run build` sem erros.
