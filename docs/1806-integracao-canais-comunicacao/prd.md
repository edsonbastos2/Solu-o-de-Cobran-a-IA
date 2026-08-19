# PRD: Plataforma de Canais de Comunicação com Integração Telegram

## Visão Geral

O sistema de cobrança conversa com devedores por WhatsApp (Z-API) e, parcialmente, por Telegram (Bot API). Hoje o domínio de cobrança conhece os canais concretos: o código decide o destino com `caseData.telegram_chat_id || caseData.phone` e despacha por `if provider === 'telegram'`, e a lógica de recebimento é duplicada entre dois webhooks. Cada novo canal (E-mail, SMS) exigiria tocar novamente a regra de negócio — inviável para um SaaS que se posiciona como omnichannel.

Esta entrega transforma a mensageria em uma **plataforma de canais**: o domínio de cobrança pede "envie esta mensagem pelo canal ativo deste caso" sem saber se é WhatsApp, Telegram ou qualquer canal futuro. Nela, o Telegram passa a ser um canal de primeira classe — configurável por tenant, vinculado ao devedor por fluxo seguro, bidirecional, com histórico e tratamento de falhas — e o WhatsApp migra para a mesma arquitetura sem perder comportamento.

É para owners/admins de tenants que precisam configurar os canais da empresa uma única vez, e para operadores de cobrança que precisam falar com o devedor onde ele está — hoje WhatsApp ou Telegram, amanhã qualquer canal novo — sem que a operação de cobrança mude.

Valor: remove o acoplamento que impede a expansão omnichannel, completa o Telegram com vinculação segura (hoje o deep link não tem expiração nem invalidação) e dá ao histórico de mensagens a rastreabilidade por canal que a operação e a auditoria exigem.

## Objetivos

- Permitir que o owner/admin de um tenant configure o bot do Telegram (e as credenciais do WhatsApp) em um único lugar, por tenant, sem expor segredos na interface, nas respostas de API ou em logs.
- Permitir que um devedor seja vinculado a um canal uma única vez, por cliente, com vinculação do Telegram por link temporário expirável e de uso único.
- Fazer toda mensagem de cobrança — manual ou automática (pipeline de IA, follow-ups, crons) — sair pelo canal ativo do caso, escolhido e alterável explicitamente pelo operador.
- Registrar no histórico de mensagens o canal, a direção (entrada/saída) e o resultado do envio (enviado/falhou, com motivo), para os dois canais.
- Receber mensagens de devedores por WhatsApp e Telegram com o mesmo fluxo de processamento, idempotente e com isolamento por tenant garantido.
- Fazer a adição de um canal futuro (E-mail, SMS) exigir apenas um novo adaptador de canal, sem alteração na regra de negócio de cobrança.

## Histórias de Usuário

**Owner/Admin do Tenant**
- Como owner de tenant, quero configurar o bot do Telegram da minha empresa (token) em Configurações > Canais, para que toda a equipe use o mesmo bot sem precisar de conhecimento técnico.
- Como owner de tenant, quero que o sistema registre o webhook do meu bot no Telegram automaticamente e me mostre o status dele (ativo, com erro, pendente), para que eu saiba se estou recebendo mensagens sem precisar consultar o Telegram.
- Como owner de tenant, quero ver na mesma tela as credenciais do WhatsApp da empresa, para que eu gerencie todos os canais em um único lugar.
- Como owner de tenant, quero habilitar e desabilitar um canal para o meu tenant, para que eu possa pausar um canal problemático sem remover a configuração.
- Como owner de tenant, quero que minhas credenciais atuais (hoje no meu perfil) sejam migradas automaticamente para a configuração do tenant no primeiro acesso, para que eu não precise redigitar nada.

**Operador de cobrança**
- Como operador, quero gerar um link de vinculação do Telegram para um cliente e enviá-lo ao devedor como eu preferir, para que eu consiga migrar a conversa para o Telegram quando fizer sentido.
- Como operador, quero ver no caso qual canal está ativo e trocar o canal ativo quando o devedor responder por outro canal, para que as mensagens automáticas saiam por onde o devedor realmente está.
- Como operador, quero ver no histórico da conversa o canal de cada mensagem e as falhas de envio (ex.: devedor bloqueou o bot), para que eu saiba quando preciso agir por outro canal.

**Devedor**
- Como devedor, quero receber um link, abrir a conversa com o bot no Telegram e confirmar a vinculação com um toque, para que eu passe a negociar por lá sem burocracia.
- Como devedor, quero que um link de vinculação antigo ou já usado não funcione mais, para que ninguém possa se passar por mim em outro momento.

## Funcionalidades Principais

### 1. Aba "Canais" em Configurações (por tenant)
Lista dos canais suportados (WhatsApp e Telegram nesta entrega, com slots futuros visíveis para E-mail e SMS). Para o Telegram: token do bot, nome de usuário do bot (validado automaticamente ao salvar), status do webhook, habilitado/desabilitado. Para o WhatsApp: credenciais da instância Z-API. O token nunca é exibido após salvo — apenas um indicador de configurado e sufixo mascarado. Credenciais são cifradas. Migração one-shot das credenciais existentes do perfil do owner no primeiro acesso.

### 2. Vinculação segura do Telegram ao cliente
O operador, na tela do cliente, gera um link de vinculação com token temporário (expiração curta, uso único). Ao abrir o link e enviar `/start` no bot, o devedor é vinculado: o identificador estável do Telegram (chat/user ID) fica registrado no cliente — username é armazenado apenas como metadado descritivo. Tokens expirados ou usados são recusados com mensagem clara. O fluxo substitui o deep link atual (base64 do ID do caso), que não tem expiração nem invalidação.

### 3. Canal ativo por caso
Cada caso aponta para um canal de comunicação ativo do cliente. O canal ativo é definido na primeira interação e pode ser alterado pelo operador. Toda mensagem de cobrança — do pipeline de IA, de crons de follow-up/protesto/negativação ou de envio manual — sai pelo canal ativo do caso. Mensagens recebidas por um canal diferente do ativo continuam sendo registradas e processadas normalmente (o recebimento nunca é recusado por divergência de canal).

### 4. Envio unificado de mensagens
Um único serviço de envio atende todo o domínio. Ele resolve o canal ativo do caso, valida o destinatário, envia pelo canal correspondente e registra o resultado. Falhas de envio (usuário bloqueou o bot, credenciais inválidas, canal indisponível, mensagem muito grande) ficam registradas no histórico com motivo e são sinalizadas na conversa.

### 5. Recebimento unificado por webhook
Os webhooks de WhatsApp e Telegram continuam como pontos de entrada HTTP, mas toda a lógica de processamento (validação de autenticidade, idempotência, resolução de tenant, resolução de cliente/caso, registro da mensagem recebida, encaminhamento ao pipeline de IA) é um fluxo único. Eventos duplicados são ignorados. Mensagens de chat sem cliente vinculado são descartadas silenciosamente. A resposta ao Telegram é imediata, independente do processamento da IA.

### 6. Histórico de mensagens rastreável
Toda mensagem trocada registra: canal, direção (entrada/saída), conteúdo, identificador externo (quando o canal fornece), resultado do envio (enviado/falhou + motivo) e timestamp. Os status refletem as capacidades reais de cada canal — nesta entrega, enviado/falhou para ambos (bots do Telegram não recebem recibo de entrega/leitura).

## Experiência do Usuário

**Fluxo principal — configurar o Telegram**
1. O owner/admin abre Configurações > Canais (novo, ao lado de Equipe e Modelos de IA).
2. No cartão do Telegram, cola o token do bot e salva.
3. O sistema valida o token, exibe o @username do bot e registra o webhook, mostrando o status "Ativo".
4. Se o owner já tinha credenciais de mensageria no perfil, elas aparecem migradas automaticamente no primeiro acesso (com aviso em caso de divergência entre perfis).

**Fluxo principal — vincular o devedor**
1. O operador abre o cliente, vê os canais vinculados (ex.: WhatsApp desde a importação) e clica em "Vincular Telegram".
2. O sistema gera um link copiável com aviso de expiração.
3. O operador envia o link ao devedor como preferir (WhatsApp, e-mail, ligação).
4. O devedor abre o link, conversa com o bot e recebe confirmação de que a conversa foi vinculada.
5. O canal Telegram aparece como vinculado no cliente; o operador pode torná-lo o canal ativo do caso.

**Fluxo principal — negociar por Telegram**
1. O devedor envia uma mensagem no Telegram.
2. O sistema registra a mensagem, identifica o cliente pelo identificador estável e o caso ativo, e processa a resposta da IA.
3. A resposta da IA sai pelo Telegram; o operador vê a conversa no caso com o canal identificado por mensagem.
4. Se o devedor bloquear o bot, a próxima tentativa de envio registra a falha com motivo e o operador é alertado na conversa.

**Casos de borda**
- Devedor usa um link expirado ou já utilizado: o bot responde explicando e o operador pode gerar um novo link.
- Devedor bloqueia o bot: envios subsequentes falham com motivo claro; nada quebra no resto do caso.
- Dois tenants com bots diferentes: cada webhook resolve exclusivamente o tenant dono da configuração — mensagens nunca atravessam tenants.
- Tenant desabilita um canal: envios por ele falham com motivo "canal desabilitado" e a UI indica isso; mensagens recebidas ainda são registradas.

**Descoberta**: a aba Canais fica em Configurações, onde os owners já gerenciam equipe e IA. A ação "Vincular Telegram" fica na tela do cliente, junto dos demais dados de contato.

**Acessibilidade**: o status de cada canal usa texto e cor (não só cor); o resultado de envio falho tem mensagem em linguagem simples, não código de erro.

## Restrições Técnicas de Alto Nível

- Isolamento multi-tenant absoluto: a configuração de canal, as vinculações e as mensagens pertencem a um tenant; nenhum fluxo (envio, webhook, vinculação) pode cruzar a fronteira do tenant.
- Segredos de canal são cifrados em repouso e nunca aparecem em respostas de API, logs, mensagens de erro ou frontend.
- O webhook de Telegram valida a autenticidade de cada evento e é idempotente sob reentrega.
- A vinculação de Telegram usa token opaco, expirável e de uso único — nunca aceita identificador informado manualmente.
- Status de mensagem limitados às capacidades reais do canal (bots do Telegram não têm recibo de entrega/leitura).
- Respeitar os limites da plataforma (Telegram: ~1 mensagem/segundo por chat) sem degradação perceptiva para o usuário final.
- Variáveis de ambiente globais atuais continuam funcionando como fallback de desenvolvimento/demo, atrás da configuração do tenant.
- Nenhuma mensagem de cobrança pode ser enviada sem rastro no histórico (auditoria).

## Não-Objetivos (Fora de Escopo)

- Canais além de WhatsApp e Telegram (E-mail, SMS): a arquitetura deve permiti-los, mas não serão implementados nesta entrega (nem slots clicáveis na UI).
- Recibos de entrega/leitura do WhatsApp (webhooks de status da Z-API): fase futura.
- Fila assíncrona de envio com retries/backoff/circuit breaker: o envio permanece síncrono com registro de falha (ADR-001).
- Mensagens de mídia (imagem, áudio, documento): apenas texto, como hoje.
- Múltiplos bots do mesmo canal por tenant (ex.: dois bots de Telegram): um por canal.
- Envio de mensagens em massa/campanhas ou broadcasts pagos do Telegram.
- Interface dedicada de auditoria de mensagens: o registro existe para auditoria, mas a visualização é a conversa do caso.
- Canal Telegram iniciando conversa com devedores não vinculados (cold outreach por username): só conversa com quem se vinculou.

## Plano de Lançamento em Fases

### MVP (Fase 1)
- Aba Canais em Configurações com config por tenant de WhatsApp e Telegram (cifrada, token nunca exibido, migração one-shot do perfil do owner).
- Registro automático do webhook do Telegram com verificação de status.
- Vinculação de Telegram por token temporário (expiração + uso único) e backfill de vinculações existentes.
- Canal ativo por caso, com troca manual pelo operador.
- Serviço de envio unificado atendendo pipeline de IA, start-negotiation, agent-message e crons.
- Recebimento unificado (webhooks WhatsApp/Telegram como adaptadores finos), idempotente, com resolução por identificador estável.
- Histórico com canal/direção/resultado (enviado/falhou + motivo).
- Critérios de sucesso para avançar: devedor vinculado por link negocia por Telegram de ponta a ponta (mensagem recebida → IA → resposta enviada → histórico íntegro); WhatsApp opera sem regressão; canal futuro seria apenas um adapter.

### Fase 2 (futura, não comprometida)
- Canais E-mail e SMS sobre a mesma plataforma.
- Recibos de entrega/leitura do WhatsApp (webhooks de status Z-API).
- Política de cascata de canais por tenant (ADR-002, alternativa futura).

## Métricas de Sucesso

- Percentual de mensagens enviadas com resultado registrado no histórico (meta: 100% — nenhuma mensagem sem rastro).
- Taxa de conclusão do fluxo de vinculação (link gerado → devedor vinculado).
- Tempo entre token colado na aba Canais e webhook ativo (validação + registro automáticos, sem passos manuais).
- Zero incidentes de vazamento de segredo de canal (token em log, resposta de API ou frontend).
- Zero incidentes de mensagens ou vinculações atravessando a fronteira de tenant.
- Regressão zero no WhatsApp: mesmas mensagens entregues pelo mesmo fluxo de negócio após a migração.

## Riscos e Mitigações

- **Risco de regressão no WhatsApp**: o canal predominante hoje é o WhatsApp; qualquer quebra na migração afeta a operação imediatamente. Mitigação: adapters preservam o comportamento atual; colunas legadas permanecem legíveis como fallback durante o rollout; validação com os scripts de verificação existentes do projeto.
- **Risco de perda de vinculações no backfill**: chat IDs e telefones atuais vivem nos casos; migração malfeita deixa devedores incomunicáveis. Mitigação: backfill não-destrutivo, relatório de inconsistências e fallback para o match legado.
- **Risco de adoção da vinculação**: operadores podem achar o fluxo de link trabalhoso e ignorar o Telegram. Mitigação: link gerado em um clique na tela do cliente, com cópia fácil e expiração generosa o suficiente para o uso real.
- **Risco de devedores bloqueando o bot**: bots são bloqueáveis a qualquer momento, silenciando o canal. Mitigação: falha registrada com motivo explícito e sinalização na conversa, permitindo ao operador migrar o caso para outro canal.
- **Risco de configuração técnica assustadora**: colar token de bot é barreira para owners não técnicos. Mitigação: instrução curta passo a passo (BotFather) dentro da aba Canais e validação imediata com feedback claro.

## Registros de Decisões de Arquitetura

- [ADR-001: Plataforma de Canais unificada para WhatsApp e Telegram](adrs/adr-001.md) — WhatsApp e Telegram migram juntos para a abstração comum de canal, com envio síncrono e sem fila assíncrona.
- [ADR-002: Identidade de canal por cliente com canal ativo por caso](adrs/adr-002.md) — Vinculações vivem no cliente (identificador estável do Telegram como chave), e o caso define o canal ativo usado por mensagens automáticas.
- [ADR-003: Configuração de canal por tenant com migração one-shot](adrs/adr-003.md) — Credenciais de mensageria saem de `profiles` para configuração por tenant cifrada, com cópia automática do owner no primeiro acesso.

## Perguntas em Aberto

- Expiração exata do token de vinculação (sugestão: 24-48h) — a definir na TechSpec.
- Texto de confirmação do bot ao devedor ao vincular e ao token expirado — a refinar no design.
- Se o canal ativo do caso deve mudar automaticamente quando o devedor inicia contato por um canal diferente (decisão do PRD: não — sempre explícito pelo operador; reavaliar com uso real).
- Se credenciais divergentes entre perfis do mesmo tenant durante a migração one-shot devem bloquear ou apenas avisar (sugestão: avisar; o owner decide).
