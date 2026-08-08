---
status: pending
title: Importação em massa CSV/XLSX
type: backend
complexity: medium
dependencies: []
---

# Importação em massa CSV/XLSX

## Visão Geral

`papaparse` está no `package.json` mas não é usado. Hoje só existe extração de PDF único. Criar `/api/import/debtors` que cria cliente + contrato + títulos em batch a partir de CSV/XLSX. Essencial para onboarding de novos tenants com carteira existente.

<critical>
- Leia o PRD e a TechSpec antes de implementar.
- Referencie as seções relevantes da TechSpec.
- Importação DEVE ser transacional por linha (rollback parcial permitido com relatório de erros).
- Validação de duplicados por `clients.document` e `contracts.contract_number`.
- Limite de linhas por upload (configurável, default 1000).
- `papaparse` já está no `package.json`; para XLSX, instalar dependência SheetJS (`xlsx`) antes de implementar o parser.
- Execute `npm run lint && npm run build`.
</critical>

<requirements>
1. `POST /api/import/debtors` aceita CSV (papaparse) ou XLSX (SheetJS) com colunas: documento, nome, telefone, contrato_numero, valor_total, parcelas, vencimento_primeira, politica_nome.
2. Endpoint cria cliente (ou reusa por documento), contrato e títulos financeiros em batch.
3. Resposta retorna `{imported, skipped, errors: [{line, reason}]}`.
4. UI `/import` com upload, mapeamento de colunas e preview das primeiras 5 linhas.
5. Política resolvida por nome (fallback para política ativa padrão do tenant).
6. Respeita isolamento por tenant.
</requirements>

## Subtarefas

- [ ] Criar `app/api/import/debtors/route.ts` (parse + validação + batch insert).
- [ ] Mapeamento de colunas com papaparse.
- [ ] Relatório de erros por linha.
- [ ] UI `app/import/page.tsx` (upload + preview + resultado).
- [ ] Validação de duplicados.

## Detalhes de Implementação

### Arquivos a Criar

- `app/api/import/debtors/route.ts`
- `app/import/page.tsx`
- `lib/import-parser.ts`

### Arquivos Relevantes

- `package.json` — `papaparse`, `@types/papaparse`.
- `app/api/contracts/route.ts` — lógica de criação reutilizável.

## Testes

### Testes de Integração

- [ ] CSV válido cria clientes, contratos e títulos.
- [ ] Linha com documento duplicado é skipped.
- [ ] Relatório de erros identifica linha e motivo.
- [ ] Limite de 1000 linhas respeitado.

## Critérios de Sucesso

- [ ] Importação em massa funcional via UI.
- [ ] Relatório de erros claro.
- [ ] `npm run lint && npm run build` sem erros.