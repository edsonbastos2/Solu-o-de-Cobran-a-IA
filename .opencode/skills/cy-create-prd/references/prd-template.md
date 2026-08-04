# Template de PRD

Use este template para estruturar todo Documento de Requisitos de Produto. Preencha cada seção com base nos resultados do brainstorming. Deixe orientações de placeholder em seções onde as informações são insuficientes e anote-as em Perguntas em Aberto.

## Visão Geral

Visão geral de alto nível da funcionalidade ou produto. Descreva:
- Qual problema ele resolve
- Para quem é destinado
- Por que é valioso

## Objetivos

Objetivos específicos e mensuráveis para esta funcionalidade ou produto:
- Métricas de sucesso e indicadores-chave de desempenho
- Objetivos de negócio e resultados esperados
- Prazos ou marcos alvo

## Histórias de Usuário

Histórias de usuário organizadas por persona:
- Como [tipo de usuário], quero [ação] para que [benefício]
- Personas principais e seus fluxos principais
- Personas secundárias e casos extremos

## Funcionalidades Principais

Funcionalidades principais agrupadas por prioridade:
- Nome da funcionalidade: o que ela faz, por que é importante, comportamento de alto nível
- Requisitos funcionais para cada funcionalidade
- Interação entre funcionalidades

## Experiência do Usuário

Jornada do usuário desde o primeiro contato até o uso regular:
- Personas principais e seus objetivos
- Fluxos principais do usuário passo a passo
- Considerações de UI/UX e requisitos de acessibilidade
- Onboarding e descobribilidade

## Restrições Técnicas de Alto Nível

Fronteiras necessárias que moldam o produto sem prescrever a implementação:
- Integrações necessárias com sistemas existentes
- Exigências de conformidade ou regulamentares
- Metas de desempenho da perspectiva do usuário
- Requisitos de privacidade e segurança de dados

NÃO inclua detalhes de implementação como bancos de dados específicos, frameworks, designs de API ou padrões de arquitetura.

## Fora do Escopo (Não-Objetivos)

Funcionalidades explicitamente excluídas e fronteiras:
- Funcionalidades intencionalmente adiadas para fases futuras
- Problemas adjacentes que não serão abordados
- Limites deste esforço

## Plano de Lançamento em Fases

Plano de entrega incremental com critérios de sucesso por fase:

### MVP (Fase 1)
- Funcionalidades principais incluídas
- Critérios de sucesso para prosseguir para a Fase 2

### Fase 2
- Funcionalidades adicionais
- Critérios de sucesso para prosseguir para a Fase 3

### Fase 3
- Conjunto completo de funcionalidades
- Critérios de sucesso de longo prazo

## Métricas de Sucesso

Medidas quantificáveis de sucesso:
- Métricas de engajamento do usuário
- Benchmarks de desempenho da perspectiva do usuário
- Indicadores de impacto no negócio
- Atributos de qualidade

## Riscos e Mitigações

Riscos não técnicos que podem afetar o produto:
- Riscos de adoção e estratégias de mitigação
- Riscos competitivos
- Restrições de prazo e recursos
- Riscos de dependência de fatores externos

NÃO inclua riscos técnicos como complexidade arquitetural ou dívida técnica.

## Architecture Decision Records

ADRs documentando decisões chave tomadas durante o brainstorming:
- [ADR-NNN: Título](adrs/adr-NNN.md) — Resumo de uma linha da decisão

## Perguntas em Aberto

Itens restantes que precisam de esclarecimento:
- Requisitos não claros
- Casos extremos que requerem contribuição dos stakeholders
- Dependências de decisões ainda não tomadas
