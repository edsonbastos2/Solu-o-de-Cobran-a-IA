---
status: completed
title: Criar leitura autenticada de títulos
type: api
complexity: medium
dependencies: ["2_task", "5_task", "6_task"]
---

# Criar leitura autenticada de títulos

## Visão Geral

Criar a fonte HTTP canônica para títulos financeiros por contrato. A rota deve aplicar autenticação, membership, RLS e retornar a elegibilidade necessária para a tela de contratos.

<critical>
- Leia as seções de API, RLS e Frontend da TechSpec.
- Não consultar parcelas diretamente nesta rota.
- Não confiar em `contract_id` sem validar tenant.
- Trate 401, 404 e 500 de forma explícita.
</critical>

<requirements>
1. `GET /api/financial-titles?contract_id=...` DEVE exigir usuário autenticado.
2. A consulta DEVE filtrar por tenant e contrato acessível.
3. A resposta DEVE incluir status, valores, vencimento e elegibilidade.
4. Contrato de outro tenant NÃO PODE revelar existência de títulos.
</requirements>

## Subtarefas

- [x] Criar route handler.
- [x] Aplicar `requireUser()` e tenant.
- [x] Consultar títulos com tipos compartilhados.
- [x] Mapear erros HTTP.

## Detalhes de Implementação

### Arquivos a Criar

- `app/api/financial-titles/route.ts` — leitura autenticada.

### Arquivos a Modificar

- `app/api/contracts/route.ts` — aplicar autenticação se necessário ao contexto.

### Arquivos Relevantes

- `lib/api-auth.ts` — padrão de autenticação.
- `lib/supabase-server.ts` — cliente RLS.
- `lib/types.ts` — resposta canônica.

### Arquivos Dependentes

- `8_task.md` e `13_task.md`.

## Entregáveis

- [x] Endpoint de títulos.
- [x] Resposta tenant-safe.
- [x] Mensagens de erro em português.

## Testes

### Testes Unitários

- [x] Query sem `contract_id` retorna 400.
- [x] Erro do banco é convertido para 500 sem detalhes internos.

### Testes de Integração

- [x] Contrato acessível retorna seus títulos.
- [x] Contrato inexistente retorna 404.
- [x] Contrato de outro tenant não revela dados.
- [x] Sessão ausente retorna 401.
- [x] Estados de elegibilidade são retornados corretamente.

## Critérios de Sucesso

- [x] Endpoint protegido e documentado.
- [x] Nenhuma consulta usa parcelas como fonte canônica.
- [x] Testes de isolamento passam.
- [x] `npm run lint` sem erros.
- [x] `npm run build` sem erros.
