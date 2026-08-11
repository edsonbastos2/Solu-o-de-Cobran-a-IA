---
status: implemented
title: Edição de contrato e cliente (CRUD faltante)
type: api
complexity: medium
dependencies: []
---

# Edição de contrato e cliente (CRUD faltante)

## Visão Geral

`/api/contracts/[id]` só tem GET (sem PUT/DELETE). `/api/clients/[id]` só tem PUT (sem DELETE). Clientes só nascem da importação de contrato. Implementar CRUD completo: edição de contrato, edição/exclusão de cliente (com validação de integridade), criação manual de cliente.

<critical>
- Leia o PRD e a TechSpec antes de implementar.
- Referencie as seções relevantes da TechSpec.
- Exclusão de cliente DEVE bloquear se há contratos/casos ativos vinculados.
- Edição de contrato DEVE recalcular títulos se valor/parcelas mudarem (com confirmação).
- O schema atual de `contracts` NÃO possui coluna de soft delete (`archived_at`/`is_active`) — criar migration antes de implementar o arquivamento.
- Auditoria em toda mutação.
- Execute `npm run lint && npm run build`.
</critical>

<requirements>
1. `PUT /api/contracts/[id]` — edita campos do contrato (interest_rate, penalty_rate, datas, regras de negativação/protesto, política).
2. `DELETE /api/contracts/[id]` — arquiva (soft delete) se sem casos ativos.
3. `POST /api/clients` — criação manual de cliente.
4. `DELETE /api/clients/[id]` — bloqueia se há contratos/casos ativos.
5. UI de edição de contrato e cliente.
6. Auditoria em toda mutação.
</requirements>

## Subtarefas

- [ ] Migration: adicionar coluna de soft delete (`archived_at TIMESTAMPTZ` nullable) em `contracts`.
- [ ] Adicionar `PUT/DELETE` em `app/api/contracts/[id]/route.ts`.
- [ ] Adicionar `POST` em `app/api/clients/route.ts` e `DELETE` em `app/api/clients/[id]/route.ts`.
- [ ] Validar integridade referencial antes de excluir.
- [ ] UI de edição no detalhe do contrato e do cliente.
- [ ] Auditoria.

## Detalhes de Implementação

### Arquivos a Modificar

- `app/api/contracts/[id]/route.ts` — PUT, DELETE.
- `app/api/clients/route.ts` — POST.
- `app/api/clients/[id]/route.ts` — DELETE.
- `app/contracts/[id]/page.tsx` — UI de edição.
- `app/clients/page.tsx` — UI de criação/exclusão.

### Arquivos Relevantes

- `lib/audit.ts`, `lib/api-validate.ts`.

## Testes

### Testes de Integração

- [ ] Edição de contrato persiste.
- [ ] Exclusão de cliente com contrato ativo é bloqueada.
- [ ] Criação manual de cliente funciona.
- [ ] Auditoria registrada.

## Critérios de Sucesso

- [ ] CRUD completo de contrato e cliente.
- [ ] `npm run lint && npm run build` sem erros.