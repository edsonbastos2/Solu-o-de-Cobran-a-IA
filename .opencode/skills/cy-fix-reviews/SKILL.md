---
name: cy-fix-reviews
description: Executa remediação de revisão usando arquivos de rodada de revisão existentes em ./docs/<ticket>-<nome>/reviews-NNN/. Use ao resolver problemas de revisão em lote, implementar correções e verificar o resultado.
---

# Corrigir Revisões

Execute o fluxo de trabalho de remediação de revisão em sequência estrita.

## Entradas Necessárias

- Arquivos de problema em `<batch_issue_files>`
- Diretório de rodada de revisão (`./docs/<ticket>-<nome>/reviews-NNN/`)
- Fluxo de verificação do repositório (`cy-final-verify`)

## Fluxo de Trabalho

1. **Coletar contexto da rodada** — ler frontmatter, provider, round, severidade.
2. **Ler e triar os arquivos de problema** — status `valid` ou `invalid` com justificativa.
3. **Corrigir problemas válidos** — por severidade (crítico → alto → médio → baixo).
4. **Fechar arquivos** — `status: resolved` após código e verificação completos.
5. **Verificar** — usar `cy-final-verify`, executar `npm run lint && npm run build`.

## Regras Críticas

- Não modifique arquivos de problema fora do lote.
- Não marque `resolved` antes da verificação estar completa.
- Arquivos em `./docs/<ticket>-<nome>/reviews-NNN/`.
