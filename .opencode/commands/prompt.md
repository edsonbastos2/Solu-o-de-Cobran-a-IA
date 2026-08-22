# Implementação de Módulo de Chat para Sistema de Cobrança com IA

## Contexto

Estou desenvolvendo um sistema de cobrança inteligente no qual diferentes agentes de IA são responsáveis por executar etapas do processo de cobrança.

Preciso implementar um novo módulo de **chat/conversação entre o agente de IA responsável pela cobrança e o devedor**, permitindo que:

1. O agente de IA inicie e conduza a conversa com o devedor.
2. O devedor possa responder às mensagens.
3. A IA possa enviar novas mensagens automaticamente.
4. Um operador humano possa assumir a conversa a qualquer momento.
5. O operador humano possa devolver o controle para a IA quando desejar.
6. Todo o histórico da conversa seja preservado.
7. O operador consiga visualizar claramente quando a IA está conduzindo a negociação e quando um humano está conduzindo.
8. A experiência do operador seja semelhante à experiência de utilização de aplicativos modernos de mensagens, especialmente o WhatsApp.

O objetivo **não é copiar o WhatsApp**, mas utilizar conceitos de UX já conhecidos pelos usuários para reduzir a curva de aprendizado do operador.

---

# Stack obrigatória

Utilize as seguintes tecnologias:

* Next.js
* React
* TypeScript
* Tailwind CSS

Considere uma arquitetura moderna compatível com Next.js atual.

Priorize:

* Componentização
* Reutilização
* Separação de responsabilidades
* Tipagem forte com TypeScript
* Acessibilidade
* Responsividade
* Performance
* Manutenibilidade
* Escalabilidade

Não introduza bibliotecas adicionais sem justificar tecnicamente a necessidade.

---

# Objetivo principal

Criar uma interface de **Central de Conversas de Cobrança**.

A tela deve permitir que um operador consiga, de forma rápida:

* visualizar conversas;
* identificar devedores;
* visualizar mensagens;
* acompanhar negociações;
* identificar se a IA está conduzindo a conversa;
* assumir manualmente uma conversa;
* devolver a conversa para a IA;
* enviar mensagens;
* visualizar status das mensagens;
* consultar informações da dívida;
* acompanhar o contexto da negociação.

A experiência deve ser inspirada em aplicações de mensagens modernas.

---

# Estrutura da interface

Projete a tela utilizando uma estrutura semelhante a:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Header / Busca / Filtros / Usuário                                           │
├───────────────────┬──────────────────────────────────────┬───────────────────┤
│                   │                                      │                   │
│ Lista de          │         Conversação                  │ Contexto da       │
│ conversas         │                                      │ cobrança          │
│                   │                                      │                   │
│ 🔵 João Silva     │  Header da conversa                  │ Devedor           │
│    R$ 5.200       │                                      │                   │
│    IA conduzindo  │  Mensagens                           │ Dívida            │
│                   │                                      │                   │
│ 🟡 Maria Souza    │                                      │ Contrato          │
│    R$ 2.300       │                                      │                   │
│    Humano         │                                      │ Negociação        │
│                   │                                      │                   │
│ 🔴 Carlos         │                                      │ Histórico         │
│    R$ 8.900       │                                      │                   │
│    Aguardando     │                                      │                   │
│                   │                                      │                   │
│                   │  Campo de mensagem                    │                   │
│                   │  [Digite uma mensagem...] [Enviar]   │                   │
└───────────────────┴──────────────────────────────────────┴───────────────────┘
```

A interface deve ser responsiva.

Em telas menores, o painel lateral de informações pode ser recolhido.

---

# 1. Lista de conversas

Criar um componente reutilizável:

```text
ConversationList
```

Cada conversa deve apresentar:

* Avatar
* Nome do devedor
* Última mensagem
* Data/hora da última mensagem
* Status da conversa
* Valor da dívida
* Indicador de mensagens não lidas
* Indicador de quem está conduzindo:

  * IA
  * Humano
  * Aguardando resposta
  * Finalizada
  * Em negociação
  * Escalada

Exemplo:

```text
João Silva
"Consigo pagar R$ 800..."
Hoje, 10:32

R$ 5.200,00
🤖 IA conduzindo
```

Utilize estados visuais claros, mas evite excesso de cores.

---

# 2. Filtros das conversas

Criar filtros para:

* Todas
* Não lidas
* IA conduzindo
* Atendimento humano
* Aguardando devedor
* Aguardando operador
* Em negociação
* Finalizadas
* Escaladas

Também permitir:

* pesquisa por nome;
* CPF/CNPJ;
* número do contrato;
* número da cobrança;
* conteúdo da mensagem.

---

# 3. Área principal da conversa

Criar um componente:

```text
ChatWindow
```

O cabeçalho da conversa deve apresentar:

* Avatar
* Nome do devedor
* Status
* Canal utilizado
* Identificação do responsável atual

Exemplo:

```text
João Silva
● Online

🤖 IA de Cobrança
```

Quando um humano assumir:

```text
João Silva
● Online

👤 Atendimento: Edson
```

---

# 4. Mensagens

Criar componentes reutilizáveis:

```text
MessageList
MessageBubble
MessageStatus
MessageTimestamp
SystemMessage
```

As mensagens devem possuir diferenciação visual entre:

### Mensagem do devedor

```text
Consigo pagar metade esse mês.

                         10:31
```

### Mensagem enviada pela IA

```text
Entendi, João. Podemos avaliar uma
condição de pagamento para você.

10:32
🤖 IA
```

### Mensagem enviada por humano

```text
João, consegui uma condição especial
para você.

10:35
👤 Edson
```

### Mensagem de sistema

Exemplo:

```text
────────────────────────────
👤 Edson assumiu o atendimento
às 10:35
────────────────────────────
```

Outro exemplo:

```text
────────────────────────────
🤖 IA retomou o atendimento
às 11:02
────────────────────────────
```

Esses eventos devem fazer parte do histórico da conversa.

---

# 5. Identificação clara da IA

A interface precisa deixar extremamente claro quando a mensagem foi enviada pela IA.

Utilize:

```text
🤖 IA de Cobrança
```

ou um indicador equivalente.

Não faça a IA parecer um operador humano.

O operador precisa conseguir identificar rapidamente:

* quem enviou;
* quando enviou;
* qual agente enviou;
* se foi automático ou manual.

---

# 6. Intervenção humana

Essa é uma das funcionalidades mais importantes.

Criar um mecanismo de:

```text
Assumir conversa
```

Quando a IA estiver conduzindo:

```text
┌─────────────────────────────────────┐
│ 🤖 IA está conduzindo esta conversa │
│                                     │
│ [ Assumir atendimento ]             │
└─────────────────────────────────────┘
```

Ao clicar:

```text
Confirmar intervenção?

Ao assumir esta conversa, a IA será
pausada e você passará a conduzir
o atendimento.

[Cancelar] [Assumir conversa]
```

Após assumir:

```text
👤 Você está conduzindo esta conversa

[Devolver para IA]
```

---

# 7. Devolver para IA

Quando o humano estiver conduzindo:

```text
👤 Atendimento humano ativo

[Devolver para IA]
```

Ao clicar:

```text
Deseja devolver esta conversa para a IA?

A IA poderá continuar a negociação a partir
do contexto atual da conversa.

[Cancelar] [Devolver para IA]
```

Registrar esse evento no histórico.

---

# 8. Estado da conversa

Modele a interface considerando estados como:

```typescript
type ConversationStatus =
  | 'AI_ACTIVE'
  | 'HUMAN_ACTIVE'
  | 'WAITING_DEBTOR'
  | 'WAITING_OPERATOR'
  | 'NEGOTIATING'
  | 'ESCALATED'
  | 'COMPLETED'
  | 'CANCELLED'
```

Também considere separar:

```typescript
type ConversationController =
  | 'AI'
  | 'HUMAN'
```

Não misture esses dois conceitos.

Por exemplo:

* `status = NEGOTIATING`
* `controller = AI`

ou:

* `status = NEGOTIATING`
* `controller = HUMAN`

Isso deve ser refletido na arquitetura da aplicação.

---

# 9. Compositor de mensagens

Criar um componente:

```text
MessageComposer
```

Deve possuir:

* textarea;
* envio com Enter;
* quebra de linha com Shift + Enter;
* botão de enviar;
* contador de caracteres, se necessário;
* estado disabled;
* loading durante envio;
* tratamento de erro;
* possibilidade de anexos, deixando a arquitetura preparada para expansão futura.

Exemplo:

```text
┌───────────────────────────────────────────────┐
│ Digite uma mensagem...                       │
│                                               │
│                                   📎  [Enviar]│
└───────────────────────────────────────────────┘
```

---

# 10. Contexto da cobrança

Criar um painel lateral:

```text
DebtContextPanel
```

Esse painel deve mostrar informações importantes sem obrigar o operador a sair da conversa.

Exemplo:

```text
DEVEDOR

João Silva
CPF: ***.***.***-**

────────────────────

DÍVIDA

Valor original
R$ 8.500,00

Valor atualizado
R$ 9.240,00

Vencimento
10/06/2026

Dias em atraso
70 dias

────────────────────

CONTRATO

Contrato #12345

────────────────────

NEGOCIAÇÃO

Status:
Em negociação

Última proposta:
R$ 7.800,00

Parcelas:
12x

────────────────────

AÇÕES

[Ver contrato]
[Ver cobrança]
[Ver histórico]
```

---

# 11. Negociação

O chat deve estar preparado para suportar informações estruturadas de negociação.

Por exemplo:

```typescript
interface Negotiation {
  id: string
  conversationId: string
  originalAmount: number
  currentAmount: number
  proposedAmount?: number
  installments?: number
  installmentAmount?: number
  status: NegotiationStatus
}
```

Possíveis estados:

```typescript
type NegotiationStatus =
  | 'NONE'
  | 'IN_PROGRESS'
  | 'PROPOSAL_SENT'
  | 'COUNTER_PROPOSAL'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
```

A interface deve permitir futuramente apresentar cards estruturados dentro da conversa.

Exemplo:

```text
┌───────────────────────────────┐
│ PROPOSTA DE NEGOCIAÇÃO        │
│                               │
│ Valor: R$ 7.800,00            │
│ Parcelamento: 12x             │
│ Parcela: R$ 650,00            │
│                               │
│ Status: Aguardando resposta   │
└───────────────────────────────┘
```

---

# 12. Timeline de eventos

Além das mensagens, a arquitetura deve suportar eventos internos.

Exemplos:

```text
IA iniciou atendimento

Devedor respondeu

IA enviou proposta

Devedor recusou proposta

Operador assumiu atendimento

Operador enviou nova proposta

Devedor aceitou negociação

Negociação criada

Cobrança finalizada
```

Criar um conceito semelhante a:

```typescript
type ConversationEvent =
  | 'MESSAGE_SENT'
  | 'MESSAGE_RECEIVED'
  | 'AI_TAKEOVER'
  | 'HUMAN_TAKEOVER'
  | 'NEGOTIATION_CREATED'
  | 'PROPOSAL_SENT'
  | 'PROPOSAL_ACCEPTED'
  | 'PROPOSAL_REJECTED'
  | 'CONVERSATION_COMPLETED'
```

---

# 13. Arquitetura de componentes

Não crie um componente monolítico.

Sugestão:

```text
components/
└── conversations/
    ├── ConversationPage.tsx
    ├── ConversationList.tsx
    ├── ConversationListItem.tsx
    ├── ConversationFilters.tsx
    ├── ChatWindow.tsx
    ├── ChatHeader.tsx
    ├── MessageList.tsx
    ├── MessageBubble.tsx
    ├── MessageComposer.tsx
    ├── MessageStatus.tsx
    ├── SystemMessage.tsx
    ├── ConversationTakeover.tsx
    ├── NegotiationCard.tsx
    ├── DebtContextPanel.tsx
    ├── DebtorSummary.tsx
    └── ConversationTimeline.tsx
```

Avalie essa estrutura criticamente e altere-a caso exista uma arquitetura melhor.

Evite criar componentes apenas para fragmentar código sem necessidade.

---

# 14. Modelo de dados

Proponha interfaces TypeScript para:

```typescript
Conversation
Message
Debtor
Debt
Contract
Negotiation
ConversationEvent
AIAgent
Operator
```

Exemplo conceitual:

```typescript
interface Message {
  id: string
  conversationId: string
  content: string
  senderType: 'DEBTOR' | 'AI' | 'HUMAN' | 'SYSTEM'
  senderId?: string
  createdAt: string
  status: MessageStatus
}
```

Não limite a arquitetura ao exemplo acima.

Analise o domínio e proponha uma modelagem adequada.

---

# 15. Preparação para tempo real

A interface deve ser projetada considerando que as mensagens futuramente poderão chegar em tempo real.

Não implemente necessariamente WebSocket se isso não for necessário nesta etapa.

Porém, a arquitetura deve permitir posteriormente utilizar:

* WebSocket;
* SSE;
* Supabase Realtime;
* Pusher;
* outro mecanismo de realtime.

Evite criar componentes fortemente acoplados à forma como os dados chegam.

---

# 16. Integração com canais

O sistema poderá futuramente trabalhar com múltiplos canais:

```text
WhatsApp
Telegram
SMS
E-mail
Chat interno
```

Portanto, modele a mensagem considerando:

```typescript
type Channel =
  | 'WHATSAPP'
  | 'TELEGRAM'
  | 'SMS'
  | 'EMAIL'
  | 'INTERNAL'
```

A UI deve conseguir indicar o canal da conversa.

---

# 17. UX inspirada no WhatsApp

Utilize conceitos de UX conhecidos:

* lista de conversas;
* mensagens agrupadas;
* timestamp;
* status de mensagem;
* mensagens não lidas;
* busca;
* rolagem automática;
* campo de composição;
* cabeçalho fixo;
* contexto do contato;
* navegação rápida.

Porém:

**NÃO copie visualmente o WhatsApp.**

Crie uma identidade própria para o sistema de cobrança.

A interface deve parecer um produto SaaS profissional de cobrança, utilizando padrões de UX familiares ao operador.

---

# 18. Design System

Utilize Tailwind CSS.

Crie uma hierarquia visual consistente para:

* cores;
* espaçamentos;
* tipografia;
* bordas;
* radius;
* shadows;
* estados;
* badges;
* botões;
* inputs;
* dropdowns;
* dialogs.

Priorize uma interface:

* profissional;
* limpa;
* moderna;
* com alta densidade de informação;
* confortável para uso prolongado por operadores.

Evite:

* excesso de gradientes;
* excesso de animações;
* excesso de cores;
* cards desnecessários;
* sombras exageradas;
* elementos decorativos que prejudiquem a produtividade.

---

# 19. Responsividade

A interface precisa funcionar em:

* Desktop
* Notebook
* Tablet

No mobile, considere uma experiência diferente:

```text
Lista de conversas
        ↓
Conversa
        ↓
Informações da dívida
```

Não tente manter três colunas obrigatoriamente em telas pequenas.

---

# 20. Acessibilidade

Utilize boas práticas:

* HTML semântico;
* ARIA quando necessário;
* navegação por teclado;
* foco visível;
* labels;
* contraste adequado;
* estados de loading;
* estados de erro;
* mensagens acessíveis para leitores de tela.

---

# 21. Estados que devem ser tratados

Não implemente somente o estado "sucesso".

A interface precisa possuir:

### Loading

```text
Carregando conversas...
Carregando mensagens...
Enviando mensagem...
```

### Empty state

```text
Nenhuma conversa encontrada.
```

### Error state

```text
Não foi possível carregar as conversas.

[Tentar novamente]
```

### Offline

```text
Sem conexão.

Suas mensagens serão enviadas quando
a conexão for restabelecida.
```

### IA processando

```text
🤖 IA está analisando a conversa...
```

---

# 22. Segurança e permissões

Considere que nem todo operador necessariamente possui permissão para:

* assumir conversas;
* enviar mensagens;
* alterar negociações;
* devolver conversa para IA;
* finalizar cobrança.

A UI deve estar preparada para controle de permissões.

Exemplo:

```typescript
interface ConversationPermissions {
  canSendMessage: boolean
  canTakeOver: boolean
  canReturnToAI: boolean
  canEditNegotiation: boolean
  canCompleteConversation: boolean
}
```

---

# 23. Auditoria

Toda ação importante deve ser rastreável.

Considere eventos como:

```text
Quem assumiu a conversa?
Quando assumiu?
Quem devolveu para IA?
Quando devolveu?
Qual mensagem foi enviada?
Foi IA ou humano?
Qual operador alterou a negociação?
```

A UI deve deixar a arquitetura preparada para apresentar essas informações.

---

# 24. Performance

Considere que um operador poderá possuir centenas ou milhares de conversas.

A arquitetura deve considerar:

* paginação;
* virtualização da lista de mensagens quando necessário;
* lazy loading;
* debounce na busca;
* memoização quando realmente necessária;
* evitar renders desnecessários;
* carregamento incremental do histórico.

Não implemente otimizações prematuras sem necessidade.

---

# 25. Testes

Crie uma estratégia de testes utilizando:

* Vitest
* React Testing Library

Cubra principalmente:

### ConversationList

* renderização;
* seleção de conversa;
* filtros;
* busca;
* mensagens não lidas.

### ChatWindow

* renderização das mensagens;
* diferenciação entre IA, humano e devedor;
* mensagens do sistema;
* estados de loading;
* estados de erro.

### Takeover

* assumir conversa;
* confirmação;
* cancelamento;
* devolver para IA.

### MessageComposer

* envio;
* Enter;
* Shift + Enter;
* loading;
* disabled;
* erro.

### NegotiationCard

* proposta;
* aceite;
* rejeição;
* contraproposta.

---

# 26. Dados mockados

Como primeira etapa, não dependa de backend.

Crie mocks realistas para demonstrar:

* várias conversas;
* diferentes estados;
* mensagens da IA;
* mensagens do devedor;
* mensagens humanas;
* negociações;
* eventos;
* conversas finalizadas;
* conversas aguardando resposta.

Os mocks devem representar um cenário realista de cobrança.

---

# 27. Regras importantes

Não faça:

* componente gigante;
* lógica de negócio misturada com apresentação;
* valores hardcoded espalhados;
* tipos TypeScript genéricos demais;
* estados duplicados;
* componentes acoplados ao backend;
* lógica de IA dentro dos componentes visuais;
* lógica de negociação dentro do MessageBubble.

Separe claramente:

```text
UI
↓
Application Logic
↓
Domain
↓
Data/API
```

---

# 28. Entregáveis

Quero que você execute o trabalho seguindo esta ordem:

## Etapa 1 — Análise

Antes de escrever código:

1. Analise o problema.
2. Identifique os principais casos de uso.
3. Identifique os estados da conversa.
4. Identifique os atores:

   * Devedor
   * Agente IA
   * Operador humano
5. Proponha a arquitetura.

## Etapa 2 — UX

Defina:

* layout;
* navegação;
* estados;
* hierarquia visual;
* comportamento de takeover;
* comportamento de devolução para IA;
* experiência de negociação.

## Etapa 3 — Arquitetura

Defina:

* estrutura de pastas;
* componentes;
* interfaces TypeScript;
* hooks;
* services;
* mocks;
* gerenciamento de estado.

## Etapa 4 — Implementação

Implemente a interface completa utilizando:

* Next.js
* React
* TypeScript
* Tailwind CSS

## Etapa 5 — Testes

Implemente os testes dos principais componentes e fluxos.

## Etapa 6 — Code Review

Ao finalizar:

1. Revise o código.
2. Procure duplicações.
3. Procure componentes excessivamente grandes.
4. Procure problemas de tipagem.
5. Procure problemas de acessibilidade.
6. Procure problemas de UX.
7. Procure possíveis problemas de performance.
8. Sugira melhorias.

---

# Regra fundamental

Não quero apenas uma tela bonita.

Quero uma **arquitetura de produto real**, preparada para evoluir para uma central de atendimento omnichannel onde:

```text
                    ┌───────────────┐
                    │    Sistema    │
                    │   de cobrança │
                    └───────┬───────┘
                            │
                     ┌──────▼──────┐
                     │ Conversação │
                     └──────┬──────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
         ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
         │ Devedor │   │    IA   │   │ Humano  │
         └─────────┘   └─────────┘   └─────────┘
                            │             │
                            └──────┬──────┘
                                   │
                             Negociação
                                   │
                            ┌──────▼──────┐
                            │   Acordo    │
                            └─────────────┘
```

O principal objetivo é criar uma experiência na qual o operador consiga **assumir o controle da conversa sem perder o contexto**, enquanto a IA consegue **retomar a negociação exatamente de onde o humano parou**.

Antes de implementar, apresente sua proposta de arquitetura e UX. Depois implemente a solução completa.


# Requisito adicional — Multi-Tenant, Operadores e Transferência de Conversas

O sistema é **multi-tenant**.

Cada Tenant representa uma organização/empresa independente e pode possuir:

* vários operadores;
* diferentes perfis de acesso;
* diferentes permissões;
* diferentes agentes de IA;
* diferentes configurações de cobrança;
* diferentes canais de comunicação.

Um operador **NUNCA pode acessar ou manipular conversas pertencentes a outro tenant**.

Toda entidade relacionada à conversação deve respeitar o isolamento do tenant.

---

# 1. Hierarquia de acesso

Considere a seguinte estrutura:

```text
Tenant
│
├── Operadores
│   ├── Administrador
│   ├── Supervisor
│   ├── Operador
│   └── Outros perfis
│
├── Agentes de IA
│
├── Devedores
│
├── Contratos
│
├── Cobranças
│
└── Conversas
```

Uma conversa pertence a exatamente um Tenant.

```typescript
interface Conversation {
  id: string
  tenantId: string

  debtorId: string

  currentController: 'AI' | 'HUMAN'

  currentOperatorId?: string

  status: ConversationStatus

  channel: Channel

  createdAt: string
  updatedAt: string
}
```

---

# 2. Responsável atual pela conversa

Não trate `currentOperatorId` como histórico.

Ele representa apenas o **responsável humano atual**.

Exemplo:

```text
conversation.currentOperatorId
        │
        ▼
      Edson
```

Se Edson transferir a conversa para Maria:

```text
conversation.currentOperatorId
        │
        ▼
      Maria
```

Porém, o sistema deve preservar todo o histórico da transferência.

---

# 3. Histórico de atribuições

Crie uma entidade específica:

```typescript
interface ConversationAssignment {
  id: string

  tenantId: string

  conversationId: string

  assignedToOperatorId?: string

  assignedByOperatorId: string

  previousOperatorId?: string

  reason?: string

  createdAt: string
}
```

Isso permitirá responder perguntas como:

```text
Quem estava responsável anteriormente?

Quem transferiu a conversa?

Para quem foi transferida?

Quando ocorreu a transferência?

Qual era o motivo?

Quantas vezes essa conversa foi transferida?
```

---

# 4. Transferência de conversa

Um operador deve poder transferir uma conversa para outro operador do mesmo tenant.

Adicionar uma ação:

```text
[Transferir conversa]
```

Ao clicar, abrir um modal:

```text
┌───────────────────────────────────────┐
│ Transferir conversa                   │
├───────────────────────────────────────┤
│                                       │
│ Responsável atual                     │
│ 👤 Edson Bastos                       │
│                                       │
│ Transferir para                       │
│                                       │
│ [ 🔍 Buscar operador...           ▼ ] │
│                                       │
│ Motivo da transferência               │
│                                       │
│ [ Opcional                         ]  │
│                                       │
│                                       │
│ [Cancelar]       [Transferir]         │
└───────────────────────────────────────┘
```

---

# 5. Lista de operadores disponíveis

Ao abrir o seletor, apresentar somente operadores que:

1. pertencem ao mesmo tenant;
2. estão ativos;
3. possuem permissão para receber conversas;
4. possuem acesso ao tipo de cobrança/conversa;
5. não estejam bloqueados por alguma regra de negócio.

Exemplo:

```text
Buscar operador...

👤 Maria Souza
   Supervisora
   ● Disponível

👤 João Santos
   Operador
   ● Disponível

👤 Carlos Oliveira
   Operador
   ◐ Ocupado
```

Não permitir selecionar operadores de outro tenant.

---

# 6. Permissões

A transferência deve ser controlada por permissão.

Considere permissões como:

```typescript
interface ConversationPermissions {
  canViewConversation: boolean

  canSendMessage: boolean

  canTakeOverConversation: boolean

  canTransferConversation: boolean

  canTransferToAnyOperator: boolean

  canTransferToSupervisors: boolean

  canReturnConversationToAI: boolean

  canCompleteConversation: boolean
}
```

Por exemplo:

### Operador

Pode:

```text
Visualizar conversa
Enviar mensagens
Assumir conversa
Transferir conversa
```

Mas não necessariamente pode:

```text
Transferir para qualquer operador
Finalizar cobrança
Alterar determinadas condições da negociação
```

### Supervisor

Pode:

```text
Visualizar conversas da equipe
Assumir conversas
Transferir conversas
Transferir para qualquer operador
Acompanhar histórico
```

### Administrador

Possui acesso completo dentro do tenant.

Não presuma que esses perfis precisam existir exatamente dessa forma. Analise a arquitetura de autorização e proponha a melhor solução.

---

# 7. Conversa atribuída ao operador

Na lista de conversas, apresentar claramente quem é o responsável.

Exemplo:

```text
┌──────────────────────────────────────────┐
│ João Silva                               │
│ "Consigo pagar em duas parcelas..."      │
│                                          │
│ R$ 8.500,00                              │
│ 👤 Maria Souza                           │
│ ● Em negociação                          │
└──────────────────────────────────────────┘
```

Quando a conversa estiver sendo conduzida pela IA:

```text
┌──────────────────────────────────────────┐
│ João Silva                               │
│ "Consigo pagar em duas parcelas..."      │
│                                          │
│ R$ 8.500,00                              │
│ 🤖 IA de Cobrança                        │
│ ● Aguardando resposta                    │
└──────────────────────────────────────────┘
```

---

# 8. Transferência deve gerar evento de sistema

Toda transferência deve gerar um evento no histórico.

Exemplo:

```text
──────────────────────────────────────────

👤 Edson transferiu o atendimento

De:
Edson Bastos

Para:
Maria Souza

Motivo:
"Cliente solicitou negociação especial"

Hoje, 10:42

──────────────────────────────────────────
```

Esse evento não deve ser tratado como uma mensagem comum.

Ele deve possuir um tipo específico:

```typescript
type ConversationEventType =
  | 'MESSAGE_SENT'
  | 'MESSAGE_RECEIVED'
  | 'AI_TAKEOVER'
  | 'HUMAN_TAKEOVER'
  | 'TRANSFERRED'
  | 'NEGOTIATION_CREATED'
  | 'PROPOSAL_SENT'
  | 'PROPOSAL_ACCEPTED'
  | 'PROPOSAL_REJECTED'
  | 'CONVERSATION_COMPLETED'
```

---

# 9. Transferência e IA

É importante diferenciar:

### Conversa controlada pela IA

```text
controller = AI
currentOperatorId = null
```

### Conversa controlada por humano

```text
controller = HUMAN
currentOperatorId = "operator-123"
```

### Transferência entre humanos

Edson:

```text
controller = HUMAN
currentOperatorId = edsonId
```

Após transferência:

```text
controller = HUMAN
currentOperatorId = mariaId
```

A IA permanece pausada.

Não iniciar a IA automaticamente apenas porque houve uma transferência.

---

# 10. Transferência para outro operador

Quando Edson transferir para Maria:

```text
Antes:

IA
 ↓
Edson
 ↓
Conversa
```

Depois:

```text
IA pausada
 ↓
Maria
 ↓
Conversa
```

A conversa deve permanecer no mesmo contexto.

Não criar uma nova conversa.

Não duplicar mensagens.

Não criar uma nova negociação.

Não perder o histórico.

---

# 11. Transferência e notificações

Ao transferir uma conversa, o operador destinatário deve receber uma indicação de nova atribuição.

Exemplo:

```text
🔔 Nova conversa atribuída

João Silva foi atribuído a você.

Última mensagem:
"Consigo pagar em duas parcelas."

[Ver conversa]
```

A arquitetura deve permitir posteriormente implementar:

* notificações in-app;
* push;
* e-mail;
* WhatsApp interno;
* outros mecanismos.

Não acople a implementação da UI a um mecanismo específico de notificação.

---

# 12. Filtragem por operador

A lista de conversas deve permitir filtros como:

```text
Minhas conversas
Conversas da equipe
Não atribuídas
Com IA
Em negociação
Aguardando devedor
Aguardando operador
Finalizadas
```

Para supervisores/administradores:

```text
Responsável:

[Todos]
[Edson]
[Maria]
[João]
[Não atribuídas]
[IA]
```

Um operador sem permissão para visualizar conversas da equipe deve visualizar apenas as conversas às quais possui acesso.

---

# 13. Conversas não atribuídas

Deve existir suporte para conversas sem operador humano.

Exemplo:

```typescript
{
  controller: 'HUMAN',
  currentOperatorId: null
}
```

Isso representa:

```text
Aguardando atribuição
```

A UI deve permitir que operadores autorizados assumam essa conversa.

Exemplo:

```text
┌─────────────────────────────────────┐
│ Conversa sem responsável            │
│                                     │
│ [Assumir conversa]                  │
└─────────────────────────────────────┘
```

---

# 14. Regras de negócio da transferência

Antes de executar a transferência, valide:

```text
1. O operador atual possui permissão?
2. A conversa pertence ao mesmo tenant?
3. O operador destinatário pertence ao mesmo tenant?
4. O operador destinatário está ativo?
5. O operador destinatário possui permissão para essa conversa?
6. A conversa está em um estado que permite transferência?
7. Existe alguma regra de negócio impedindo a transferência?
```

A validação deve existir no backend.

A UI deve apenas refletir as permissões.

**Nunca confiar somente na autorização do frontend.**

---

# 15. Concorrência

Considere o seguinte cenário:

```text
Edson ───────┐
             ├── tenta transferir → Maria
João ────────┘
```

Ou:

```text
Edson está atendendo

Maria abre a mesma conversa

Edson transfere para João
```

A arquitetura deve evitar inconsistências de atribuição.

Considere mecanismos como:

* optimistic concurrency;
* versionamento da conversa;
* controle transacional;
* validação do responsável atual;
* idempotência da operação.

Exemplo conceitual:

```typescript
transferConversation({
  conversationId,
  fromOperatorId,
  toOperatorId,
  expectedVersion
})
```

Se a versão mudou:

```text
A conversa foi alterada por outro operador.
Atualize a conversa antes de tentar novamente.
```

---

# 16. Auditoria

A transferência deve ser auditável.

Registrar:

```typescript
interface ConversationTransferAudit {
  id: string
  tenantId: string
  conversationId: string

  fromOperatorId?: string
  toOperatorId: string

  performedByOperatorId: string

  reason?: string

  createdAt: string
}
```

Nunca confiar apenas no histórico visual da conversa para auditoria.

A auditoria deve possuir persistência própria.

---

# 17. Modelo conceitual final

A arquitetura deve considerar:

```text
Tenant
 │
 ├── Operators
 │      │
 │      └── Permissions
 │
 ├── AI Agents
 │
 ├── Debtors
 │
 ├── Contracts
 │
 ├── Debts
 │
 └── Conversations
          │
          ├── Messages
          │
          ├── Events
          │
          ├── Negotiations
          │
          ├── Assignments
          │
          └── Audit
```

A relação de responsabilidade deve ser:

```text
Conversation
      │
      ├── controller = AI
      │       └── AI Agent
      │
      └── controller = HUMAN
              └── Current Operator
```

E o histórico:

```text
Conversation
      │
      └── Assignments
            ├── IA
            ├── Edson
            ├── Maria
            ├── João
            └── ...
```

---

# 18. Requisito fundamental de multi-tenancy

Considere esta regra como **não negociável**:

> Nenhum operador, agente de IA ou usuário pode visualizar, consultar, transferir ou manipular uma conversa que pertença a outro tenant, independentemente do ID recebido pelo frontend.

A autorização deve ser validada no backend/API e, caso seja utilizado banco com suporte a Row Level Security, considerar também políticas de isolamento por `tenant_id`.

O frontend nunca deve ser responsável pela segurança do isolamento entre tenants.

---

# 19. UX final esperada

O operador deve conseguir realizar o fluxo:

```text
1. Recebe/abre uma conversa
          ↓
2. Visualiza o contexto da dívida
          ↓
3. Verifica que a IA está conduzindo
          ↓
4. Decide assumir a conversa
          ↓
5. IA é pausada
          ↓
6. Operador negocia com o devedor
          ↓
7. Decide transferir para outro operador
          ↓
8. Seleciona o operador
          ↓
9. Informa o motivo
          ↓
10. Confirma transferência
          ↓
11. Novo operador recebe a conversa
          ↓
12. Todo o histórico permanece disponível
          ↓
13. Novo operador continua a negociação
```

O sistema deve fazer com que essa transferência pareça **natural e instantânea**, semelhante à transferência de atendimento em uma central de atendimento profissional.

---

# 20. Critério de aceite

Considere a funcionalidade pronta somente quando:

* [ ] O sistema respeita isolamento por tenant.
* [ ] Um tenant pode possuir múltiplos operadores.
* [ ] Operadores possuem permissões diferentes.
* [ ] A UI respeita as permissões.
* [ ] O backend deve ser considerado a autoridade final de autorização.
* [ ] Uma conversa possui um responsável atual.
* [ ] É possível assumir uma conversa.
* [ ] É possível transferir uma conversa.
* [ ] É possível transferir para outro operador do mesmo tenant.
* [ ] Operadores sem permissão não conseguem realizar transferência.
* [ ] Operadores de outro tenant nunca aparecem como opção.
* [ ] A transferência mantém todo o histórico.
* [ ] A negociação permanece intacta.
* [ ] A IA permanece pausada durante atendimento humano.
* [ ] A transferência gera evento de sistema.
* [ ] Existe histórico de atribuições.
* [ ] Existe auditoria da transferência.
* [ ] O operador destinatário pode ser notificado.
* [ ] Conversas não atribuídas podem ser assumidas por operadores autorizados.
* [ ] Existem estados de loading, erro e sucesso.
* [ ] O fluxo possui testes automatizados.
* [ ] O código está componentizado.
* [ ] A solução está preparada para realtime.
* [ ] A solução está preparada para múltiplos canais.
