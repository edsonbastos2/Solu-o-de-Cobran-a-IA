---
status: completed
title: Consolidar tipos e regras puras
type: refactor
complexity: medium
dependencies: ["5_task"]
---

# Consolidar tipos e regras puras

## Visão Geral

Atualizar os tipos compartilhados para representar contexto canônico, legado e erros de criação. Criar regras puras de apoio à apresentação, mantendo o banco como autoridade final de elegibilidade.

<critical>
- Leia a TechSpec e preserve alterações não relacionadas em `lib/types.ts`.
- Não renomeie silenciosamente campos existentes.
- Tipos novos DEVEM refletir respostas reais da API/RPC.
- Testes de datas e status são obrigatórios.
</critical>

<requirements>
1. `CaseCreationErrorCode`, `CreateCaseInput`, `CreateCaseResult` e `CollectionCaseContext` DEVEM existir.
2. `Case` DEVE suportar título, responsável e estado legado.
3. A regra pura DEVE distinguir título futuro, vencendo hoje, vencido, pago e cancelado.
4. Os nomes atuais de valor DEVEM ser preservados.
</requirements>

## Subtarefas

- [x] Adicionar tipos de contexto e erro.
- [x] Estender tipos de caso e título sem quebrar legado.
- [x] Criar helper de elegibilidade para UI.
- [x] Executar verificação TypeScript.

## Detalhes de Implementação

### Arquivos a Criar

- Nenhum; manter tipos no módulo existente.

### Arquivos a Modificar

- `lib/types.ts` — entidades, contexto e contratos.
- `lib/finance.ts` — regra pura de apresentação.

### Arquivos Relevantes

- `app/api/cases/route.ts` — usa códigos de erro.
- `supabase_collection_case_core.sql` — autoridade da regra.

### Arquivos Dependentes

- `7_task.md`, `8_task.md`, `13_task.md` e `15_task.md`.

### ADRs Relacionados

- [ADR-004](adrs/adr-004.md) — entrada por título.

## Entregáveis

- [x] Tipos compartilhados compilando.
- [x] Helper puro de elegibilidade.
- [x] Nenhum campo legado removido.

## Testes

### Testes Unitários

- [x] Data futura retorna não elegível.
- [x] Data de hoje segue regra inicial.
- [x] Data passada com status pago/cancelado retorna não elegível.
- [x] Data passada com status recuperável retorna elegível.

### Testes de Integração

- [x] Contexto canônico e legado são serializáveis.
- [x] Códigos da RPC são aceitos pelo contrato TypeScript.

## Critérios de Sucesso

- [x] `npx tsc --noEmit` sem erros.
- [x] Tipos não quebram consumidores existentes.
- [x] Casos de data/status passam.
- [x] `npm run lint` sem erros.
- [x] `npm run build` sem erros.
