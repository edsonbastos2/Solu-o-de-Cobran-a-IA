# Critérios de Revisão

## Níveis de Severidade

### critical (crítico)

Falhas de segurança, crashes, perda de dados, comportamento indefinido ou condições de corrida.
Problemas que podem causar incidentes em produção ou comprometer dados de usuários.

Exemplos: bypass de autenticação, injeção SQL/de comandos, desreferência de ponteiro nil
em um caminho quente, vazamento ilimitado de goroutine, escrita de dados sensíveis em logs.

### high (alto)

Bugs afetando correção, gargalos de desempenho visíveis aos usuários, ou
anti-padrões que prejudicam significativamente a escalabilidade, confiabilidade ou usabilidade.
Precisam ser corrigidos antes do merge.

Exemplos: erro de lógica retornando resultados errados, loop O(n^2) sobre entrada ilimitada,
rollback de transação faltando, erro silenciosamente engolido em um caminho crítico,
validação de entrada faltando em um limite do sistema.

### medium (médio)

Preocupações de manutenibilidade, code smells, lacunas de cobertura de testes ou padrões
não idiomáticos que degradam a saúde de longo prazo. Não bloqueiam, mas devem ser tratados.

Exemplos: lógica duplicada entre pacotes, função excedendo 80 linhas com
aninhamento profundo, teste faltando para um ramo de erro, context.Background() usado
fora de main, interface aceita mas apenas uma implementação existe.

### low (baixo)

Melhorias menores, lacunas de documentação ou sugestões de nomenclatura. Melhorias
opcionais que aumentam a clareza.

Exemplos: nome de variável pouco claro, godoc faltando em uma função exportada,
conversão de tipo redundante, comentário levemente enganoso.

## Áreas de Avaliação

### 1. Segurança

- Falhas de autenticação e autorização.
- Lacunas de validação de entrada (injeção, traversal de path, XSS).
- Segredos, tokens ou credenciais codificados diretamente.
- Uso incorreto de criptografia ou armazenamento inseguro.
- Exposição de dados sensíveis em logs ou mensagens de erro.

### 2. Correção

- Erros de lógica produzindo resultados errados.
- Bugs de off-by-one e condições de fronteira.
- Desreferências de ponteiro nil ou null.
- Caminhos de erro não tratados levando a falhas silenciosas.
- Asserções ou conversões de tipo incorretas.

### 3. Concorrência

- Condições de corrida e sincronização faltando.
- Vazamentos de goroutine (sem caminho de shutdown ou cancelamento de contexto).
- Potencial de deadlock por ordenação de locks.
- Uso incorreto de canais (envio em canal fechado, bloqueio sem buffer).
- `sync.WaitGroup` faltando para goroutines criadas.

### 4. Desempenho e Escalabilidade

- Problemas de complexidade algorítmica (O(n^2) onde O(n) é suficiente).
- Vazamentos de recursos (file handles, bodies HTTP, conexões de banco de dados).
- Crescimento ilimitado em slices, maps ou canais.
- Cache faltando para operações caras repetidas.
- I/O bloqueante em caminhos críticos sem timeout.

### 5. Tratamento de Erros

- Erros engolidos (atribuídos a `_` sem justificativa).
- Contexto de erro faltando (`fmt.Errorf("contexto: %w", err)`).
- `panic()` ou `log.Fatal()` em código de biblioteca ou handler.
- Tratamento de erro catch-all amplo mascarando falhas específicas.
- Uso incorreto de `errors.Is()` ou `errors.As()`.

### 6. Qualidade e Manutenibilidade do Código

- Problemas de legibilidade (nomenclatura pouco clara, lógica profundamente aninhada).
- Duplicação de código entre funções ou pacotes.
- Funções excessivamente complexas que deveriam ser decompostas.
- Código morto ou exportações não utilizadas.
- Violações das convenções de código do projeto.

### 7. Testes

- Testes faltando para caminhos de código críticos.
- Testes que verificam mocks em vez de comportamento.
- Padrões de teste instáveis (dependentes de tempo, dependentes de ordem).
- Cobertura inadequada de casos extremos e caminhos de erro.
- `t.Parallel()` faltando para subtestes independentes.

### 8. Arquitetura

- Dependências circulares entre pacotes.
- Violações de camada (ex.: pacote CLI importando detalhes internos de runtime).
- Abstrações vazadas expondo detalhes de implementação.
- Acoplamento forte que impede testes independentes.
- Padrões inconsistentes dentro da mesma área da base de código.

### 9. Operações

- Log estruturado faltando ou insuficiente (`slog`).
- Contexto de erro faltando para depuração em produção.
- Valores de configuração codificados diretamente em vez de parametrizados.
- Tratamento de shutdown gracioso faltando para processos de longa duração.
- Lacunas de observabilidade (sem métricas ou rastreamento em operações críticas).

## Abordagem de Revisão

- Ler o PRD e o TechSpec antes de revisar o código para entender a intenção.
- Revisar em ordem de severidade: crítico primeiro, baixo por último.
- Focar em problemas que importam. Ignorar problemas de estilo já capturados por linters.
- Fornecer sugestões acionáveis: declarar o problema e como a correção deve ser.
- Atribuir severidade com base no impacto real, não em preocupação teórica.
- Criar um problema por arquivo por problema distinto.
- Se um problema abranger múltiplos arquivos, criar um problema por arquivo afetado.
- Reconhecer padrões bem implementados; não criar problemas para eles.
