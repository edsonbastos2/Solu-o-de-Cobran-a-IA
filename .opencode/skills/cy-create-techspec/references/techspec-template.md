# Template de TechSpec

Use este template para estruturar toda Especificação Técnica.

## Resumo Executivo

Visão geral técnica breve em 1-2 parágrafos:
- Principais decisões arquiteturais
- Estratégia e abordagem de implementação
- Principais trade-offs técnicos

## Arquitetura do Sistema

### Visão Geral dos Componentes

Componentes principais, suas responsabilidades e relacionamentos:
- Nome do componente, propósito e fronteiras
- Fluxo de dados entre componentes
- Interações com sistemas externos (Supabase, Z-API, AI providers)

## Design de Implementação

### Interfaces Principais

Interfaces de serviço chave com exemplos de código TypeScript. Limitar cada exemplo a 20 linhas:
- Definições de TypeScript interfaces/types
- Assinaturas de funções com tipos de parâmetros e retorno
- Convenções de tratamento de erros

### Modelos de Dados

Entidades de domínio principais e seus relacionamentos:
- Definições de entidades com tipos de campos
- Tipos de requisição e resposta para APIs
- Schemas Supabase ou estruturas de armazenamento

### Endpoints de API

Superfície de API organizada por recurso:
- Método, caminho e descrição
- Formato de requisição e campos obrigatórios
- Formato de resposta e códigos de status

## Pontos de Integração

Serviços externos e fronteiras do sistema:
- Supabase Auth (cookie-based session, RLS)
- AI Providers (Gemini, OpenAI, Anthropic, OpenRouter, Ollama)
- Z-API WhatsApp
- Outras integrações

## Sequenciamento de Desenvolvimento

Ordem de Build numerada com dependências explícitas:
1. [Passo 1] — sem dependências
2. [Passo 2] — depende do Passo 1
3. [Passo 3] — depende dos Passos 1, 2
...

## Riscos Técnicos e Mitigações

- Riscos de integração e estratégias
- Preocupações de desempenho e mitigação
- Operações multi-tenant

## Architecture Decision Records

ADRs documentando decisões técnicas:
- [ADR-NNN: Título](adrs/adr-NNN.md) — Resumo de uma linha da decisão

## Perguntas em Aberto

Itens técnicos restantes que precisam de esclarecimento.
