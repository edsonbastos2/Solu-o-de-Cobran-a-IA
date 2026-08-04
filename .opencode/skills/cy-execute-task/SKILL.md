---
name: cy-execute-task
description: >
  Use SOMENTE quando o prompt fornece um arquivo N_task.md, diretório do PRD e caminhos
  de rastreamento. Executa a tarefa de ponta a ponta com rastreamento, memória de fluxo
  e suporte a auto-commit. Para desenvolvimento ad-hoc sem PRD formal, use feature-orchestrator.
  Não use para lotes de revisão de PR, tarefas genéricas sem arquivo N_task.md, ou trabalho
  de verificação isolado.
---

# Executar Tarefa do PRD

Execute uma tarefa do PRD desde a exploração até as atualizações de rastreamento.

## Entradas Necessárias

- Especificação da tarefa em markdown.
- Caminho do diretório do PRD.
- Caminho do arquivo de tarefa.
- Caminho do arquivo mestre de tarefas.
- Modo de auto-commit.
- Opcional: caminho do diretório de memória do fluxo de trabalho.
- Opcional: caminho da memória compartilhada do fluxo de trabalho.
- Opcional: caminho da memória da tarefa atual.

## Fluxo de Trabalho

1. Ancorar no repositório e contexto do PRD.
   - Ler a especificação de tarefa fornecida.
   - Ler os arquivos de orientação do repositório nomeados pelo chamador.
   - Ler os documentos do PRD no diretório fornecido, especialmente `techspec.md` e `tasks.md`.
   - Ler ADRs do subdiretório `adrs/` do diretório do PRD para entender o contexto de decisão arquitetural para esta tarefa.
   - Após ler todas as fontes, verificar conflitos entre a especificação da tarefa, o techspec e os ADRs. Se algum requisito se contradizer, pare e reporte o conflito em vez de adivinhar — não prossiga para o passo 2.
   - Se o chamador fornecer caminhos de memória do fluxo de trabalho, usar a skill `cy-workflow-memory` instalada antes de editar código.
   - Reconciliar o estado atual do workspace antes de novas edições.

2. Construir o checklist de execução.
   - Extrair entregáveis, critérios de aceitação e todo item explícito de `Validação`, `Plano de Teste` ou `Testes` em um checklist de trabalho numerado.
   - Imprimir o checklist completo antes de iniciar a implementação para que seja visível e rastreável.
   - Capturar o sinal concreto pré-mudança que prova que a tarefa ainda não está concluída.
   - Usar este checklist como portão: marcar cada item concluído à medida que evidências são produzidas durante a implementação, e não prosseguir para validação até que todos os itens do checklist tenham sido tratados.

3. Implementar a tarefa.
   - Manter o escopo alinhado à especificação da tarefa.
   - Seguir padrões do repositório e APIs de dependências reais.
   - Registrar trabalho significativo fora do escopo como notas de acompanhamento em vez de expandir silenciosamente a tarefa.

4. Validar e revisar automaticamente.
   - Executar todos os comandos de teste e validação listados na especificação da tarefa — não apenas a verificação geral do repositório.
   - Usar a skill `cy-final-verify` instalada. Este passo é obrigatório independentemente do modo de auto-commit — sempre verificar antes de reivindicar conclusão.
   - Realizar uma revisão automática após a verificação e resolver todos os problemas bloqueantes antes de prosseguir.

5. Atualizar rastreamento de tarefas.
   - Se caminhos de memória do fluxo de trabalho foram fornecidos, atualizar os arquivos de memória primeiro — registrar decisões, aprendizados e superfícies tocadas antes de atualizar o status de rastreamento.
   - Usar o caminho do arquivo de tarefa e o caminho do arquivo mestre de tarefas fornecidos pelo chamador.
   - Marcar subtarefas como concluídas apenas quando a implementação e as evidências estiverem realmente completas.
   - Alterar o status da tarefa para concluída apenas após verificação limpa e revisão automática.
   - Ler `references/tracking-checklist.md` ao aplicar atualizações de status, checklist ou commit.
   - Sequência: atualização de memória (se aplicável) -> checkboxes do arquivo de tarefa -> status da tarefa -> arquivo mestre de tarefas -> commit (se aplicável).

6. Tratar comportamento de commit.
   - Se o auto-commit estiver habilitado, criar um commit local após verificação limpa, revisão automática e atualizações de rastreamento.
   - Se o auto-commit estiver desabilitado, deixar o diff pronto para revisão e commit manual.
   - Nunca fazer push automaticamente.

## Tratamento de Erros

- Se o sinal pré-mudança não puder ser reproduzido diretamente, capturar o sinal de linha de base mais forte disponível e declarar a limitação.
- Se a validação falhar, manter o status da tarefa inalterado até que a falha seja resolvida.
- Se os arquivos de rastreamento estiverem faltando, parar e reportar o caminho ausente antes de marcar como conclusão.
