# Diretrizes de Memória de Fluxo de Trabalho

Use estas regras para manter a memória do fluxo de trabalho do Compozy útil entre execuções repetidas de tarefas do PRD.

## Papéis dos Arquivos

### Memória compartilhada do fluxo de trabalho: `MEMORY.md`

Use a memória compartilhada do fluxo de trabalho para contexto que deve sobreviver entre múltiplas tarefas e múltiplas execuções.

Mantenha:
- estado atual do fluxo de trabalho que afeta mais de uma tarefa
- decisões técnicas ou de produto duráveis
- aprendizados reutilizáveis que importarão novamente
- riscos abertos ou notas de entrega que mudam a execução futura

Evite:
- notas de rascunho passo a passo
- grandes trechos de código
- fatos que já são explícitos em `prd.md`, `techspec.md`, `tasks.md` ou no próprio repositório

### Memória da tarefa atual: `memory/<nome do arquivo de tarefa>`

Use a memória de tarefa para contexto específico da tarefa atual.

Mantenha:
- snapshot do objetivo atual
- decisões importantes locais da tarefa
- aprendizados e correções locais
- arquivos ou superfícies tocados que valem lembrar na próxima execução
- notas prontas para a próxima execução

Evite:
- resumos entre tarefas que pertencem ao `MEMORY.md`
- reafirmações repetidas da especificação da tarefa
- transcrições de comandos de baixo sinal

## Regras de Promoção

Promova um item da memória de tarefa para a memória compartilhada do fluxo de trabalho apenas quando for:
- durável entre execuções
- útil a outra tarefa
- provável de prevenir erros repetidos ou redescoberta

Deixe informação na memória de tarefa quando for:
- operacional apenas para a tarefa atual
- temporária
- detalhada demais para reutilização em todo o fluxo de trabalho

## Regras de Compactação

Quando a compactação for necessária:
- preserve estado atual, decisões duráveis, aprendizados reutilizáveis, riscos abertos e entregas
- remova repetição, notas obsoletas, transcrições longas e fatos deriváveis
- reescreva para clareza, não para completude
- prefira bullets factuais curtos em vez de logs narrativos

## Fronteiras Padrão de Seção

### `MEMORY.md`

- `## Estado Atual`
- `## Decisões Compartilhadas`
- `## Aprendizados Compartilhados`
- `## Riscos Abertos`
- `## Entregas`

### `memory/<nome do arquivo de tarefa>`

- `## Snapshot do Objetivo`
- `## Decisões Importantes`
- `## Aprendizados`
- `## Arquivos / Superfícies`
- `## Erros / Correções`
- `## Pronto para a Próxima Execução`
