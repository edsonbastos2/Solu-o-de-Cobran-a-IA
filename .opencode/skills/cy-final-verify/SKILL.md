---
name: cy-final-verify
description: Exige evidências frescas de verificação antes de qualquer afirmação de conclusão, correção ou aprovação, e antes de commits. Use quando um agente está prestes a reportar sucesso, entregar trabalho ou fazer commit de código.
---

# Verificação Antes da Conclusão

**Princípio central:** Evidências antes de afirmações, sempre.

```
NENHUMA AFIRMAÇÃO DE CONCLUSÃO SEM EVIDÊNCIA FRESCA DE VERIFICAÇÃO
```

## A Função Portão

```
ANTES de afirmar qualquer status:

1. IDENTIFICAR: Qual comando prova esta afirmação?
2. EXECUTAR: Rodar o comando COMPLETO
3. LER: Saída completa, verificar código de saída
4. VERIFICAR: A saída confirma a afirmação?
5. SOMENTE ENTÃO: Fazer a afirmação
```

## Escopo de Verificação

- **Afirmação estreita** (ex.: "build passa"): Executar `npm run build`.
- **Afirmação ampla** (ex.: "tarefa completa"): Executar `npm run lint && npm run build`.

**Pipeline com sucesso != requisitos atendidos.** Verifique entregáveis em relação à especificação original.

## Falhas Comuns

| Afirmação | Requer | Não Suficiente |
|-----------|--------|---------------|
| Build passa | Saída do comando: 0 erros | Execução anterior |
| Linter limpo | Saída do linter: 0 erros | Verificação parcial |
| Pipeline completo | `npm run lint && npm run build`: saída 0 | Linter passou sozinho |
| Bug corrigido | Testar sintoma original | Código alterado |
| Requisitos atendidos | Checklist linha por linha | Pipeline passando |

## Template de Relatório de Verificação

```
RELATÓRIO DE VERIFICAÇÃO
------------------------
Afirmação: [o que está sendo afirmado]
Comando: [comando exato executado]
Executado: [agora, após todas as alterações]
Código de saída: [0 ou diferente de zero]
Resumo da saída: [linhas chave]
Avisos: [quaisquer avisos, ou "nenhum"]
Erros: [quaisquer erros, ou "nenhum"]
Veredicto: APROVADO ou REPROVADO
```

## Quando a Verificação Falha

1. Leia a falha — identifique o erro exato.
2. Diagnostique a causa raiz.
3. Corrija a causa raiz.
4. Verifique novamente do zero.
5. Reporte com evidências.

**Nunca:** pule re-verificação, afirme sucesso parcial, culpe a ferramenta sem evidência.
