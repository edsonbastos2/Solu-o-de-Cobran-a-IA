# Bloco PAGINAÇÃO + ORDENAÇÃO + SELEÇÃO — opcional

Acrescenta paginação server-side (`lazy`), ordenação por coluna (`@sort`) e, opcionalmente,
seleção múltipla com "Remover selecionados" / "Remover todos".

## Atributos no `<DataTable>`

```vue
<DataTable
  :value="list{{Entidade}}"
  data-testid="tabela-{{entidade}}"
  data-key="uuid"
  class="p-datatable-{{entidade}} mt-0"
  :rows="5"
  :rowHover="true"
  :lazy="true"
  :loading="loading"
  :total-records="quantity"
  :rowsPerPageOptions="[5, 10, 15, 20]"
  responsiveLayout="scroll"
  :first="firstItemInPage"
  removableSort
  @sort="onSort($event)"
  @page="onPage($event)"
  paginator
  scrollable
  scrollHeight="400px"
  resizableColumns
  showGridlines
  stripedRows
>
```

### Ordenação por coluna

Adicione `sortable` e um `field` (chave de ordenação enviada ao backend) em cada coluna ordenável:

```vue
<Column header="{{HeaderColuna}}" field="{{FIELD_ORDENACAO}}" sortable>
  <template #body="{ data }">{{ data.{{field}} }}</template>
</Column>
```

### Seleção múltipla (opcional)

Atributos extra no `<DataTable>`:

```vue
<DataTable
  ...
  selection-mode="multiple"
  :metaKeySelection="metaKey"
  v-model:selection="selected{{Entidade}}"
  :selectAll="selectAll"
  @select-all-change="onSelectAllChange($event)"
  @row-select="onRowSelect($event)"
  @row-unselect="onRowUnselect($event)"
  @row-unselect-all="onRowUnselectAll($event)"
>
```

Coluna de checkbox (primeira do `DataTable`):

```vue
<Column selectionMode="multiple" headerStyle="width: 2rem"></Column>
```

Botões no `#subtitle` do `Card`:

```vue
<Button
  data-testid="btn-remover-selecionados-{{entidade}}"
  label="Remover selecionados"
  outlined
  icon="pi pi-trash"
  class="p-button-danger mr-2"
  @click="deleteSelected{{Entidade}}()"
/>
<Button
  data-testid="btn-remover-todos-{{entidade}}"
  label="Remover todos"
  outlined
  icon="pi pi-trash"
  class="p-button-danger mr-2"
  @click="deleteAll{{Entidade}}()"
/>
```

## Script — paginação e ordenação

```ts
import {
  DataTablePageEvent,
  DataTableSortEvent
} from 'primevue/datatable'

const onPage = async ({ page, rows }: DataTablePageEvent) => {
  await {{entidade}}Store.index({ page, size: rows, unpaged: false })
}

const onSort = async ({ rows, sortField, sortOrder }: DataTableSortEvent) => {
  const order = sortOrder === 1 ? 'ASC' : sortOrder === -1 ? 'DESC' : ''
  const field = sortField!
  {{entidade}}Store.applySort({ tipoOrdenacao: order, ordenacao: field })
  await {{entidade}}Store.index({ page: 0, size: rows, unpaged: false })
}
```

## Script — seleção múltipla (opcional)

```ts
import {
  DataTableRowSelectEvent,
  DataTableSelectAllChangeEvent
} from 'primevue/datatable'

// Data
const selected{{Entidade}} = ref([] as {{Model}}[])
const selectAll = ref(false)
const metaKey = ref(true)

// Methods
const deleteSelected{{Entidade}} = async () => {
  const uuids = selected{{Entidade}}.value.map((t) => t.uuid!)
  if (!uuids.length) {
    toast.add({
      severity: 'error',
      summary: 'Remover Selecionados',
      detail: 'Necessário selecionar algum item antes',
      life: 3000
    })
    return
  }
  confirm.require({
    message: 'Tem certeza que quer remover todos os itens selecionados?',
    header: 'Confirmação',
    icon: 'pi pi-info-circle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      nuxt.callHook('page:start')
      const status = await {{entidade}}Store.delSelected(uuids)
      nuxt.callHook('page:finish')
      if (status === 200) {
        toast.add({
          severity: 'success',
          summary: 'Confirmado',
          detail: 'Os itens selecionados foram removidos',
          life: 3000
        })
        selectAll.value = false
        selected{{Entidade}}.value = []
      }
    }
  })
}

const deleteAll{{Entidade}} = async () => {
  confirm.require({
    message: 'Tem certeza que quer remover todos os itens?',
    header: 'Confirmação',
    icon: 'pi pi-info-circle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      nuxt.callHook('page:start')
      const status = await {{entidade}}Store.delAll()
      nuxt.callHook('page:finish')
      if (status === 200) {
        toast.add({
          severity: 'success',
          summary: 'Confirmado',
          detail: 'Todos os itens foram removidos',
          life: 3000
        })
        selectAll.value = false
      }
    }
  })
}

const onSelectAllChange = async (event: DataTableSelectAllChangeEvent) => {
  if (event.checked) {
    await {{entidade}}Store.selectAll()
    selectAll.value = true
    selected{{Entidade}}.value = [...{{entidade}}Store.${{entidades}}FromSelectAll]
  } else {
    selectAll.value = false
    selected{{Entidade}}.value = []
  }
}

const onRowSelect = (_event: DataTableRowSelectEvent) => {
  selectAll.value = selected{{Entidade}}.value?.length === quantity.value
}

const onRowUnselect = () => {
  selectAll.value = false
}

const onRowUnselectAll = () => {
  selectAll.value = false
  selected{{Entidade}}.value = []
}
```

Adicionar ao `defineExpose`: `onPage, onSort` (+ `selected{{Entidade}}, deleteSelected{{Entidade}},
deleteAll{{Entidade}}, onSelectAllChange, onRowSelect, onRowUnselect, onRowUnselectAll` se houver seleção).

## Notas

- A store precisa de `applySort({ tipoOrdenacao, ordenacao })` e, para seleção,
  `selectAll()` + getter `${{entidades}}FromSelectAll` + `delSelected(uuids)` / `delAll()`.
  Delegue à skill `api-integration` se a store ainda não tiver esses métodos.
- `field` na coluna é a **chave de ordenação do backend** (geralmente UPPER_SNAKE_CASE);
  `filterField`/`v-model` continuam usando a chave do dado (camelCase).
- Sem seleção: omita os atributos de seleção, a `<Column selectionMode>` e os botões de remover em massa.
