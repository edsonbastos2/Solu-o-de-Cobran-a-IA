---
name: frontend-dev
description: >
  Use SEMPRE para qualquer tarefa de desenvolvimento frontend neste projeto: Nuxt 3, Vue 3,
  TypeScript, PrimeVue (auto-import), Tailwind CSS, Pinia e Vitest/@vue/test-utils.

  GATILHOS OBRIGATÓRIOS — ative esta skill quando o usuário:
  - Colar, mencionar ou descrever código Vue (.vue), store Pinia, composable ou página Nuxt
  - Pedir para criar ou modificar componente, tela, formulário, modal ou tabela
  - Descrever um ticket, user story ou bug de UI/UX no projeto
  - Mencionar qualquer dessas tecnologias: Nuxt, Vue, PrimeVue, Pinia, Vitest, Tailwind, $fetch
  - Compartilhar erros de console, build ou TypeScript do projeto front-end
  - Pedir integração com API (endpoint, DTO, $fetch, tratamento de erro HTTP)
  - Pedir testes unitários de componentes, stores ou composables

  NÃO ative para: tarefas puramente de backend, infra, banco de dados ou design gráfico sem código.

  Antes de gerar qualquer código, leia OBRIGATORIAMENTE:
  - `references/frontend.md` — padrões de componente, store, composable e testes
  - `references/responsividade.md` — padrões de layout responsivo (mobile-first)
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

# Frontend Dev Skill

Guia de desenvolvimento para o projeto com Nuxt 3, Vue 3 (Composition API) e PrimeVue.

## Stack

| Camada     | Tecnologias                                                    |
| ---------- | -------------------------------------------------------------- |
| Core       | Nuxt 3, Vue 3 (Composition API), TypeScript                    |
| UI & Style | PrimeVue (auto-import), Tailwind CSS                           |
| Estado     | Pinia                                                          |
| Testes     | Vitest, @vue/test-utils, @pinia/testing, MSW para mocks de API |

---

## Passo a passo por tipo de tarefa

### Nova Feature

1. Leia `references/frontend.md` e `references/responsividade.md`
2. Mapeie as camadas: Store (Pinia) → Componente (UI)
3. Implemente nessa ordem: Store → Componente
4. Aplique responsividade mobile-first com Tailwind
5. Crie testes unitários junto com a implementação (veja skill `test-generator`)

### Correção de Bug

1. Identifique a camada: apresentação (Vue) | estado (Pinia) | dados (Composable/API)
2. Leia `references/frontend.md` para confirmar o padrão esperado
3. Proponha a correção com causa raiz descrita
4. Ajuste os testes afetados

### Revisão de código / PR

→ Use a skill `code-review` para checklist completo antes de commitar

---

## Nomenclatura

| Artefato       | Padrão                            | Localização    |
| -------------- | --------------------------------- | -------------- |
| Componente Vue | `NomePascalCase.vue`              | `components/`  |
| Composable     | `useNomeCamelCase.ts`             | `composables/` |
| Store Pinia    | `useNomeCamelCaseStore.ts`        | `stores/`      |
| Mock MSW       | `nomeCamelCaseHandlers.ts`        | `mocks/`       |
| Interface/Type | `INomeInterface.ts`               | `models/`      |
| Página (rota)  | `nome-da-pagina.vue` (kebab-case) | `pages/`       |

---

## Referências detalhadas

- **Padrões de código** (componente, store, testes): `references/frontend.md`
- **Responsividade** (breakpoints, grid, modal, tabela): `references/responsividade.md`
- **Integração com API** (DTOs, erros HTTP, paginação): use a skill `api-integration`
- **Testes unitários**: use a skill `test-generator`
- **Tabelas / listagens** (`DataTable` com modal, filtros, paginação, ordenação): use a skill `table-generator` — padrão completo embutido, com perguntas de refinamento
