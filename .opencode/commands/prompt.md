1. Objetivo da funcionalidade

 - Criar um módulo chamado CRM de Cobrança, destinado aos operadores responsáveis pelo atendimento e negociação dos devedores.

- O CRM deverá permitir:

1 - Visualizar os casos de cobrança;
2 - Visualizar os casos em formato Kanban;
3 - Organizar os casos por etapas do processo de cobrança;
4 - Arrastar e soltar casos entre as etapas;
5 - Registrar automaticamente a mudança de etapa;
6 - Associar cada caso a um operador;
7 - Permitir transferência de casos entre operadores;
8 - Permitir que um operador visualize somente os casos permitidos pelas suas permissões;
9 - Permitir que gestores visualizem casos de sua equipe;
10 - Permitir negociação com o devedor;
11 - Integrar o CRM com o módulo de chat;
12 - Registrar todas as atividades realizadas;
13 - Manter histórico completo das alterações;
14 - Respeitar rigorosamente o isolamento entre tenants.

2. Conceito principal do CRM

O CRM não deve criar uma nova entidade independente para representar a negociação.

O CRM deve ser uma visão operacional dos Casos de Cobrança.

O Kanban deve trabalhar sobre os Casos de Cobrança existentes.

Exemplo:

Caso de Cobrança
    |
    +-- Cliente
    |
    +-- Contrato
    |
    +-- Títulos Financeiros
    |
    +-- Operador responsável
    |
    +-- Status / Etapa CRM
    |
    +-- Negociações
    |
    +-- Conversas
    |
    +-- Atividades
    |
    +-- Histórico
    |
    +-- Agente IA


3. Etapas iniciais do Kanban

Crie uma estrutura flexível para as etapas.

Não faça o status como valores hardcoded diretamente nos componentes.

A estrutura inicial sugerida é:

NOVO
↓
EM_CONTATO
↓
EM_NEGOCIACAO
↓
AGUARDANDO_PAGAMENTO
↓
PAGAMENTO_CONFIRMADO
↓
NEGOCIACAO_CONCLUIDA

Também devem existir situações de exceção:

SEM_CONTATO
NEGOCIACAO_RECUSADA
PROMESSA_NAO_CUMPRIDA
ESCALADO
ENCERRADO

Entretanto, a arquitetura deve permitir que futuramente cada tenant possa configurar suas próprias etapas.

Portanto, considere algo conceitualmente semelhante a:

CRMBoard
CRMStage
Case
CaseStageHistory

Não necessariamente utilize exatamente esses nomes. Avalie a melhor modelagem para o domínio existente.


4. Regras importantes sobre etapas

Uma mudança de etapa nunca deve ser apenas uma alteração visual no frontend.

Quando o operador arrastar um caso:

EM_NEGOCIACAO
        ↓
AGUARDANDO_PAGAMENTO

deve existir uma operação de domínio/API responsável por essa transição.

Exemplo conceitual:

PATCH /collection-cases/{caseId}/stage

Payload:

{
  "stageId": "uuid"
}

O backend deve:

1 - Validar o tenant;
2 - Validar o usuário;
3 - Validar a permissão;
4 - Validar se o caso pertence ao tenant;
5 - Validar se a transição é permitida;
6 - Atualizar a etapa;
7 - Registrar histórico;
8 - Registrar auditoria;
9 - Disparar eventos necessários.


5. Histórico de movimentação

Toda movimentação deve gerar histórico.

Exemplo:

Caso: #000123

10:31
João Silva moveu:

EM_CONTATO
→
EM_NEGOCIACAO

Estrutura conceitual:

CaseStageHistory

id
caseId
tenantId
fromStageId
toStageId
changedByUserId
reason
createdAt

Esse histórico será utilizado futuramente para:

auditoria;
métricas;
SLA;
produtividade;
tempo médio por etapa;
análise de conversão;
relatórios.

6. Multi-Tenant

Essa é uma regra crítica.

Nenhum operador pode acessar informações de outro tenant.

Toda consulta deve respeitar:

tenantId

O tenant deve ser obtido de maneira segura através do contexto autenticado, e não confiado cegamente em valores enviados pelo frontend.

Nunca permita algo como:

GET /cases?tenantId=outro-tenant

sem validação de autorização no backend.

O frontend deve trabalhar com o contexto autenticado.

7. Usuários e operadores

O sistema possui múltiplos usuários por tenant.

Exemplo:

Tenant A

├── Administrador
├── Supervisor
├── Operador João
├── Operador Maria
└── Operador Pedro

Cada usuário pode possuir diferentes permissões.

Considere pelo menos:

Administrador

Pode:

visualizar todos os casos;
distribuir casos;
transferir casos;
configurar etapas;
visualizar métricas;
visualizar histórico;
gerenciar operadores.
Supervisor

Pode:

visualizar casos da equipe;
distribuir casos;
transferir casos;
acompanhar negociações;
visualizar métricas;
intervir em conversas.
Operador

Pode:

visualizar seus casos;
visualizar casos permitidos;
negociar;
enviar mensagens;
alterar etapas permitidas;
solicitar/realizar transferência conforme permissão.

A arquitetura deve permitir novas roles e permissões no futuro.

8. Distribuição e transferência

Um operador deve poder transferir um Caso de Cobrança para outro operador.

Exemplo:

João
   ↓
Transferir
   ↓
Maria

A transferência deve:

Alterar o operador responsável;
Registrar histórico;
Registrar quem realizou a transferência;
Registrar operador anterior;
Registrar novo operador;
Opcionalmente exigir motivo;
Atualizar o Kanban;
Atualizar notificações;
Atualizar o contexto da conversa.

Modelo conceitual:

CaseAssignmentHistory

id
caseId
tenantId
previousOperatorId
newOperatorId
assignedByUserId
reason
createdAt


9. Kanban

Criar uma interface semelhante a CRMs modernos.

Estrutura:

┌───────────────────────────────────────────────────────────────┐
│ CRM de Cobrança                                                │
├───────────────────────────────────────────────────────────────┤
│ Filtros                                                       │
│ [Operador] [Campanha] [Status] [Prioridade] [Busca]           │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ NOVOS      EM CONTATO      NEGOCIAÇÃO       AGUARDANDO       │
│                                                               │
│ ┌───────┐  ┌───────┐       ┌───────┐        ┌───────┐        │
│ │ Caso  │  │ Caso  │       │ Caso  │        │ Caso  │        │
│ │ João  │  │ Maria │       │ Pedro │        │ Ana   │        │
│ │ R$... │  │ R$... │       │ R$... │        │ R$... │        │
│ └───────┘  └───────┘       └───────┘        └───────┘        │
│                                                               │
└───────────────────────────────────────────────────────────────┘


10. Card do caso

O card deve apresentar informações suficientes para o operador identificar rapidamente a cobrança.

Sugestão:

┌──────────────────────────────┐
│ #000123                 🔴   │
│ João da Silva                │
│ CPF: ***.***.***-12         │
│                              │
│ Dívida                       │
│ R$ 12.450,00                 │
│                              │
│ Vencimento                   │
│ 15/08/2026                   │
│                              │
│ Último contato               │
│ Hoje, 10:32                  │
│                              │
│ 🤖 IA                        │
│ 👤 João                      │
└──────────────────────────────┘

Não sobrecarregue o card.

As informações detalhadas devem ficar na tela de detalhes do caso.

11. Tela de detalhes do Caso

Ao clicar em um card, abrir uma página ou drawer de detalhes.

A estrutura deve ser semelhante a:

Caso #000123

┌─────────────────────────────────────────────────────────────┐
│ Cliente                                                     │
│ João da Silva                                               │
│ CPF: ***                                                    │
│                                                             │
│ Operador: João                                              │
│ Status: Em negociação                                       │
│                                                             │
│ Dívida: R$ 12.450,00                                        │
│                                                             │
│ [Abrir conversa] [Transferir] [Nova negociação]             │
└─────────────────────────────────────────────────────────────┘

Abaixo:

Resumo
Negociações
Conversas
Títulos
Contrato
Atividades
Histórico

Utilize tabs quando fizer sentido.

12. Integração com Chat

O CRM deve estar integrado ao módulo de chat já previsto no sistema.

O operador deve conseguir:

Caso
 ↓
Abrir conversa
 ↓
WhatsApp
 ↓
Chat com devedor

O CRM não deve duplicar a implementação do chat.

Crie uma integração através de componentes/composables/serviços bem definidos.

13. IA + operador humano

O sistema possui agentes de IA responsáveis pela cobrança.

Um Caso pode estar sendo conduzido inicialmente pela IA.

Exemplo:

IA
 ↓
Entra em contato
 ↓
Devedor responde
 ↓
IA negocia
 ↓
Operador assume

O CRM deve indicar claramente:

🤖 Atendimento por IA

ou:

👤 Atendimento humano

Quando um operador assumir:

IA → HUMANO

deve existir registro da intervenção.

Não implemente a lógica de IA diretamente dentro do componente Kanban.


14. Negociações

Um Caso pode possuir múltiplas negociações.

Exemplo:

Negociação #1
R$ 10.000
10 parcelas
Recusada

Negociação #2
R$ 9.500
8 parcelas
Aceita

O CRM deve permitir visualizar a negociação atual.

Informações importantes:

Valor original
Desconto
Valor negociado
Quantidade de parcelas
Valor da parcela
Data do primeiro pagamento
Status
Operador responsável
Data da negociação

Estados possíveis:

EM_NEGOCIACAO
PROPOSTA_ENVIADA
ACEITA
RECUSADA
EXPIRADA
CANCELADA

Não misture o status da negociação com o status do Caso de Cobrança.

São conceitos diferentes.

15. Filtros

O CRM deve possuir filtros.

Inicialmente:

Operador;
Equipe;
Etapa;
Prioridade;
Campanha;
Canal;
Status da negociação;
Faixa de valor;
Data de vencimento;
Último contato;
Busca por cliente;
Busca por CPF/CNPJ;
Busca pelo número do caso.

Exemplo:

[Buscar cliente...]

Operador:
[Todos]

Etapa:
[Todos]

Campanha:
[Todos]

Prioridade:
[Todos]

Valor:
[Todos]

[Limpar] [Aplicar]

Os filtros devem ser reutilizáveis.

Crie componentes específicos, por exemplo:

CrmFilters
CrmOperatorFilter
CrmStageFilter
CrmCampaignFilter
CrmPriorityFilter

Não coloque todos os filtros diretamente no componente principal.


16. Busca

A busca deve permitir localizar rapidamente:

Nome
CPF/CNPJ
Número do caso
Número do contrato
Telefone

Para grandes volumes, prefira busca server-side.

Não carregue milhares de casos no frontend apenas para realizar um filtro local.


17. Paginação / carregamento

O Kanban pode trabalhar com grandes quantidades de casos.

Não assuma que todos os casos estarão carregados no frontend.

Avalie:

paginação por coluna;
infinite scroll;
virtualização;
cursor pagination.

A solução deve considerar performance.

Por exemplo:

NEGOCIAÇÃO

35 casos

[carregar mais]


18. Drag and Drop

Implemente Drag and Drop de maneira acessível e robusta.

Ao mover:

Caso A
EM_NEGOCIACAO
      ↓
AGUARDANDO_PAGAMENTO

o frontend deve:

Atualizar otimisticamente a interface, se apropriado;
Chamar API;
Aguardar confirmação;
Reverter se ocorrer erro;
Mostrar feedback ao operador.

Nunca deixe o frontend em estado divergente do backend.

Exemplo:

Movimentação
     ↓
API
     ↓
Sucesso → mantém
Erro → rollback


19. Transições inválidas

Nem toda etapa necessariamente poderá ir para qualquer outra.

Exemplo:

NOVO
→ EM_CONTATO

permitido.

Mas:

PAGAMENTO_CONFIRMADO
→ NOVO

pode ser proibido.

Crie uma estratégia para configurar transições.

Exemplo conceitual:

CRMStageTransition

fromStage
toStage
allowed

Ou uma regra de domínio equivalente.

Não implemente regras complexas apenas no frontend.

20. Auditoria

Todas as ações relevantes precisam ser auditáveis.

Registrar:

Quem
O quê
Quando
Caso
Tenant
Dados anteriores
Dados novos

Eventos importantes:

CASE_CREATED
CASE_STAGE_CHANGED
CASE_ASSIGNED
CASE_TRANSFERRED
NEGOTIATION_CREATED
NEGOTIATION_UPDATED
NEGOTIATION_ACCEPTED
MESSAGE_SENT
HUMAN_INTERVENTION
AI_RESUMED
CASE_CLOSED

A implementação deve reutilizar o mecanismo de auditoria existente, caso já exista.

Não crie um segundo sistema de auditoria sem necessidade.


21. Notificações

Considere notificações para eventos como:

caso transferido para operador;
nova mensagem do devedor;
negociação aceita;
promessa de pagamento vencendo;
intervenção solicitada;
caso escalado;
nova atribuição.

A arquitetura deve permitir posteriormente:

In-app
Email
WhatsApp
Push

Não acople a regra de negócio diretamente ao componente visual.

22. Dashboard do operador

Além do Kanban, o CRM deve possuir indicadores básicos.

Exemplo:

┌──────────────┐
│ Meus casos   │
│ 127          │
└──────────────┘

┌──────────────┐
│ Negociações  │
│ 43           │
└──────────────┘

┌──────────────┐
│ Promessas    │
│ 18           │
└──────────────┘

┌──────────────┐
│ Recuperado   │
│ R$ 84.500    │
└──────────────┘

Indicadores iniciais:

Total de casos;
Casos em negociação;
Casos aguardando pagamento;
Negociações realizadas;
Negociações convertidas;
Promessas de pagamento;
Pagamentos confirmados;
Valor recuperado.

O dashboard deve respeitar o escopo de acesso do usuário.


23. Arquitetura Frontend

Organize a implementação de forma modular.

Uma possível estrutura:

modules/
└── crm/
    ├── components/
    │   ├── CrmBoard.vue
    │   ├── CrmColumn.vue
    │   ├── CrmCaseCard.vue
    │   ├── CrmFilters.vue
    │   ├── CrmHeader.vue
    │   ├── CrmStats.vue
    │   ├── CrmCaseDetails.vue
    │   ├── CrmCaseTimeline.vue
    │   └── CrmTransferDialog.vue
    │
    ├── composables/
    │   ├── useCrmBoard.ts
    │   ├── useCrmFilters.ts
    │   ├── useCrmCase.ts
    │   └── useCrmPermissions.ts
    │
    ├── services/
    │   └── crm.service.ts
    │
    ├── stores/
    │   └── crm.store.ts
    │
    ├── types/
    │   ├── crm.types.ts
    │   ├── crm-stage.types.ts
    │   └── crm-case.types.ts
    │
    └── pages/
        ├── crm.vue
        └── crm/
            └── [caseId].vue

Adapte essa estrutura à arquitetura existente do projeto.

Não altere desnecessariamente a arquitetura já existente.


24. Componentização

O componente:

CrmBoard.vue

não deve conhecer detalhes de:

API;
autenticação;
regras de negócio;
negociação;
transferência;
chat.

Ele deve ser responsável principalmente pela composição da interface.

Exemplo conceitual:

<CrmBoard>
  <CrmFilters />

  <CrmStats />

  <CrmColumn
    v-for="stage in stages"
    :key="stage.id"
  >
    <CrmCaseCard
      v-for="caseItem in stage.cases"
      :key="caseItem.id"
    />
  </CrmColumn>
</CrmBoard>

As regras devem ficar em composables/services/use cases apropriados.


25. API

Antes de implementar o frontend, analise os endpoints existentes.

Caso os endpoints ainda não existam, proponha um contrato.

Exemplo:

GET /crm/board
GET /crm/stages
GET /collection-cases
GET /collection-cases/{id}

PATCH /collection-cases/{id}/stage

POST /collection-cases/{id}/transfer

GET /collection-cases/{id}/history

GET /collection-cases/{id}/negotiations

POST /collection-cases/{id}/negotiations

Não implemente endpoints duplicados caso o backend já possua recursos equivalentes.


26. Tratamento de erros

O sistema deve tratar situações como:

caso já movimentado por outro operador;
permissão insuficiente;
sessão expirada;
caso transferido por outro usuário;
etapa removida;
conflito de atualização;
API indisponível.

Exemplo:

Este caso foi atualizado por outro operador.
Atualize o Kanban para visualizar a situação atual.


27. Concorrência

Considere que vários operadores podem trabalhar simultaneamente.

Exemplo:

João vê Caso #123 em "Em negociação"

Maria transfere o caso para Pedro

João tenta movimentar o caso

O backend deve detectar o estado atual e evitar sobrescritas silenciosas.

Considere mecanismos como:

versionamento;
updatedAt;
optimistic locking;
version number.

Escolha a solução mais adequada à arquitetura existente.


28. Realtime

Avalie se o sistema já utiliza recursos realtime.

Caso utilize Supabase Realtime, WebSocket ou mecanismo equivalente, considere atualização automática do Kanban.

Exemplo:

Maria move Caso #123

        ↓

Evento realtime

        ↓

Kanban de João/Supervisor atualizado

Não introduza WebSocket/Supabase Realtime se o projeto já possui outro mecanismo consolidado.

29. Segurança

A implementação deve considerar:

autorização no backend;
isolamento por tenant;
RBAC;
permissões por ação;
validação de ownership;
proteção contra IDOR;
validação de transições;
auditoria.

Nunca confie apenas em:

if (user.role === 'ADMIN')

no frontend.

O frontend apenas controla UX.

A autorização real deve existir no backend.