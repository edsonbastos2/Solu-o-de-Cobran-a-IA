# Template de Arquivo de Problema

Use esta estrutura exata para cada arquivo de problema. O arquivo é analisado por
`reviews.ReadReviewEntries()` e `prompt.ParseReviewContext()`.

## Formato

```
---
status: pending
file: caminho/para/arquivo.go
line: 42
severity: critical|high|medium|low
author: claude-code
provider_ref:
---

# Problema NNN: <título conciso resumindo o problema>

## Comentário de Revisão

<descrição detalhada do problema, por que é um problema,
e uma correção sugerida com trecho de código conciso, se útil>

## Triagem

- Decisão: `SEM REVISÃO`
- Notas:
```

## Definições de Campos

- **NNN**: Número do problema com zeros à esquerda e três dígitos (001, 002, ...).
- **status**: Começa como `pending`, depois passa por `valid` ou `invalid`, e termina como `resolved`.
- **title**: Resumo de uma linha do problema. Máximo de 72 caracteres.
- **file**: Caminho relativo da raiz do repositório até o arquivo-fonte afetado.
  Use `unknown` apenas quando o problema é puramente arquitetural e não está vinculado a
  um arquivo específico.
- **line**: Número da linha onde o problema é mais visível. Use `0` quando nenhuma
  linha específica se aplica.
- **severity**: Exatamente um de `critical`, `high`, `medium`, `low`.
  Leia `review-criteria.md` para definições.
- **author**: Sempre `claude-code` para rodadas de revisão manual.
- **provider_ref**: Sempre vazio para rodadas de revisão manual.

## Compatibilidade do Parser

- O frontmatter YAML deve ser válido e analisável por `prompt.ParseReviewContext()`.
- Os nomes dos arquivos de problema devem corresponder ao padrão `issue_NNN.md` onde NNN é um
  número com zeros à esquerda, para que `prompt.ExtractIssueNumber()` os reconheça.

## Regras

- Um problema por arquivo. Não combine múltiplos problemas não relacionados.
- O Comentário de Revisão deve ser acionável: declare o problema claramente e
  forneça uma sugestão concreta de como corrigi-lo.
- Mantenha trechos de código no Comentário de Revisão em até 15 linhas.
- Mantenha o título descritivo mas curto.
  Bom: "Verificação de nil faltando antes de acesso ao map em resolveConfig".
  Ruim: "Problema no código".
