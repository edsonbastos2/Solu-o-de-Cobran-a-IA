# Referência de Responsividade — ppov-front-vue3

## Breakpoints Tailwind (padrão — projeto não customizou)

| Prefixo | Largura mínima | Dispositivo típico         |
|---------|---------------|---------------------------|
| _(sem)_ | 0px           | Mobile (base)              |
| `sm:`   | 640px         | Mobile grande / landscape  |
| `md:`   | 768px         | Tablet                     |
| `lg:`   | 1024px        | Desktop pequeno            |
| `xl:`   | 1280px        | Desktop                    |
| `2xl:`  | 1536px        | Desktop grande             |

**Regra de ouro:** escreva o estilo sem prefixo para mobile. Adicione `md:` e `lg:` para expandir o layout.

---

## 1. Grid de Formulário

Padrão do projeto: `grid grid-cols-12` com `col-span-*` responsivo.

```vue
<!-- Campos de formulário: empilham em mobile, ficam lado a lado em md/lg -->
<div class="grid grid-cols-12 gap-4">

  <!-- Campo largo: full em mobile, metade em tablet, 1/3 em desktop -->
  <div class="flex flex-col field col-span-12 md:col-span-6 lg:col-span-4">
    <label>Descrição</label>
    <InputText v-model="form.descricao" class="w-full" />
  </div>

  <!-- Campo médio -->
  <div class="flex flex-col field col-span-12 md:col-span-4 lg:col-span-3">
    <label>Tipo</label>
    <Select v-model="form.tipo" :options="tipos" class="w-full" />
  </div>

  <!-- Campo pequeno: metade em mobile, quarto em md/lg -->
  <div class="flex flex-col field col-span-6 md:col-span-3 lg:col-span-2">
    <label>Código</label>
    <InputText v-model="form.codigo" class="w-full" />
  </div>

</div>
```

### Mapa de col-span por tipo de campo

| Tipo de campo           | mobile (`col-span-`) | tablet (`md:col-span-`) | desktop (`lg:col-span-`) |
|-------------------------|---------------------|------------------------|-------------------------|
| Texto longo / descrição | 12                  | 6                      | 4                       |
| Select / dropdown       | 12                  | 4                      | 3                       |
| Data / período          | 12                  | 3                      | 3                       |
| Código / número curto   | 6                   | 3                      | 2                       |
| Checkbox / toggle       | 6                   | 2                      | 2                       |
| Botão de ação isolado   | 12                  | 3                      | 2                       |

---

## 2. Cabeçalhos de Seção (título + botão)

Padrão do projeto: `flex flex-row flex-wrap justify-between`.
Em telas muito pequenas, os itens quebram linha naturalmente via `flex-wrap`.

```vue
<!-- Padrão já estabelecido — manter consistência -->
<div class="flex flex-row flex-wrap justify-between mb-2">
  <div class="font-bold text-surface-800 dark:text-surface-50 flex items-center">
    Título da Seção
  </div>
  <div class="mb-1">
    <Button label="Adicionar" outlined icon="pi pi-plus" @click="openModal()" />
  </div>
</div>
```

Para cabeçalhos com filtros inline (ex: cabeçalho de DataTable):

```vue
<template #header>
  <div class="flex md:flex-row flex-col mx-0 justify-between gap-2">
    <!-- Filtros ficam em coluna no mobile, linha no tablet+ -->
    <div class="flex flex-col w-full md:w-auto">
      <label class="mb-1">Tipo</label>
      <Select v-model="filtro" :options="opcoes" class="w-full md:w-48" />
    </div>
    <!-- Busca global alinhada à direita no md+ -->
    <div class="flex items-end">
      <InputText v-model="globalFilter" placeholder="Buscar..." class="w-full md:w-56" />
    </div>
  </div>
</template>
```

---

## 3. Tabelas (DataTable / TreeTable)

**Obrigatório:** sempre usar `responsiveLayout="scroll"` para habilitar scroll horizontal em mobile.

```vue
<DataTable
  :value="lista"
  responsiveLayout="scroll"
  showGridlines
  :rows="10"
  paginator
  :rowsPerPageOptions="[5, 10, 15, 20]"
>
```

### Largura de colunas responsiva

Evitar larguras fixas em `px`. Preferir percentual ou classes Tailwind:

```vue
<!-- BOM: largura responsiva com Tailwind -->
<Column header="Descrição" class="sm:w-64 md:w-96 lg:w-auto" />

<!-- BOM: percentual relativo -->
<Column header="Ações" style="width: 8%" />

<!-- RUIM: largura fixa que quebra em mobile -->
<Column header="Descrição" style="width: 300px" />
```

Para tabelas com muitas colunas que precisam de largura mínima total:

```vue
<!-- tableStyle garante scroll horizontal quando necessário -->
<DataTable tableStyle="min-width: 50rem" responsiveLayout="scroll">
```

---

## 4. Modais e Dialogs (PrimeVue `<Dialog>`)

**Padrão obrigatório:** sempre definir `:breakpoints` junto com `:style`.

```vue
<!-- Modal pequeno (ex: confirmação, formulário simples) -->
<Dialog
  v-model:visible="visible"
  modal
  :style="{ width: '45vw' }"
  :breakpoints="{ '960px': '75vw', '641px': '100vw' }"
  header="Título do Modal"
>

<!-- Modal médio (ex: formulário completo) -->
<Dialog
  v-model:visible="visible"
  modal
  :style="{ width: '55vw' }"
  :breakpoints="{ '960px': '75vw', '641px': '100vw' }"
>

<!-- Modal grande (ex: tabela interna, formulário complexo) -->
<Dialog
  v-model:visible="visible"
  modal
  :style="{ width: '70vw' }"
  :breakpoints="{ '960px': '85vw', '641px': '100vw' }"
>
```

### Mapa de larguras por tamanho de modal

| Tamanho  | `:style.width` | `960px` breakpoint | `641px` breakpoint |
|----------|---------------|-------------------|-------------------|
| Pequeno  | `45vw`        | `75vw`            | `100vw`           |
| Médio    | `55vw`        | `75vw`            | `100vw`           |
| Grande   | `70vw`        | `85vw`            | `100vw`           |
| Full     | `90vw`        | `95vw`            | `100vw`           |

**Conteúdo interno do modal:** aplicar os mesmos padrões de grid de formulário dentro do `<Dialog>`.

---

## 5. Flex layouts direcionais

```vue
<!-- Empilha em mobile, lado a lado em md+ -->
<div class="flex flex-col md:flex-row gap-4">
  <div class="w-full md:w-1/2">...</div>
  <div class="w-full md:w-1/2">...</div>
</div>

<!-- Sempre lado a lado, quebra em mobile com wrap -->
<div class="flex flex-row flex-wrap gap-2">
  <Button label="Ação 1" />
  <Button label="Ação 2" />
</div>
```

---

## 6. Visibilidade por breakpoint

```vue
<!-- Só aparece em tablet+ -->
<div class="hidden md:block">Coluna extra de detalhe</div>

<!-- Só aparece em mobile -->
<div class="block md:hidden">Versão compacta para mobile</div>

<!-- Ícone sem texto em mobile, com texto em md+ -->
<Button icon="pi pi-plus" class="md:hidden" />
<Button icon="pi pi-plus" label="Adicionar" class="hidden md:inline-flex" />
```

---

## 7. Tipografia e espaçamento responsivo

```vue
<!-- Texto que cresce em telas maiores -->
<h1 class="text-lg md:text-xl lg:text-2xl font-bold">Título</h1>

<!-- Padding que aumenta em desktop -->
<div class="p-2 md:p-4 lg:p-6">...</div>

<!-- Margem bottom que diminui em mobile -->
<div class="mb-4 md:mb-6">...</div>
```

---

## 8. Padrões específicos do projeto

### Select/Dropdown com largura adaptativa

```vue
<!-- Padrão encontrado no projeto -->
<Select
  v-model="valor"
  :options="opcoes"
  class="w-full md:w-4/12 sm:w-8/12"
/>
```

### Botões de ação em linha de tabela

```vue
<!-- Sempre centralizado, nunca ocupa a linha toda -->
<div class="flex justify-center flex-wrap gap-1">
  <Button icon="pi pi-pencil" text @click="editar(data)" />
  <Button icon="pi pi-trash" text @click="deletar(data)" />
</div>
```

### Filtros de coluna (DataTable com filterDisplay)

```vue
<InputText
  v-model="search.campo"
  type="text"
  class="p-column-filter w-full"
  placeholder="Filtrar..."
/>
```

---

## 9. Anti-padrões — O que evitar

```vue
<!-- RUIM: largura fixa em px em elemento de layout -->
<div style="width: 350px">...</div>

<!-- BOM: usar Tailwind com responsivo -->
<div class="w-full md:w-96">...</div>

<!-- RUIM: Modal sem breakpoints -->
<Dialog :style="{ width: '600px' }">

<!-- BOM: Modal com breakpoints -->
<Dialog :style="{ width: '55vw' }" :breakpoints="{ '960px': '75vw', '641px': '100vw' }">

<!-- RUIM: colunas sempre lado a lado sem adaptação mobile -->
<div class="flex flex-row">
  <div class="w-1/3">...</div>
  <div class="w-2/3">...</div>
</div>

<!-- BOM: empilha em mobile -->
<div class="flex flex-col md:flex-row">
  <div class="w-full md:w-1/3">...</div>
  <div class="w-full md:w-2/3">...</div>
</div>

<!-- RUIM: DataTable sem responsiveLayout -->
<DataTable :value="lista">

<!-- BOM -->
<DataTable :value="lista" responsiveLayout="scroll">
```

---

## 10. Checklist final de revisão

Antes de marcar um componente como responsivo:

- [ ] Testado conceitualmente em 375px (mobile), 768px (tablet) e 1280px (desktop)
- [ ] Nenhum elemento com largura fixa em `px` que possa causar overflow
- [ ] Todos os `Dialog` têm `:breakpoints` definidos
- [ ] Todas as `DataTable` têm `responsiveLayout="scroll"`
- [ ] Campos de formulário empilham em mobile (`col-span-12`)
- [ ] `flex-row` em desktop tem equivalente `flex-col` ou `flex-wrap` para mobile
- [ ] Não há conteúdo que fique escondido por overflow sem intenção
