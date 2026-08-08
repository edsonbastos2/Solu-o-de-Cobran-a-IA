# Roadmap Cobrança IA — Fase 2

Roadmap de evolução do sistema de cobrança guiado por IA, baseado em inventário completo do estado atual (Fase 1) e pesquisa de tendências da indústria (Experian, Gartner, McKinsey) sobre AI em debt collection.

## Documentos

- [PRD](prd.md) — Documento de Requisitos do Produto (visão, objetivos, histórias, funcionalidades, UX, métricas, riscos).
- [TechSpec](techspec.md) — Especificação Técnica (arquitetura, design, interfaces, modelos, endpoints, testes, sequenciamento).
- [tasks.md](tasks.md) — Índice das 22 tarefas ordenadas por valor ÷ esforço.

## Contexto

A Fase 1 entregou um núcleo funcional: extração de contrato por IA, títulos financeiros com elegibilidade, casos de cobrança com pipeline multi-agente (Supervisor → Especialista → Qualidade CDC), mensageria WhatsApp/Telegram bidirecional, multi-tenant com RLS, estágios de cobrança com limite de desconto por aging, auditoria e Realtime.

A Fase 2 parte de duas constatações estratégicas:

1. **Gap de implementação**: o `supabase_tenant_model.sql` já criou `negotiations`, `workflows`, `campaigns`, `quarantines`, `negativations`, `protests`, `legal_processes` — tabelas de domínio avançado **sem nenhuma rota de API ou página consumindo-as**.
2. **Diferencial competitivo de IA**: a indústria moderna de cobrança (Experian, Gartner) aponta que o maior ROI está em **analytics preditiva** (scoring de propensão, next-best-action, segmentação) e **automação proativa** (campanhas, workflows), não apenas na negociação reativa via chatbot.

## Princípios de priorização

As tarefas estão ordenadas por **valor de negócio ÷ esforço**, com bloqueadores respeitados:

- **Fechamento do loop de negócio** primeiro (métricas → acordo → pagamento) — sem isso é impossível medir o ROI de qualquer outra melhoria.
- **Diferencial de IA** em seguida (insights longitudinais, NBA, scoring) — é o que separa "chatbot de cobrança" de "sistema de cobrança inteligente".
- **Escala e arsenal legal/compliance** depois (campanhas, negativação, protesto, jurídico, quarentena).
- **Governança de IA** (templates) e **diversificação** (import/export, notificações, CRUD faltante) na sequência.
- **Fundação técnica** por último (rate limiter, testes, CI/CD, observabilidade, storage) — necessárias mas sem impacto direto em receita.

## Grupos de valor

| Grupo | Tarefas | Foco |
|-------|---------|------|
| A — Fechar o loop | 1, 2, 3 | Métricas confiáveis, acordos formais, baixa de títulos |
| B — Diferencial de IA | 4, 5, 6 | Insights longitudinais, next-best-action, scoring de propensão |
| C — Escala proativa | 7 | Workflows + campanhas |
| D — Arsenal legal & compliance | 8, 9, 10, 11 | Negativação, protesto, jurídico, quarentena |
| E — Governança de IA | 12 | Templates de mensagens auditáveis |
| F — Diversificação | 13, 14, 15, 16, 17 | Importação em massa, relatórios, notificações, CRUD faltante, roles |
| G — Fundação técnica | 18, 19, 20, 21, 22 | Rate limiter, testes, CI/CD, observabilidade, storage |

## Referências de indústria

- **Experian** — "AI in Debt Collection: Benefits and Uses" (2025): predictive analytics, chatbots, automação de comunicação, priorização de contas por risco.
- **Gartner** — IA transformando debt collection: segmentação preditiva e customer-centric approach.
- **CDC Art. 42/43** — conformidade regulatória brasileira (sem ameaça/constrangimento, notificação prévia de negativação em 5 dias, direito de não contato).
