## Campos Obrigatórios

- `status`: Estado do ciclo de vida da tarefa.
- `title`: Título legível por humanos da tarefa. Deve corresponder ao primeiro H1 no corpo da tarefa.
- `type`: Slug de tipo de trabalho permitido. Use `[tasks].types` de `.iappov/config.toml` quando configurado; caso contrário use os padrões integrados `frontend`, `backend`, `docs`, `test`, `infra`, `refactor`, `chore`, `bugfix`.
- `complexity`: Classificação de dificuldade. Deve ser um de: `low`, `medium`, `high`, `critical`.
- `dependencies`: Lista YAML de nomes de arquivos de tarefas que devem ser concluídas antes desta tarefa. Use `[]` quando não há dependências.

## Valores de Status

Valores válidos para `status`:

- `pending` — a tarefa ainda não foi iniciada.
- `in_progress` — a tarefa está sendo trabalhada atualmente.
- `completed` — a tarefa está concluída e verificada.
- `done` — tratado como concluído.
- `finished` — tratado como concluído.

## Nomenclatura de Arquivos

Os arquivos de tarefas devem corresponder ao padrão `\d+_task\.md`:
- `1_task.md`, `2_task.md`, `10_task.md`, `99_task.md`

Estes nomes são reservados para documentos meta:
- `prd.md` — Documento de Requisitos de Produto
- `techspec.md` — Especificação Técnica
- `tasks.md` — Lista mestre de tarefas
