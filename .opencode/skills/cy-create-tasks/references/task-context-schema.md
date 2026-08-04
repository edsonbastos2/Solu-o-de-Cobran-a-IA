# Schema de Contexto de Tarefa

Definições de campos de metadados para cada arquivo de tarefa (`N_task.md`).

## Frontmatter YAML

| Campo | Tipo | Obrigatório | Valores |
|-------|------|-------------|---------|
| `status` | string | Sim | `pending`, `in_progress`, `completed`, `cancelled` |
| `title` | string | Sim | Título da tarefa (deve ser igual ao H1 do corpo) |
| `type` | string | Sim | `frontend`, `backend`, `api`, `supabase`, `ai`, `whatsapp`, `docs`, `refactor`, `chore`, `bugfix` |
| `complexity` | string | Sim | `low`, `medium`, `high`, `critical` |
| `dependencies` | string[] | Sim | Lista de arquivos de tarefa dos quais esta depende (ex.: `["1_task"]`) |

## Seções do Corpo

| Seção | Obrigatório | Descrição |
|-------|-------------|-----------|
| `## Visão Geral` | Sim | 2-3 frases sobre o que a tarefa faz |
| `<critical>` | Sim | Lembretes críticos (PRD/TechSpec, foco, minimizar código, testes) |
| `<requirements>` | Sim | Requisitos técnicos numerados com DEVE/DEVERIA |
| `## Subtarefas` | Sim | 3-7 itens de checklist |
| `## Detalhes de Implementação` | Sim | Arquivos a criar/modificar, pontos de integração |
| `### Arquivos Relevantes` | Sim | Arquivos existentes relevantes para a tarefa |
| `### Arquivos Dependentes` | Sim | Arquivos que serão afetados |
| `### ADRs Relacionados` | Condicional* | ADRs que afetam esta tarefa |
| `## Entregáveis` | Sim | Saídas concretas com itens de teste |
| `## Testes` | Sim | Casos de teste específicos como checklists |
| `## Critérios de Sucesso` | Sim | Resultados mensuráveis |

*Obrigatório se houver ADRs relevantes; omitir a subseção se não houver.
