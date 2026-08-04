# Bloco BASE — `Card` + `DataTable` (sempre)

Padrão mínimo de uma tabela de listagem. Inclui: `Card` com título e botão "Adicionar",
`DataTable` com colunas, coluna de **Ações** (editar/remover) e wiring com a store.
Os outros blocos (modal, filtros, paginação, seleção) **acrescentam** atributos/templates
sobre esta base.

> Este código é genérico e autocontido — copie daqui, não de componentes do projeto.

## Template

```vue
<template>
  <!-- Modal: incluir somente se o bloco "modal" foi escolhido -->
  <Modal{{Entidade}}
    :display-modal="displayModal"
    @display-modal="displayModal = $event"
    :uuid-{{entidade}}="uuid{{Entidade}}Edit"
  />

  <Card>
    <template #subtitle>
      <div class="flex flex-row flex-wrap justify-between">
        <div
          class="font-bold text-surface-800 dark:text-surface-50 flex justify-items-center items-center"
        >
          {{Titulo}}
        </div>
        <div class="mb-1">
          <Button
            id="btn-adicionar"
            data-testid="btn-adicionar-{{entidade}}"
            label="Adicionar"
            outlined
            icon="pi pi-plus"
            class="mr-2"
            @click="openModal()"
          />
        </div>
      </div>
    </template>

    <template #content>
      <DataTable
        :value="list{{Entidade}}"
        data-testid="tabela-{{entidade}}"
        class="p-datatable-{{entidade}}"
        data-key="uuid"
        :rows="5"
        :rowHover="true"
        :lazy="true"
        :loading="loading"
        :total-records="quantity"
        :rowsPerPageOptions="[5, 10, 15, 20]"
        responsiveLayout="scroll"
        :first="firstItemInPage"
        @page="onPage($event)"
        showGridlines
        paginator
      >
        <template #empty> Nenhum registro foi encontrado. </template>

        <!-- COLUNAS: uma <Column> por campo informado -->
        <Column header="{{HeaderColuna}}">
          <template #body="{ data }">
            {{ data.{{field}} }}
          </template>
        </Column>

        <!-- Coluna de Ações (editar/remover) -->
        <Column headerStyle="width: 6rem" :showFilterMenu="false">
          <template #header>
            <div class="flex-1 text-center font-bold">Ações</div>
          </template>
          <template #body="{ data, index }">
            <div class="flex justify-center flex-wrap">
              <Button
                :data-testid="`botao-editar-{{entidade}}-${index}`"
                icon="pi pi-pencil"
                class="p-button-rounded p-button-text mx-0"
                @click="openModal(data.uuid)"
                v-tooltip.bottom="{
                  value: 'Editar',
                  pt: { arrow: { style: { display: 'none' } } }
                }"
              />
              <Button
                :data-testid="`botao-remover-{{entidade}}-${index}`"
                icon="pi pi-trash"
                class="p-button-rounded p-button-text mx-0"
                @click="delete{{Entidade}}(data.uuid)"
                v-tooltip.bottom="{
                  value: 'Remover',
                  pt: { arrow: { style: { display: 'none' } } }
                }"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </template>
  </Card>
</template>

<script lang="ts" setup>
  import { DataTablePageEvent } from 'primevue/datatable'
  import { useConfirm } from 'primevue/useconfirm'
  import { useToast } from 'primevue/usetoast'
  import { {{store}} } from '~/store/{{entidades}}/{{entidades}}'
  import { {{Model}} } from '~/models/{{Model}}'

  // Composables
  const {{entidade}}Store = {{store}}()
  const nuxt = useNuxtApp()
  const confirm = useConfirm()
  const toast = useToast()

  // Data
  const uuid{{Entidade}}Edit = ref<string | undefined>('')
  const displayModal = ref(false)

  // Computed
  const loading = computed(() => {{entidade}}Store.$loading)
  const list{{Entidade}} = computed(() => {{entidade}}Store.${{entidades}})
  const quantity = computed(() => {{entidade}}Store.$quantity)
  const firstItemInPage = computed(() => {{entidade}}Store.$firstItemInPage)

  // Methods
  const openModal = (uuid?: string) => {
    uuid{{Entidade}}Edit.value = uuid
    displayModal.value = true
  }

  const delete{{Entidade}} = async (uuid: string) => {
    confirm.require({
      message: 'Tem certeza que quer remover esse item?',
      header: 'Confirmação',
      icon: 'pi pi-info-circle',
      acceptClass: 'p-button-danger',
      accept: async () => {
        nuxt.callHook('page:start')
        const status = await {{entidade}}Store.del(uuid)
        nuxt.callHook('page:finish')
        if (status === 200) {
          toast.add({
            severity: 'success',
            summary: 'Confirmado',
            detail: 'O item foi removido',
            life: 3000
          })
        }
      }
    })
  }

  const onPage = async ({ page, rows }: DataTablePageEvent) => {
    await {{entidade}}Store.index({ page, size: rows, unpaged: false })
  }

  // Lifecycle
  onMounted(async () => {
    await nextTick()
    await {{entidade}}Store.index()
  })

  defineExpose({
    nuxt,
    displayModal,
    uuid{{Entidade}}Edit,
    list{{Entidade}},
    openModal,
    delete{{Entidade}},
    onPage
  })
</script>

<style lang="scss" scoped>
  .p-column-filter-element {
    width: 100%;
  }
</style>
```

## Notas

- `data-key="uuid"` é o identificador padrão das entidades do projeto.
- A store expõe getters read-only com prefixo `$` (`$loading`, `$quantity`,
  `$firstItemInPage`, `${{entidades}}`) e mutações via `ref`. Ver skill `frontend-dev`.
- `nuxt.callHook('page:start' | 'page:finish')` controla o overlay global de loading.
- Se **não** houver modal, remova `<Modal{{Entidade}}>`, o botão "Adicionar" e o botão de
  editar (mantendo só remover, se o usuário quiser ações).
- Se **não** houver paginação, remova `:lazy`, `paginator`, `:rows`, `:rowsPerPageOptions`,
  `:first` e `@page` (ver bloco `pagination-sorting.md` para o caso "Sim").
