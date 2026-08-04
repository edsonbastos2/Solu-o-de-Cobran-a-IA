# Bloco MODAL criar/editar — opcional

Modal (`Dialog`) de criação/edição usado pela tabela. Recebe `displayModal` e o `uuid` do
item a editar; decide entre criar/editar por `isEdit`; valida, chama a store e emite
`displayModal` para fechar. Vai em `components/templates/Modal{{Entidade}}/Modal{{Entidade}}.vue`.

> Autocontido — copie daqui, não de modais do projeto.

## Template

```vue
<template>
  <Dialog
    v-model:visible="visible"
    :breakpoints="{ '960px': '50vw', '640px': '40vw' }"
    :style="{ width: '27vw' }"
    :modal="true"
    :closable="false"
  >
    <template #header>
      <div class="w-full">
        <h2
          class="text-surface-800 dark:text-surface-50 font-bold flex justify-items-center items-center"
        >
          <div>
            {{ !isEdit ? 'Adicionar {{Titulo}}' : 'Editar {{Titulo}}' }}
          </div>
        </h2>
        <Divider class="mb-0" />
      </div>
    </template>

    <div class="formgrid grid gap-4 gap-y-1">
      <!-- Um campo por propriedade editável -->
      <div class="flex flex-col field col-span-12">
        <label class="text-muted-color font-normal mb-1" for="{{field}}"
          >{{HeaderCampo}}
          <span style="color: #9f3a38" title="Campo Obrigatório">*</span></label
        >
        <InputText
          id="{{field}}"
          data-testid="input-{{field}}"
          type="text"
          v-model="{{entidade}}.{{field}}"
          class="w-full text-color bg-surface-0 dark:bg-surface-900 border border-solid border-surface rounded-border outline-0"
        />
      </div>
    </div>

    <template #footer>
      <div class="flex flex-col gap-2 w-full">
        <Divider />
        <div class="flex justify-end gap-x-1">
          <Button
            label="Cancelar"
            class="p-button-cancel"
            outlined
            @click="closeDialog()"
            data-testid="btn-cancelar-{{entidade}}"
          />
          <Button
            label="Salvar"
            autofocus
            data-testid="btn-salvar-{{entidade}}"
            @click="save{{Entidade}}()"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
  import { useToast } from 'primevue/usetoast'
  import { {{Model}} } from '~/models/{{Model}}'
  import { {{store}} } from '~/store/{{entidades}}/{{entidades}}'

  const props = defineProps({
    displayModal: { default: false, type: Boolean },
    uuid{{Entidade}}: { default: '', type: String }
  })

  const emit = defineEmits(['displayModal'])

  const empty{{Entidade}} = (): {{Model}} =>
    ({ uuid: '', {{field}}: '' } as {{Model}})

  const {{entidade}} = ref<{{Model}}>(empty{{Entidade}}())

  const nuxt = useNuxtApp()
  const toast = useToast()
  const {{entidade}}Store = {{store}}()

  const visible = computed({
    get() {
      return props.displayModal
    },
    set(newValue: boolean) {
      emit('displayModal', newValue)
    }
  })

  const isEdit = computed(() => Boolean(props.uuid{{Entidade}}))

  const set{{Entidade}}Data = async () => {
    nuxt.callHook('page:start')
    if (isEdit.value) {
      await setEdit{{Entidade}}Data()
    } else {
      {{entidade}}.value = empty{{Entidade}}()
    }
    nuxt.callHook('page:finish')
  }

  const setEdit{{Entidade}}Data = async () => {
    {{entidade}}Store.{{entidade}}ToEdit.uuid = props.uuid{{Entidade}}
    await {{entidade}}Store.getByUuid()
    {{entidade}}.value = {{entidade}}Store.{{entidade}}ToEdit
  }

  const is{{Entidade}}Valid = () => {
    const { {{field}} } = {{entidade}}.value
    return Boolean({{field}})
  }

  const save{{Entidade}} = async () => {
    if (!is{{Entidade}}Valid()) {
      toast.add({
        severity: 'error',
        life: 3000,
        summary: 'Erro',
        detail: 'Todos os campos são obrigatórios!'
      })
      return
    }
    nuxt.callHook('page:start')
    if (!isEdit.value) {
      await create{{Entidade}}()
    } else {
      await edit{{Entidade}}()
    }
    nuxt.callHook('page:finish')
    closeDialog()
  }

  const create{{Entidade}} = async () => {
    const status = await {{entidade}}Store.create({{entidade}}.value)
    if ([200, 201, 204].includes(status)) {
      toast.add({
        severity: 'success',
        life: 3000,
        summary: 'Salvar {{Titulo}}',
        detail: '{{Titulo}} criado.'
      })
    }
  }

  const edit{{Entidade}} = async () => {
    const status = await {{entidade}}Store.update({{entidade}}.value)
    if ([200, 201, 204].includes(status)) {
      await {{entidade}}Store.index()
      toast.add({
        severity: 'success',
        life: 3000,
        summary: 'Salvar {{Titulo}}',
        detail: '{{Titulo}} alterado.'
      })
    }
  }

  const closeDialog = () => {
    {{entidade}}.value = empty{{Entidade}}()
    visible.value = false
  }

  watch(visible, async (newValue) => {
    if (newValue) {
      await set{{Entidade}}Data()
    }
  })

  defineExpose({
    visible,
    nuxt,
    isEdit,
    save{{Entidade}},
    closeDialog
  })
</script>
```

## Notas

- O componente **não** controla seu próprio `visible` diretamente: usa `computed` com
  getter (`props.displayModal`) e setter (`emit('displayModal', ...)`), padrão de modal do projeto.
- `watch(visible)` carrega os dados ao abrir (busca o item ao editar; limpa ao criar).
- Inputs variam por tipo: `InputText` (texto), `Select` (seleção), `Password` (senha),
  `InputNumber` (número). Sempre com `data-testid="input-{{field}}"` e `label` com `*` se obrigatório.
- A store precisa de `create`, `update`, `getByUuid` e um objeto `{{entidade}}ToEdit`.
  Delegue à skill `api-integration` se ainda não existirem.
- A tabela monta o modal assim (ver `table-base.md`):
  ```vue
  <Modal{{Entidade}}
    :display-modal="displayModal"
    @display-modal="displayModal = $event"
    :uuid-{{entidade}}="uuid{{Entidade}}Edit"
  />
  ```
