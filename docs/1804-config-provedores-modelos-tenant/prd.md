# PRD — Configuração de Provedores e Modelos de IA por Tenant

Ticket: `1804` · Slug: `config-provedores-modelos-tenant`

## Overview

A plataforma de cobrança com IA usa múltiplos provedores de LLM (OpenCode/DeepSeek, Gemini, OpenAI, Anthropic, OpenRouter, Ollama) para três funções distintas: o assistente de cobrança (chat Negociação + help-chat de suporte), a extração de dados de PDFs de contratos/devedores, e o pipeline multi-agente de cobrança. Hoje toda essa configuração (provedor, modelo e chaves de API) é **por usuário** na tabela `profiles`, com fallbacks hardcoded e um único default de sistema implícito (`process.env.OPENCODE_API_KEY` + modelos constantes espalhados por 6+ arquivos). A app já migrou para o modelo multi-tenant, mas o `tenants.settings` JSONB está sem uso: nenhum tenant consegue definir seus próprios provedores/modelos, e não existe default de sistema gerenciável.

Esta feature torna a configuração de IA **por tenant** e dá ao super-admin um **padrão de sistema** editável, com uma cadeia de resolução transparente. Cada tenant define provedor, modelo e chaves por função; cada agente de cobrança continua podendo sobrescrever o modelo individualmente; e a extração de PDF deixa de ser hardcoded para respeitar a config do tenant.

## Goals

- Permitir que o owner/admin de cada tenant configure provedor, modelo e chaves de API para três funções: assistente do sistema, extração de PDF e agentes de cobrança.
- Permitir que o super-admin defina provedor e modelo padrão de sistema (assistente e extração de PDF) que sirvam de fallback quando o tenant não configurar.
- Estabelecer uma cadeia de resolução única e transparente: override de modelo por agente → bucket do tenant → default de sistema → fallback hardcoded.
- Eliminar a extração de PDF hardcoded (`minimax-m3` via `process.env.OPENCODE_API_KEY`) e passar as duas rotas de extração a respeitar a config do tenant (incluindo autenticar `/api/debtors/extract-pdf`).
- Migrar automaticamente, sem downtime, a config de IA existente (do owner) para o tenant no primeiro acesso pós-deploy.
- Centralizar os ternários de fallback de modelo espalhados em `lib/agent.ts`, `lib/case-insights.ts`, `app/api/start-negotiation/route.ts`, `app/api/help-chat/route.ts`, `app/api/extract-contract/route.ts` e `app/api/debtors/extract-pdf/route.ts` em um único resolvedor server-side.

## User Stories

**Dono/admin de tenant (owner/admin no `tenant_members`)**
- Como owner/admin de um tenant, quero configurar o provedor e modelo que o assistente de cobrança usa, para usar o LLM que melhor atende minha operação e custo.
- Como owner/admin de um tenant, quero configurar o provedor e modelo da extração de PDF, para usar um modelo com visão de documento adequado aos meus contratos.
- Como owner/admin de um tenant, quero configurar o provedor e modelo do pipeline de agentes de cobrança, para padronizar a negociação automatizada.
- Como owner/admin de um tenant, quero inserir minha própria chave de API do provedor, para não depender de chaves de terceiros e controlar meu custo.
- Como owner/admin de um tenant, quero que cada agente mantenha seu próprio modelo (override), para que o especialista jurídico use um modelo mais capaz e o supervisor use um mais barato.

**Super-admin**
- Como super-admin, quero definir um provedor e modelo padrão de sistema para o assistente e outro para extração de PDF, para que tenants recém-criados funcionem out-of-the-box sem configurar nada.
- Como super-admin, quero mudar o default de sistema em runtime sem redeploy, para responder a indisponibilidade ou mudança de pricing de um provedor.
- Como super-admin, quero continuar trocando de tenant via `?tenant_id=` e gerenciar a config de qualquer tenant quando necessário.

**Membro comum de tenant**
- Como membro comum de um tenant, quero consumir a config de AI definida pelo meu owner/admin, sem poder alterá-la, para evitar que membros troquem provedor/chave sem controle.

**Edge cases**
- Como owner/admin de um tenant novo (sem config), quero que o sistema use automaticamente o default de sistema, para que o assistente e a extração funcionem desde o primeiro dia.
- Como owner/admin que já tinha config em `profiles`, quero que minha config seja migrada automaticamente para o tenant no primeiro acesso, sem precisar reconfigurar do zero.

## Core Features

### Feature 1 — Configuração de IA por tenant (3 buckets)
O owner/admin de um tenant edita, numa nova aba "Configurações do Tenant" dentro de Settings, três buckets independentes:
- **Assistente** — provedor + modelo + chaves usados pelo chat de cobrança (`processChat`) e pelo help-chat de suporte.
- **Extração de PDF** — provedor + modelo + chaves usados pelas rotas de extração de contratos e de devedores (tipicamente um modelo com visão de documento).
- **Agentes** — provedor + modelo + chaves usados como base pela pipeline multi-agente de cobrança (supervisor, especialistas, qualidade).

Cada bucket suporta os seis provedores atuais (opencode, gemini, openai, anthropic, openrouter, ollama). As chaves inseridas são criptografadas (mesma infraestrutura de Vault já existente) e nunca exibidas de volta; a UI mostra apenas a presença/ausência de cada segredo salvo. Campos vazios não substituem segredos já salvos.

### Feature 2 — Padrões de sistema (super-admin, 2 buckets)
Uma nova página em `/admin` (Painel Admin) permite ao super-admin definir padrões globais em dois buckets:
- **Assistente** — provedor + modelo (e chaves opcionais) de sistema.
- **Extração de PDF** — provedor + modelo (e chaves opcionais) de sistema.

Esses padrões atuam como fallback quando o tenant não configurou o bucket correspondido. O super-admin edita em runtime; não exige redeploy.

### Feature 3 — Cadeia de resolução unificada
Um único resolvedor server-side centraliza a lógica de eleição de provedor/modelo/chave com a precedência: override de modelo por agente-row (somente modelo, dentro da pipeline de agentes) → bucket do tenant correspondente à função → default de sistema correspondente → fallback hardcoded existente. Substitui os ternários e os `process.env.*_API_KEY` espalhados. O `process.env.OPENCODE_API_KEY` permanece apenas como último fallback no resolvedor.

### Feature 4 — Migração one-shot do owner para o tenant
No primeiro acesso do owner/admin à nova aba de Settings pós-deploy, a config de IA existente em `profiles` (provedor, modelo, chaves) é copiada (não movida) para o bucket `assistant` do tenant, re-criptografada via `ai_encrypt`. Um flag `migrated_at` evita re-execução. As colunas de AI de `profiles` deixam de ser a fonte de verdade para AI (permanecem para mensageria Z-API/Telegram).

### Feature 5 — Extração de PDF tenant-scoped e autenticada
As rotas `/api/extract-contract` e `/api/debtors/extract-pdf` passam a resolver provedor/modelo/chave via o bucket `pdf_extraction` do tenant (com fallback para o default de sistema e depois fallback hardcoded), em vez de hardcoded `minimax-m3`/OpenCode. A rota `/api/debtors/extract-pdf` passa a exigir sessão autenticada (alinhada ao middleware) e a operar no contexto do tenant ativo do usuário.

## User Experience

**Persona primária — owner/admin de tenant**
1. Abre Settings → vê a nova aba "Configurações do Tenant".
2. No primeiro acesso, vê um aviso "Sua configuração de IA foi migrada automaticamente para este tenant" (se já havia config em `profiles`).
3. Seleciona o bucket (Assistente / Extração de PDF / Agentes) — três sub-seções distintas, cada uma com seu próprio seletor de provedor, seletor de modelo (com lista válida por provedor) e campos de chave por provedor.
4. Salva por bucket; segredos mostram "salvo" em vez do valor.
5. As chamadas de IA do tenant começam a usar a nova config imediatamente.

**Persona secundária — super-admin**
1. Abre Painel Admin → "Padrões de IA" (nova página).
2. Define provedor + modelo para o bucket Assistente e para o bucket Extração de PDF.
3. Salva; todos os tenants sem config própria passam a usar esses defaults.

**Persona secundária — membro comum**
- Vê a aba "Configurações do Tenant" como somente leitura (ou não vê os campos editáveis), sem capacidade de alterar.

**Descoberta**: a aba nova aparece em Settings para todo usuário autenticado do tenant; o Painel Admin mostra a página "Padrões de IA" apenas para `is_super_admin = true`. Um membro comum ao tentar PUT na API de config do tenant recebe 403. Acessibilidade: mesma estrutura de formulários já usada na aba IA atual, com labels associadas e estado de "salvo" comunicado por badge textual.

## High-Level Technical Constraints

- **Multi-tenant isolation**: a config de AI de um tenant nunca pode vazar para outro; a API de config valida que o solicitante é owner/admin do mesmo `tenant_id` que está sendo editado (`requireTenantContext` + `requireRole('admin')`).
- **Segredos**: chaves continuam criptografadas em repouso via Vault (RPC `ai_encrypt`/`ai_decrypt` existente), acessíveis só com service role; nunca retornadas pela API — apenas flags de presença.
- **Provedores suportados**: continuar aceitando os seis provedores atuais; não remover nenhum.
- **Sem dependência de redo deploy** para mudar defaults de sistema: o super-admin edita em runtime.
- **Compatibilidade com demo mode**: se env vars do Supabase faltarem (demo mode), a config de AI degrada graciosamente para o fallback hardcoded, como hoje.
- **Performance**: a resolução de config de AI por chamada não pode adicionar uma viagem de ida e volta extra por chamada de LLM; deve ser cached/prefetch quando possível.

## Non-Goals (Out of Scope)

- **Provider override por agente-row** (cada agente com seu próprio provedor/chave): deferred — permanece apenas override de **modelo**.
- **Bucket de sistema para "agentes"**: o super-admin define defaults só para assistente e extração de PDF; o bucket de agentes fica exclusivamente por tenant (e fallback do bucket assistente do tenant para a pipeline quando não configurado).
- **Catálogo dinâmico de modelos por provedor** (puxar lista de modelos da API do provedor): o MVP usa listas whitelisted por provedor, como hoje.
- **Rotas de mensageria** (Z-API/Telegram): permanecem em `profiles`, não migradas.
- **Telemetria/contabilização de tokens e custos por tenant**: fora do escopo do MVP.
- **Permissões granularizadas além de owner/admin**: papéis novos no `tenant_members` não são introduzidos aqui.
- **Substituição dos fallbacks hardcoded por completo**: o último fallback (`minimax-m3`/OpenCode env key) permanece como behaviour seguro final.

## Phased Rollout Plan

### MVP (Phase 1) — entrega única
- Configuração de IA por tenant (3 buckets) com UI em Settings (nova aba).
- Padrões de sistema (2 buckets) com UI em `/admin/ai-defaults`.
- Cadeia de resolução unificada (resolvedor server-side) substituindo ternários espalhados.
- Migração one-shot do owner para o tenant com flag `migrated_at`.
- Extração de PDF tenant-scoped e autenticada (ambas as rotas).
- `.env.example` documentado com as variáveis de AI faltantes.
- **Critérios de sucesso para encerrar a Fase 1**:
  - Owner/admin consegue salvar/reler config de IA por bucket via UI.
  - Membro comum recebe 403 ao tentar PUT.
  - A cadeia de resolução respeita a precedência documentada, verificada com cada bucket preenchido/vazio.
  - Extração de PDF usa o bucket `pdf_extraction` do tenant e degrada para o default de sistema quando o bucket está vazio.
  - Migração one-shot roda uma única vez por tenant e não re-criptografa chaves já migradas.

### Phase 2 (futuro)
- Override de **provider** por agente-row (adicionar `ai_provider` + chaves na `agents` table).
- Catálogo dinâmico de modelos por provedor (auto-fetch).
- Contabilização de tokens/custo por tenant por função.

### Phase 3 (futuro)
- Default de sistema para o bucket "agentes".
- Suporte a provedores adicionais (ex.: Bedrock, Vertex) via plugin.
- Workspaces/folds de config para experimentos A/B de modelos.

## Success Metrics

- **Cobertura de configuração**: ≥80% dos tenants ativos têm ao menos o bucket "Assistente" configurado em 30 dias após deploy.
- **Migração sem retrabalho**: 100% dos tenants com config pré-existente em `profiles` são migrados sem intervenção manual (flag `migrated_at` set), medido no primeiro acesso do owner.
- **Fallback correto**: zero chamadas de IA roteadas para a chave errada por ambiguidade de precedência (verificado por suite de testes da cadeia de resolução).
- **Extração de PDF consistente**: extração de um mesmo contrato produz o mesmo resultado quando rodada por dois usuários do mesmo tenant (mesma config), e resultado diferente/adequado quando rodada por tenants com config de extração diferente.
- **Operabilidade sem redeploy**: super-admin consegue trocar o default de sistema em runtime e a mudança reflete imediatamente.
- **Segurança**: chaves de API nunca aparecem em respostas de API nem em logs; apenas flags de presença.

## Risks and Mitigations

- **Adoção**: tenants existentes podem não perceber a nova aba nem reconfigurar depois que o fallback de sistema passa a cobrir. Mitigação: banner na nova aba + aviso no chat quando a config vigente vem de fallback de sistema.
- **Confusão de "qual config vale"**: com quatro níveis de precedência, o usuário pode ficar incerto sobre qual config está ativa. Mitigação: a UI exibe explicitamente "usando configuração do tenant" vs "usando padrão de sistema" vs "fallback" no bucket vigente.
- **Dependência de provedor**: alguns tenants canibalsam a chave do sistema em vez de digitar a própria, criando acoplamento. Mitigação: permitir mas não encorajar o reuso de default de sistema; recomendar chave própria no banner.
- **Risco externo**: indisponibilidade/mudança de pricing de um provedor pode afetar muitos tenants simultaneamente quando usam o default de sistema. Mitigação: super-admin pode trocar o default em runtime; o fallback hardcoded permanece como rede de segurança.

## Architecture Decision Records

- [ADR-001: Tenant-scoped AI provider/model configuration with per-function buckets and one-shot migration](adrs/adr-001.md) — Adota configuração de IA por tenant com 3 buckets + 2 buckets de sistema + cadeia de resolução unificada + migração one-shot, entregues em MVP único.

## Open Questions

- **Market research (resolvido)**: pesquisa externa feita — LiteLLM (gateway LLM open-source mais adotado) e Portkey (gateway comercial). Ambos validam a abordagem proposta: hierarquia org → team → virtual key, **"model groups" lógicos por função (equivalentes aos nossos "buckets")**, herança de config do nível superior, e spend tracking por nível. A arquitetura escolhida (resolvedor único + 3 buckets por tenant + 2 buckets de sistema) é a versão "lite" do padrão de gateway, adequada ao porte Next.js + Supabase. Orçamento/rate-limit e spend tracking por tenant são Non-Goals do MVP que seguem o lead do LiteLLM em Phase 2. Defaults de provedor/modelo por bucket ficam a cargo do super-admin no deploy (recomendação de referência em ADR/tabela de defaults — não prescrita no corpo do PRD).
- **Bucket "agentes" de sistema**: confirmar se fica explicitamente fora do MVP (Non-Goal) ou se deve existir como um terceiro bucket de sistema opcional para consistência. Atualmente fora do escopo.
- **Persistência do "from onde veio a config vigente"**: decidir no TechSpec se exibir proveniência (tenant/sistema/fallback) na UI de Settings e/ou em uma página de diagnóstico de config.
- **Cache da resolução**: definir no TechSpec a estratégia de cache do resolvedor para não acrescentar round-trip por chamada de LLM.
- **Chaves globais reutilizáveis**: confirmar que o super-admin **não** cadastra chaves globais compartilhadas entre tenants (decisão atual); só provedor+modelo de sistema. Reavaliar se surge demanda de tenants pequenos sem conta própria em provedor.