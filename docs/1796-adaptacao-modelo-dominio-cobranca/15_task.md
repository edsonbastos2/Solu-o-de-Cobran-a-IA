---
status: completed
title: Atualizar o workspace do caso
type: frontend
complexity: medium
dependencies: ["9_task", "11_task"]
---

# Atualizar o workspace do caso

## Visão Geral

Exibir no workspace o contexto financeiro completo do caso e o histórico de auditoria autorizado, preservando chat, IA, intervenção humana e dossiê. Casos legados devem continuar operáveis com aviso claro.

<critical>
- Leia a TechSpec e preserve o fluxo de conversa existente.
- Não bloquear casos legados somente por contexto incompleto.
- Usar estados de loading, erro e vazio.
- Manter acessibilidade e responsividade.
</critical>

<requirements>
1. O workspace DEVE mostrar cliente, contrato, título, valores, vencimento e atraso.
2. O workspace DEVE mostrar status e responsável.
3. Contexto legado incompleto DEVE ser sinalizado.
4. Auditoria DEVE aparecer somente para usuários autorizados.
5. Chat, IA, intervenção e dossiê DEVEM permanecer utilizáveis.
</requirements>

## Subtarefas

- [x] Adicionar painel de contexto financeiro.
- [x] Adicionar responsável e status.
- [x] Adicionar atividade/auditoria.
- [x] Tratar legado e responsividade.

## Detalhes de Implementação

### Arquivos a Criar

- Nenhum, salvo componente local necessário à página.

### Arquivos a Modificar

- `app/cases/[id]/page.tsx` — workspace composto.

### Arquivos Relevantes

- `app/api/cases/[id]/route.ts` — resposta composta.
- `lib/types.ts` — `CollectionCaseContext`.
- `lib/agent.ts` — fluxo de chat.

### Arquivos Dependentes

- `16_task.md` — validação visual e integrada.

## Entregáveis

- [x] Resumo financeiro.
- [x] Aviso de contexto legado.
- [x] Auditoria autorizada.
- [x] Fluxos existentes preservados.

## Testes

### Testes Unitários

- [x] Contexto completo renderiza todos os campos.
- [x] Contexto legado renderiza aviso sem quebrar a página.

### Testes de Integração

- [x] Caso completo exibe cliente, contrato e título.
- [x] Caso legado continua exibindo conversa.
- [x] Auditoria respeita autorização.
- [x] Envio humano e alteração de status continuam funcionando.
- [x] Layout mobile e navegação por teclado funcionam.

## Critérios de Sucesso

- [x] Operador identifica a obrigação sem sair do caso.
- [x] Contexto legado é transparente.
- [x] Chat e IA não sofrem regressão.
- [x] `npm run lint` sem erros.
- [x] `npm run build` sem erros.
