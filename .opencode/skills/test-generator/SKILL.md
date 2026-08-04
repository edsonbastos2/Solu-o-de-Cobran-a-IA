---
name: test-generator
description: >
  Use SEMPRE que precisar criar ou completar testes unitários no projeto frontend Vue 3 / Nuxt.
  Ative esta skill quando o usuário:
  - Pedir "escreve o teste para...", "cria o spec de...", "adiciona cobertura em..."
  - Mostrar um componente .vue, store Pinia sem arquivo .spec.ts correspondente
  - Pedir para aumentar cobertura de testes ou cobrir um caso de erro/edge case
  - Mencionar Vitest, @vue/test-utils, @pinia/testing, MSW ou "test unitário"
  - Após criar qualquer nova feature (sempre gerar testes junto)

  Esta skill cobre os três tipos de teste do projeto:
  1. Teste de Componente Vue (mount, data-testid, emits, slots)
  2. Teste de Store Pinia (actions, getters, estado inicial, erros)

  Antes de gerar qualquer teste, LEIA o arquivo-alvo para entender o que deve ser coberto.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

# Test Generator Skill

Gera testes unitários completos para o projeto Vue 3 / Nuxt seguindo os padrões com
Vitest, @vue/test-utils, @pinia/testing e MSW.

## Fluxo de trabalho

1. **Leia o arquivo-alvo** (componente, store)
2. **Identifique o tipo** (componente / store)
3. **Mapeie o que testar** usando o checklist abaixo
4. **Verifique se existe mock** em `mocks/` — crie se necessário
5. **Gere o arquivo `.spec.ts`** no mesmo diretório do arquivo testado
6. **Valide** cobrindo: happy path + edge cases + cenários de erro

---

## Checklist por tipo

### Componente Vue

- [ ] Expoe todos os metódos, props, emits, ref e computed no defineExpose({})
- [ ] Renderiza corretamente com props padrão
- [ ] Renderiza com estado inicial do store (via `createTestingPinia`)
- [ ] Elementos interativos têm `data-testid` e são encontráveis
- [ ] Emits são disparados corretamente nas ações do usuário
- [ ] Estados de loading/disabled refletem o estado do store
- [ ] Slots e conteúdo condicional (v-if/v-show) são testados
- [ ] Chamada a métodos da store é verificada (`.toHaveBeenCalledOnce()`)

### Store Pinia

- [ ] Estado inicial está correto
- [ ] Getters computados retornam o valor esperado
- [ ] Actions de busca: happy path (dados retornados), estado de loading, erro
- [ ] Actions de mutação: POST/PUT/DELETE com mock do `$fetch`
- [ ] `loading` volta para `false` tanto no sucesso quanto no erro
- [ ] `error` é definido corretamente e limpo a cada nova requisição

---

## Templates de código

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

### Teste de Store

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

### Template de Mock MSW

```typescript
// mock/exemploHandlers.ts
import { rest } from 'msw'
import { mockServerPath } from './nuxt-imports-mock'
import _random from 'lodash/random'
import _remove from 'lodash/remove'
import { Pagination } from '~/models/Paginations'
import { ExemploDTO } from '~/models/ExemploDTO'

// ─── Dados de mock reutilizáveis nos testes ───────────────────────────────────
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

// ─── Handlers MSW ─────────────────────────────────────────────────────────────
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

---

## Regras de nomenclatura de testes

```
describe('NomeDoArtefato') {           // nome exato do componente ou store
  describe('nomeDoMetodo') {           // agrupa por método ou ação quando a store é complexa
    it('should <behavior expected> when <condition>') { ... }
    it('should return null when <error condition>') { ... }
  }
}
```

---

## Anti-padrões a evitar

```typescript
// RUIM: testar implementação interna
expect(wrapper.vm.loading).toBe(true) // acopla ao estado interno

// BOM: testar comportamento visível
expect(wrapper.find('[data-testid="spinner"]').exists()).toBe(true)

// RUIM: assertions muito genéricas
expect(store.items).toBeTruthy()

// BOM: assertions precisas
expect(store.items).toHaveLength(2)
expect(store.items[0].nome).toBe('Exemplo Teste')

// RUIM: não resetar mocks
vi.fn() // sem beforeEach(() => mock.mockReset())

// BOM
beforeEach(() => fetchMock.mockReset())
```
