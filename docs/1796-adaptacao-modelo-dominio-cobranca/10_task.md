---
status: completed
title: Corrigir rotas alternativas de mutação
type: api
complexity: medium
dependencies: ["9_task"]
---

# Corrigir rotas alternativas de mutação

## Visão Geral

Alinhar rotas que alteram status e mensagens ao mesmo escopo do detalhe do caso. Isso evita que um caminho alternativo contorne autenticação, tenant ou auditoria.

<critical>
- Leia a TechSpec e mantenha o caso como aggregate root.
- Não duplicar regras de elegibilidade nesta tarefa.
- Toda mensagem e status devem ter ator identificável.
</critical>

<requirements>
1. Rotas de status e mensagem DEVEM usar autenticação.
2. Caso de outro tenant DEVE ser rejeitado sem revelar dados.
3. Status DEVE usar allowlist e transições válidas.
4. Mensagens vazias ou inválidas DEVEM ser rejeitadas.
5. Ações DEVEM gerar auditoria.
</requirements>

## Subtarefas

- [x] Revisar `case-status`.
- [x] Revisar `agent-message`.
- [x] Aplicar contexto de tenant.
- [x] Integrar auditoria e erros.

## Detalhes de Implementação

### Arquivos a Criar

- Nenhum.

### Arquivos a Modificar

- `app/api/case-status/route.ts` — status server-side.
- `app/api/agent-message/route.ts` — mensagem autenticada e auditada.

### Arquivos Relevantes

- `app/api/cases/[id]/route.ts` — contrato de lifecycle.
- `lib/audit.ts` — helper compartilhado.

### Arquivos Dependentes

- `11_task.md` e `12_task.md`.

## Entregáveis

- [x] Rotas com autenticação e escopo.
- [x] Status e mensagens auditados.
- [x] Erros consistentes.

## Testes

### Testes Unitários

- [x] Status desconhecido é rejeitado.
- [x] Mensagem vazia é rejeitada.

### Testes de Integração

- [x] Sessão ausente retorna 401.
- [x] Caso cross-tenant retorna 404/403 conforme padrão.
- [x] Mensagem válida gera registro e auditoria.
- [x] Status válido gera auditoria.

## Critérios de Sucesso

- [x] Rotas alternativas não bypassam tenant.
- [x] Auditoria é atribuível.
- [x] `npm run lint` sem erros.
- [x] `npm run build` sem erros.
