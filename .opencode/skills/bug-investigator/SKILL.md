---
name: bug-investigator
description: >
  Use para investigar bugs e comportamentos inesperados no projeto frontend Vue 3 / Nuxt.
  Ative esta skill quando o usuário:
  - Descrever um comportamento inesperado ("não está funcionando", "quebrou", "está errado")
  - Colar um stack trace, erro de console, erro TypeScript ou erro de build
  - Perguntar "por que X não funciona?" ou "o que está causando esse erro?"
  - Mencionar regressão após uma mudança recente
  - Descrever um bug de UI (componente não renderiza, dado não aparece, ação não dispara)
  - Relatar bug em store (estado incorreto, loading preso, getter retornando valor errado)
  - Relatar bug de API (requisição não sai, payload errado, erro HTTP não tratado)
  - Testes falhando sem motivo aparente após mudança de código
  - Erros de SSR ou hidratação (apenas no cliente / no servidor)

  Esta skill investiga a causa raiz antes de propor qualquer correção.
  Nunca aplica um fix sem ter identificado o layer e o motivo real do bug.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

# Bug Investigator Skill

Investiga bugs no projeto Vue 3 / Nuxt seguindo uma metodologia de camadas:
sintoma → hipótese → confirmação → causa raiz → fix.

Não aplique correções antes de completar a investigação.

---

## Fase 1 — Coleta de sintomas

Antes de abrir qualquer arquivo, responda internamente:

```
Sintoma descrito: [o que o usuário relatou]
Reproduzível? [sim / não / desconhecido]
Aparece em: [desenvolvimento / produção / testes / todos]
Após qual mudança? [commit, PR, deploy — se informado]
Mensagem de erro: [stack trace / mensagem do console / erro TS]
```

Se faltar informação crítica para investigar, pergunte ao usuário **uma coisa de cada vez**.

---

## Fase 2 — Identificação do layer

Classifique o bug em uma das camadas abaixo. Um bug pode cruzar camadas, mas sempre começa em uma.

| Layer | Sintomas típicos |
|-------|-----------------|
| **Componente (Vue)** | Não renderiza, dado não aparece no template, evento não dispara, v-if errado |
| **Store (Pinia)** | Estado incorreto, getter retorna valor errado, loading fica preso, action não executa |
| **API / Composable** | Requisição não sai, payload errado, erro HTTP não tratado, dados mapeados incorretamente |
| **Reatividade** | Ref não atualiza a UI, computed não recalcula, watch não dispara |
| **Async / Timing** | Dado undefined no primeiro render, race condition, await faltando |
| **TypeScript** | Erro de compilação, type assertion incorreta, interface desatualizada |
| **SSR / Hydration** | Erro só no servidor, conteúdo muda após hidratação, `window is not defined` |
| **Roteamento** | Middleware não executa, params ausentes, redirect incorreto |
| **Testes** | Spec falha, handler MSW não intercepta, store não populada no teste |

---

## Fase 3 — Investigação por layer

### Bug de Componente Vue

```bash
# Encontrar o componente
grep -r "NomeDoComponente" src/ --include="*.vue" --include="*.ts"
```

Verifique nesta ordem:
1. O template está usando a variável correta? (ref vs computed vs store getter)
2. O `v-if` / `v-show` está bloqueando a renderização?
3. O componente recebe as props esperadas? (`defineProps` está correto?)
4. Algum `watch` ou `onMounted` deveria popular um dado mas não está sendo chamado?
5. O componente usa `defineExpose`? O pai está acessando via template ref?

### Bug de Store Pinia

```bash
# Encontrar a store
grep -r "useNomeStore" src/ --include="*.ts" --include="*.vue"
```

Verifique nesta ordem:
1. A action tem `loading.value = true` antes e `loading.value = false` no `finally`?
2. O getter usa `computed()` — não é uma função comum?
3. O `error.value = null` é chamado no início de cada action?
4. A store está sendo instanciada dentro de um contexto Pinia válido? (não fora de setup/action)
5. Outra store é importada diretamente no state? (deve ser chamada dentro da action)

### Bug de API / Composable

```bash
# Encontrar o handler MSW relacionado
grep -r "endpoint" mocks/ --include="*.ts"
```

Verifique nesta ordem:
1. A URL do `$fetch` bate com o handler MSW (em teste) ou com o backend (em dev)?
2. O payload enviado tem todos os campos obrigatórios? Algum `undefined` está sendo serializado?
3. O `onResponse` captura o `status`? (sem ele, erros HTTP silenciosos)
4. O envelope de resposta está sendo desembrulhado corretamente? (`data.value` vs `data`)
5. O handler MSW usa `rest.get` / `rest.post` com o método HTTP correto?

### Bug de Reatividade

Indicadores clássicos:
- Dado atualizado na store mas não aparece no componente → provável acesso direto ao estado sem `computed`
- `watch` não dispara → dependência não é reativa (objeto mutado sem `.value = ...`)
- Computed retorna valor desatualizado → dependência não declarada ou fora do escopo reativo

```typescript
// RUIM: perde reatividade
const nome = store.usuario.nome  // cópia não-reativa

// BOM: mantém reatividade
const nome = computed(() => store.$usuario?.nome)
```

### Bug de Async / Timing

Sintoma mais comum: dado é `undefined` no primeiro render ou action.

```typescript
// RUIM: não espera a action
onMounted(() => {
  store.buscarDados()   // sem await — componente renderiza antes dos dados chegarem
})

// BOM
onMounted(async () => {
  await store.buscarDados()
})
```

Outros padrões a verificar:
- `await nextTick()` necessário após mutação do DOM
- Múltiplas actions concorrentes atualizando o mesmo estado
- `watch` com `immediate: true` + `async` sem cancelar request anterior

### Bug de TypeScript

```bash
# Ver todos os erros TS do projeto
yarn nuxt typecheck 2>&1 | head -50
```

Verifique:
1. Interface em `models/` está desatualizada em relação ao que a API retorna?
2. `as Tipo` está mascarando um erro real? (substituir por type guard)
3. Prop opcional tratada como obrigatória (falta `?` ou operador `?.`)?
4. Tipo de retorno de action assíncrona declarado incorretamente?

### Bug de SSR / Hydration

Sintomas: erro só no servidor, `window is not defined`, conteúdo muda após load.

```typescript
// Qualquer acesso a API do browser deve ser guardado
if (import.meta.client) {
  // código só cliente aqui
}
```

Verifique:
1. Código usa `window`, `document`, `localStorage` sem `import.meta.client`?
2. Plugin está registrado sem `.client.ts` no nome quando deveria ser client-only?
3. Estado computado no servidor difere do cliente? (timezone, locale, cookies)

### Bug de Testes

```bash
# Executar os testes com verbose para ver o que falha
yarn test --reporter=verbose 2>&1 | head -80
```

Verifique nesta ordem:
1. O handler MSW cobre o endpoint que a action está chamando? (URL e método HTTP exatos)
2. A `renderComponent` configura o `createTestingPinia` com `stubActions: false`?
3. O estado do `generalDataManager` (`uuidPov`, etc.) foi populado antes do teste?
4. `await flushPromises()` foi chamado após actions assíncronas?
5. O `data-testid` que o teste procura existe no template do componente?

```bash
# Verificar se o handler MSW bate com a URL chamada
grep -r "mockServerPath" mocks/ --include="*.ts" -A 2
```

---

## Fase 4 — Hipóteses e confirmação

Após a investigação, liste as hipóteses em ordem de probabilidade:

```
Hipótese 1 (mais provável): [descrição]
  → Evidência: [o que no código suporta essa hipótese]
  → Verificar: [arquivo:linha a ler para confirmar]

Hipótese 2: [descrição]
  → Evidência: ...
  → Verificar: ...
```

Leia os arquivos identificados e **confirme** antes de prosseguir.

---

## Fase 5 — Relatório de causa raiz

Após confirmar a causa, gere um relatório conciso:

```
## Bug Investigation Report

**Sintoma:** [o que o usuário relatou]
**Layer afetado:** [componente / store / API / ...]
**Arquivo(s):** `path/do/arquivo.vue`, linha XX

**Causa raiz:**
[Uma ou duas frases explicando o porquê real do problema]

**Por que não foi detectado antes:**
[teste ausente / caso de borda / dependência externa / etc.]

**Correção proposta:**
[descrição da mudança]

**Testes a adicionar/ajustar:**
[quais cenários precisam de cobertura]
```

---

## Fase 6 — Handoff para skill de correção

Após identificar a causa raiz, delegue a implementação do fix para a skill adequada:

| Tipo de correção | Skill |
|-----------------|-------|
| Correção em componente Vue | `frontend-dev` |
| Correção em store Pinia | `frontend-dev` |
| Correção em chamada de API | `api-integration` |
| Correção/adição de testes | `test-generator` |
| Correção + revisão antes de commitar | `code-review` |

---

## Atalhos de diagnóstico rápido

### Stack trace com "Cannot read properties of undefined"

Causa mais comum: dado ainda não carregado quando o template renderiza.

```bash
# Onde o dado é populado?
grep -r "nomeDoAtributo" src/ --include="*.ts" --include="*.vue" -l
```

Solução provável: operador `?.` no template ou `v-if="dado"` antes de renderizar.

### "hydration mismatch" no console

```bash
# Procurar por acesso a browser APIs sem guard
grep -r "window\." src/ --include="*.vue" --include="*.ts"
grep -r "document\." src/ --include="*.vue" --include="*.ts"
grep -r "localStorage" src/ --include="*.vue" --include="*.ts"
```

### Loading preso em `true` após erro

Causa: `loading.value = false` está no bloco `try`, não no `finally`.

```bash
grep -r "loading.value = false" src/ --include="*.ts" -B 5 -A 2
```

### Teste falha com "Cannot find element"

Causa: `data-testid` não existe ou nome diferente do esperado.

```bash
# Verificar data-testids existentes no componente
grep -r "data-testid" src/components/NomeComponente.vue
```

### Handler MSW não intercepta

Causa mais comum: URL do handler difere da URL chamada (trailing slash, query params, parâmetro de rota).

```bash
# Comparar URL na store com URL no handler
grep -r "api.get\|api.post\|api.put\|api.del\|\$fetch" src/stores/useExemploStore.ts
grep -r "rest.get\|rest.post\|rest.put\|rest.delete" mocks/handlers/
```

---

## Anti-padrões de diagnóstico

```typescript
// RUIM: aplicar fix sem entender a causa
// "Vou só adicionar um ?. aqui para parar de dar erro"
// Isso mascara o problema real

// BOM: entender POR QUÊ o dado está undefined antes de usar ?.
// A causa pode ser uma action não chamada, loading não tratado, ou dado nunca buscado

// RUIM: remover teste que falha
// "O teste tá atrapalhando, vou comentar"

// BOM: investigar por que o teste falha — ele pode estar expondo um bug real
```
