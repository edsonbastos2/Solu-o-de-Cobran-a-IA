# PRD: Central de Conversas de Cobrança

## Visão Geral

Hoje o operador precisa abrir cada caso individualmente (`/cases/[id]`) para ver o chat com o devedor — não existe nenhuma visão consolidada de conversas. Esta funcionalidade introduz a **Central de Conversas**, um módulo novo na seção Operação onde o operador vê todas as conversas de cobrança do tenant num único lugar, com experiência inspirada em aplicativos modernos de mensagens: lista de conversas com última mensagem, filtros, busca, chat em tempo real, painel de contexto da dívida e — o mais importante — **assumir/devolver o controle da conversa entre IA e humano** e **transferir conversas entre operadores**, sem perder contexto nem histórico.

A conversa é modelada como o caso de cobrança existente enriquecido (ADR-001): todo o pipeline de IA, canais (WhatsApp/Telegram) e histórico de mensagens permanecem intactos.

Público-alvo: operadores, gestores e administradores do tenant que conduzem negociações de cobrança com apoio de agentes de IA.

## Objetivos

- Eliminar a navegação caso-a-caso: toda conversa do tenant visível, filtrável e buscável em uma única tela.
- Tornar explícito e auditável **quem conduz cada conversa** (IA ou humano), separando esse conceito do status operacional da cobrança.
- Permitir que o operador **assuma a conversa** (IA pausa), **devolva para a IA** (que retoma do ponto exato) e **transfira para outro operador** do mesmo tenant, com histórico e auditoria completos.
- Indicar mensagens **não lidas** por conversa, por operador.
- Remover o chat da página de detalhe do caso (que vira hub de contexto), tornando a Central o lar único da conversa — sem duplicação.
- Preparar a arquitetura para realtime e múltiplos canais sem acoplar a UI ao mecanismo.

## Histórias de Usuário

**Operador (tenant_members.role = operador)**
- Como operador, quero ver a lista de todas as conversas do tenant com última mensagem, valor da dívida e quem conduz, para priorizar meu atendimento sem abrir caso por caso.
- Como operador, quero filtrar por não lidas, IA conduzindo, atendimento humano, aguardando devedor e aguardando operador, para focar no que precisa de ação.
- Como operador, quero buscar por nome do devedor, documento, contrato, número da cobrança ou conteúdo de mensagem, para localizar rapidamente uma conversa.
- Como operador, quero assumir uma conversa que a IA está conduzindo (com confirmação), para intervir quando julgar necessário — e quero que a IA fique pausada enquanto eu conduzo.
- Como operador, quero devolver a conversa para a IA com confirmação, para que ela continue a negociação a partir do contexto atual.
- Como operador, quero enviar mensagens na conversa (Enter envia, Shift+Enter quebra linha), com indicação de envio/falha, como em apps de mensagens.
- Como operador, quero ver claramente qual mensagem foi enviada pela IA, por humano ou pelo devedor, e quando, para nunca confundir quem falou.
- Como operador, quero ver o contexto da dívida (devedor, valores, vencimento, atraso, contrato, negociação) ao lado do chat, sem sair da conversa.
- Como operador que recebeu uma conversa transferida, quero vê-la destacada na minha lista, para saber que há nova atribuição me aguardando.

**Gestor (role = gestor)**
- Como gestor, quero tudo que o operador tem, mais transferir conversas para qualquer operador do tenant, com motivo opcional, para distribuir o atendimento.
- Como gestor, quero filtrar por responsável (todos, operadores específicos, não atribuídas, IA), para acompanhar a carga da equipe.
- Como gestor, quero ver o histórico de atribuições e eventos de uma conversa, para auditar quem fez o quê e quando.

**Administrador/Owner (role = admin/owner)**
- Como administrador, quero acesso completo às conversas do tenant, incluindo finalizar conversas/cobranças, para controle total da operação.

**Devedor (indireto)**
- Como devedor, quero que minha conversa continue no mesmo canal (WhatsApp/Telegram) e no mesmo histórico, mesmo quando um humano assumir ou a conversa for transferida, para não perceber interrupção.

## Funcionalidades Principais

### P0: Lista de conversas (`/conversations`)
- Lista com avatar, nome do devedor, última mensagem, data/hora, valor da dívida, canal, badge de não lidas e indicador de quem conduz (🤖 IA / 👤 operador responsável / sem responsável).
- Ordenação por atividade mais recente.
- Item de navegação "Conversas" na sidebar (seção Operação).

### P0: Filtros e busca
- Filtros: Todas, Não lidas, IA conduzindo, Atendimento humano, Aguardando devedor, Aguardando operador, Em negociação, Finalizadas, Minhas conversas.
- Para gestor/admin: filtro por responsável (Todos / operadores / Não atribuídas / IA).
- Busca com debounce por: nome, CPF/CNPJ, número do contrato, número da cobrança, conteúdo de mensagem.

### P0: Janela de conversa (chat)
- Cabeçalho com avatar, nome, status, canal e responsável atual (IA ou operador).
- Histórico completo com bolhas diferenciadas: devedor (esquerda), IA e humano (direita, com identificação de quem enviou), mensagens de sistema centralizadas.
- Mensagens de sistema para eventos: humano assumiu, devolveu para IA, transferência (de/para/motivo), negociação criada, proposta aceita/recusada, conversa finalizada.
- Atualização em tempo real (realtime/polling já existentes), rolagem automática para a última mensagem.
- Link para o caso completo (hub de contexto).

### P0: Compositor de mensagens
- Textarea com Enter para enviar, Shift+Enter para quebra de linha, botão enviar, loading durante envio, estado disabled e tratamento de erro com retry.
- Indicação de status da mensagem (enviando, enviada, falha).

### P0: Assumir conversa (takeover)
- Banner "IA está conduzindo" com botão **Assumir atendimento** + confirmação ("a IA será pausada e você passará a conduzir").
- Após assumir: banner "Você está conduzindo" com botão **Devolver para IA** + confirmação ("a IA continuará a partir do contexto atual").
- Eventos de sistema registrados no histórico; atribuição auditada.
- Conversa `controller=HUMAN` sem responsável aparece como "aguardando atribuição" e pode ser assumida por operador autorizado.

### P0: Devolver para IA
- Confirmado em modal; IA retoma exatamente de onde o humano parou (contexto preservado); evento de sistema registrado.

### P0: Transferência entre operadores
- Ação "Transferir conversa" (gestor/admin): modal com responsável atual, seletor de operadores do mesmo tenant (ativos, com permissão) e motivo opcional.
- Validações no backend (permissão, tenant, estado da conversa, concorrência — responsável atual esperado).
- Gera evento de sistema (de → para → motivo) e registro de auditoria; conversa destacada para o destinatário.
- IA permanece pausada em transferência entre humanos; histórico, mensagens e negociação intactos.

### P0: Não lidas
- Badge de não lidas por conversa na lista + filtro "Não lidas".
- Marcação como lida ao abrir a conversa (por operador).

### P1: Painel de contexto da dívida
- Coluna lateral recolhível com: devedor (nome, documento mascarado), dívida (valor original/atualizado, vencimento, dias em atraso), contrato, negociação (status, última proposta, parcelas) e ações rápidas (ver contrato, ver cobrança/caso, ver histórico).

### P1: Notificação de nova atribuição
- Conversa transferida aparece com destaque "Nova atribuição" na lista do destinatário (in-app, na Central). Sem push/e-mail no MVP.

## Experiência do Usuário

**Fluxo primário (operador):**
1. Operador abre "Conversas" na sidebar.
2. Vê a lista ordenada por atividade, com badges de não lidas e condutor de cada conversa.
3. Filtra "Aguardando operador" e abre uma conversa.
4. Lê o histórico (IA, devedor, eventos de sistema), consulta o painel de contexto da dívida.
5. Assume o atendimento (confirmação → IA pausa → evento de sistema).
6. Negocia com o devedor pelo composer.
7. Devolve para a IA (confirmação → evento de sistema) ou o gestor transfere para outro operador.

**Layout:** três colunas no desktop (lista | conversa | contexto), contexto recolhível em telas menores; em mobile, navegação em pilha: lista → conversa → informações da dívida. Não manter três colunas em telas pequenas.

**Identidade visual:** produto SaaS profissional de cobrança — denso, limpo, confortável para uso prolongado. UX familiar de apps de mensagens (lista, bolhas, timestamps, status, não lidas), **sem copiar visualmente o WhatsApp**.

**Estados obrigatórios:** loading (conversas, mensagens, envio), empty state ("Nenhuma conversa encontrada"), erro com retry ("Não foi possível carregar..."), IA processando ("🤖 IA está analisando a conversa..."), conversa sem canal vinculado (mensagem fica registrada como histórico, como hoje).

**Acessibilidade:** HTML semântico, ARIA onde necessário, navegação por teclado (lista e composer), foco visível, labels, contraste adequado, estados de loading/erro anunciados para leitores de tela.

## Restrições Técnicas de Alto Nível

- Multi-tenant **não negociável**: nenhum operador acessa, transfere ou manipula conversa de outro tenant; backend é a autoridade final de autorização (validação no API + RLS por `tenant_id`).
- Permissões derivadas dos perfis existentes (`owner > admin > gestor > operador` em `tenant_members`): operador vê/envia/assume; gestor também transfere e vê equipe; admin/owner completos.
- Todo envio de mensagem ao devedor continua passando pelo serviço único de canais (`sendCaseMessage`) — nunca acoplar a UI aos adapters de canal.
- A UI não deve acoplar-se ao mecanismo de chegada de mensagens (deve permitir evoluir para WebSocket/SSE/Realtime).
- Auditoria persistida (não apenas eventos visuais na conversa) para toda ação importante: quem assumiu/devolveu/transferiu, quando, para quem, por quê.
- Separação de camadas: UI → lógica de aplicação (hooks) → domínio → dados/API. Sem lógica de IA ou negociação dentro de componentes visuais.

## Fora do Escopo (Non-Goals)

- Notificações push, e-mail e toast global (apenas destaque in-app na Central no MVP).
- Sistema granular de permissões por conversa (usa perfis existentes).
- Criação de novas conversas manuais na Central (conversas nascem dos casos existentes).
- Múltiplas conversas por caso.
- Anexos no composer (apenas arquitetura preparada).
- Cards estruturados de proposta de negociação dentro do chat (futuro; arquitetura preparada).
- Virtualização da lista de mensagens (paginação/carregamento incremental apenas se necessário).
- Novos canais além dos existentes (WhatsApp/Telegram).
- Tempo real via WebSocket dedicado (realtime do Supabase/polling já existentes bastam).

## Plano de Entrega por Fases

### MVP (Fase 1)
- Lista de conversas com filtros, busca, não lidas e indicador de condutor.
- Janela de conversa completa (histórico, eventos de sistema, realtime).
- Composer com estados de envio.
- Assumir conversa / devolver para IA (com confirmações e eventos).
- Transferência entre operadores (gestor/admin) com histórico de atribuições e auditoria.
- Painel de contexto da dívida (P1 incluído por ser central para "não perder contexto").
- Testes automatizados (Vitest + React Testing Library) dos componentes e fluxos principais.
- **Critério para avançar:** operador completa o fluxo receber → ler contexto → assumir → negociar → devolver/transferir sem sair da Central e sem perder histórico.

### Fase 2
- Cards estruturados de proposta de negociação no chat.
- Notificações in-app mais amplas (toast, badge no menu) e por e-mail.
- Filtros salvos, atalhos de teclado, atalhos de mensagens rápidas (templates existentes).
- Métricas de atendimento por operador (tempo de resposta, taxa de acordo).

### Fase 3
- Múltiplos canais adicionais (e-mail, SMS) e enriquecimento do indicador de canal.
- Virtualização para milhares de conversas/mensagens.
- Distribuição automática de conversas (filas e regras por carga/perfil).

## Métricas de Sucesso

- **Adoção:** 100% das interações de chat de operadores migradas para a Central (página de caso sem composer) na Fase 1.
- **Eficiência:** tempo médio entre receber uma mensagem do devedor e visualizá-la na Central reduzido em relação ao fluxo atual de abrir caso por caso.
- **Intervenção humana:** nº de takeovers e devoluções para IA rastreáveis com auditoria completa (100% dos eventos com ator, timestamp e registro persistido).
- **Transferência:** 100% das transferências com histórico de atribuição e evento de sistema; zero conversas duplicadas/perdidas.
- **Isolamento:** zero incidentes de acesso entre tenants (validação no backend + RLS).
- **Qualidade:** cobertura de testes dos componentes e fluxos principais da Central.

## Riscos e Mitigações

- **Regressão nos fluxos do caso:** o chat monolítico hoje embute ações (canal ativo, troca de status, dossiê) que não devem se perder. *Mitigação:* extração incremental, mantendo os endpoints existentes e cobrindo fluxos críticos com testes.
- **Concorrência em takeover/transferência:** dois operadores agindo sobre a mesma conversa simultaneamente. *Mitigação:* backend valida responsável atual esperado e estado da conversa; UI comunica conflito ("conversa alterada por outro operador, atualize").
- **Adoção pelos operadores:** mudança de hábito (chat deixa de estar no caso). *Mitigação:* link bidirecional caso ↔ conversa; UX familiar de mensagens para reduzir curva de aprendizado.
- **Ambiguidade de status atual:** `needs_attention` hoje mistura "aguardando operador" e outros. *Mitigação:* condutor explícito + status de espera deduzido de regras claras, sem reescrever a máquina de estados existente do caso.

## Registros de Decisão de Arquitetura

- [ADR-001: Central de Conversas modelada sobre o caso de cobrança existente](adrs/adr-001.md) — Conversa = caso enriquecido com condutor, atribuições, eventos e leitura; sem entidade `conversations` separada.

## Questões Abertas

- Mascaramento do documento do devedor no painel de contexto: sempre mascarado ou revelável por permissão/ação? (padrão atual do sistema: verificar)
- "Finalizadas" incluem apenas `status=closed` ou também casos arquivados há mais de N dias?
- Debounce da busca: valor padrão (sugestão: 300ms — detalhe de TechSpec).
- A Marcação de leitura deve ocorrer ao abrir a conversa ou apenas ao focar a janela de mensagens? (sugestão: ao abrir)
