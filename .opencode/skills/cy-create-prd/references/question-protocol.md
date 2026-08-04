# Protocolo de Perguntas

Protocolo de brainstorming estruturado para criação de PRD. Siga estas fases e regras para guiar a conversa da ideia ao documento.

## Fases

### 1. Descoberta

Coletar contexto inicial sobre a ideia ou espaço do problema.
- Qual é o problema central ou oportunidade?
- Quem são os usuários afetados?
- O que motivou esta iniciativa?

### 2. Entendimento

Aprofundar o conhecimento sobre requisitos e restrições.
- QUAIS funcionalidades específicas os usuários precisam?
- POR QUÊ isso fornece valor de negócio?
- QUEM são os usuários-alvo e quais são seus fluxos de trabalho atuais?
- Quais são os critérios de sucesso?
- Quais são as restrições conhecidas (prazo, orçamento, conformidade)?

### 3. Opções

Apresentar abordagens de produto para o usuário avaliar.
- Oferecer 2-3 abordagens distintas com trade-offs claros.
- Liderar com a abordagem recomendada e explicar o porquê.
- Cada abordagem deve diferir significativamente em escopo, faseamento ou estratégia.
- Aguardar o usuário selecionar antes de prosseguir.

### 4. Refinamento

Refinar a abordagem selecionada com acompanhamentos direcionados.
- Esclarecer limites de escopo para a abordagem escolhida.
- Confirmar faseamento e prioridade das funcionalidades.
- Validar critérios de sucesso e métricas.
- Resolver quaisquer perguntas em aberto restantes.

### 4b. Validação Incremental do Design

Apresentar o design do produto seção por seção para aprovação do usuário.
- Dimensionar cada seção à sua complexidade: breve para tópicos diretos, detalhado para tópicos com nuances.
- Apresentar uma seção por vez; perguntar se está correto antes de continuar.
- Aplicar YAGNI: questionar cada funcionalidade quanto à necessidade para o MVP.
- Estar pronto para revisar qualquer seção antes de prosseguir para a próxima.

### 5. Criação

Gerar o documento PRD usando o contexto coletado.
- Ler e preencher o template do PRD.
- Cada seção deve refletir decisões confirmadas.
- Itens não resolvidos vão para Perguntas em Aberto.

## Regras

### Aplicação de Pergunta Interativa
- Toda pergunta DEVE ser feita usando a ferramenta de questão interativa dedicada do runtime — aquela que apresenta a pergunta e pausa a execução até o usuário responder.
- Não gere perguntas como texto simples e continue gerando.
- Se tal ferramenta não estiver disponível, apresente a pergunta como sua mensagem completa e pare de gerar.

### Limites de Perguntas
- Faça apenas uma pergunta por mensagem. Se um tópico precisar de exploração mais profunda, divida-o em uma sequência de perguntas individuais.
- Prefira perguntas de múltipla escolha quando as opções puderem ser predeterminadas.
- Aguarde a resposta do usuário antes de fazer a próxima pergunta.

### Portões de Progressão
- Deve completar pelo menos uma rodada completa de Entendimento antes de apresentar Opções.
- Deve ter clareza sobre propósito, restrições e critérios de sucesso antes de apresentar abordagens.
- Deve ter aprovação do usuário de uma abordagem antes de entrar no Refinamento.

### Limites de Foco
- As perguntas devem focar em O QUÊ, POR QUÊ e QUEM.
- Nunca pergunte COMO, ONDE ou QUAL em relação à implementação técnica.
- Tópicos proibidos: bancos de dados, APIs, estrutura de código, frameworks, estratégias de teste, padrões de arquitetura, infraestrutura de deployment.

### Princípio YAGNI
- Remova rigorosamente funcionalidades não essenciais durante o refinamento.
- Questione cada funcionalidade: o MVP precisa disso?
- Adie funcionalidades "nice-to-have" para fases posteriores.
- Prefira escopo menor e bem definido em vez de amplitude ambiciosa.

### Anti-Padrão: Pular Brainstorming para Funcionalidades "Simples"
Todo PRD passa pelo protocolo completo de perguntas independentemente da complexidade percebida. Funcionalidades simples são onde suposições de negócio não examinadas causam mais retrabalho. O brainstorming pode ser breve, mas deve acontecer.
