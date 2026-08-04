---
name: code-review
description: >
  Use para revisar código frontend antes de commitar ou abrir PR. Ative esta skill quando
  o usuário:
  - Pedir "revisa esse componente", "faz o review do PR", "tá pronto pra commitar?"
  - Compartilhar código Vue, store ou composable e perguntar se está correto/bom
  - Mencionar "code review", "PR", "pull request", "checklist" ou "revisão"
  - Terminar uma feature e querer validar antes de subir
  - Pedir para verificar qualidade, padrões ou problemas potenciais em código frontend

  Esta skill aplica os padrões do projeto (frontend.md + responsividade.md) como critérios
  de revisão, cobrindo: TypeScript, Vue patterns, Pinia, responsividade, testes e acessibilidade.
  Use sempre em conjunto com a skill frontend-dev para contexto dos padrões.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

# Code Review Skill

Realiza revisão completa de código frontend aplicando os padrões do projeto.
Gera um relatório estruturado com problemas encontrados, severidade e sugestões de correção.

## Como usar esta skill

1. **Leia o(s) arquivo(s)** compartilhados pelo usuário
2. **Aplique os checklists** de cada categoria relevante
3. **Classifique os problemas** por severidade (🔴 Blocker / 🟡 Warning / 🟢 Suggestion)
4. **Gere o relatório** no formato padronizado abaixo
5. **Proponha correções** com código quando a mudança for clara
6. **Emita o veredicto final** — sempre a última linha do relatório

---

## Checklists de Revisão

### 🏗️ Estrutura do Componente Vue

- [ ] Usa `<script setup lang="ts">` (não Options API)
- [ ] Imports na ordem correta: externos → internos → tipos
- [ ] `defineProps<>()` e `defineEmits<>()` com tipos genéricos (não `withDefaults` desnecessário)
- [ ] Lógica de negócio está no composable ou store, não no componente
- [ ] `defineExpose()` presente se o componente precisa de métodos expostos para testes
- [ ] Lifecycle hooks fazem limpeza quando necessário (`onUnmounted`)

### 🔷 TypeScript

- [ ] Sem uso de `any` (usar `unknown` + type guard quando necessário)
- [ ] Interfaces/types estão em `models/` com prefixo `I` (ex: `IExemploDTO`)
- [ ] Props tipadas (sem `PropType<>` da Options API)
- [ ] Retornos de função assíncrona tipados (`Promise<Tipo>`)
- [ ] Sem type assertions desnecessárias (`as Tipo` sem validação)

### 🟣 PrimeVue

- [ ] Componentes PrimeVue **sem** import manual (são auto-importados)
- [ ] Uso de `:pt` (PassThrough) para customizações ao invés de CSS global
- [ ] `data-testid` presente em todos os elementos interativos
- [ ] Eventos usam a sintaxe correta do PrimeVue (`@update:modelValue` vs `@change`)

### 🍍 Pinia Store

- [ ] Store usa setup syntax (`defineStore('id', () => { ... })`)
- [ ] `loading` e `error` gerenciados em todas as actions assíncronas
- [ ] `error` é limpo no início de cada action (`error.value = null`)
- [ ] `loading` volta para `false` no `finally` (não esquece no catch)
- [ ] Getters usam `computed()` — não são funções normais
- [ ] Store não importa outras stores diretamente no state (fazê-lo dentro da action)

### 📱 Responsividade

- [ ] Layout é mobile-first (sem breakpoint = mobile)
- [ ] `flex-col` em mobile → `md:flex-row` em desktop quando necessário
- [ ] Grid usa `col-span-12` em mobile e estreita com `md:` / `lg:`
- [ ] `Dialog` tem `:breakpoints` definido (sem largura fixa em `px`)
- [ ] `DataTable` tem `responsiveLayout="scroll"`
- [ ] Sem larguras fixas em `px` que causem overflow em mobile

### 🧪 Testabilidade

- [ ] Elementos clicáveis têm `data-testid` único e descritivo
- [ ] Sem lógica inline complexa no template (dificulta teste)
- [ ] Métodos públicos acessíveis via `defineExpose` quando precisar
- [ ] Mock MSW existe em `mocks/` para todas as chamadas de API do componente
- [ ] Arquivo `.spec.ts` existe ou foi solicitado

### ⚡ Performance

- [ ] `v-for` sempre tem `:key` único e estável (evitar index como key em listas mutáveis)
- [ ] Computeds usados no lugar de métodos chamados no template
- [ ] Sem watchers desnecessários (checar se computed resolve o problema)
- [ ] Imagens têm `loading="lazy"` quando fora da viewport inicial
- [ ] Sem imports de bibliotecas pesadas no nível do componente sem lazy loading

### ♿ Acessibilidade (A11y)

- [ ] Inputs têm `label` associado (`for` / `id` ou `aria-label`)
- [ ] Botões sem texto visível têm `aria-label`
- [ ] Ícones decorativos têm `aria-hidden="true"`
- [ ] Mensagens de erro estão associadas ao campo (`aria-describedby`)
- [ ] Foco visível não foi removido sem substituto

---

## Formato do Relatório

````markdown
## Code Review — NomeDoArquivo.vue

### Resumo

- 🔴 Blockers: X
- 🟡 Warnings: Y
- 🟢 Suggestions: Z

---

### 🔴 Blockers (impedem merge)

#### 1. [Título curto do problema]

**Arquivo:** `path/do/arquivo.vue`, linha XX
**Problema:** Descrição clara do que está errado e por que é um problema.
**Correção:**

```vue
// código corrigido aqui
```
```

---

### 🟡 Warnings (devem ser corrigidos, mas não bloqueiam)

#### 1. [Título curto]

...

---
### 🟢 Suggestions (melhorias opcionais)

#### 1. [Título curto]

...

---

### ✅ O que está bem

- Item positivo 1
- Item positivo 2

---

### Veredicto

> ✅ **APROVADO** — Nenhum blocker encontrado. Pode commitar.

ou

> ❌ **REPROVADO** — X blocker(s) encontrado(s). Corrija antes de commitar.
> Blockers: [lista resumida dos títulos]

````

### Regra do veredicto

| Situação | Veredicto |
|---|---|
| Nenhum 🔴 Blocker | ✅ **APROVADO** |
| 1 ou mais 🔴 Blockers | ❌ **REPROVADO** |

Warnings e Suggestions **nunca** reprovam — devem ser endereçados mas não bloqueiam o commit.

---

## Severidade de problemas

| Severidade | Quando usar |
|------------|-------------|
| 🔴 Blocker | Bug real, quebra de padrão crítico, vazamento de estado, ausência de tipos, código que vai para produção com erro |
| 🟡 Warning | Código funcionando mas que viola padrões do projeto, dificulta manutenção ou cria dívida técnica |
| 🟢 Suggestion | Melhorias de legibilidade, performance opcional, alternativas mais idiomáticas |

---

## Exemplos de problemas comuns

### Blocker: lógica de negócio no componente
```vue
<!-- 🔴 RUIM: fetch direto no componente -->
<script setup lang="ts">
const exemplo = ref([])
onMounted(async () => {
  exemplo.value = await $fetch('exemplo')  // deve estar na store/exemplo composable
})
</script>

<!-- ✅ BOM: delega para store -->
<script setup lang="ts">
const exemplo = useExemploStore()
const listExemplo = computed(() => exemplo.$exemplo)  // getter computado
onMounted( async() => await exemplo.index())
</script>
```
### Warning: Dialog sem breakpoints

```vue
<!-- 🟡 RUIM -->
<Dialog :style="{ width: '600px' }">

<!-- ✅ BOM -->
<Dialog :style="{ width: '55vw' }" :breakpoints="{ '960px': '75vw', '641px': '100vw' }">
```

### Warning: loading não finaliza no erro

```typescript
// 🟡 RUIM
async function buscar() {
  loading.value = true
  const data = await $fetch('/api/items') // se jogar erro, loading fica true para sempre
  loading.value = false
}

// ✅ BOM
async function index() {
  let status = 200
  try {
    let params = {
      // Montar query params apenas com valores definidos
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
      const dataValue = data as ExemploDTO[]
      exemplo.value = dataValue
    } else {
      exemplo.value = [] as ExemploDTO[]
    }
    loading.value = false
    return status
  } catch (error: any) {
    loading.value = false
    return status
  }
}
```

### Suggestion: computed no lugar de método no template

```vue
<!-- 🟢 Recomendado trocar -->
<template>
  <div>{{ getNomeFormatado() }}</div>
  <!-- recalcula em todo render -->
</template>

<!-- por -->
<template>
  <div>{{ nomeFormatado }}</div>
  <!-- só recalcula quando deps mudam -->
</template>
<script setup lang="ts">
  const nomeFormatado = computed(() => formatarNome(form.value.nome))
</script>
```
