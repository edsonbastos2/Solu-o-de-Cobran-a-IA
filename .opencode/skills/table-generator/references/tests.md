# Bloco TESTES — `.spec.ts` (sempre)

Teste de componente da tabela com `@vue/test-utils` + `createTestingPinia` + MSW.
Segue as regras do projeto (CLAUDE.md): **sem `vi.mock`** de store/API, **sem snapshots**,
sem dados de mock inline (use handlers MSW existentes em `mocks/`). O modal é **stubado**
para isolar a tabela.

> Para detalhes adicionais e o teste de store, ver skill `test-generator` e
> `frontend-dev/references/frontend.md`. Este bloco cobre o essencial da tabela.

## `Table{{Entidade}}.spec.ts`

```typescript
import { {{store}} } from '~/store/{{entidades}}/{{entidades}}'
import { flushPromises, mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { waitFor } from '@testing-library/vue'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import Table{{Entidade}} from './Table{{Entidade}}.vue'
import { UnwrapPromise } from '~~/models/GeneralInterfaces'

const renderComponent = async () => {
  const wrapper = mount(Table{{Entidade}}, {
    global: {
      stubs: {
        // Stub do modal para isolar a tabela (omitir se não houver modal)
        Modal{{Entidade}}: {
          name: 'Modal{{Entidade}}',
          emits: ['displayModal'],
          template: '<div>Modal {{Entidade}}</div>'
        }
      },
      plugins: [
        createTestingPinia({ stubActions: false }),
        PrimeVue,
        ToastService,
        ConfirmationService
      ],
      components: { Card, DataTable, Column, Button, InputText }
    }
  })

  const {{entidade}}Store = {{store}}()
  wrapper.vm.nuxt = vi.fn() as any
  return { wrapper, {{entidade}}Store }
}

describe('Table{{Entidade}}', () => {
  let comp: UnwrapPromise<ReturnType<typeof renderComponent>>

  beforeAll(async () => {
    comp = await renderComponent()
  })

  it('renderiza o componente', async () => {
    await comp.{{entidade}}Store.index()
    await flushPromises()
    expect(comp.wrapper.exists()).toBe(true)
  })

  it('abre o modal ao clicar em Adicionar', async () => {
    const btn = comp.wrapper.find('[data-testid="botao-adicionar-{{entidade}}"]')
    const openModal = vi.spyOn(comp.wrapper.vm, 'openModal')
    await btn.trigger('click')
    expect(openModal).toHaveBeenCalled()
    expect(comp.wrapper.vm.displayModal).toBe(true)
  })

  it('lista os registros no DataTable', async () => {
    await comp.{{entidade}}Store.index()
    await waitFor(() =>
      expect(comp.wrapper.vm.list{{Entidade}}.length).toBeGreaterThan(0)
    )
  })

  it('chama onPage ao trocar de página', async () => {
    const onPage = vi.spyOn(comp.wrapper.vm, 'onPage')
    const dataTable = comp.wrapper.findComponent(DataTable)
    await dataTable.vm.$emit('page', { first: 6, rows: 5, page: 1 })
    expect(onPage).toHaveBeenCalled()
  })

  // Incluir somente se houver ordenação:
  it('chama onSort ao ordenar', async () => {
    const onSort = vi.spyOn(comp.wrapper.vm, 'onSort')
    const dataTable = comp.wrapper.findComponent(DataTable)
    await dataTable.vm.$emit('sort', {
      rows: 5,
      sortField: '{{FIELD_ORDENACAO}}',
      sortOrder: 1
    })
    expect(onSort).toHaveBeenCalled()
  })

  // Incluir somente se houver filtro:
  it('aplica busca ao filtrar', async () => {
    const applySearch = vi.spyOn(comp.wrapper.vm, 'applySearch')
    await comp.wrapper.vm.applySearch()
    expect(applySearch).toHaveBeenCalled()
  })
})
```

## Regras (CLAUDE.md)

- **Nunca** `vi.mock` de store ou de chamadas de API.
- **Nunca** snapshots (`toMatchSnapshot`/`toMatchInlineSnapshot`/`__snapshots__/`).
- Usar os **handlers MSW existentes** em `mocks/` (registrados via `mocks/setupTests.ts`).
  Se a entidade não tiver handler, crie `mocks/{{entidades}}Handlers.ts` (delegue a `test-generator`).
- Para controlar retorno de action, usar `createTestingPinia({ stubActions: true, createSpy: vi.fn })`
  + `vi.mocked(store.action).mockResolvedValue(...)` — não inline mock data.
- Cobrir: render, abrir modal, listagem, paginação, ordenação (se houver), filtro (se houver),
  remover (confirm) e cenário de erro.
- Gerar `Modal{{Entidade}}.spec.ts` também quando houver modal (testar `save`, `closeDialog`, `isEdit`).
