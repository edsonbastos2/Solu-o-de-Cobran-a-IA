# Template de Arquivo de Problema

```yaml
---
provider: manual
pr:
round: <N>
round_created_at: <timestamp UTC RFC3339>
status: pending
file: caminho/para/arquivo.ts
line: 42
severity: high
author: claude-code
provider_ref:
---
```

# Problema NNN: <título conciso, máximo 72 caracteres>

## Comentário de Revisão

<corpo detalhado descrevendo o problema e uma correção sugerida>

## Triagem

- Decisão: `SEM REVISÃO`
- Notas:

---

## Campos do Frontmatter

| Campo | Descrição | Valores |
|-------|-----------|---------|
| `provider` | Origem da revisão | `manual` |
| `pr` | Número do PR (se aplicável) | string vazia para manual |
| `round` | Número da rodada (inteiro) | 1, 2, 3... |
| `round_created_at` | Timestamp UTC RFC3339 | ex.: `2024-01-15T10:30:00Z` |
| `status` | Estado do problema | `pending`, `valid`, `invalid`, `resolved` |
| `file` | Caminho relativo do arquivo | ex.: `components/cases-table.tsx` |
| `line` | Número da linha aproximado | inteiro |
| `severity` | Nível de severidade | `critical`, `high`, `medium`, `low` |
| `author` | Autor da revisão | `claude-code` |
| `provider_ref` | Referência do provedor | vazio para manual |
