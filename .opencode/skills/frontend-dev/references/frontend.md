# Frontend Reference — Vue 3 / Nuxt / PrimeVue / Pinia / Vitest

## Princípios Gerais

- Sempre usar **Composition API** com `<script setup lang="ts">`
- Componentes PrimeVue são **auto-importados** — nunca importar manualmente
- Tipagem explícita com TypeScript em todos os arquivos `.ts` e `.vue`
- Evitar lógica de negócio dentro de componentes — delegar a stores
- Props e emits sempre tipados com `defineProps<>()` e `defineEmits<>()`

---

## Estrutura de Componente Vue

```vue
<template>
  <!-- PrimeVue components são auto-importados -->
  <div>
    <InputText
      v-model="form.nome"
      :disabled="loading"
      data-testid="inputtext-example-name"
    />
    <Button
      label="Salvar"
      :loading="loading"
      :disabled="!isValid"
      @click="salvar"
      data-testid="btn-example-save"
    />
  </div>
</template>

<script setup lang="ts">
  // 1. Imports internos (stores, composables, tipos)
  import { useExemploStore } from '@/stores/exemplo/exemplo'
  import { ExemploDTO } from '@/models/exemplo'
    import { useConfirm } from 'primevue/useconfirm'
  import { useToast } from 'primevue/usetoast'

  // 2. Props e emits
  const props = defineProps<{
    itemId: number
    readonly?: boolean
  }>()

  const emit = defineEmits<{
    saved: [item: ExemploDTO]
    cancelled: []
  }>()

  // 3. Stores e composables
  const exemploStore = useExemploStore()
    const nuxt = useNuxtApp()
  const confirm = useConfirm()
  const toast = useToast()

  // 4. Estado local (refs/reactivos)
  const loading = ref(false)
  const form = ref<ExemploDTO>({ ... })

  // 5. Computed
  const isValid = computed(() => !!form.value.nome)

  // 6. Métodos
  async function salvar() {
    loading.value = true
    try {
      const resultado = await exemploStore.salvar(form.value)
      emit('saved', resultado)
    } finally {
      loading.value = false
    }
  }

  // 7. Lifecycle hooks
  onMounted(async () => {
    // inicialização
    await nextTick()
  })

  // 8. Métodos expostos para teste
    defineExpose({
      // métodos expostos exemplo
      nuxt,
      salvar
    })
</script>

<style lang="scss" scoped></style>
```

---

## Pinia Store

```typescript
// stores/exemplo/exemplo.ts
import { defineStore } from 'pinia'
import { FetchResponse } from 'ofetch'
import { PageSelect, Pagination } from '@/models/Paginations'
import { ExemploDTO } from '@/models/exemplo'

export const useExemploStore = defineStore('exemplo', () => {
  const generalDataManager = useGeneralDataManagerStore()

  // State
  const exemploPagination = ref({
    content: [] as ExemploDTO[],
    numberOfElements: 0,
    size: 5,
    totalElements: 0,
    totalPages: 0,
    number: 0,
    pageable: { pageNumber: 0, pageSize: 5, offset: 0, sort: {} },
    sort: {}
  } as Pagination<ExemploDTO[]>)
  const exemplosAll = ref<ExemploDTO[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const exemploToEdit = ref<ExemploDTO>({} as ExemploDTO)

  // Modal
  const loading = ref(false)

  // Assets
  const api = useApi()

  // Getters
  const $perPage = computed(() => exemploPagination.value.pageable.pageSize)
  const $firstItemInPage = computed(
    () => ($currentPage.value - 1) * $perPage.value
  )
  const $currentPage = computed(
    () => exemploPagination.value.pageable.pageNumber + 1
  )
  const $totalPages = computed(() => exemploPagination.value.totalPages)
  const $quantity = computed(() => exemploPagination.value.totalElements)
  const $loading = computed(() => loading.value)
  const $exemploPagination = computed(() => exemploPagination.value)
  const $exemplos = computed(() => exemploPagination.value.content)
  const $exemplosAll = computed(() => exemplosAll.value)
  const $exemploToEdit = computed(() => exemploToEdit.value)

  // Actions
  function setExemploPagination(payload: Pagination<ExemploDTO>) {
    const content = payload.content.map((c) => new ExemploDTO(c))
    const newDataValue = { ...payload, content } as Pagination<ExemploDTO>
    exemploPagination.value = newDataValue
  }

  async function index(pageSelect?: PageSelect) {
    let status = 200
    try {
      if (pageSelect === undefined) {
        pageSelect = { page: 0, size: $perPage.value, unpaged: false }
      }

      const uuidPov = generalDataManager.$uuidPov

      let params = {
        ...pageSelect,
        unpaged: pageSelect.unpaged,
        uuidPov // Qualquer endpoint que precise do uuidPov deve receber esse parâmetro, para evitar que tenhamos que ficar buscando
      }

      loading.value = true
      const data = await api.get('/exemplos/paginados', {
        params,
        /* istanbul ignore start */
        onResponse: ({
          response
        }: {
          response: FetchResponse<any> & FetchResponse<ResponseType>
        }) => {
          status = response.status
        }
        /* istanbul ignore end */
      })

      if (status === 200) {
        const dataValue = data as Pagination<ExemploDTO[]>
        setExemploPagination(dataValue)
      } else {
        setExemploPagination({
          content: [] as ExemploDTO[],
          numberOfElements: 0,
          size: 5,
          totalElements: 0,
          totalPages: 0,
          number: 0,
          pageable: { pageNumber: 0, pageSize: 5, offset: 0, sort: {} },
          sort: {}
        } as Pagination<ExemploDTO[]>)
      }
      loading.value = false
      return status
    } catch (error: any) {
      loading.value = false
      return status
    }
  }

  async function indexAll() {
    let status = 200
    try {
      loading.value = true

      let params = {} as any

      const data = await api.get(`/exemplos`, {
        params,
        /* istanbul ignore start */
        onResponse: ({
          response
        }: {
          response: FetchResponse<any> & FetchResponse<ResponseType>
        }) => {
          status = response.status
        }
        /* istanbul ignore end */
      })
      if ([200, 201].includes(status)) {
        const dataValue = data as ExemploDTO[]
        exemplosAll.value = dataValue
      } else {
        exemplosAll.value = []
      }
      loading.value = false
      return status
    } catch (error: any) {
      loading.value = false
      return status
    }
  }

  async function getExemploByUuid() {
    let status = 200
    try {
      loading.value = true
      const data = await api.get(`/exemplos/${$exemploToEdit.value.uuid}`, {
        /* istanbul ignore start */
        onResponse: ({
          response
        }: {
          response: FetchResponse<any> & FetchResponse<ResponseType>
        }) => {
          status = response.status
        }
        /* istanbul ignore end */
      })

      if (status === 200) {
        const dataValue = data as ExemploDTO
        exemploToEdit.value = dataValue
      } else {
        exemploToEdit.value = {
          uuid: '1',
          nome: 'Exemplo Teste',
          ativo: true
        } as ExemploDTO
      }
      loading.value = false
      return status
    } catch (error: any) {
      loading.value = false
      return status
    }
  }

  async function create(exemplo: ExemploDTO) {
    let status = 200
    try {
      const body = { ...exemplo }
      const data = await api.post(`/exemplos`, {
        body,
        /* istanbul ignore start */
        onResponse: ({
          response
        }: {
          response: FetchResponse<any> & FetchResponse<ResponseType>
        }) => {
          status = response.status
        }
        /* istanbul ignore end */
      })

      if (status !== 204) {
        const dataValue = data as ExemploDTO
        let page = $totalPages.value - 1
        if ($quantity.value === $perPage.value * $totalPages.value) {
          page++
        }
        exemploToEdit.value = dataValue
        await index({ page, size: $perPage.value, unpaged: false })
      }
      return status
    } catch (error: any) {
      loading.value = false
      return status
    }
  }

  async function update(exemplo: ExemploDTO) {
    let status = 200
    try {
      const body = { ...exemplo }
      const data = await api.put(`/exemplos/${exemplo.uuid}`, {
        body,
        /* istanbul ignore start */
        onResponse: ({
          response
        }: {
          response: FetchResponse<any> & FetchResponse<ResponseType>
        }) => {
          status = response.status
        }
        /* istanbul ignore end */
      })

      if (status === 200) {
        const dataValue = data as ExemploDTO
        exemploToEdit.value = dataValue
        await index({
          page: $currentPage.value - 1,
          size: $perPage.value,
          unpaged: false
        })
      } else {
        exemploToEdit.value = {} as ExemploDTO
      }
      return status
    } catch (error: any) {
      loading.value = false
      return status
    }
  }

  async function del(uuid: string) {
    let status = 200
    try {
      await api.del(`/exemplos/${uuid}`, {
        /* istanbul ignore start */
        onResponse: ({
          response
        }: {
          response: FetchResponse<any> & FetchResponse<ResponseType>
        }) => {
          status = response.status
        }
        /* istanbul ignore end */
      })
      if (status === 200) {
        let page = $currentPage.value - 1
        if (
          $exemplos.value.length &&
          $exemplos.value.length === 1 &&
          page !== 0
        ) {
          page--
        }
        await index({
          page,
          size: $perPage.value,
          unpaged: false
        })
      }
      return status
    } catch (error: any) {
      loading.value = false
      return status
    }
  }

  return {
    exemplos,
    loading,
    error,
    $quantity,
    $loading,
    $exemploPagination,
    index,
    indexAll,
    create,
    update,
    del
  }
})
```

---

## Composable (**Caso for solicitado**)

```typescript
// composables/useExemplo.ts
import { ExemploDTO } from '@/models/exemplo'

export function useExemplo() {
  const loading = ref(false)

  async function dateFormat(inputDate: Date): Promise<ExemploDTO | null> {
    loading.value = true
    try {
      return parseDateStringBR(inputDate)!.toLocaleDateString('pt-BR')
    } catch {
      return null
    } finally {
      loading.value = false
    }
  }

  return { loading, dateFormat }
}
```

---

## Testes com Vitest + @vue/test-utils

### Arquivo de mock separado no MSW

```typescript
// mock/exemploHandlers.ts
import { rest } from 'msw'
import { mockServerPath } from './nuxt-imports-mock'
import _random from 'lodash/random'
import _remove from 'lodash/remove'
import { Pagination } from '~/models/Paginations'
import { ExemploDTO } from '~/models/ExemploDTO'

let indexEndpoint = {} as Pagination<ExemploDTO>
let getExemploByUuidEndpoint = {} as ExemploDTO

const resetApiMocks = () => {
  indexEndpoint = {
    content: [
      {
        uuid: '1',
        nome: 'Exemplo Teste',
        ativo: true
      } as ExemploDTO
    ],
    pageable: {
      pageNumber: 0,
      pageSize: 5,
      sort: { empty: true, sorted: false, unsorted: true },
      offset: 0,
      paged: true,
      unpaged: false
    },
    last: true,
    totalElements: 1,
    totalPages: 1,
    size: 5,
    number: 0,
    sort: { empty: true, sorted: false, unsorted: true },
    first: true,
    numberOfElements: 0,
    empty: true
  }

  getExemploByUuidEndpoint = {
    uuid: '1',
    nome: 'Exemplo Teste',
    ativo: true
  } as ExemploDTO
}

export const exemploHandlers = [
  // index
  rest.get(mockServerPath + '/exemplo/paginado', (_req, res, ctx) => {
    resetApiMocks()
    return res(
      ctx.status(200),
      ctx.body(JSON.stringify({ value: indexEndpoint }))
    )
  }),

  // indexAll
  rest.get(mockServerPath + '/exemplo', (_req, res, ctx) => {
    resetApiMocks()
    return res(
      ctx.status(200),
      ctx.body(JSON.stringify({ value: indexEndpoint.content }))
    )
  }),

  // getExemploByUuid
  rest.get(mockServerPath + '/exemplo/:uuid', (_req, res, ctx) => {
    resetApiMocks()
    return res(
      ctx.status(200),
      ctx.body(JSON.stringify({ value: getExemploByUuidEndpoint }))
    )
  }),

  // create
  rest.post(mockServerPath + '/exemplo', async (req, res, ctx) => {
    resetApiMocks()
    const body: ExemploDTO = await req.json()
    indexEndpoint.content.push({
      id: 2,
      nome: 'Exemplo Teste 2',
      ativo: true
    } as ExemploDTO)
    return res(
      ctx.status(201),
      ctx.json({ value: { ...body, uuid: _random(0, 100).toString() } })
    )
  }),

  // update
  rest.put(
    mockServerPath + '/exemplo/atualizar/:uuid',
    async (req, res, ctx) => {
      resetApiMocks()
      const body: ExemploDTO = await req.json()
      _remove(indexEndpoint.content, (c) => c.uuid === body.uuid)
      const updateBody = {
        id: 1,
        nome: 'Exemplo Teste atualizado',
        ativo: true
      } as ExemploDTO
      indexEndpoint.content.push(updateBody)
      return res(ctx.status(200), ctx.json({ value: updateBody }))
    }
  ),

  // delete
  rest.delete(mockServerPath + '/exemplo/:uuid', (_req, res, ctx) => {
    resetApiMocks()
    return res(ctx.status(200))
  })
]
```

### Teste de Componente

```typescript
// TableExemplo.spec.ts
import { useExemploStore } from '@/stores/useExemploStore'
import { usePovsStore } from './../../../store/povs/povs'
import { flushPromises, mount } from '@vue/test-utils'
import Button from 'primevue/button'
import { createTestingPinia } from '@pinia/testing'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import TableExemplo from './TableExemplo.vue'
import InputText from 'primevue/inputtext'
import ConfirmationService from 'primevue/confirmationservice'
import { waitFor } from '@testing-library/vue'
import Card from 'primevue/card'
import MultiSelect from 'primevue/multiselect'
import { useGeneralDataManagerStore } from '~~/store/generalDataManager'
import { UnwrapPromise } from '~~/models/GeneralInterfaces'
import { PovStatus } from '~~/models/Pov'

const renderComponent = async () => {
  const wrapper = mount(TableExemplo, {
    global: {
      stubs: {
        ModalExemplo: {
          name: 'ModalExemplo',
          emits: ['displayModal'],
          template: '<div>Modal Exemplo</div>'
        }
      },
      plugins: [
        createTestingPinia({ stubActions: false }),
        PrimeVue,
        ToastService,
        ConfirmationService
      ],
      components: {
        Column,
        DataTable,
        InputText,
        Card,
        MultiSelect,
        Button
      }
    }
  })
  const exemplo = useExemploStore()

  const generalDataManager = useGeneralDataManagerStore()
  generalDataManager.uuidPov = 'uuidPov'

  const povs = usePovsStore()

  povs.currentPovStatus = new PovStatus({
    exercicioEmPlanejamento: false,
    exercicioEmRevisao: true,
    exercicioDentroDoPeriodoDePlanejamento: false,
    temCenarioEleito: true,
    temRevisaoEmAberto: true,
    mesesLiberados: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  })

  wrapper.vm.nuxt = vi.fn() as any
  return { wrapper, exemplo, povs }
}

describe('TableExemplo', () => {
  let comp: UnwrapPromise<ReturnType<typeof renderComponent>>
  beforeAll(async () => {
    comp = await renderComponent()
  })

  it('is component rendered', async () => {
    await comp.exemplo.index()
    await flushPromises()

    expect(comp.wrapper.exists()).toBe(true)
  })

  it('should open Modal when ModalExemplo component emit displayModal', async () => {
    const modal = comp.wrapper.findComponent({ name: 'ModalExemplo' })
    modal.vm.$emit('displayModal', true)
    await flushPromises()

    expect(modal.exists()).toBe(true)
    expect(comp.wrapper.vm.displayModal).toBe(true)
  })

  it('should call openModal when button is clicked', async () => {
    const btn = comp.wrapper
      .findAllComponents(Button)
      .at(0)!
      .find('#btn-adicionar')
    const openModal = vi.spyOn(comp.wrapper.vm, 'openModal')
    await btn.trigger('click')
    expect(comp.wrapper.vm.hasMonthsEnabled).toBe(true)
    expect(openModal).toHaveBeenCalled()
  })

  it('should call updateSetting when import is clicked', async () => {
    const btn = comp.wrapper
      .findAllComponents(Button)
      .at(1)!
      .find('#btn-intergrar')
    const updateSetting = vi.spyOn(comp.wrapper.vm, 'updateSetting')
    await btn.trigger('click')
    await flushPromises()
    expect(comp.wrapper.vm.hasMonthsEnabled).toBe(true)
    expect(updateSetting).toHaveBeenCalled()
  })

  it('should call deleteSelectedExemplo when button is clicked', async () => {
    const btn = comp.wrapper
      .findAllComponents(Button)
      .at(2)!
      .find('#btn-remover-selecionados')
    const deleteSelectedExemplo = vi.spyOn(
      comp.wrapper.vm,
      'deleteSelectedExemplo'
    )
    await btn.trigger('click')
    expect(comp.wrapper.vm.hasMonthsEnabled).toBe(true)
    expect(deleteSelectedExemplo).toHaveBeenCalled()
  })

  it('should show exemplo on DataTable', async () => {
    await comp.exemplo.index()
    await waitFor(() =>
      expect(comp.wrapper.vm.listExemplo.length).toBeGreaterThan(0)
    )
    expect(comp.wrapper.text()).toContain('Configuração Exemplo')
  })

  it('should call onPage when page is changed', async () => {
    const onPage = vi.spyOn(comp.wrapper.vm, 'onPage')
    const dataTable = comp.wrapper.findComponent(DataTable)
    await dataTable.vm.$emit('page', { first: 6, rows: 5, page: 1 })
    expect(onPage).toHaveBeenCalled()
  })

  it('should call onSort when sort is changed', async () => {
    const onSort = vi.spyOn(comp.wrapper.vm, 'onSort')
    const dataTable = comp.wrapper.findComponent(DataTable)
    await dataTable.vm.$emit('sort', {
      rows: 5,
      sortField: 'CODIGO',
      sortOrder: 1
    })
    expect(onSort).toHaveBeenCalled()
  })
})
```

### Teste de Store Pinia

```typescript
// exemplo.spec.ts
import { setActivePinia } from 'pinia'
import { createTestingPinia } from '@pinia/testing'
import { useGeneralDataManagerStore } from '../generalDataManager'
import { useExemploStore } from './exemplo'

beforeAll(() => {
  setActivePinia(createTestingPinia({ fakeApp: true, stubActions: false }))
})

describe('useExemploStore', async () => {
  it('creates a store', () => {
    const store = useExemploStore()
    expect(store).toBeDefined()
  })

  it('get exemplos', async () => {
    const store = useExemploStore()
    const generalDataManager = useGeneralDataManagerStore()
    generalDataManager.uuidPov = 'uuidPov'
    await store.index()
    expect(store.$exemplos.length).toBeGreaterThan(0)
  })

  it('create exemplo', async () => {
    const store = useExemploStore()
    const generalDataManager = useGeneralDataManagerStore()
    generalDataManager.uuidPov = 'uuidPov'
    await store.index()
    const exemplo = store.$exemplos[0]
    await store.create(exemplo)
    expect(exemplo.descricao).toEqual(store.exemploToEdit.descricao)
  })

  it('update exemplo', async () => {
    const store = useExemploStore()
    const generalDataManager = useGeneralDataManagerStore()
    generalDataManager.uuidPov = 'uuidPov'
    await store.index()
    const exemplo = store.$exemplos[0]
    exemplo.descricao = 'Editado'
    await store.update(exemplo)
    expect(exemplo).toEqual(store.exemploToEdit)
  })

  it('delete exemplo', async () => {
    const store = useExemploStore()
    const generalDataManager = useGeneralDataManagerStore()
    generalDataManager.uuidPov = 'uuidPov'
    await store.index()
    const exemplo = store.$exemplos[0]
    await store.del(exemplo.uuid!)

    expect(store.$exemplos).not.toContain(exemplo)
  })

  it('get exemplo by uuid', async () => {
    const store = useExemploStore()
    const generalDataManager = useGeneralDataManagerStore()
    generalDataManager.uuidPov = 'uuidPov'
    await store.getExemploByUuid()
    expect(store.$exemploToEdit).toEqual({
      uuid: '1',
      nome: 'Exemplo Teste',
      ativo: true
    } as ExemploDTO)
  })
})
```

### Teste de Composable (Caso solicitado)

```typescript
// useExemplo.spec.ts
import { flushPromises } from '@vue/test-utils'
import { renderComponent } from '~/components/organisms/TreeDataTableDirectBudgetDFC/TreeDataTableDirectBudgetDFC.unit.spec'
import { UnwrapPromise } from '~/models'
import autoTable, { RowInput } from 'jspdf-autotable'

describe('useExemplo', () => {
  let comp: UnwrapPromise<ReturnType<typeof renderComponent>>
  beforeAll(async () => {
    comp = await renderComponent()
  })

  it('is component rendered', async () => {
    await flushPromises()
    expect(comp.wrapper.exists()).toBe(true)
  })
})
```
---

## Checklist Front-end

- [ ] `<script setup lang="ts">` em todos os componentes
- [ ] Props e emits tipados com generics
- [ ] PrimeVue sem import manual
- [ ] Lógica de negócio fora do componente (store)
- [ ] Arquivo de mock com MSW (`exemploHandlers`) em `mocks`
- [ ] Testes cobrem: happy path, edge case e erro
- [ ] `data-testid` nos elementos interativos dos testes
