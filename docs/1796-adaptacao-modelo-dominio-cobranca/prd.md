# Documento de Requisitos do Produto: Núcleo de Cobrança Centrado no Domínio

## Visão Geral

O produto já permite o trabalho de cobrança, mas não preserva de forma consistente a cadeia de negócio entre empresa, cliente, contrato, obrigação financeira e caso de cobrança. Isso cria dúvidas sobre qual obrigação um caso representa e permite a criação de casos para obrigações que ainda não estão vencidas.

Esta funcionalidade estabelece o Caso de Cobrança como centro operacional, preservando a experiência atual dos operadores e o histórico existente. Ela atende operadores de cobrança e administradores da empresa que precisam de dados confiáveis e isolados por empresa. O valor está em oferecer contexto confiável para cada caso, reduzir erros operacionais e criar uma base para futuros fluxos de negociação e compliance.

## Objetivos

- Garantir que todo novo caso de cobrança esteja vinculado a uma empresa, cliente, contrato e título financeiro.
- Impedir a criação de casos para títulos financeiros que não estejam vencidos.
- Oferecer ao operador o contexto da obrigação e do cliente dentro do fluxo do caso.
- Preservar o histórico de cobrança existente e manter os fluxos atuais utilizáveis durante a transição.
- Registrar as ações críticas que criam, atualizam, atribuem, comunicam ou encerram um caso.

## Histórias de Usuário

- Como operador de cobrança, quero ver o cliente, o contrato e o título vencido associado ao caso para agir com o contexto financeiro correto.
- Como operador de cobrança, quero que o sistema explique por que um caso não pode ser aberto para corrigir a obrigação de origem em vez de criar um caso inválido.
- Como operador de cobrança, quero continuar usando os casos e conversas existentes para que a melhoria do domínio não interrompa meu trabalho.
- Como administrador da empresa, quero que os dados permaneçam separados por empresa para que um tenant não acesse informações de cobrança de outro tenant.
- Como gestor de cobrança, quero que as ações críticas do caso sejam rastreáveis para investigar alterações e apoiar o compliance.
- Como cliente, quero que as comunicações de cobrança se refiram à obrigação correta para receber informações claras e precisas.

## Funcionalidades Principais

### P0: Dados de cobrança pertencentes ao tenant

- Tratar a empresa como proprietária de clientes, contratos, títulos financeiros, casos, conversas e ações relacionadas.
- Manter os usuários associados à empresa e preservar a separação entre tenants na experiência do produto.
- Exibir apenas registros disponíveis no contexto da empresa ativa.

### P0: Cadeia canônica da obrigação

- Representar o fluxo principal como Empresa -> Cliente -> Contrato -> Título Financeiro -> Caso de Cobrança.
- Manter o título financeiro conectado ao contrato e ao cliente de origem.
- Manter o caso de cobrança conectado ao título financeiro que está sendo recuperado.
- Exibir a cadeia na experiência do caso sem exigir que o operador pesquise em telas sem relação direta.

### P0: Criação de caso somente para título vencido

- Permitir a abertura de um caso somente para um título financeiro vencido.
- Rejeitar a criação para títulos em aberto, pagos, cancelados ou não vencidos.
- Apresentar o motivo da rejeição em linguagem que permita uma ação ao operador.
- Impedir casos ativos duplicados para o mesmo título recuperável, salvo quando as regras de negócio permitirem explicitamente um novo caso.

### P0: Conversa centrada no caso

- Manter as conversas de cobrança vinculadas ao caso.
- Preservar os fluxos existentes de IA, humanos e canais em torno do caso.
- Exibir o contexto da obrigação junto à conversa.
- Manter o caso como o local de trabalho dos operadores, da IA e das futuras automações.

### P0: Auditoria das ações críticas

- Registrar quem executou uma ação crítica, quando ela ocorreu, qual entidade foi afetada e o contexto anterior e posterior relevante.
- Cobrir criação, mudança de status, atribuição, mensagens e encerramento de casos na primeira entrega.
- Disponibilizar o histórico de auditoria aos usuários autorizados da empresa.

### P1: Suporte à transição

- Preservar o histórico de casos e conversas existentes.
- Identificar registros legados sem contexto completo em vez de inventar relacionamentos.
- Manter telas e fluxos atuais utilizáveis enquanto as novas regras são introduzidas.
- Fornecer mensagens claras para estados vazio, indisponível e de transição.

## Experiência do Usuário

O operador começa no fluxo de cobrança existente e seleciona uma obrigação para recuperar. O produto apresenta o contexto do cliente e do contrato, identifica se o título financeiro está vencido e permite a criação do caso somente quando a regra de recuperação for atendida.

Após a criação, o operador acessa o espaço de trabalho do caso. Esse espaço apresenta cliente, contrato, valor e vencimento do título, situação de atraso, status do caso, conversa, responsável e atividade relevante para auditoria em um contexto único. As ações de IA e de humanos continuam centradas no caso.

Se o título não for elegível, o operador verá uma explicação direta e o próximo passo útil, como revisar o status ou o vencimento do título. Registros existentes continuarão acessíveis, com indicação explícita quando o contexto legado estiver incompleto.

A experiência deve atender ao trabalho de cobrança em desktop e mobile, usar linguagem empresarial simples em português, preservar rótulos acessíveis e navegação por teclado e não expor dados de outra empresa.

## Restrições Técnicas de Alto Nível

- O isolamento dos dados por empresa é obrigatório.
- Dados financeiros e de clientes devem ser tratados como informações empresariais sensíveis.
- Decisões e comunicações de cobrança devem atender às obrigações brasileiras aplicáveis de proteção do consumidor e privacidade.
- O histórico existente não deve ser excluído durante a transição.
- A elegibilidade do caso deve ser consistente em todos os pontos de entrada.
- O operador não deve precisar conhecer a terminologia interna do modelo para concluir uma tarefa de cobrança.

## Fora do Escopo

- Implementação completa de ofertas de negociação e planos de parcelamento.
- Promessas de pagamento automatizadas e seu acompanhamento.
- Gestão de quarentena.
- Execução de negativação e protesto.
- Gestão de casos jurídicos.
- Editor completo de workflows.
- Nova plataforma multicanal de comunicação.
- Substituição do provedor ou da estratégia de negociação de IA existentes.
- Redesign amplo sem relação com o domínio e o fluxo do caso.

## Plano de Entrega por Fases

### MVP (Fase 1)

- Cadeia principal pertencente ao tenant.
- Contexto de cliente, contrato, título financeiro e caso.
- Criação de caso somente para título vencido.
- Contexto de conversa centrado no caso.
- Trilha de auditoria das ações críticas do caso.
- Preservação dos registros e fluxos existentes.

Critério para avançar: todos os novos casos atendem à cadeia canônica e à regra de vencimento, os operadores conseguem resolver um caso com o contexto da obrigação visível e nenhum histórico existente é perdido.

### Fase 2

- Negociações e promessas de pagamento vinculadas aos casos.
- Eventos do caso e histórico de ciclo de vida mais completo.
- Políticas e workflows de cobrança configuráveis.
- Relatórios operacionais de resultados dos casos.

Critério para avançar: os operadores conseguem administrar todo o ciclo de negociação assistida a partir do espaço de trabalho do caso.

### Fase 3

- Etapas de quarentena, negativação, protesto e jurídico.
- Integrações com provedores externos e controles de automação.
- Priorização avançada, análise da carteira e relatórios de compliance.

Critério de sucesso: as empresas conseguem administrar etapas avançadas de recuperação com automação controlada e rastreabilidade completa.

## Métricas de Sucesso

- 100% dos novos casos possuem contexto de empresa, cliente, contrato e título financeiro.
- 0 novos casos são originados de títulos financeiros não vencidos.
- 100% das ações críticas do MVP possuem registro de auditoria atribuível.
- Pelo menos 90% das tentativas de abertura de caso chegam a um próximo passo claro sem suporte manual.
- Nenhum caso ou histórico de conversa é perdido durante a implantação.
- O operador identifica a obrigação recuperada no espaço de trabalho do caso sem navegar para registros não relacionados.

## Riscos e Mitigações

- **Atrito do operador com regras mais rigorosas:** explicar ações rejeitadas e mostrar os dados de origem que precisam de atenção.
- **Registros legados incompletos:** sinalizar o contexto ausente e oferecer um caminho controlado de correção em vez de adivinhar.
- **Definições conflitantes de vencimento:** alinhar a regra visível à política financeira aprovada pela empresa antes da implantação.
- **Expansão de escopo para recuperação avançada:** manter as etapas avançadas nas fases posteriores e medir o MVP pelo resultado de integridade do núcleo.
- **Baixa adoção se o fluxo mudar demais:** preservar a navegação atual e introduzir o novo contexto gradualmente.

## Registros de Decisão de Arquitetura

- [ADR-001: Preservar a Experiência Atual de Cobrança com um Núcleo de Domínio Mais Forte](adrs/adr-001.md) — Consolidar a cadeia principal preservando operadores, histórico e etapas avançadas para fases posteriores.

## Questões em Aberto

- Qual é a definição de negócio aprovada para um título financeiro vencido quando existem carência, feriados ou outras regras de vencimento?
- Um título pode ter mais de um caso histórico encerrado?
- Quais perfis da empresa podem consultar o histórico de auditoria na primeira entrega?
- Como casos legados sem vínculo confiável com título financeiro devem ser exibidos e corrigidos?
- Quais status atuais de caso correspondem ao primeiro ciclo de vida canônico?
