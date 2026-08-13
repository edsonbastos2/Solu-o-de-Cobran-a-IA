## Princípios da modelagem
O MVP deve seguir estas regras:

1 - Todo dado pertence a uma empresa (Tenant).
2 - Um cliente pode possuir vários contratos.
3 - Um contrato pode possuir vários títulos financeiros.
4 - Apenas títulos vencidos podem gerar Casos de Cobrança.
5 - Toda cobrança acontece sobre um Caso de Cobrança.
6 - IA, humano e automações sempre trabalham sobre o Caso.
7 - Toda ação gera auditoria.

# Modelo de Domínio:

Tenant
│
├── Usuários
│
├── Clientes
│
├── Contratos
│      │
│      ├── Cláusulas
│      ├── Documentos
│      ├── Responsáveis
│      └── Títulos Financeiros
│               │
│               ▼
│        Casos de Cobrança
│               │
│               ├── Conversas
│               │      └── Mensagens
│               │
│               ├── Negociações
│               │
│               ├── Promessas de Pagamento
│               │
│               ├── Eventos
│               │
│               ├── Quarentena
│               │
│               ├── Negativação
│               │
│               ├── Protesto
│               │
│               └── Encerramento
│
├── Workflows
│
├── Políticas de Cobrança
│
├── Agentes IA
│
└── Auditoria

## Fluxo principal:

Cliente

↓

Contrato

↓

Título Financeiro

↓

Caso de Cobrança

↓

IA

↓

Negociação

↓

Pagamento

↓

Encerrado


## Entidades
# Tenant

### Representa uma empresa que contratou o SaaS.

# Tenant

id

nome

cnpj

plano

status

configurações


# Usuário

id

tenant_id

nome

email

perfil

status


# Cliente

- Pessoa que possui uma obrigação financeira.

Cliente

id

tenant_id

tipo

cpf_cnpj

nome

emails

telefones

endereços



# Contrato

Origem da obrigação.

Contrato

id

tenant_id

cliente_id

número

tipo

data

vigência

status

juros

multa

índice

workflow_id


# Cláusula
Cláusula

id

contrato_id

tipo

conteúdo


# Documento
Documento

id

contrato_id

arquivo

tipo


# Responsável

Permite vários responsáveis.

Responsável

id

contrato_id

cliente_id

tipo


# Título Financeiro

Essa entidade é muito importante.

Ela representa:

parcela
boleto
aluguel
mensalidade

Título Financeiro

id

contrato_id

número

vencimento

valor_original

valor_atual

status

dias_atraso


# Status:

ABERTO

PAGO

ATRASADO

NEGOCIADO

CANCELADO


# Caso de Cobrança

Esta é a principal entidade do sistema.

Caso de Cobrança

id

tenant_id

titulo_financeiro_id

status

prioridade

workflow_id

agente_ia_id

responsável_humano_id

score

data_abertura

data_encerramento


# Status:

CRIADO

PREVENTIVO

AMIGÁVEL

NEGOCIAÇÃO

PROMESSA

QUARENTENA

NEGATIVAÇÃO

PROTESTO

JURÍDICO

QUITADO

ENCERRADO


# Conversa

Cada caso possui uma conversa.

Conversa

id

caso_id

canal

status


# Mensagem
Mensagem

id

conversa_id

autor

tipo

texto

tokens

data

# Autor:

IA

CLIENTE

OPERADOR

# Negociação
Negociação

id

caso_id

status

valor

desconto

parcelas

entrada

# Promessa de Pagamento
Promessa

id

caso_id

valor

vencimento

status


# Quarentena
Quarentena

id

caso_id

início

fim

motivo

status


# Negativação
Negativação

id

caso_id

provedor

status

protocolo

data


# Protesto
Protesto

id

caso_id

cartório

status

protocolo


# Workflow

Cada empresa pode ter vários fluxos.
Workflow

id

tenant_id

nome

ativo


# Política de Cobrança
Política

id

tenant_id

dias_negativação

dias_protesto

dias_quarentena

desconto_máximo

parcelamento_máximo


# Agente IA
Agente

id

tenant_id

nome

modelo

objetivo

ativo


# Auditoria
Auditoria

id

tenant_id

entidade

registro

ação

usuário

data

antes

depois


# Relacionamentos

Tenant
│
├── Usuários
│
├── Clientes
│      │
│      └────────────┐
│                   │
├── Contratos       │
│      │            │
│      ▼            │
│ Cláusulas         │
│ Documentos        │
│ Responsáveis──────┘
│
│
└── Títulos Financeiros
        │
        ▼
Casos de Cobrança
        │
        ├── Conversas
        │       │
        │       └── Mensagens
        │
        ├── Negociações
        │
        ├── Promessas
        │
        ├── Quarentenas
        │
        ├── Negativações
        │
        ├── Protestos
        │
        ├── Eventos
        │
        └── Auditoria


# O que eu mudaria em relação a um sistema de cobrança tradicional
- A maioria dos sistemas coloca Contrato ou Cliente no centro do domínio. Eu colocaria o Caso de Cobrança como o Aggregate Root da recuperação de crédito.

# Isso significa que:
- A IA trabalha sobre o caso.
- O operador assume o caso.
- O workflow controla o caso.
- A negociação pertence ao caso.
- A quarentena pertence ao caso.
- A negativação pertence ao caso.
- O protesto pertence ao caso.
- A auditoria registra tudo o que acontece no caso.


## Enquanto isso, Cliente, Contrato e Título Financeiro permanecem como a origem da obrigação financeira.

## Essa separação deixa o domínio mais coeso, facilita a manutenção e permite evoluir o produto para suportar diferentes tipos de dívida sem alterar a lógica central de recuperação de crédito.
