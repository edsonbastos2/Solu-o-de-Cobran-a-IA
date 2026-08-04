---
name: cy-execute-task
description: >
  Use SOMENTE quando o prompt fornece um arquivo N_task.md, diretório do PRD e caminhos
  de rastreamento. Executa a tarefa de ponta a ponta com rastreamento, memória de fluxo
  e suporte a auto-commit. Para desenvolvimento ad-hoc sem PRD formal, use feature-orchestrator.
---

# Executar Tarefa do PRD

Execute uma tarefa do PRD desde a exploração até as atualizações de rastreamento.

## Entradas Necessárias

- Especificação da tarefa em markdown
- Caminho do diretório do PRD (`./docs/<ticket>-<slug>/`)
- Caminho do arquivo de tarefa
- Caminho do arquivo mestre de tarefas
- Modo de auto-commit
- Opcional: caminhos de memória do fluxo de trabalho

## Fluxo de Trabalho

1. **Ancorar no repositório e contexto do PRD.**
   - Ler a especificação de tarefa, techspec, tasks.md, ADRs.
   - Verificar conflitos entre a tarefa, techspec e ADRs.
   - Se houver caminhos de memória, usar skill `cy-workflow-memory`.

2. **Construir o checklist de execução.**
   - Extrair entregáveis, critérios de aceitação em checklist numerado.
   - Capturar sinal pré-mudança.

3. **Implementar a tarefa.**
   - Manter escopo alinhado à especificação.
   - Seguir padrões do repositório (Next.js App Router, React, TypeScript, Tailwind, Supabase, SWR).

4. **Validar e revisar automaticamente.**
   - Executar `npm run lint && npm run build` como pipeline mínimo.
   - Usar skill `cy-final-verify` — obrigatório.
   - Revisão automática após verificação.

5. **Atualizar rastreamento de tarefas.**
   - Atualizar memória → checkboxes → status → tasks.md → commit (se aplicável).

6. **Commit.**
   - Auto-commit: commit local após verificação limpa.
   - Sem auto-commit: deixar diff pronto.
   - Nunca fazer push automaticamente.

## Tratamento de Erros

- Se validação falhar, manter status inalterado até resolver.
- Se arquivos de rastreamento faltarem, parar e reportar.
