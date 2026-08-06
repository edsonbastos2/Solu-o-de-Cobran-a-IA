---
status: completed
title: Fortalecer detalhe, PATCH, DELETE e auditoria
type: api
complexity: medium
dependencies: ["5_task", "6_task"]
---

# Fortalecer detalhe, PATCH, DELETE e auditoria

## Visão Geral

Tornar o detalhe do caso tenant-safe e contextual, restringir atualizações e impedir a exclusão física de histórico. Generalizar o helper de auditoria para registrar ator, entidade, tenant e antes/depois.

<critical>
- Leia as seções de Auditoria e API da TechSpec.
- Não aplicar corpo inteiro no PATCH.
- Não remover mensagens nem auditoria.
- Toda mutação DEVE exigir autenticação e escopo.
</critical>

<requirements>
1. GET DEVE retornar cliente, contrato, título, mensagens, estágio e auditoria.
2. PATCH DEVE aceitar somente campos autorizados.
3. Alterações DEVEM registrar antes/depois.
4. DELETE NÃO DEVE destruir histórico.
5. Falha de auditoria DEVE ser observável e tratada conforme política da rota.
</requirements>

## Subtarefas

- [x] Adicionar autenticação no detalhe.
- [x] Implementar contexto composto.
- [x] Criar allowlist e validação de transição.
- [x] Generalizar auditoria.
- [x] Substituir exclusão destrutiva.

## Detalhes de Implementação

### Arquivos a Criar

- Nenhum.

### Arquivos a Modificar

- `app/api/cases/[id]/route.ts` — detalhe e lifecycle.
- `lib/audit.ts` — contrato completo de auditoria.

### Arquivos Relevantes

- `supabase_audit_logs.sql` — colunas existentes.
- `lib/api-auth.ts` — autenticação.
- `lib/finance.ts` — estágio.

### Arquivos Dependentes

- `10_task.md` e `15_task.md`.

## Entregáveis

- [x] Contexto composto no GET.
- [x] PATCH seguro.
- [x] Auditoria com erros propagados.
- [x] Histórico preservado.

## Testes

### Testes Unitários

- [x] Campo arbitrário é rejeitado.
- [x] Transição de status inválida é rejeitada.
- [x] Payload de auditoria contém antes/depois.

### Testes de Integração

- [x] Caso de outro tenant não é retornado.
- [x] Mudança de status gera auditoria.
- [x] Troca de responsável gera auditoria.
- [x] DELETE não remove mensagens.
- [x] Caso legado retorna contexto parcial sem erro.

## Critérios de Sucesso

- [x] Nenhuma mutação sem usuário e tenant válidos.
- [x] Histórico não é apagado.
- [x] Auditoria cobre alterações críticas.
- [x] `npm run lint` sem erros.
- [x] `npm run build` sem erros.
