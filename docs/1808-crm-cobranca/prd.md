# PRD: CRM de Cobrança — Visão Kanban Operacional dos Casos

## Visão Geral

Operadores de cobrança trabalham hoje com uma lista tabular de casos (`/cases`) que não expressa onde cada negociação está no funil, quem é responsável por ela nem o que precisa acontecer a seguir. A distribuição de casos entre a equipe é invisível e a movimentação do processo de cobrança não tem histórico próprio.

O CRM de Cobrança é um módulo que dá aos operadores, gestores e administradores do tenant uma **visão operacional em Kanban dos casos de cobrança existentes** — não uma nova entidade. Cada card do Kanban é um caso real, com cliente, contrato, títulos financeiros, conversas, negociações e agente IA associados. O operador arrasta o caso entre as etapas do funil, transfere casos entre operadores, acompanha indicadores e abre a conversa com o devedor sem sair do contexto.

Valor: concentra a operação de cobrança humana em um único fluxo de trabalho visual, com rastreabilidade completa (quem moveu, quando, de onde para onde) e isolamento rigoroso entre tenants — base para métricas de produtividade, SLA e conversão por etapa no futuro.

## Objetivos

- Permitir que operadores visualizem e trabalhem seus casos em um quadro Kanban organizado pelas etapas do processo de cobrança.
- Garantir que toda mudança de etapa seja uma operação de domínio validada (tenant, usuário, permissão, posse, transição permitida), registrada em histórico e auditoria — nunca apenas visual.
- Permitir associação e transferência de casos entre operadores com registro completo (quem transferiu, de quem, para quem, motivo opcional).
- Respeitar o escopo de acesso: operador vê e age apenas nos seus casos; gestor/admin/owner veem e agem em todos os casos do tenant.
- Integrar o Kanban à Central de Conversas existente (chat, takeover IA→humano, transferência) sem duplicar implementação.
- Fornecer indicadores básicos por operador/equipe que respeitem o escopo de acesso do usuário.
- Manter o isolamento multi-tenant verificado no backend a partir do contexto autenticado — nunca confiado a parâmetros do frontend.

## Histórias de Usuário

**Operador**
- Como operador, quero ver meus casos distribuídos em colunas por etapa do funil, para que eu saiba em que pé está cada negociação e o que fazer a seguir.
- Como operador, quero arrastar um caso meu para a etapa seguinte, para que a movimentação fique registrada sem burocracia.
- Como operador, quero transferir um caso meu para outro operador com motivo, para que o caso siga com quem pode atendê-lo.
- Como operador, quero clicar em um card e ver os detalhes do caso (cliente, dívida, negociações, conversas, histórico), para que eu negocie com contexto completo.
- Como operador, quero abrir a conversa do caso com um clique, para que eu fale com o devedor pela Central de Conversas sem procurar o caso de novo.
- Como operador, quero ver no card se o caso está com IA ou com humano, para que eu saiba quando devo assumir.

**Gestor/Admin/Owner**
- Como gestor, quero ver todos os casos do tenant no Kanban e filtrar por operador, para que eu distribua e acompanhe a carga da equipe.
- Como gestor, quero mover e transferir qualquer caso, para que eu corrija a distribuição e destrave negociações.
- Como gestor, quero indicadores (casos por etapa, negociações, promessas, valor recuperado) do tenant, para que eu acompanhe a operação sem relatório manual.
- Como gestor, quero ver o histórico de movimentação de um caso, para que eu entenda a jornada da negociação.

**Plataforma (super-admin)**
- Como super-admin, quero acessar o Kanban de um tenant específico sob minha visão de administração, para que eu dê suporte respeitando o isolamento entre tenants.

## Funcionalidades Principais

### 1. Quadro Kanban por etapas do CRM
Colunas fixas definidas pelo produto nesta entrega: **NOVO → EM_CONTATO → EM_NEGOCIACAO → AGUARDANDO_PAGAMENTO → PAGAMENTO_CONFIRMADO → NEGOCIACAO_CONCLUIDA**, mais colunas de exceção: **SEM_CONTATO, NEGOCIACAO_RECUSADA, PROMESSA_NAO_CUMPRIDA, ESCALADO, ENCERRADO**. As etapas e transições permitidas são regra de domínio — nenhum componente de UI conhece as regras. A arquitetura das etapas deve permitir, no futuro, configuração por tenant.

### 2. Movimentação de etapa como operação de domínio
Arrastar um card dispara uma operação de API que valida: tenant (do contexto autenticado), usuário e permissão (operador: apenas casos seus; gestor+: qualquer caso do tenant), posse do caso pelo tenant e transição permitida. A operação atualiza a etapa, registra o histórico de movimentação (de, para, quem, quando, motivo opcional), grava auditoria com estado anterior/novo e sincroniza o status atual do caso por regra de correspondência explícita (ex.: NEGOCIACAO_CONCLUIDA/ENCERRADO → `closed`). Transições proibidas são rejeitadas no backend com mensagem clara (o frontend apenas previne visualmente).

### 3. Histórico de movimentação de etapa
Toda mudança de etapa gera registro imutável (caso, tenant, etapa de origem, etapa de destino, autor, motivo opcional, data/hora), exibido na linha do tempo do caso. Esse histórico é a base futura de métricas de tempo por etapa, conversão e SLA.

### 4. Atribuição e transferência entre operadores
O caso possui um operador responsável (conceito já existente). O CRM permite atribuir/transferir casos entre operadores do tenant, registrando quem realizou, operador anterior, novo operador, motivo opcional e data — reutilizando e estendendo o mecanismo de transferência da Central de Conversas (o contexto da conversa acompanha o caso). O Kanban é atualizado em tempo real para os outros operadores.

### 5. Card do caso
Card enxuto com: número do caso, indicador visual de prioridade, nome do cliente, documento mascarado, valor da dívida, data de vencimento, último contato, indicador de atendimento (IA 🤖 / humano 👤) e operador responsável (quando visível para gestores). Ações rápidas: abrir detalhes, abrir conversa, mover etapa, transferir. Informações detalhadas ficam na tela de detalhes.

### 6. Detalhes do caso
Reutiliza e enriquece a tela de detalhes existente do caso, agora também com: etapa atual do CRM, prioridade, operador responsável, ações (abrir conversa, transferir, mover etapa) e linha do tempo de movimentação de etapa junto ao histórico/auditoria existente. Não cria tela duplicada.

### 7. Filtros reutilizáveis
Componentes de filtro dedicados: operador (para gestores), etapa, prioridade e busca (nome do cliente, CPF/CNPJ, número do caso). Busca é resolvida no servidor. Filtros são componentes compostos, não embutidos no board.

### 8. Paginação por coluna
Cada coluna carrega um lote inicial de casos com "carregar mais" — o board nunca assume que todos os casos estão no cliente. Contagem de casos por coluna reflete o total real.

### 9. Dashboard de indicadores
Indicadores no topo do CRM respeitando o escopo de acesso: total de casos, casos em negociação, casos aguardando pagamento, negociações realizadas, negociações convertidas, promessas de pagamento, pagamentos confirmados e valor recuperado.

### 10. Integração com a Central de Conversas
"Abrir conversa" leva à conversa do caso na Central existente, com takeover IA→humano quando aplicável. Indicador IA/humano no card reflete o controlador atual do caso. A intervenção humana já é registrada pelo mecanismo existente — o CRM não duplica.

### 11. Tempo real e concorrência
O Kanban é atualizado automaticamente quando outro operador move/transfere casos (reutilizando Supabase Realtime). Mudanças concorrentes são detectadas: se o caso mudou desde a visualização (ex.: transferido por outro usuário), a movimentação é rejeitada com mensagem clara orientando atualizar o board — nunca sobrescreve silenciosamente.

### 12. Prioridade do caso
Prioridade manual simples (alta/média/baixa) atribuída ao caso, visível no card, usável como filtro e editável por operadores no seu caso e gestores em qualquer caso.

## Experiência do Usuário

1. Operador abre **CRM** no menu → vê seus indicadores, filtros e o quadro com seus casos por etapa.
2. Arrasta um card de EM_NEGOCIACAO para AGUARDANDO_PAGAMENTO → o board atualiza otimisticamente; em erro (permissão, transição inválida, conflito), o card volta ao lugar com mensagem explicativa.
3. Clica no card → vê detalhes completos, histórico e ações.
4. "Abrir conversa" → Central de Conversas com o caso carregado; assume da IA quando fizer sentido (takeover existente).
5. "Transferir" → diálogo para escolher operador e motivo → caso muda de responsável no board de todos, com registro de quem transferiu.
6. Gestor filtra por operador para revisar carga da equipe e reorganiza casos conforme necessário.

**Acessibilidade**: drag-and-drop com alternativa por teclado/ação de menu ("mover para etapa..."), foco visível e feedback textual — mover caso nunca depende exclusivamente do mouse.

## Restrições Técnicas de Alto Nível

- Isolamento multi-tenant obrigatório em toda consulta e mutação, com tenant derivado do contexto autenticado (backend); frontend nunca envia tenant confiável.
- Autorização real no backend por role e posse do caso; o frontend controla apenas UX.
- Toda ação relevante audita quem/o quê/quando/caso/tenant com estado anterior e novo, reutilizando o mecanismo de auditoria existente.
- Nenhuma regra de transição de etapa implementada apenas no frontend.
- Integração com chat exclusivamente via Central de Conversas existente.
- Performance: busca e filtros server-side; paginação por coluna.

## Non-Goals (Fora do Escopo)

- Etapas configuráveis por tenant, transições customizáveis por tenant e UI de configuração de pipeline (futura Fase 2).
- Filtros por campanha, canal, faixa de valor, data de vencimento e último contato (campanha nem está vinculada a casos hoje).
- Notificações in-app/e-mail/push (eventos ficam registrados; entrega de notificação é fase futura).
- Métricas avançadas por etapa (tempo médio, SLA, conversão), relatórios e produtividade por operador.
- Automações disparadas por mudança de etapa (ex.: régua de contato por etapa).
- Mobile dedicado; substituição da lista de casos existente.

## Plano de Rollout Faseado

### MVP (Fase 1) — esta entrega
Kanban em `/crm` com etapas fixas e transições validadas no backend; movimentação com histórico e auditoria; sincronização etapa↔status; atribuição/transferência com registro; card, detalhes enriquecidos, filtros (operador, etapa, prioridade, busca), paginação por coluna, dashboard de indicadores, realtime e prioridade manual.
**Critérios de sucesso**: operador consegue trabalhar seu dia a dia 100% pelo CRM (visualizar, mover, transferir, abrir conversa, ver indicadores); nenhuma mutação sem auditoria; operador nunca vê caso de outro tenant ou de outro operador.

### Fase 2
Etapas configuráveis por tenant; notificações (in-app, e-mail); métricas por etapa (tempo médio, conversão, SLA); filtros ampliados (valor, vencimento, último contato, campanha).

### Fase 3
Automações por mudança de etapa; relatórios de produtividade por operador/equipe; distribuição automática de casos.

## Métricas de Sucesso

- **Adoção**: % de casos ativos movimentados ao menos uma vez via Kanban em 30 dias após rollout.
- **Engajamento operacional**: movimentações de etapa por operador/dia; uso da transferência entre operadores.
- **Tempo até primeira ação**: intervalo médio entre criação do caso e primeira movimentação de etapa.
- **Integridade**: 100% das mudanças de etapa com histórico e auditoria; zero incidentes de vazamento cross-tenant.
- **Qualidade**: taxa de erro de movimentação (conflito/permissão) com feedback claro ao operador.

## Riscos e Mitigações

- **Resistência à mudança** (operadores perdiam visão de todos os casos): visão restrita vale apenas para o CRM; a lista `/cases` mantém o comportamento atual durante a transição.
- **Confusão etapa × status**: regra de correspondência explícita e centralizada; comunicação de que o Kanban é a visão operacional e o status alimenta automações/relatórios existentes.
- **Sobrecarga do board** com carteiras grandes: paginação por coluna, busca server-side e contagem real desde o MVP.
- **Operação concorrente** gerando fricção (caso movido por outro operador): detecção de conflito com mensagem orientando atualização, padrão já validado na Central de Conversas.

## Registros de Decisão de Arquitetura

- [ADR-001: Kanban operacional sobre os casos existentes com etapa CRM própria sincronizada](adrs/adr-001.md) — CRM é visão operacional dos casos; etapa nova com transições de domínio e sincronização com o status atual; reuso de conversas, permissões, auditoria e realtime.

## Questões Abertas

- A etapa inicial padrão de casos existentes e novos (proposta: NOVO, com migração de casos `not_started`).
- Se a lista `/cases` deve, no futuro, ganhar filtro por etapa do CRM (fase 2, após consolidação).
- Se operadores podem mover casos entre etapas de exceção livremente ou se algumas exigem papel de gestor (proposta MVP: operador move livremente nos seus casos, inclusive exceções).
