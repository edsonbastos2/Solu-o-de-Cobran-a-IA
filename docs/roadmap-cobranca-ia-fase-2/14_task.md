---
status: pending
title: Exportação de relatórios CSV/PDF
type: backend
complexity: medium
dependencies: [1]
---

# Exportação de relatórios CSV/PDF

## Visão Geral

Atualmente só existe download de dossiê em `.txt`. Criar endpoints de exportação de relatórios: carteira por estágio, casos por período, acordos, recuperação. Formatos CSV (para Excel) e PDF (para apresentação). Reutiliza agregações do dashboard (tarefa 1).

<critical>
- Leia o PRD e a TechSpec antes de implementar.
- Referencie as seções relevantes da TechSpec.
- Exportação DEVE respeitar tenant.
- CSV DEVE usar encoding UTF-8 com BOM (compatibilidade Excel Brasil).
- PDF DEVE ter cabeçalho com tenant + data de geração.
- Limite de registros por export (paginação para grandes volumes).
- Execute `npm run lint && npm run build`.
</critical>

<requirements>
1. `GET /api/reports/portfolio.csv` — carteira por estágio com colunas: caso, cliente, valor, dias_atraso, estágio, status, propensão.
2. `GET /api/reports/agreements.csv` — acordos por período.
3. `GET /api/reports/recovery.pdf` — relatório de recuperação com gráficos.
4. Filtros: `from`, `to`, `stage`, `status`.
5. UI botão "Exportar" nas páginas de casos, acordos e dashboard.
6. Respeita isolamento por tenant.
</requirements>

## Subtarefas

- [ ] Criar `app/api/reports/portfolio.csv/route.ts`.
- [ ] Criar `app/api/reports/agreements.csv/route.ts`.
- [ ] Criar `app/api/reports/recovery.pdf/route.ts` (uso de lib PDF tipo pdfkit ou jspdf).
- [ ] UI botão de exportação nas páginas relevantes.
- [ ] Validação de filtros.

## Detalhes de Implementação

### Arquivos a Criar

- `app/api/reports/portfolio.csv/route.ts`
- `app/api/reports/agreements.csv/route.ts`
- `app/api/reports/recovery.pdf/route.ts`

### Arquivos a Modificar

- `app/cases/page.tsx`, `app/negotiations/page.tsx`, `app/page.tsx` — botões de export.

### Arquivos Relevantes

- `app/api/dashboard/metrics/route.ts` (tarefa 1) — agregações reutilizáveis.
- `lib/finance.ts` — `generateCaseDossier` (referência de geração de dossiê); PDF novo com `pdfkit` ou `jspdf` (adicionar dependência em `package.json`).

## Testes

### Testes de Integração

- [ ] CSV abre no Excel com acentos corretos.
- [ ] PDF gerado com gráficos.
- [ ] Filtros de data respeitados.
- [ ] Tenant isolado.

## Critérios de Sucesso

- [ ] Exportações funcionais via UI.
- [ ] `npm run lint && npm run build` sem erros.