---
status: completed
title: Atualizar a lista de casos
type: frontend
complexity: low
dependencies: ["8_task"]
---

# Atualizar a lista de casos

## Visão Geral

Exibir na lista de casos o contexto resumido do contrato e do título e remover ações que destruam histórico. A alteração deve ser pequena e preservar paginação e filtros.

<critical>
- Leia a TechSpec e mantenha o padrão visual existente.
- Não reverter alterações paralelas da página.
- Não adicionar redesign fora do escopo.
</critical>

<requirements>
1. Casos canônicos DEVEM mostrar referência de título quando disponível.
2. Casos legados DEVEM indicar contexto incompleto.
3. Paginação, busca e filtros DEVEM continuar funcionando.
4. Ações destrutivas DEVEM ser removidas ou substituídas por encerramento.
</requirements>

## Subtarefas

- [x] Adicionar resumo do título/contrato.
- [x] Adicionar indicador legado.
- [x] Revisar ações destrutivas.
- [x] Verificar filtros e responsividade.

## Detalhes de Implementação

### Arquivos a Criar

- Nenhum.

### Arquivos a Modificar

- `app/cases/page.tsx` — apresentação contextual.

### Arquivos Relevantes

- `app/api/cases/route.ts` — formato GET.
- `lib/types.ts` — tipos de caso.

### Arquivos Dependentes

- `16_task.md` — regressão final.

## Entregáveis

- [x] Contexto resumido na lista.
- [x] Indicador de legado.
- [x] Sem exclusão física na interface.

## Testes

### Testes Unitários

- [x] Caso com título e caso sem título renderizam estados corretos.

### Testes de Integração

- [x] Paginação permanece correta.
- [x] Busca e status continuam filtrando.
- [x] Ação destrutiva não aparece.

## Critérios de Sucesso

- [x] Lista diferencia caso canônico e legado.
- [x] Nenhum histórico é apagado pela UI.
- [x] `npm run lint` sem erros.
- [x] `npm run build` sem erros.
