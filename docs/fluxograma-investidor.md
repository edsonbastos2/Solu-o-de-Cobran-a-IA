# Fluxograma para Investidor: Solução de Cobrança IA

## Resumo executivo

A Solução de Cobrança IA automatiza o ciclo de recuperação de crédito: recebe carteiras de inadimplência, identifica títulos elegíveis, abre casos de cobrança, conduz negociações por IA em canais como WhatsApp e Telegram, registra acordos, aciona atendimento humano quando necessário e entrega indicadores de recuperação para gestão.

O diferencial do produto é combinar **automação conversacional**, **políticas de cobrança configuráveis**, **compliance auditável**, **multi-tenant para escala B2B** e **inteligência preditiva** para priorizar os casos com maior chance de recuperação.

## Fluxograma executivo

```mermaid
flowchart LR
    A[Carteira de clientes e títulos] --> B[Importação ou cadastro no painel]
    B --> C[Validação da obrigação]
    C --> D{Título vencido e elegível?}

    D -- Não --> E[Operador corrige dados ou aguarda vencimento]
    D -- Sim --> F[Caso de cobrança]

    F --> G[Classificação por estágio de atraso]
    G --> H[Score de propensão ao pagamento]
    H --> I[Pipeline de IA multiagente]

    I --> I1[Supervisor: entende a intenção]
    I1 --> I2[Especialista: cobra ou negocia]
    I2 --> I3[Qualidade: revisa compliance e desconto]

    I3 --> J[Mensagem enviada por WhatsApp ou Telegram]
    J --> K[Devedor responde]
    K --> I

    I3 --> L{Resultado da conversa}
    L -- Acordo fechado --> M[Acordo formal registrado]
    M --> N[Baixa, relatório e métricas de recuperação]

    L -- Precisa de humano --> O[Handoff para operador]
    O --> P[Atendimento especializado, quarentena ou análise jurídica]

    L -- Sem resposta --> Q[Follow-up automático]
    Q --> J

    P --> R[Negativação, protesto ou jurídico quando aplicável]
    R --> N

    S[Dashboard de gestão] -. monitora .-> F
    S -. acompanha .-> N
    T[Auditoria e regras de compliance] -. controla .-> I3
    U[Isolamento multi-tenant] -. protege .-> B
```

## Fluxo operacional do caso

```mermaid
flowchart TD
    A[Empresa acessa o sistema] --> B[Seleciona tenant ativo]
    B --> C[Cadastra cliente]
    C --> D[Cadastra contrato]
    D --> E[Cadastra título financeiro]
    E --> F{Título está vencido?}

    F -- Não --> G[Bloqueia abertura de caso]
    G --> H[Mostra motivo e próximo passo]

    F -- Sim --> I[Cria caso de cobrança]
    I --> J[Calcula dias de atraso]
    J --> K{Estágio}

    K --> K1[Preventiva]
    K --> K2[Amigável: 1 a 30 dias]
    K --> K3[Negocial: 31 a 180 dias]
    K --> K4[Especializada: acima de 180 dias ou atenção humana]

    K1 --> L[Define abordagem e desconto permitido]
    K2 --> L
    K3 --> L
    K4 --> L

    L --> M[IA monta resposta com contexto do cliente, contrato e título]
    M --> N[Agente de qualidade valida CDC, tom e margem de desconto]
    N --> O[Envia mensagem ao devedor]
    O --> P[Resposta chega via webhook]
    P --> Q[Histórico da conversa é atualizado]
    Q --> R{IA identifica evento}

    R -- Acordo --> S[Registra negociação]
    S --> T[Atualiza status do caso]
    T --> U[Gestor acompanha resultado no dashboard]

    R -- Risco ou exceção --> V[Envia para humano]
    V --> W[Auditoria registra decisão]

    R -- Conversa continua --> M
```

## Arquitetura simplificada

```mermaid
flowchart LR
    subgraph Produto["Aplicação SaaS"]
        A[Next.js App Router]
        B[Painel operacional]
        C[APIs REST]
        D[Rotinas automáticas]
    end

    subgraph Dados["Camada de dados"]
        E[Supabase Auth]
        F[Postgres com RLS]
        G[Perfis, tenants e permissões]
        H[Clientes, contratos, títulos, casos e mensagens]
        I[Auditoria e relatórios]
    end

    subgraph IA["Camada de inteligência"]
        J[Configuração de provedor por tenant]
        K[OpenAI, Gemini, Anthropic, OpenRouter, Groq ou Ollama]
        L[Supervisor]
        M[Especialistas]
        N[Qualidade e compliance]
        O[Score de propensão]
    end

    subgraph Canais["Canais e integrações"]
        P[WhatsApp via Z-API]
        Q[Telegram]
        R[Webhooks de entrada]
        S[CSV e PDF]
        T[Negativação, protesto e jurídico]
    end

    A --> B
    B --> C
    C --> E
    C --> F
    F --> G
    F --> H
    F --> I

    C --> J
    J --> K
    K --> L
    L --> M
    M --> N
    H --> O

    N --> P
    N --> Q
    P --> R
    Q --> R
    R --> C

    D --> O
    D --> P
    D --> T
    I --> S
```

## Fluxo de valor para o investidor

```mermaid
flowchart LR
    A[Carteira inadimplente] --> B[Automação reduz custo operacional]
    B --> C[Contato em canal de alta resposta]
    C --> D[IA negocia em escala]
    D --> E[Compliance reduz risco jurídico]
    E --> F[Gestor acompanha ROI por dashboard]
    F --> G[Mais recuperação com menor custo por cobrança]
```

## Como apresentar em 60 segundos

Esta plataforma transforma cobrança em um processo automatizado, rastreável e escalável. A empresa importa sua carteira, o sistema identifica quais títulos podem ser cobrados e abre casos com todo o contexto financeiro. A IA conversa com o devedor por WhatsApp ou Telegram, negocia dentro das políticas de desconto da empresa e passa por uma camada de qualidade para evitar abuso, ameaça ou proposta fora da margem. Quando há acordo, o sistema registra a negociação; quando há exceção, transfere para um operador humano ou para etapas como quarentena, negativação, protesto e jurídico. Tudo fica isolado por empresa, auditado e medido em dashboards, permitindo vender a solução como SaaS para assessorias, fintechs, varejo, instituições de ensino e qualquer negócio com alto volume de inadimplência.

## Pontos de destaque para o pitch

- **Problema grande:** cobrança tradicional é cara, manual, difícil de escalar e pouco eficiente em canais frios.
- **Solução clara:** negociação automatizada por IA em canais com alto engajamento, especialmente WhatsApp.
- **Escala B2B:** arquitetura multi-tenant permite atender várias empresas com isolamento de dados.
- **Governança:** políticas, limites de desconto, auditoria e revisão de compliance reduzem risco operacional.
- **Diferencial técnico:** pipeline multiagente com supervisor, especialistas e qualidade, em vez de um chatbot simples.
- **Inteligência de carteira:** score de propensão e estágios de atraso ajudam a priorizar onde há mais chance de recuperação.
- **Expansão natural:** relatórios, campanhas, templates, notificações, negativação, protesto e jurídico aumentam ticket e retenção.

## Legenda dos principais módulos

| Módulo | Papel no negócio |
| --- | --- |
| Dashboard | Mostra volume, status dos casos, acordos e indicadores de recuperação. |
| Clientes, contratos e títulos | Organizam a cadeia financeira que dá origem à cobrança. |
| Casos de cobrança | Centralizam conversa, status, valores, estágio, responsável e histórico. |
| IA multiagente | Decide abordagem, negocia e valida conformidade antes de responder. |
| Mensageria | Envia e recebe mensagens por WhatsApp ou Telegram. |
| Políticas e templates | Padronizam régua de cobrança, tom, descontos e fallback quando a IA falha. |
| Auditoria | Registra ações críticas para rastreabilidade e compliance. |
| Relatórios | Exportam informações para gestão financeira e análise de ROI. |
| Rotinas automáticas | Executam follow-up, score, alerta, negativação, protesto e expiração de negociações. |
| Multi-tenant | Permite vender o produto para múltiplas empresas com dados isolados. |

## Sugestão de slide

1. **Slide 1: Dor e oportunidade**
   Mostre alto custo de cobrança manual, baixa escala e necessidade de recuperar receita sem prejudicar relacionamento.

2. **Slide 2: Fluxograma executivo**
   Use o primeiro diagrama como visão central do produto.

3. **Slide 3: Diferencial da IA**
   Explique o pipeline supervisor, especialista e qualidade.

4. **Slide 4: Modelo SaaS e defensabilidade**
   Destaque multi-tenant, integrações, auditoria, dados históricos e score de propensão.

5. **Slide 5: Expansão de receita**
   Mostre módulos futuros ou avançados: campanhas, negativação, protesto, jurídico, relatórios e integrações.
