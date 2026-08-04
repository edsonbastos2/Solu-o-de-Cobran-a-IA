---
name: api-integration
description: >
  Use quando precisar integrar o frontend com endpoints da API backend. Ative esta skill quando
  o usuário:
  - Mencionar useApi, $fetch, endpoint, API, REST, HTTP, DTO ou contrato de API
  - Pedir para criar ou ajustar chamada de API no frontend (store)
  - Compartilhar payload JSON de um endpoint e pedir para tipar ou consumir
  - Perguntar sobre tratamento de erro HTTP (400, 401, 403, 404, 500)
  - Pedir paginação, filtros via query params ou listagem com server-side sort
  - Mencionar "response envelope", "FetchError", "ofetch" ou erros de rede
  - Precisar mapear dados do backend para o formato esperado pelo frontend

  Cobre: tipagem de DTOs, padrão de chamada com `useApi()`, captura de status HTTP,
  tratamento de erro centralizado, paginação server-side, query params dinâmicos
  e conversão DTO → model.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

# API Integration Skill

Guia de integração frontend ↔ API para o projeto Nuxt 3, com foco em tipagem de DTOs,
captura de status HTTP e padrões de chamada com o wrapper `useApi()`.

## Regra de ouro: sempre `useApi()`, nunca `$fetch` cru

Toda chamada HTTP nas stores passa pelo composable `composables/useApi.ts` —
**nunca** se usa `$fetch` direto. O `useApi()` injeta automaticamente:

- `baseURL` a partir de `config.public.apiBase` (por isso a URL começa em `/cargos`, **não** `/api/cargos`)
- header `x-session` (token do cookie)
- header `historicoProcessoEmValidacaoUuid` (quando houver)
- interceptor global `onResponseError` que joga o erro em `useGeneralDataManagerStore().errorMessage`,
  exibido via PrimeVue Toast em `app.vue`

```typescript
// Dentro da store, na seção "Assets"
const api = useApi()

await api.get('/cargos', { params })
await api.post('/cargos', { body })
await api.put(`/cargos/${uuid}`, { body })
await api.del(`/cargos/${uuid}`)
await api.patch(`/cargos/${uuid}`, { body })
```

## Estrutura de um DTO

DTOs são interfaces/types em `models/`, em **PascalCase com sufixo `Dto`** (sem prefixo `I`).
Frequentemente há uma **classe model** correspondente (ex.: `CargoRH`) que recebe o DTO no
construtor e calcula campos derivados.

```typescript
// models/CargoRHDto.ts
export interface CargoRHDto {
  uuid: string
  codigo: string
  descricao: string
  horasTrabalhadas: number
  salarioFinal: number
  salarioInicial: number
  status: boolean
  valorHora: number
}

// Coleções têm o tipo no plural
export type CargosRHDto = CargoRHDto[]
```

```typescript
// models/CargoRH.ts — classe que encapsula o DTO e expõe campos formatados
export class CargoRH {
  uuid: string
  descricao: string
  salarioFinalFormatado: string // calculado no frontend, nunca vem da API

  constructor(dto: CargoRHDto) {
    this.uuid = dto.uuid
    this.descricao = dto.descricao
    this.salarioFinalFormatado = formatCurrency(dto.salarioFinal)
  }
}
export type CargosRH = CargoRH[]
```

O DTO é o **contrato cru da API**; a classe model é a forma **consumida pela UI**.
A conversão acontece sempre na store, via `.map((c) => new CargoRH(c))`.

## Envelope de resposta paginada

```typescript
// models/Paginations.ts

export interface Pageable {
  sort: Sort
  pageNumber: number
  pageSize: number
  offset: number
  unpaged: boolean
  paged: boolean
}

export interface Pagination<T> {
  content: T
  empty: boolean
  last: boolean
  first: boolean
  number: number
  numberOfElements: number
  pageable: Pageable
  size: number
  sort: Sort
  totalPages: number
  totalElements: number
}
```

---

## Captura de status HTTP

O padrão do projeto **não** depende de `try/catch` para fluxo de status: o status é capturado
pelo callback `onResponse` e usado para decidir o que fazer com o dado. O `catch` serve apenas
de rede de segurança (o erro em si já foi tratado centralmente pelo `useApi`).

```typescript
let status = 200
const data = await api.get('/cargos', {
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

if (status !== 204) {
  // usa data
}
```

> Os blocos `/* istanbul ignore start/end */` em volta do `onResponse` são intencionais —
> esse callback não é coberto por teste.

---

## Padrões de chamada (store Pinia)

### GET com paginação e filtros

```typescript
async function index(pageSelect?: PageSelect) {
  let status = 200
  try {
    if (pageSelect === undefined) {
      pageSelect = { page: 0, size: $perPage.value, unpaged: false }
    }

    // Monta query params dinamicamente — só inclui o que tem valor
    let params = {
      ...pageSelect,
      unpaged: pageSelect.unpaged,
      povUuid: generalDataManager.$uuidPov // endpoints por POV recebem o uuid
    } as any

    if (search.value) {
      params.descricaoCargo = search.value
    }

    loading.value = true
    const data = await api.get('/cargos', {
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

    if (status !== 204) {
      const dataValue = data as Pagination<CargosRHDto>
      setCargoPagination(dataValue) // converte DTO → model lá dentro
    } else {
      setCargoPagination({
        content: [] as CargosRH,
        numberOfElements: 0,
        size: 5,
        totalElements: 0,
        totalPages: 0,
        number: 0,
        pageable: { pageNumber: 0, pageSize: 5, offset: 0, sort: {} },
        sort: {}
      } as Pagination<CargosRH>)
    }
    loading.value = false
    return status
  } catch (error: any) {
    loading.value = false
    return status
  }
}
```

A conversão DTO → model fica na função `set*`:

```typescript
function setCargoPagination(payload: Pagination<CargosRHDto>) {
  const content = payload.content.map((c) => new CargoRH(c))
  cargoPagination.value = { ...payload, content } as Pagination<CargosRH>
}
```

### GET simples (por uuid)

```typescript
async function getCargoByUuid() {
  let status = 200
  try {
    loading.value = true
    const data = await api.get(`/cargos/${$cargoRhToEdit.value.uuid}`, {
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
      cargoRhToEdit.value = new CargoRH(data as CargoRHDto)
    }
    loading.value = false
    return status
  } catch (error: any) {
    loading.value = false
    return status
  }
}
```

### POST / PUT

```typescript
// POST - criação
async function create(cargo: CargoRHDto) {
  let status = 200
  try {
    const body = { ...cargo, povUuid: generalDataManager.$uuidPov }
    const data = await api.post(`/cargos`, {
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
      const dataValue = new CargoRH(data as CargoRHDto)
      let page = $totalPages.value - 1
      if ($quantity.value === $perPage.value * $totalPages.value) {
        page++
      }
      cargoRhToEdit.value = dataValue
      await index({ page, size: $perPage.value, unpaged: false })
    }
    return status
  } catch (error: any) {
    loading.value = false
    return status
  }
}

// PUT - atualização
async function update(cargo: CargoRHDto) {
  let status = 200
  try {
    const body = { ...cargo, povUuid: generalDataManager.$uuidPov }
    const data = await api.put(`/cargos/${cargo.uuid}`, {
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
      cargoRhToEdit.value = new CargoRH(data as CargoRHDto)
      await index({
        page: $currentPage.value - 1,
        size: $perPage.value,
        unpaged: false
      })
    } else {
      cargoRhToEdit.value = {} as CargoRH
    }
    return status
  } catch (error: any) {
    loading.value = false
    return status
  }
}
```

### DELETE

```typescript
async function del(uuid: string) {
  let status = 200
  try {
    await api.del(`/cargos/${uuid}`, {
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
      if ($cargos.value.length && $cargos.value.length === 1 && page !== 0) {
        page--
      }
      await index({ page, size: $perPage.value, unpaged: false })
    }
    return status
  } catch (error: any) {
    loading.value = false
    return status
  }
}
```

> `del` com corpo (ex.: exclusão em lote) passa `body` junto das `opts`:
> `await api.del('/cargos/selecionados', { body, onResponse: ... })`.

---

## Tratamento de Erros HTTP — centralizado

**Não há `try/catch` para montar mensagem de erro na store, nem composable `useApiError`.**
O erro HTTP é capturado **uma única vez**, no interceptor `onResponseError` de
`composables/useApi.ts`, que escreve em `useGeneralDataManagerStore().errorMessage`:

```typescript
// composables/useApi.ts (já existente — não recriar)
return $fetch(requestUrl, {
  ...options,
  onResponseError({ response }) {
    const errorData = response._data as BackendErrorMessageData[]
    generalDataManager.errorMessage = Array.isArray(errorData)
      ? errorData
      : [errorData]
  }
})
```

Esse `errorMessage` é observado em `app.vue` e exibido via PrimeVue **Toast**
globalmente. Por isso a store:

- **não** mantém um state `error` próprio
- **não** faz re-throw — o `catch` apenas garante `loading.value = false` e retorna o `status`
- retorna o **status numérico** para o componente decidir o fluxo (ex.: fechar modal só se 200/201)

```typescript
// No componente — reage ao status retornado pela action
const status = await cargosStore.create(cargo)
if (status === 200 || status === 201) {
  closeModal()
}
// erro de API já apareceu no Toast automaticamente; nada a fazer aqui
```

---

## Paginação server-side com DataTable

```vue
<template>
  <DataTable
    :value="$cargos"
    :rows="$perPage"
    :rowHover="true"
    :lazy="true"
    :loading="$loading"
    data-key="uuid"
    :total-records="$quantity"
    :rowsPerPageOptions="[5, 10, 15, 20]"
    responsiveLayout="scroll"
    :first="$firstItemInPage"
    @page="onPage($event)"
    showGridlines
    paginator
  >
    <Column field="descricao" header="Descrição" />
  </DataTable>
</template>

<script setup lang="ts">
  import type { DataTablePageEvent } from 'primevue/datatable'

  const cargos = useCargosRHStore()
  const { $cargos, $perPage, $quantity, $firstItemInPage, $loading } =
    storeToRefs(cargos)

  const onPage = async ({ page, rows }: DataTablePageEvent) => {
    await cargos.index({ page, size: rows, unpaged: false })
  }

  onMounted(async () => {
    await cargos.index()
  })
</script>
```

---

## Checklist de integração API

- [ ] DTO tipado em `models/` em **PascalCase com sufixo `Dto`** (sem prefixo `I`)
- [ ] Tipo plural para coleções (`CargosRHDto = CargoRHDto[]`)
- [ ] Classe model correspondente quando há campos derivados/formatados
- [ ] Conversão DTO → model na store, via `.map((c) => new Model(c))`
- [ ] Chamadas de API apenas em stores (nunca no componente) e sempre via `useApi()`
- [ ] URL **sem** prefixo `/api` (o `baseURL` já vem do config)
- [ ] Status capturado por `onResponse` e decisão via `if (status !== 204)` / `if (status === 200)`
- [ ] `loading.value = true` antes da chamada; `loading.value = false` antes de cada `return` (inclusive no `catch`)
- [ ] `povUuid` enviado em endpoints que dependem do POV
- [ ] Query params construídos dinamicamente (só adicionar filtro quando há valor)
- [ ] **Não** criar state `error` na store nem re-throw — erro já é central no `useApi`/Toast
- [ ] Mock MSW criado em `mocks/` para todos os endpoints do módulo

---

## Anti-padrões

```typescript
// 🔴 RUIM: $fetch cru — perde baseURL, x-session e o tratamento central de erro
const data = await $fetch('/api/cargos')

// 🔴 RUIM: prefixo /api na URL — o baseURL do config já aponta para a API
await api.get('/api/cargos')

// 🔴 RUIM: prefixo I no DTO e sem sufixo Dto — fora do padrão do projeto
interface ICargo { ... }

// 🔴 RUIM: criar useApiError/state error e dar re-throw
catch (e) {
  error.value = parsearErro(e)
  throw e // o erro já é exibido via Toast pelo useApi; re-throw quebra o padrão
}

// 🔴 RUIM: chamada de API direto no componente
onMounted(async () => {
  items.value = await api.get('/cargos')
})

// 🔴 RUIM: loading preso — sem zerar no catch
async function buscar() {
  loading.value = true
  const data = await api.get('/cargos') // se lançar, loading fica true
  loading.value = false
}

// 🔴 RUIM: passar undefined em query params
await api.get('/cargos', {
  params: { descricaoCargo: search.value } // se vazio, vira "undefined" na URL
})
// ✅ adicione o filtro só quando houver valor:
if (search.value) params.descricaoCargo = search.value
```
