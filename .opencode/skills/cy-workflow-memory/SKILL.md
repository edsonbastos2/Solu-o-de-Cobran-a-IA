---
name: cy-workflow-memory
description: Mantém memória de tarefa com escopo de fluxo de trabalho para execuções do Compozy usando arquivos em ../ppov-docs/issues/front/<ticket>-<nome>/memory/. Use quando um prompt de tarefa fornece caminhos de memória do fluxo de trabalho e requer que o agente leia, atualize, compacte e promova contexto durável entre execuções de tarefas do PRD. Não use para remediação de revisão de PR, preferências globais do usuário ou sumarização programática de log de eventos.
---

# Memória de Fluxo de Trabalho

Mantenha os arquivos de memória do fluxo de trabalho fornecidos pelo chamador.

## Entradas Necessárias

- Caminho do diretório de memória do fluxo de trabalho.
- Caminho do arquivo de memória compartilhada do fluxo de trabalho.
- Caminho do arquivo de memória da tarefa atual.
- Sinal opcional do chamador indicando se algum arquivo deve ser compactado antes de prosseguir.

## Fluxo de Trabalho

1. Carregar o estado de memória antes de editar código.
   - Ler o arquivo de memória compartilhada do fluxo de trabalho e o arquivo de memória da tarefa atual antes de fazer qualquer alteração de código.
   - Tratar esses arquivos como contexto obrigatório para a execução, não como notas opcionais.
   - Se o chamador marcar algum arquivo para compactação, ler `references/memory-guidelines.md` e compactar esse arquivo antes de prosseguir com a implementação.

2. Manter a memória atualizada enquanto a tarefa executa.
   - Atualizar a memória da tarefa atual sempre que o objetivo mudar, uma decisão não óbvia for tomada, um aprendizado importante aparecer, ou um erro mudar o plano.
   - Promover apenas contexto durável entre tarefas na memória compartilhada do fluxo de trabalho.
   - Manter detalhes de execução locais da tarefa no arquivo de memória da tarefa atual.

3. Fechar a execução adequadamente.
   - Atualizar a memória antes de qualquer afirmação de conclusão, entrega ou commit.
   - Registrar apenas fatos que ajudem a próxima execução a começar mais rápido e com menos erros.
   - Reler `references/memory-guidelines.md` antes de compactar se o arquivo tiver ficado ruidoso ou repetitivo.

## Regras Críticas

- Não invente histórico, decisões ou status que não aconteceram.
- Não copie grandes blocos de código, stack traces ou especificações de tarefas para os arquivos de memória.
- Não duplique fatos que são óbvios do repositório, do git diff, do arquivo de tarefa ou dos documentos do PRD.
- Não leia arquivos de memória de tarefas não relacionadas, a menos que a memória compartilhada do fluxo de trabalho ou o chamador apontem explicitamente para eles.
- Mantenha a memória compartilhada durável e entre tarefas. Mantenha a memória de tarefa local e operacional.

## Teste de Decisão de Promoção

Antes de promover um item da memória de tarefa para a memória compartilhada do fluxo de trabalho, pergunte:

1. Outra tarefa precisará dessas informações para evitar um erro ou redescoberta?
2. Este fato é durável entre múltiplas execuções, não apenas a execução atual?
3. Essa informação NÃO é já óbvia do PRD, techspec, arquivos de tarefas ou do próprio repositório?

Todos os três devem ser "sim" para promover. Se qualquer um for "não", o item permanece na memória da tarefa.

**Exemplos que pertencem à memória compartilhada do fluxo de trabalho:**
- Uma restrição descoberta que afeta múltiplas tarefas (ex.: "a API limita a 100 req/s, operações em lote devem respeitar isso")
- Uma decisão arquitetural transversal tomada durante a implementação (ex.: "escolheu coordenação baseada em canal em vez de mutex para o pipeline")
- Um risco aberto que tarefas futuras devem considerar (ex.: "migração depende do schema v3 que ainda não foi implantado em staging")

**Exemplos que ficam na memória de tarefa:**
- Arquivos tocados durante a implementação desta tarefa
- Passos de depuração tomados para resolver um erro específico da tarefa
- Snapshot do objetivo e critérios de aceitação da tarefa atual
- Um workaround aplicado apenas ao escopo da tarefa atual

## Regras de Compactação

Quando o chamador sinaliza um arquivo de memória para compactação, aplique estas regras inline. Leia `references/memory-guidelines.md` para detalhes completos, mas estas regras são suficientes para a maioria das passagens de compactação:

1. Se ambos os arquivos precisarem de compactação, compacte a memória compartilhada do fluxo de trabalho primeiro, depois compacte a memória da tarefa. O arquivo compartilhado define o contexto entre tarefas que o arquivo de tarefa não deve duplicar.
2. **Preserve:** estado atual, decisões duráveis, aprendizados reutilizáveis, riscos abertos e notas de entrega.
3. **Remova:** repetição, notas obsoletas, transcrições longas de comandos e fatos já deriváveis do repositório, PRD ou arquivos de tarefas.
4. **Reescreva** itens mantidos como bullets factuais curtos. Não preserve logs narrativos ou registros cronológicos.
5. Mantenha os cabeçalhos de seção padrão do template intactos. Remova seções vazias apenas se forem genuinamente não utilizadas.

## Quando Ler a Referência

Leia `references/memory-guidelines.md` quando qualquer um destes se aplicar:

- o chamador solicitar compactação e as regras inline acima não cobrirem a situação
- não estiver claro o que pertence à memória compartilhada versus à memória de tarefa
- o arquivo de memória atual tiver derivado para notas ruidosas ou detalhes redundantes

## Tratamento de Erros

- Se algum caminho de memória fornecido pelo chamador estiver faltando, pare e reporte a incompatibilidade em vez de adivinhar outro caminho.
- Se o conteúdo da memória conflitar com o repositório ou especificação da tarefa, confie no repositório e nos documentos de tarefa e, então, corrija o arquivo de memória.
- Se a compactação remover riscos ativos, decisões ou contexto de entrega, mantenha esses itens e remova primeiro repetição de menor valor.
