---
name: cy-review-round
description: Realiza uma revisão abrangente de código de uma implementação de PRD e gera um diretório de rodada de revisão com arquivos de problema compatíveis com cy-fix-reviews. Use ao revisar tarefas de PRD implementadas, criar uma rodada de revisão manual sem provedor externo, ou realizar uma auditoria de qualidade de alterações de código. Não use para buscar revisões de provedores externos, corrigir problemas de revisão existentes, executar tarefas de PRD ou editar código-fonte.
---

# Rodada de Revisão

Realize uma revisão estruturada de código de uma implementação de PRD e produza um diretório de rodada de revisão que o fluxo de trabalho `cy-fix-reviews` possa processar.

## Entradas Necessárias

- Nome da funcionalidade identificando o diretório `../ppov-docs/issues/front/<ticket>-<nome>/`.
- Opcional: arquivos ou diretórios específicos para escopo da revisão.

## Fluxo de Trabalho

1. Determinar o diretório de rodada de revisão.
   - Derivar o `<ticket>` a partir do prefixo numérico da branch git atual (ex.: branch `1796-feature-x` → ticket `1796`). Se a branch não tiver prefixo numérico, perguntar o número do ticket ao usuário.
   - Derivar o diretório do PRD a partir do nome da funcionalidade: `../ppov-docs/issues/front/<ticket>-<nome>/`.
   - Verificar se o diretório do PRD existe. Se não existir, pare e reporte o diretório faltante.
   - Listar subdiretórios `reviews-NNN/` existentes para determinar o próximo número de rodada. Se nenhum existir, usar rodada 1.
   - Se rodadas de revisão anteriores existirem, ler seus arquivos de problema para construir uma lista de problemas já conhecidos. A rodada atual deve conter apenas problemas NOVOS não rastreados em rodadas anteriores. Não re-sinalize problemas que estão pendentes, válidos ou resolvidos em rodadas anteriores.
   - Determinar o caminho do diretório de rodada de revisão: `../ppov-docs/issues/front/<ticket>-<nome>/reviews-NNN/` com o número de rodada preenchido com zeros até 3 dígitos. NÃO crie-o ainda — aguarde o passo 4 confirmar que há problemas a escrever. Isso evita deixar diretórios vazios quando a revisão não encontra problemas.

2. Identificar o escopo da revisão.
   - Ler `prd.md`, `techspec.md` e `tasks.md` do diretório do PRD para entender o que foi implementado e por quê.
   - Ler ADRs de `../ppov-docs/issues/front/<ticket>-<nome>/adrs/` para contexto de decisão arquitetural.
   - Se ambos `prd.md` e `techspec.md` estiverem faltando, avisar que a revisão não terá contexto de requisitos, mas prosseguir com revisão apenas de qualidade de código.
   - Se o usuário forneceu arquivos ou diretórios específicos, escopo da revisão para esses caminhos.
   - Se nenhum escopo explícito foi fornecido, executar `git diff main...HEAD --name-only` para descobrir todos os arquivos criados ou modificados no branch atual. Se o diff estiver vazio ou não for útil, pedir ao usuário que especifique arquivos.
   - Criar uma chamada de Agent para explorar os arquivos identificados, suas importações e dependências para construir um mapa da implementação.

3. Realizar a revisão de código.
   - Ler `references/review-criteria.md` para definições de severidade e áreas de avaliação.
   - **Priorizar o escopo da revisão.** Se o escopo contiver mais de 15 arquivos, fazer triagem antes da leitura profunda: identificar os arquivos de implementação principais (novos pacotes, novas APIs exportadas, arquivos com mais adições) e revisá-los primeiro completamente. Revisar arquivos restantes (testes, edições menores, alterações de configuração) apenas para problemas óbvios. Isso evita revisões superficiais espalhadas por muitos arquivos.
   - Ler todos os arquivos no escopo priorizado completamente antes de formar conclusões.
   - **Validação de requisitos**: Se `prd.md` ou `techspec.md` estiveram disponíveis no passo 2, fazer verificação cruzada da implementação em relação a cada requisito declarado, critério de aceitação e decisão arquitetural. Sinalizar qualquer requisito que esteja faltando, parcialmente implementado ou implementado de forma diferente do especificado. Esses são problemas de correção — atribuir severidade com base no impacto da lacuna (crítico se uma funcionalidade principal estiver faltando, alto se o comportamento divergir da especificação, médio se um caso extremo da especificação não for tratado).
   - Avaliar cada arquivo em relação às nove áreas de avaliação: Segurança, Correção, Concorrência, Desempenho e Escalabilidade, Tratamento de Erros, Qualidade e Manutenibilidade do Código, Testes, Arquitetura e Operações.
   - Identificar problemas em ordem de severidade: crítico primeiro, depois alto, médio e baixo.
   - Para cada problema registrar: o caminho do arquivo relativo à raiz do repositório, o número aproximado de linha, o nível de severidade, um título conciso (máximo 72 caracteres) e um comentário de revisão detalhado descrevendo o problema e uma correção sugerida.
   - **Deduplique antes de escrever.** Se o mesmo padrão (ex.: verificação de nil faltando, erro de wrap faltando) aparecer em múltiplos arquivos, crie um problema para a instância mais representativa e liste os outros arquivos afetados no seu Comentário de Revisão. Não crie N problemas idênticos para N arquivos exibindo a mesma causa raiz. Um problema por problema distinto, não por ocorrência.
   - **Verifique antes de sinalizar.** Antes de criar um problema, verifique se o padrão é intencional: procure comentários adjacentes explicando a escolha, referências a ADRs ou cobertura de testes que valide o comportamento. Se o código parece suspeito mas tem uma justificativa clara (ex.: `// nolint: ignorando intencionalmente erro de fechamento em arquivo somente leitura`), não crie um problema. Sinalize apenas padrões que sejam genuinamente problemáticos, não meramente não convencionais.
   - Ignore problemas que linters ou formatadores já capturam. Execute `make lint` primeiro para filtrá-los.
   - **Foque em sinal, não em volume.** Prefira menos problemas de maior qualidade em vez de uma lista exaustiva. Se encontrar mais de 20 problemas, reavalie: mantenha todos os problemas críticos e altos, mas elimine problemas médios e baixos para apenas os mais impactantes. Uma revisão com 8 problemas precisos é mais útil do que uma com 30 que inclui preocupações marginais.
   - Observe também aspectos bem implementados do código. Essas observações informam o resumo, mas não produzem arquivos de problema.
   - Se nenhum problema for encontrado após uma revisão minuciosa, reporte que a implementação parece limpa e pule os passos 4 a 6. Não crie o diretório de rodada de revisão.

4. Gerar arquivos de problema.
   - Criar o diretório de rodada de revisão determinado no passo 1.
   - Ler `references/issue-template.md` para o formato canônico.
   - Para cada problema identificado no passo 3, criar um arquivo `issue_NNN.md` no diretório de rodada de revisão.
   - A numeração de problemas começa em `001` e incrementa sequencialmente.
   - Cada arquivo deve usar esta estrutura exata:

     ```
     ---
     provider: manual
     pr:
     round: <N>
     round_created_at: <timestamp UTC no formato RFC3339>
     status: pending
     file: caminho/para/arquivo.go
     line: 42
     severity: high
     author: claude-code
     provider_ref:
     ---

     # Problema NNN: <título>

     ## Comentário de Revisão

     <corpo detalhado da revisão>

     ## Triagem

     - Decisão: `SEM REVISÃO`
     - Notas:
     ```

   - O campo `<author>` deve ser `claude-code`.
   - O campo `provider_ref` deve estar vazio.
   - O campo `provider` deve ser `manual`.
   - O campo `pr` está vazio para revisões manuais. Se o usuário fornecer um número de PR, inclua-o.
   - O campo `round` deve corresponder ao número do diretório como inteiro (sem preenchimento com zeros).
   - O campo `round_created_at` deve usar o mesmo timestamp UTC RFC3339 atual em todos os problemas desta rodada.
   - O campo `severity` deve ser exatamente um de: `critical`, `high`, `medium`, `low`.

5. Resumir e apresentar a revisão.
   - Imprimir um resumo listando:
     - **Recomendação de merge**: Se qualquer problema crítico ou alto existir, declarar "Necessita correções antes do merge" com os problemas bloqueantes. Se apenas problemas médios/baixos existirem, declarar "Seguro para merge com acompanhamentos." Se nenhum problema, declarar "Limpo — pronto para merge."
     - Total de problemas encontrados, dividido por severidade (crítico, alto, médio, baixo).
     - O caminho do diretório de rodada de revisão.
     - A lista completa de nomes de arquivos de problema gerados.
     - Aspectos bem implementados observados durante a revisão.
   - Sugerir executar `compozy reviews fix <nome>` para processar a rodada de revisão.

6. Verificar antes da conclusão.
   - Usar `cy-final-verify` instalado antes de afirmar que a rodada de revisão está completa.
   - Reler cada arquivo de problema gerado e verificar se o frontmatter é analisável corretamente.
   - Verificar se todos os arquivos de problema na rodada têm valores correspondentes de `provider`, `pr`, `round` e `round_created_at`.
   - Confirmar que o diretório de rodada de revisão segue a convenção de nomenclatura `reviews-NNN`.

## Regras Críticas

- Não corrija os problemas encontrados. Esta skill apenas identifica e documenta problemas. O fluxo de trabalho `cy-fix-reviews` trata a remediação.
- Não crie arquivos de problema para problemas que linters ou formatadores já capturam.
- Todo arquivo de problema deve ter frontmatter YAML válido analisável por `prompt.ParseReviewContext()`.
- Não crie ou mantenha `_meta.md` de revisão; os metadados da rodada ficam no frontmatter de cada arquivo de problema.
- Não crie rodadas de revisão vazias. Se nenhum problema for encontrado, reporte uma revisão limpa e não crie o diretório de rodada.
- Não modifique nenhum arquivo de código-fonte. Esta é uma skill somente de revisão.
- Não chame scripts específicos de provedor ou mutações do `gh`.

## Tratamento de Erros

- Se o diretório do PRD não existir, pare e reporte o diretório faltante.
- Se nenhum arquivo puder ser identificado para revisão e o usuário não forneceu caminhos explícitos, peça ao usuário que especifique arquivos.
- Se ambos `prd.md` e `techspec.md` estiverem faltando, avise sobre a falta de contexto de requisitos, mas prossiga com revisão apenas de qualidade de código.
- Se o diretório de rodada de revisão não puder ser criado, pare e reporte o erro do sistema de arquivos.
- Se a escrita de um arquivo de problema falhar, pare e reporte qual arquivo não pôde ser escrito.
- Se `make lint` falhar ao executar (erros de build, ferramentas faltando), note a falha no resumo e prossiga com a revisão. Não pule a revisão porque o linting falhou — apenas reconheça que a filtragem de sobreposição do linter não pôde ser aplicada.
