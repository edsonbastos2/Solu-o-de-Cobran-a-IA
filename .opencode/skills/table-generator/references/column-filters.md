# Bloco FILTRO POR COLUNA (menu) — opcional

Cada coluna ganha um menu de filtro (ícone de funil) com input próprio e botões
"Limpar Filtro" / "Visualizar". A busca é server-side: o input grava em `search`,
e "Visualizar" chama `applySearch()` → `store.applySearch()` + `store.index()`.

> Gerar **apenas** para os campos que o usuário indicou como filtráveis.

## Atributos adicionais no `<DataTable>`

```vue
<DataTable
  ...
  v-model:filters="filters"
  filterDisplay="menu"
  :globalFilterFields="globalFilterFields"
>
```

## `<Column>` filtrável — input de TEXTO (`InputText`)

```vue
<Column
  header="{{HeaderColuna}}"
  filterField="{{field}}"
  :show-filter-operator="false"
  :show-add-button="false"
  :show-filter-match-modes="false"
  filterMenuStyle="min-width: 15rem; max-width: 15rem"
  headerClass="p-filter-field"
>
  <template #body="{ data }">
    {{ data.{{field}} }}
  </template>
  <template #filter>
    <InputText
      v-model="search.{{field}}"
      type="text"
      class="p-column-filter"
      data-testid="input-filtro-{{field}}"
    />
  </template>
  <template #filterclear>
    <Button
      type="button"
      outlined
      @click="clearFilters()"
      class="w-5/12 font-bold"
      style="justify-content: center"
      data-testid="botao-limpar-filtro-{{field}}"
      >Limpar Filtro</Button
    >
  </template>
  <template #filterapply>
    <Button
      type="button"
      @click="applySearch()"
      class="w-5/12 font-bold"
      style="justify-content: center"
      data-testid="botao-aplicar-filtro-{{field}}"
      >Visualizar</Button
    >
  </template>
</Column>
```

## Variações do input (trocar apenas o `<template #filter>`)

### Seleção única (`Select`)

```vue
<template #filter>
  <Select
    v-model="search.{{field}}"
    :options="{{opcoes}}"
    optionLabel="selectLabel"
    optionValue="selectValue"
    placeholder="Selecione"
    :filter="true"
    showClear
    class="p-column-filter w-full text-color bg-surface-0 dark:bg-surface-900 border border-solid border-surface rounded-border outline-0"
    data-testid="select-filtro-{{field}}"
    @change="applySearch()"
  />
</template>
```

### Seleção múltipla (`MultiSelect`)

```vue
<template #filter>
  <MultiSelect
    v-model="search.{{field}}"
    :options="{{opcoes}}"
    optionLabel="descricao"
    optionValue="uuid"
    :filter="true"
    class="p-column-filter"
    inputClass="w-full text-color bg-surface-0 dark:bg-surface-900 border border-solid border-surface rounded-border outline-none"
  />
</template>
```

## Script — estado e métodos de filtro

```ts
import {
  DataTableFilterMetaData,
  DataTableOperatorFilterMetaData
} from 'primevue/datatable'
import { FilterOperator, FilterMatchMode } from '@primevue/core/api'

// Data
const search = ref<{{Model}}>({
  // um campo por filtro, com valor inicial vazio:
  {{field}}: ''
} as {{Model}})

const globalFilterFields = ref<string[]>([
  '{{field}}' // listar todos os filterField das colunas filtráveis
])

const filters = ref<{
  [key: string]:
    | string
    | DataTableFilterMetaData
    | DataTableOperatorFilterMetaData
}>()

// Methods
const initFilters = () => {
  const filterFields: Record<string, any> = []
  globalFilterFields.value.forEach((field) => {
    filterFields[field] = {
      operator: FilterOperator.AND,
      constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }]
    }
  })
  filters.value = { ...filterFields }
}

const clearFilters = async () => {
  search.value = { {{field}}: '' } as {{Model}} // resetar todos os campos de busca
  await applySearch()
}

const applySearch = async () => {
  {{entidade}}Store.applySearch(search.value)
  await {{entidade}}Store.index()
}
```

E no `onMounted`, antes de `index()`:

```ts
onMounted(async () => {
  await nextTick()
  initFilters()
  await {{entidade}}Store.index()
})
```

Adicionar ao `defineExpose`: `filters, search, globalFilterFields, applySearch, clearFilters`.

## Notas

- `filterField` deve casar com a chave usada no `search` e no `globalFilterFields`.
- `headerClass="p-filter-field"` destaca visualmente as colunas com filtro.
- `clearFilters()` reseta **todos** os campos (padrão do projeto) — se o usuário quiser
  limpar campo a campo, use um `switch (filterField)` como em `header-filters.md`.
