---
name: cy-workflow-memory
description: Mantém memória de tarefa com escopo de fluxo de trabalho usando arquivos em ./docs/<ticket>-<nome>/memory/. Use quando um prompt fornece caminhos de memória e requer que o agente leia, atualize, compacte e promova contexto entre execuções de tarefas do PRD.
---

# Memória de Fluxo de Trabalho

Mantenha os arquivos de memória do fluxo de trabalho fornecidos pelo chamador.

## Entradas Necessárias

- Caminho do diretório de memória do fluxo de trabalho (`./docs/<ticket>-<nome>/memory/`)
- Caminho do arquivo de memória compartilhada
- Caminho do arquivo de memória da tarefa atual
- Sinal opcional para compactação

## Fluxo de Trabalho

1. **Carregar estado de memória** antes de editar código.
2. **Manter memória atualizada** enquanto a tarefa executa — registrar decisões, aprendizados, erros.
3. **Fechar execução** — atualizar memória antes de qualquer afirmação de conclusão.

## Teste de Decisão de Promoção

Antes de promover da memória de tarefa para a compartilhada:
1. Outra tarefa precisará dessas informações?
2. É durável entre múltiplas execuções?
3. Não é óbvio do PRD, techspec ou repositório?

Todos três "sim" para promover.

## Regras de Compactação

- **Preserve:** estado atual, decisões duráveis, aprendizados, riscos abertos.
- **Remova:** repetição, notas obsoletas, transcrições longas.
- **Reescreva** como bullets factuais curtos.

## Regras Críticas

- Não invente histórico ou decisões.
- Não copie grandes blocos de código para a memória.
- Não duplique fatos óbvios do repositório ou documentos do PRD.
