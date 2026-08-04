---
name: cy-create-tasks
description: Decompõe PRDs e TechSpecs em arquivos de tarefas detalhados e implementáveis independentemente, com enriquecimento por exploração da base de código. Use quando um PRD ou TechSpec existir e precisar ser dividido em tarefas executáveis, ou quando arquivos de tarefas precisarem de enriquecimento com contexto de implementação. Não use para criação de PRD, geração de TechSpec ou execução direta de tarefas.
argument-hint: "[nome-da-feature] [arquivo-prd]"
---

# Criar Tarefas

Decomponha requisitos em arquivos de tarefas detalhados e acionáveis com enriquecimento informado pela base de código.

## Entradas Necessárias

- Nome da funcionalidade identificando o diretório `./docs/<ticket>-<nome>/`.
- No mínimo, `prd.md` ou `techspec.md` nesse diretório.

## Fluxo de Trabalho

1. Carregar registro de tipos.
   - Ler `./.opencode/config.json` (arquivo de configuração do opencode na raiz do projeto).
   - Se contiver uma chave `tasks.types`, usar essa lista como valores `type` permitidos.
   - Caso contrário, usar os padrões integrados: `frontend`, `backend`, `api`, `supabase`, `ai`, `whatsapp`, `docs`, `refactor`, `chore`, `bugfix`.

2. Carregar contexto.
   - Derivar o `<ticket>` a partir do prefixo numérico da branch git atual (ex.: branch `1796-feature-x` → ticket `1796`). Se a branch não tiver prefixo numérico, perguntar o número do ticket ao usuário.
   - Ler `prd.md` e `techspec.md` de `./docs/<ticket>-<nome>/`.
   - Ler ADRs existentes de `./docs/<ticket>-<nome>/adrs/` para entender o contexto de decisão por trás dos requisitos e escolhas de design.
   - Se `techspec.md` estiver faltando:
     - Avisar o usuário que as tarefas serão de mais alto nível sem orientação de implementação do TechSpec.
     - Derivar tarefas a partir dos requisitos funcionais do PRD e histórias de usuário.
     - Durante o enriquecimento, depender mais fortemente da exploração da base de código.
     - Indicar explicitamente lacunas de detalhes de implementação faltantes no corpo da tarefa.
   - Se ambos `prd.md` e `techspec.md` estiverem faltando, pare e peça ao usuário para criar pelo menos um primeiro.
   - Criar uma chamada de Agent para explorar a base de código em busca de arquivos a criar ou modificar, padrões e convenções de código.

3. Decompor em tarefas.
   - Decompor seções de implementação do TechSpec em tarefas granulares e implementáveis independentemente.
   - **Cada tarefa DEVE ser implementável independentemente quando todas as suas dependências declaradas forem atendidas.**
   - **Sem dependências circulares.**
   - Cada tarefa deve ter: título, tipo, complexidade e dependências.
   - Atribuir complexidade usando estes critérios:
     - `low`: Alteração em arquivo único, sem novas interfaces, lógica simples.
     - `medium`: 2-4 arquivos, pode introduzir nova interface ou tipo, pontos de integração limitados.
     - `high`: 5+ arquivos, novo subsistema ou refatoração significativa, múltiplos pontos de integração.
     - `critical`: Alteração transversal afetando muitos módulos, alto risco de regressão.
   - Quando uma tarefa implementa diretamente um ADR específico, incluir a referência na seção "ADRs Relacionados".
   - Incorporar requisitos de teste em cada tarefa. Nunca criar tarefas separadas dedicadas exclusivamente a testes.
   - Seguir a estrutura definida em `references/task-template.md`.
   - Consultar `references/task-context-schema.md` para definições de campos de metadados.

4. Apresentar o detalhamento de tarefas para aprovação interativa.
   - Mostrar todas as tarefas com: títulos, descrições, complexidade e dependências.
   - Aguardar feedback do usuário antes de prosseguir.
   - Iterar até que o usuário aprove explicitamente.

5. Gerar arquivos de tarefas.
   - Escrever `tasks.md` como lista mestre de tarefas usando formato tabela markdown.
   - Escrever arquivos individuais como `1_task.md`, `2_task.md`, até `N_task.md`.
   - Cada arquivo deve começar com frontmatter YAML contendo `status`, `title`, `type`, `complexity` e `dependencies`.
   - A numeração de tarefas deve ser sequencial e consistente entre `tasks.md` e os arquivos individuais.

6. Enriquecer cada arquivo de tarefa.
   - Preencher TODAS as seções do template de `references/task-template.md`: Visão Geral, `<critical>`, `<requirements>`, Subtarefas, Detalhes de Implementação, Arquivos Relevantes, Arquivos Dependentes, ADRs Relacionados, Entregáveis, Testes, Critérios de Sucesso.
   - Reavaliar a complexidade com base nos achados da exploração e atualizar se necessário.

7. Executar validação manual das tarefas.
   - Verificar frontmatter completo, numeração sequencial, dependências válidas (sem circulares), seções obrigatórias presentes.

## Anti-Padrões

NÃO produza tarefas com estes defeitos:

- **Mega-tarefas.** Se uma tarefa toca mais de 7 arquivos ou tem mais de 7 subtarefas, é muito abrangente. Divida-a.
- **Duplicação do TechSpec.** Referencie a seção do TechSpec pelo nome em vez de reproduzir seu conteúdo.
- **Casos de teste vagos.** Cada caso de teste deve nomear a entrada específica ou condição sendo verificada.

## Tratamento de Erros

- Se ambos `prd.md` e `techspec.md` estiverem faltando, pare e peça ao usuário para criar pelo menos um primeiro.
- Se o usuário rejeitar o detalhamento de tarefas, incorpore todo o feedback antes de apresentar novamente.
- Se o diretório alvo não existir, criá-lo.
