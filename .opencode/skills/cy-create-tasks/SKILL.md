---
name: cy-create-tasks
description: Decompõe PRDs e TechSpecs em arquivos de tarefas detalhados e implementáveis independentemente, com enriquecimento por exploração da base de código. Use quando um PRD ou TechSpec existir e precisar ser dividido em tarefas executáveis, ou quando arquivos de tarefas precisarem de enriquecimento com contexto de implementação. Não use para criação de PRD, geração de TechSpec ou execução direta de tarefas.
argument-hint: "[nome-da-feature] [arquivo-prd]"
---

# Criar Tarefas

Decomponha requisitos em arquivos de tarefas detalhados e acionáveis com enriquecimento informado pela base de código.

## Entradas Necessárias

- Nome da funcionalidade identificando o diretório `../ppov-docs/issues/front/<ticket>-<nome>/`.
- No mínimo, `prd.md` ou `techspec.md` nesse diretório.

## Fluxo de Trabalho

1. Carregar registro de tipos.
   - Ler `.iappov/config.toml` (permanece local no projeto front).
   - Se contiver `[tasks].types`, usar essa lista como valores `type` permitidos.
   - Caso contrário, usar os padrões integrados: `frontend`, `backend`, `docs`, `test`, `infra`, `refactor`, `chore`, `bugfix`.

2. Carregar contexto.
   - Derivar o `<ticket>` a partir do prefixo numérico da branch git atual (ex.: branch `1796-feature-x` → ticket `1796`). Se a branch não tiver prefixo numérico, perguntar o número do ticket ao usuário.
   - Ler `prd.md` e `techspec.md` de `../ppov-docs/issues/front/<ticket>-<nome>/`.
   - Ler ADRs existentes de `../ppov-docs/issues/front/<ticket>-<nome>/adrs/` para entender o contexto de decisão por trás dos requisitos e escolhas de design.
   - Se `techspec.md` estiver faltando:
     - Avisar o usuário que as tarefas serão de mais alto nível sem orientação de implementação do TechSpec.
     - Derivar tarefas a partir dos requisitos funcionais do PRD e histórias de usuário, em vez das seções de implementação do TechSpec.
     - Durante o enriquecimento, depender mais fortemente da exploração da base de código para preencher `## Detalhes de Implementação`, `### Arquivos Relevantes` e `### Arquivos Dependentes`.
     - Marcar `<requirements>` com requisitos comportamentais derivados do PRD em vez de requisitos técnicos derivados do TechSpec.
     - Indicar explicitamente lacunas de detalhes de implementação faltantes no corpo da tarefa em vez de inventar especificidades.
   - Se ambos `prd.md` e `techspec.md` estiverem faltando, pare e peça ao usuário para criar pelo menos um primeiro.
   - Criar uma chamada de Agent para explorar a base de código em busca de arquivos a criar ou modificar, padrões de teste e convenções de código.

3. Decompor em tarefas.
   - Decompor seções de implementação do TechSpec em tarefas granulares e implementáveis independentemente.
   - **Cada tarefa DEVE ser implementável independentemente quando todas as suas dependências declaradas forem atendidas.** Nenhuma tarefa pode exigir trabalho não declarado de outra tarefa. Se duas tarefas tiverem acoplamento forte, mescle-as ou extraia a parte compartilhada em uma tarefa de dependência.
   - **Sem dependências circulares.** Se a tarefa A depende da tarefa B, a tarefa B NÃO deve depender da tarefa A (direta ou transitivamente).
   - Cada tarefa deve ter: título, tipo, complexidade e dependências.
   - Atribuir complexidade usando estes critérios:
     - `low`: Alteração em arquivo único, sem novas interfaces, sem concorrência, lógica simples.
     - `medium`: 2-4 arquivos, pode introduzir nova interface ou struct, pontos de integração limitados.
     - `high`: 5+ arquivos, novo subsistema ou refatoração significativa, múltiplos pontos de integração, concorrência envolvida.
     - `critical`: Alteração transversal afetando muitos pacotes, alto risco de regressão, requer coordenação com outras tarefas.
   - Quando uma tarefa implementa diretamente ou é constrangida por um ADR específico, incluir a referência ao ADR na seção "ADRs Relacionados" em Detalhes de Implementação.
   - Incorporar requisitos de teste em cada tarefa. Nunca criar tarefas separadas dedicadas exclusivamente a testes.
   - Seguir a estrutura definida em `references/task-template.md`.
   - Consultar `references/task-context-schema.md` para definições de campos de metadados.

4. Apresentar o detalhamento de tarefas para aprovação interativa.
   - Mostrar todas as tarefas com: títulos, descrições, ratings de complexidade e cadeias de dependência.
   - Aguardar feedback do usuário antes de prosseguir.
   - Se o usuário solicitar alterações, revisar o detalhamento e apresentar novamente.
   - Iterar até que o usuário aprove explicitamente.

5. Gerar arquivos de tarefas.
   - Escrever `tasks.md` como lista mestre de tarefas usando este formato exato de tabela markdown:
     ```markdown
     # [Nome da Feature] — Lista de Tarefas

     ## Tarefas

     | # | Título | Status | Complexidade | Dependências |
     |---|--------|--------|--------------|--------------|
     | 01 | [Título da tarefa] | pending | [low/medium/high/critical] | [1_task, ... ou —] |
     ```
   - Escrever arquivos individuais de tarefas como `1_task.md`, `2_task.md`, até `N_task.md`.
   - Arquivos de tarefas usam o sufixo `_task` com o número sequencial primeiro (ex.: `1_task.md`), igual ao padrão usado em `issues/back` do `ppov-docs`.
   - Cada arquivo deve começar com frontmatter YAML contendo `status`, `title`, `type`, `complexity` e `dependencies`. Use `dependencies: []` quando não há dependências — não omita o campo.
   - A numeração de tarefas deve ser sequencial e consistente entre `tasks.md` e os arquivos individuais.

6. Enriquecer cada arquivo de tarefa.
   - Para cada arquivo de tarefa, verificar se já possui as seções `## Visão Geral`, `## Entregáveis` e `## Testes`. Se todas as três existirem, pular o enriquecimento para esse arquivo.
   - Mapear a tarefa para os requisitos do PRD e orientações do TechSpec.
   - Criar uma chamada de Agent para descobrir arquivos relevantes, arquivos dependentes, pontos de integração e regras do projeto para esta tarefa específica.
   - Preencher TODAS as seções do template de `references/task-template.md`. Todo arquivo de tarefa DEVE conter cada uma das seguintes seções — omitir qualquer uma é uma falha:
     - `## Visão Geral`: o que a tarefa realiza e por quê, em 2-3 frases.
     - Bloco `<critical>`: o bloco padrão de lembretes críticos (ler PRD/TechSpec, referenciar TechSpec, focar no QUÊ, minimizar código, testes obrigatórios).
     - Bloco `<requirements>`: requisitos técnicos específicos e numerados usando linguagem DEVE/DEVERIA.
     - `## Subtarefas`: 3-7 itens de checklist descrevendo O QUÊ, não COMO.
     - `## Detalhes de Implementação`: caminhos de arquivos a criar ou modificar, pontos de integração. Referenciar o TechSpec para padrões.
     - `### Arquivos Relevantes`: caminhos descobertos da exploração da base de código com breves razões.
     - `### Arquivos Dependentes`: arquivos que serão afetados por esta tarefa com breves razões.
     - `### ADRs Relacionados`: links para ADRs relevantes se algum existir, ou omitir subseção se não houver ADRs aplicáveis.
     - `## Entregáveis`: saídas concretas com itens de teste obrigatórios e meta de cobertura de pelo menos 70%.
     - `## Testes`: casos de teste específicos como checklists, divididos nas categorias testes unitários e testes de integração.
     - `## Critérios de Sucesso`: resultados mensuráveis incluindo "Todos os testes passando" e "Cobertura de testes >=70%".
   - Reavaliar a complexidade com base nos achados da exploração e atualizar se necessário.
   - Atualizar o arquivo de tarefa no lugar com conteúdo enriquecido.
   - Se o enriquecimento falhar para uma tarefa, continuar para a próxima e reportar todas as falhas ao final.

7. Executar validação manual das tarefas.
   - Verificar a consistência de todos os arquivos gerados (sem ferramenta externa):
     - **Frontmatter completo** em cada `N_task.md`: `status`, `title`, `type`, `complexity` e `dependencies` presentes; `title` igual ao primeiro H1 do corpo; `type` dentro dos valores permitidos; `complexity` em `low|medium|high|critical`.
     - **Numeração sequencial e consistente** entre `tasks.md` e os arquivos individuais (`1_task.md`, `2_task.md`, …).
     - **Dependências válidas**: toda entrada em `dependencies` aponta para um arquivo de tarefa existente; sem dependências circulares (diretas ou transitivas).
     - **Seções obrigatórias** presentes em cada arquivo (Visão Geral, `<critical>`, `<requirements>`, Subtarefas, Detalhes de Implementação, Entregáveis, Testes, Critérios de Sucesso).
   - Se encontrar qualquer inconsistência, corrigir o arquivo correspondente e revalidar.
   - Não marcar a skill como completa até que todas as verificações acima passem.

## Anti-Padrões

NÃO produza tarefas com estes defeitos:

- **Mega-tarefas.** Se uma tarefa toca mais de 7 arquivos ou tem mais de 7 subtarefas, é muito abrangente. Divida-a em tarefas menores com dependências explícitas entre elas.
- **Duplicação do TechSpec.** NÃO copie definições de interfaces, trechos de código ou diagramas de arquitetura do TechSpec para os arquivos de tarefas. Referencie a seção do TechSpec pelo nome (ex.: "Ver seção 'Interfaces Principais' do TechSpec") em vez de reproduzir seu conteúdo.
- **Casos de teste vagos.** NÃO escreva descrições de teste como "testar o caminho feliz" ou "verificar tratamento de erro". Cada caso de teste deve nomear a entrada específica, condição ou comportamento sendo verificado (ex.: "POST /job/done com ID de job desconhecido retorna 404").

## Tratamento de Erros

- Se ambos `prd.md` e `techspec.md` estiverem faltando, pare e peça ao usuário para criar pelo menos um primeiro.
- Se o usuário rejeitar o detalhamento de tarefas, incorpore todo o feedback antes de apresentar novamente.
- Se a exploração da base de código revelar limites de tarefas que não correspondem ao TechSpec, note a discrepância e pergunte ao usuário como prosseguir.
- Se o diretório alvo não existir, criá-lo.
- Se um arquivo de tarefa já existir e estiver totalmente enriquecido, pule-o e vá para o próximo.
