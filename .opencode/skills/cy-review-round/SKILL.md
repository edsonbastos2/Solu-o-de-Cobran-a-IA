---
name: cy-review-round
description: Realiza uma revisão abrangente de código de uma implementação de PRD e gera um diretório de rodada de revisão com arquivos de problema compatíveis com cy-fix-reviews.
---

# Rodada de Revisão

Realize uma revisão estruturada de código e produza um diretório de rodada de revisão.

## Entradas Necessárias

- Nome da funcionalidade: `./docs/<ticket>-<nome>/`
- Opcional: arquivos ou diretórios para escopo da revisão

## Fluxo de Trabalho

1. **Determinar diretório de rodada** — `./docs/<ticket>-<nome>/reviews-NNN/`.
2. **Identificar escopo** — ler PRD, TechSpec, ADRs; `git diff main...HEAD --name-only`.
3. **Realizar revisão** — ler `references/review-criteria.md`, avaliar segurança, correção, performance, erros, qualidade, testes, arquitetura. Executar `npm run lint` primeiro para filtrar sobreposições.
4. **Gerar arquivos de problema** — `issue_NNN.md` com frontmatter YAML (provider, round, status, file, line, severity).
5. **Resumir** — recomendação de merge, total por severidade, aspectos positivos.
6. **Verificar** — `cy-final-verify`.

### Template de Arquivo de Problema

```yaml
---
provider: manual
pr:
round: <N>
round_created_at: <timestamp RFC3339>
status: pending
file: caminho/para/arquivo.ts
line: 42
severity: high
author: claude-code
provider_ref:
---

# Problema NNN: <título>

## Comentário de Revisão
<corpo detalhado>

## Triagem
- Decisão: `SEM REVISÃO`
- Notas:
```

## Regras Críticas

- Não corrija problemas — apenas identifique e documente.
- Não crie problemas para o que o linter já captura.
- Não crie rodadas vazias.
- Severidades: `critical`, `high`, `medium`, `low`.
