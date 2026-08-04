# Diretrizes de Memória

## Propósito

Arquivos de memória do fluxo de trabalho mantêm contexto durável entre execuções de tarefas do PRD. Eles reduzem a redescoberta e erros repetidos em execuções subsequentes.

## Estrutura

```
./docs/<ticket>-<nome>/memory/
├── shared.md       # Memória compartilhada entre tarefas (cross-task)
└── <N>_task.md     # Memória específica da tarefa atual
```

## O que armazenar na memória compartilhada

- Restrições descobertas que afetam múltiplas tarefas
- Decisões arquiteturais tomadas durante implementação
- Riscos abertos que tarefas futuras devem considerar
- Padrões de integração com Supabase, API routes, SWR

## O que manter na memória de tarefa

- Arquivos tocados durante a implementação
- Passos de depuração para erros específicos
- Snapshot do objetivo e critérios de aceitação
- Workarounds aplicados apenas ao escopo atual

## Compactação

Quando solicitado, compacte o arquivo de memória:
1. Preserve estado atual e decisões duráveis
2. Remova repetição e notas obsoletas
3. Reescreva como bullets factuais
4. Mantenha cabeçalhos de seção intactos
