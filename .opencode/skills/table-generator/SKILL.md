---
name: table-generator
description: >
  Gerador determinístico do padrão de Tabela (listagem) do projeto usando o componente
  PrimeVue `DataTable` dentro de um `Card`. Ative esta skill quando o usuário:
  - Pedir para criar uma tabela, listagem, grid, "tela de listagem" ou CRUD de listagem
  - Mencionar `DataTable`, `Column`, "tabela com filtro", "tabela com paginação" ou "tabela com modal"
  - Pedir um componente `organisms/TableXxx` (com ou sem `templates/ModalXxx`)
  - Descrever uma tela que lista registros com colunas, filtros, ordenação e ações (editar/remover)

  NÃO ative para: gráficos, árvores (TreeTable), formulários isolados sem listagem,
  ou telas que não sejam de listagem tabular.

  Esta skill é INTERATIVA e roda no FLUXO PRINCIPAL: faz perguntas de refinamento
  (modal? filtros? paginação/ordenação?) ANTES de gerar o código. Todo o padrão está
  embutido em `references/` — não depende de nenhum componente do projeto.
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
---

# Table Generator

Gera o **padrão de Tabela** do projeto (listagem com `DataTable` dentro de um `Card`),
montando o componente a partir de blocos opcionais (modal, filtros, paginação/ordenação,
seleção). É **determinístico**: as mesmas respostas produzem sempre a mesma estrutura.

> **Autocontido:** todo o código-base vive em `references/`. Esta skill **não lê nem
> depende** de `TableConnectionSettings`, `TableRevenueHistory`, `TableEmployee` ou
> `ModalConnectionSetting` — se esses componentes mudarem no futuro, o padrão aqui
> continua válido. Ao gerar, copie dos arquivos em `references/`, nunca dos componentes vivos.

---

## Onde roda

Sempre no **fluxo principal** (precisa perguntar ao usuário). Quando acionada pelo
`feature-orchestrator`, é o agente **`cy-frontend-developer`** que a invoca para a etapa
de Componente — mas as perguntas de refinamento devem ser respondidas pelo usuário no
fluxo principal antes de delegar (o orquestrador coleta as respostas e as repassa na spec).

---

## Passo 1 — Ler o padrão (obrigatório antes de gerar)

Leia os blocos que serão usados, conforme as respostas do Passo 2:

| Bloco | Arquivo | Quando ler |
| --- | --- | --- |
| Base (sempre) | `references/table-base.md` | Sempre |
| Modal criar/editar | `references/modal.md` | Se houver modal |
| Filtro por coluna (menu) | `references/column-filters.md` | Se filtro = coluna |
| Filtro no header (busca) | `references/header-filters.md` | Se filtro = header |
| Paginação + ordenação + seleção | `references/pagination-sorting.md` | Se houver paginação/ordenação |
| Testes | `references/tests.md` | Sempre (gera o `.spec.ts`) |

---

## Passo 2 — Perguntas de refinamento (use `AskUserQuestion`)

Faça **todas** as perguntas abaixo antes de escrever qualquer arquivo. Use uma única
chamada `AskUserQuestion` com múltiplas perguntas quando possível.

1. **Identidade** (texto livre, pergunte no chat se faltar):
   - Nome do domínio em PascalCase (ex.: `CargoRH`) → vira `Table{{Entidade}}`
   - Título exibido no `Card` (ex.: "Cargos")
   - Endpoint base da API (ex.: `/cargos`) e se já existe `store`/`model` ou precisam ser criados
   - Lista de colunas: para cada uma → `header` (label PT), `field` (chave do dado),
     tipo (`texto` | `numero` | `moeda` | `data` | `select` | `multiselect`)

2. **Modal?** — "Vai existir modal de criação/edição?"
   - `Sim` → gerar `templates/Modal{{Entidade}}/Modal{{Entidade}}.vue` (bloco `modal.md`)
     + botão "Adicionar" + coluna de Ações com editar.
   - `Não` → sem modal; a coluna de Ações fica opcional (pergunte se ainda quer remover).

3. **Filtros?** — "Como será o filtro?" (pode ser nenhum):
   - `Nenhum`
   - `Filtro por coluna (menu)` → bloco `column-filters.md`. **Pergunte quais campos**
     terão filtro e o tipo de input de cada um (texto = `InputText`, select = `Select`,
     múltiplos = `MultiSelect`).
   - `Filtro no header (busca)` → bloco `header-filters.md`. **Pergunte quais campos**
     entram no formulário de busca do header e o tipo (`InputNumber`, `InputMask`,
     `InputText`, `DatePicker`).
   - (Ambos podem coexistir se o usuário pedir.)

4. **Paginação e ordenação?** — "Vai existir paginação e ordenação?"
   - `Sim` → bloco `pagination-sorting.md` (lazy + `paginator` + `:rows` + `removableSort`
     + `sortable` nas colunas + `@sort`/`@page`). Pergunte também se há **seleção múltipla**
     (checkbox + "Remover selecionados" / "Remover todos").
   - `Não` → tabela simples sem `paginator`/`lazy`.

---

## Passo 3 — Gerar os arquivos

Componha o componente a partir dos blocos selecionados, substituindo os placeholders:

| Placeholder | Significado | Exemplo |
| --- | --- | --- |
| `{{Entidade}}` | PascalCase | `CargoRH` |
| `{{entidade}}` | camelCase | `cargoRh` |
| `{{entidades}}` | camelCase plural | `cargosRh` |
| `{{Titulo}}` | título do Card | `Cargos` |
| `{{store}}` | nome do composable da store | `useCargosRhStore` |
| `{{Model}}` | interface principal | `ICargoRH` |
| `{{endpoint}}` | rota base | `/cargos` |

Arquivos gerados (apenas os aplicáveis):

```
components/organisms/Table{{Entidade}}/Table{{Entidade}}.vue
components/organisms/Table{{Entidade}}/Table{{Entidade}}.spec.ts
components/templates/Modal{{Entidade}}/Modal{{Entidade}}.vue        (se modal = Sim)
components/templates/Modal{{Entidade}}/Modal{{Entidade}}.spec.ts    (se modal = Sim)
```

Store, model (DTO) e handler MSW: se ainda não existirem, **delegue** ao fluxo padrão —
a skill `api-integration` (model/store) e a skill `test-generator` (specs + MSW). Esta
skill foca no(s) componente(s) de tabela/modal e em deixar os pontos de integração prontos.

### Regras de geração (não negociáveis)

- `data-testid` em **todo** elemento interativo (botões, inputs, linhas de ação),
  no padrão `kebab-case` derivado da entidade (ex.: `tabela-{{entidade}}`,
  `botao-adicionar-{{entidade}}`).
- Sem lógica de negócio no componente — estado e chamadas ficam na store (`{{store}}`).
- PrimeVue é **auto-import** (não importar `DataTable`, `Column`, `Button`, etc.).
- Estilo Prettier do projeto: 2 espaços, aspas simples, sem ponto e vírgula, sem trailing comma.
- **NUNCA** gerar snapshots nos testes (proibido no projeto).
- Após gerar, rodar `yarn test` para os arquivos novos antes de declarar concluído.

---

## Passo 4 — Integração no fluxo agêntico

Esta skill é a **fonte do padrão de tabela**. No fluxo do `feature-orchestrator`, quando a
etapa de Componente Vue for uma **listagem tabular**, o agente `cy-frontend-developer`
aciona `table-generator` (em vez de montar a tabela do zero com `frontend-dev`). Os testes
continuam pelo `cy-qa-engineer` → `test-generator`, e os portões de review seguem normais.

---

## Checklist de saída

- [ ] Perguntas de refinamento respondidas (modal / filtros / paginação)
- [ ] Componente `Table{{Entidade}}.vue` gerado a partir de `references/`
- [ ] `Modal{{Entidade}}.vue` gerado (se aplicável)
- [ ] `data-testid` em todos os elementos interativos
- [ ] Store/model/handler existentes reutilizados ou delegados a `api-integration`/`test-generator`
- [ ] `.spec.ts` gerado sem snapshots
- [ ] `yarn test` dos arquivos novos passa
