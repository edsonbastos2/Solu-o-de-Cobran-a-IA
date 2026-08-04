# Bloco FILTRO NO HEADER (busca) — opcional

Formulário de busca no `#header` do `DataTable` (acima das linhas), com vários campos
lado a lado e os botões "Limpar Filtros" / "Visualizar". Útil quando a busca combina
vários critérios de uma vez (ex.: mês + ano + descrição). Server-side, igual ao filtro
de coluna: grava em `search` e dispara `applySearch()`.

> Gerar **apenas** os campos que o usuário indicou para o formulário de busca.

## `<template #header>` dentro do `<DataTable>`

```vue
<template #header>
  <div class="formgrid grid grid-cols-12 gap-4 gap-y-1">
    <!-- Campo numérico (ex.: Mês) -->
    <div class="flex flex-col field col-span-12 md:col-span-1 lg:col-span-1">
      <label class="text-muted-color font-normal" for="search-{{field}}"
        >{{HeaderCampo}}</label
      >
      <InputNumber
        id="search-{{field}}"
        v-model="search.{{field}}"
        data-testid="input-busca-{{field}}"
        inputId="minmax-buttons"
        mode="decimal"
        showButtons
        allow-empty
        :min="1"
        :max="12"
        fluid
      />
    </div>

    <!-- Campo de máscara (ex.: Ano) -->
    <div class="flex flex-col field col-span-12 md:col-span-2 lg:col-span-2">
      <label class="text-muted-color font-normal" for="search-{{field}}"
        >{{HeaderCampo}}</label
      >
      <InputMask
        id="search-{{field}}"
        v-model="search.{{field}}"
        data-testid="input-busca-{{field}}"
        mask="9999"
        slotChar="yyyy"
        autoClear
        class="p-column-filter w-full text-color bg-surface-0 dark:bg-surface-900 border border-solid border-surface rounded-border outline-0"
      />
    </div>

    <!-- Campo de texto -->
    <div class="flex flex-col field col-span-12 md:col-span-3 lg:col-span-3">
      <label class="text-muted-color font-normal" for="search-{{field}}"
        >{{HeaderCampo}}</label
      >
      <InputText
        id="search-{{field}}"
        v-model="search.{{field}}"
        data-testid="input-busca-{{field}}"
        type="text"
        class="p-column-filter"
      />
    </div>

    <!-- Botão Limpar -->
    <div class="flex flex-col field col-span-6 md:col-span-3 lg:col-span-2">
      <Button
        data-testid="btn-limpar-busca-{{entidade}}"
        outlined
        type="button"
        icon="pi pi-filter-slash"
        label="Limpar Filtros"
        class="w-full mt-5 font-bold whitespace-nowrap"
        @click="clearAllFilters()"
      />
    </div>

    <!-- Botão Visualizar -->
    <div class="flex flex-col field col-span-6 md:col-span-3 lg:col-span-2">
      <Button
        data-testid="btn-buscar-{{entidade}}"
        outlined
        type="button"
        label="Visualizar"
        class="w-full mt-5 font-bold whitespace-nowrap"
        @click="applySearch()"
      />
    </div>
  </div>
</template>
```

### Variação: campo de data (`DatePicker`)

```vue
<DatePicker
  v-model="afterDate"
  data-testid="input-busca-data"
  dateFormat="dd/mm/yy"
  inputClass="w-full bg-surface-0 dark:bg-surface-900 btn-calendar"
  manualInput
/>
```

```ts
import {
  formatDateUSAInternational,
  getDateWithoutTimeIso
} from '~~/models/GeneralFunctions'

const afterDate = computed({
  get() {
    return search.value.data
      ? getDateWithoutTimeIso(search.value.data as string)
      : undefined
  },
  set(newValue) {
    search.value.data = newValue ? formatDateUSAInternational(newValue) : ''
  }
})
```

## Script — estado e métodos

```ts
// Data
const search = ref({
  {{field}}: '' // um campo por critério de busca
} as Search{{Entidade}})

// Methods
const applySearch = async () => {
  {{entidade}}Store.applySearch(search.value)
  await {{entidade}}Store.index()
}

const clearAllFilters = async () => {
  search.value = { {{field}}: '' } as Search{{Entidade}}
  await applySearch()
}
```

Adicionar ao `defineExpose`: `search, applySearch, clearAllFilters`.

## Notas

- O grid usa `formgrid grid grid-cols-12` (PrimeFlex/Tailwind) — ajuste `col-span-*` por
  campo para o layout responsivo (mobile-first). `mt-5` alinha os botões à base dos inputs.
- Crie uma interface `Search{{Entidade}}` no `models/` com os campos de busca.
- O filtro no header **pode** coexistir com paginação/ordenação — só somar os atributos.
