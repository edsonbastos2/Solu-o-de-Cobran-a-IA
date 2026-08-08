# Documento de Requisitos do Produto: Roadmap Cobrança IA — Fase 2

## Visão Geral

A Fase 1 estabeleceu o núcleo de cobrança centrado no domínio: cadeia canônica empresa → cliente → contrato → título financeiro → caso, criação transacional elegível, pipeline multi-agente de IA com auditoria CDC, mensageria WhatsApp/Telegram bidirecional, multi-tenant com RLS e auditoria de ações críticas.

A Fase 2 parte de duas constatações estratégicas. Primeiro, o `supabase_tenant_model.sql` já criou tabelas de domínio avançado (`negotiations`, `workflows`, `campaigns`, `quarantines`, `negativations`, `protests`, `legal_processes`) que estão **sem nenhuma rota de API ou página consumindo-as** — toda a frente de automação, jurídica e de negativação está modelada mas não implementada. Segundo, a indústria moderna de cobrança (Experian, Gartner) aponta que o maior ROI está em **analytics preditiva** (scoring de propensão, next-best-action, segmentação) e **automação proativa** (campanhas, workflows), não apenas na negociação reativa via chatbot.

Esta funcionalidade fecha o loop de negócio (métricas confiáveis → acordo formal → baixa de pagamento), adiciona diferencial de IA (insights longitudinais, next-best-action, scoring de propensão), implementa escala proativa (workflows e campanhas), entrega o arsenal legal e compliance (negativação, protesto, jurídico, quarentena) e fortalece a fundação técnica (testes, CI/CD, observabilidade). Ela atende operadores de cobrança que precisam de contexto estratégico e ações sugeridas, gestores que precisam de métricas confiáveis e relatórios, e administradores que precisam de automação configurável e compliance rastreável. O valor está em transformar o sistema de "chatbot de cobrança reativo" para "plataforma de cobrança inteligente e proativa".

## Objetivos

- Fechar o loop de negócio com métricas confiáveis, acordos formais persistidos e baixa de títulos.
- Adicionar diferencial de IA com insights longitudinais do histórico, next-best-action para operadores e scoring de propensão a pagamento.
- Implementar automação proativa com workflows e campanhas segmentadas por audiência.
- Entregar o arsenal legal e compliance com negativação, protesto, pipeline jurídico e quarentena de contas.
- Fortalecer a governança de IA com biblioteca de templates de mensagens auditáveis.
- Diversificar com importação em massa, exportação de relatórios, notificações in-app, CRUD faltante e permissões granulares.
- Consolidar a fundação técnica com rate limiter multi-instância, suíte de testes, CI/CD, observabilidade e storage de documentos.

## Histórias de Usuário

- Como gestor de cobrança, quero ver métricas confiáveis de recuperação, taxa de acordo e aging por bucket para tomar decisões baseadas em dados reais.
- Como operador de cobrança, quero que o acordo fechado pela IA seja registrado formalmente com valor, parcelas e desconto para não perder o rastreio da promessa de pagamento.
- Como operador financeiro, quero dar baixa em títulos pagos direto na tela do contrato para que o dashboard reflita a recuperação real.
- Como operador de cobrança, quero ver o heatmap de sentimento e as principais objeções do devedor ao longo do tempo para ajustar minha abordagem.
- Como operador de cobrança, quero receber sugestões de próxima melhor ação com botões acionáveis para agir mais rápido e com mais contexto.
- Como gestor de cobrança, quero ordenar casos por propensão a pagamento para priorizar a carteira de maior potencial.
- Como gestor de cobrança, quero criar campanhas preventivas e de acompanhamento para abordar proativamente a carteira em vez de apenas reagir.
- Como administrador, quero controlar negativação e protesto com prazos legais respeitados para exercer pressão regulada sem risco jurídico.
- Como advogado, quero ver e atualizar o andamento de processos jurídicos vinculados aos casos para manter auditoria dupla.
- Como operador de cobrança, quero que contas em quarentena (litígio, falecimento, não contato) bloqueiem abordagens automáticas para evitar violação do CDC.
- Como administrador, quiro gerenciar templates de mensagens com preview e compliance CDC para reduzir custo de LLM e garantir conformidade.
- Como administrador, quero importar a carteira existente via planilha para onboardar novos tenants rapidamente.
- Como gestor, quero exportar relatórios em CSV e PDF para apresentar resultados à diretoria.
- Como operador, quero receber notificações in-app quando casos pararem ou acordos expirarem para agir antes de perder o timing.
- Como administrador, quero que membros do tenant não consigam alterar políticas ou aprovar quarentenas para proteger configurações sensíveis.

## Funcionalidades Principais

### P0: Fechar o loop de negócio

- Corrigir o dashboard de métricas que usa status legados e retorna valores zerados.
- Implementar acordos formais persistidos na tabela `negotiations` com transições de status e expiração via cron.
- Conectar o pipeline de IA para criar `negotiation` automaticamente ao detectar `[ACORDO_FECHADO]`.
- Implementar baixa de títulos (total, parcial, cancelamento) com auditoria e impacto no dashboard.
- Calcular aging por bucket (0-30/31-90/91-180/180+), tempo médio de resolução e taxa de acordo.

### P0: Diferencial de IA

- Insights longitudinais do histórico de mensagens: heatmap de sentimento, principais objeções, probabilidade de acordo, tom recomendado.
- Next-best-action dinâmica para operadores: ações sugeridas com botões acionáveis, respeitando prazos legais e estágio.
- Scoring de propensão a pagamento persistido em `cases.propensity_score`, recalculado via cron, com ordenação na lista de casos.

### P1: Escala proativa

- Editor de workflows com triggers (vencimento, dias de atraso, status) e definição JSONB.
- Campanhas segmentadas por `audience_filter` (status, dias_atraso, estágio, propensão) com janela de disparo e horário permitido.
- Runner via cron que resolve audiência e dispara mensagens dentro da janela configurada.

### P1: Arsenal legal e compliance

- Negativação com notificação prévia de 5 dias (CDC Art. 43), controle de prazos por contrato e remoção automática na quitação.
- Protesto em cartório com encadeamento legal (requer negativação tentada) e cancelamento na quitação.
- Pipeline jurídico com auto-criação quando estágio especializada ultrapassa X dias sem acordo.
- Quarentena de contas que bloqueia `processChat`, `start-negotiation` e campanhas.

### P1: Governança de IA

- Biblioteca de templates de mensagens com variáveis, preview com dado real e fallback no Especialista quando LLM falha.

### P2: Diversificação

- Importação em massa CSV/XLSX com mapeamento de colunas e relatório de erros.
- Exportação de relatórios CSV (UTF-8 BOM) e PDF com filtros de período e estágio.
- Notificações in-app em tempo real conectadas aos crons de alerta existentes.
- CRUD completo de contrato e cliente (PUT/DELETE faltantes).
- Permissões granulares por role (owner/admin/member) com enforcement em API e UI.

### P2: Fundação técnica

- Rate limiter multi-instância via Redis/Upstash com fallback in-memory.
- Suíte de testes automatizados (Vitest) cobrindo funções puras, pipeline de IA com mock e RLS multi-tenant.
- CI/CD com GitHub Actions rodando lint, typecheck, testes e build em cada PR.
- Logging estruturado com `request_id`, contexto de tenant/user e integração opcional com Sentry.
- Storage de PDFs de contrato no Supabase Storage com RLS por tenant.

## Experiência do Usuário

O operador abre o dashboard e vê métricas confiáveis: recuperação, taxa de acordo, aging por bucket e distribuição por estágio. Ao entrar no detalhe do caso, além do contexto canônico da Fase 1, ele vê o heatmap de sentimento, as principais objeções do devedor, a probabilidade de acordo e um cartão de next-best-action com botões acionáveis ("Sugerir parcelamento em 4x", "Escalar para jurídico", "Enviar lembrete").

Quando a IA fecha um acordo, o registro formal aparece na seção de acordos do caso com valor, parcelas, desconto e data de expiração. O operador pode dar baixa no título direto na tela do contrato, e o dashboard reflete a recuperação imediatamente.

O gestor cria campanhas preventivas (D-3 do vencimento) ou de acompanhamento pós-acordo, segmentando por audiência e configurando janela de disparo. A fila de negativação mostra títulos elegíveis com prazo legal de notificação, e a fila de protesto exige negativação prévia. Processos jurídicos são auto-criados quando casos em estágio especializada ultrapassam o limite de dias sem acordo.

O administrador gerencia templates de mensagens com preview usando dado real, importa carteira via planilha, exporta relatórios e controla permissões por role. Notificações in-app alertam sobre casos parados, acordos expirando e negativações pendentes.

A experiência deve manter a linguagem empresarial simples em português, preservar a navegação existente, atender desktop e mobile, e não expor dados de outro tenant. Novas seções (acordos, insights, NBA, jurídico, negativação, protesto, quarentena, templates, campanhas, workflows) são adicionadas gradualmente sem redesenhar o workspace existente.

## Restrições Técnicas de Alto Nível

- O isolamento dos dados por empresa é obrigatório em todas as novas tabelas e endpoints.
- Dados financeiros e de clientes continuam sendo tratados como informações empresariais sensíveis.
- Decisões e comunicações de cobrança devem atender às obrigações brasileiras aplicáveis (CDC Art. 42/43, LGPD).
- O histórico existente não deve ser excluído durante a implementação das novas frentes.
- A elegibilidade de negativação e protesto deve ser consistente em todos os pontos de entrada.
- Scoring de propensão é sinal auxiliar, não substituto de julgamento humano.
- NBA nunca deve sugerir violar o CDC (ex: ameaçar negativação fora do prazo legal).
- Templates de mensagens passam por revisão de compliance.
- Logs estruturados não devem conter dados sensíveis (chaves AI, tokens, senhas).

## Fora do Escopo

- Integração real com Serasa/SPC/Boa Vista (a Fase 2 usa provider mock substituível).
- Integração real com cartórios (a Fase 2 usa provider mock substituível).
- Gateway de pagamento real para gerar boletos/PIX (a Fase 2 faz baixa manual).
- Conciliação automática de retorno CNAB/PIX (a Fase 2 faz baixa manual).
- Multi-idioma (a Fase 2 continua pt-BR hardcoded).
- Recuperação de senha e signup self-service (a Fase 2 mantém criação via super-admin).
- Modelos de ML treinados para scoring (a Fase 2 usa heurística, evolui depois).
- Redesign amplo da UI (a Fase 2 adiciona seções gradualmente).

## Plano de Entrega por Grupos

### Grupo A — Fechar o loop (tarefas 1-3)

- Dashboard de métricas confiável com aging e funil.
- Acordos formais persistidos com expiração via cron.
- Baixa de títulos com auditoria.

Critério para avançar: dashboard reflete recuperação real, acordos da IA são persistidos e títulos podem ser baixados manualmente.

### Grupo B — Diferencial de IA (tarefas 4-6)

- Insights longitudinais do histórico de mensagens.
- Next-best-action com botões acionáveis.
- Scoring de propensão persistido e ordenável.

Critério para avançar: operador vê heatmap de sentimento, recebe NBA acionável e pode ordenar casos por propensão.

### Grupo C — Escala proativa (tarefa 7)

- Workflows com triggers e definição JSONB.
- Campanhas segmentadas com runner via cron.

Critério para avançar: gestor cria e executa campanhas preventivas e de acompanhamento.

### Grupo D — Arsenal legal e compliance (tarefas 8-11)

- Negativação com notificação prévia de 5 dias.
- Protesto com encadeamento legal.
- Pipeline jurídico com auto-criação.
- Quarentena bloqueando abordagens.

Critério para avançar: administrador controla negativação, protesto e jurídico com prazos legais respeitados, e contas em quarentena bloqueiam IA.

### Grupo E — Governança de IA (tarefa 12)

- Biblioteca de templates com preview e fallback.

Critério para avançar: administrador gerencia templates e Especialista usa fallback quando LLM falha.

### Grupo F — Diversificação (tarefas 13-17)

- Importação em massa, exportação de relatórios, notificações in-app, CRUD faltante, permissões por role.

Critério para avançar: tenant onboardable via planilha, relatórios exportáveis, notificações em tempo real, CRUD completo e roles enforced.

### Grupo G — Fundação técnica (tarefas 18-22)

- Rate limiter Redis, testes, CI/CD, observabilidade, storage.

Critério para avançar: sistema testável, CI funcional, logs estruturados e PDFs persistidos.

## Métricas de Sucesso

- Dashboard reflete recuperação real com zero referências a status legados.
- 100% dos acordos fechados pela IA são persistidos em `negotiations`.
- 100% das baixas de título registram auditoria.
- Operador visualiza insights longitudinais e NBA em casos com histórico suficiente.
- Scoring de propensão recalculado semanalmente e ordenável na lista de casos.
- Campanhas disparam apenas dentro da janela e horário permitidos.
- Negativação respeita notificação prévia de 5 dias (CDC Art. 43).
- Protesto exige negativação prévia tentada.
- Contas em quarentena bloqueiam `processChat` e campanhas.
- Templates passam por revisão de compliance e são usados como fallback de LLM.
- Importação em massa cria clientes, contratos e títulos com relatório de erros.
- Roles enforced em API (403) e UI (botões ocultos).
- CI roda lint, typecheck, testes e build em cada PR.
- Logs estruturados sem dados sensíveis.

## Riscos e Mitigações

- **Métricas zeradas mascaradas:** reescrever queries com status reais antes de qualquer outra evolução para medir impacto.
- **Acordos não persistidos:** conectar o pipeline de IA à criação de `negotiation` antes de depender do dashboard.
- **Custo de LLM em insights/NBA:** cache de 5min para insights e 2min para NBA; truncar histórico >50 mensagens.
- **Scoring enviesado:** documentar heurística, não substituir julgamento humano, evoluir para ML depois.
- **Campanhas com spam:** rate limit por destinatário, horário permitido e audiência filtrada.
- **Negativação fora do prazo legal:** notificação prévia de 5 dias e controle por `override_days_to_negative`.
- **Templates não conformes:** revisão de compliance obrigatória antes de ativar.
- **Importação com dados inconsistentes:** relatório de erros por linha e rollback parcial.
- **Roles mal configuradas:** owner imune a remoção, admin não gerencia owner, auditoria registra role.
- **Rate limiter quebra em multi-instância:** Redis/Upstash com fallback in-memory para demo mode.

## Registros de Decisão de Arquitetura

- A definir conforme implementação avança (potenciais ADRs: scoring heurístico vs ML, provider mock de negativação, cache de LLM, Redis vs in-memory).

## Questões em Aberto

- Qual fórmula heurística inicial para scoring de propensão? Quais pesos para dias de atraso, histórico de pagamento, respostas anteriores e acordos anteriores?
- Qual o limite de dias em estágio especializada sem acordo para auto-criar processo jurídico? (default proposto: 60 dias)
- Qual o horário permitido padrão para campanhas? (default proposto: 9h-18h dias úteis)
- Templates padrão por estágio devem ser pré-seedados? Quais?
- Qual limite de linhas por importação? (default proposto: 1000)
- URLs assinadas de Storage devem expirar em quanto tempo? (default proposto: 1h)
- Sentry ou Logflare para observabilidade?
- NBA deve combinar LLM + regras determinísticas, ou só LLM?
