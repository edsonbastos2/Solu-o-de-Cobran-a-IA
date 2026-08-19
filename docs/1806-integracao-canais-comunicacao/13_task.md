---
status: pending
title: Verify SQL + .env.example + documentação de padrões
type: docs
complexity: medium
dependencies: ["1_task", "7_task", "9_task", "10_task", "11_task", "12_task"]
---

# Verify SQL + .env.example + documentação de padrões

## Visão Geral

Fecha a entrega: script de verificação de banco no padrão `*_verify.sql`, atualização do `.env.example` com os papéis das variáveis de mensageria e registro dos novos padrões (módulo de canais) na documentação de agentes.

<critical>
- Leia PRD e TechSpec antes de implementar
- Referencie a seção "Estratégia de Testes" do TechSpec
- Foque no QUÊ entregar, não no COMO
- Minimize alterações de código ao necessário
- Testes são obrigatórios
- Execute `npm run lint && npm run build` como pipeline de verificação
</critical>

<requirements>
1. `supabase_channel_platform_verify.sql` DEVE seguir o padrão de `supabase_collection_case_core_verify.sql`: verificações com DO blocks / queries que reportam PASS/FAIL, sem mutar dados de produção.
2. O script DEVE verificar: RLS das três tabelas novas (membro do tenant lê; usuário de outro tenant não lê — via `SET LOCAL request.jwt.claims` ou simulação equivalente ao padrão do verify existente), uniques (`webhook_secret_hash`; `(tenant_id, client_id, channel)`; `(tenant_id, channel, external_id)`; índice parcial de `messages`), backfill consistente (casos com `telegram_chat_id` e client possuem `client_channels`), e uso único de token (UPDATE com `WHERE used_at IS NULL` afeta 1 linha na primeira vez e 0 na segunda).
3. `.env.example` DEVE atualizar a seção "Telegram Configuration" e "Messaging provider" documentando que `TELEGRAM_BOT_TOKEN` e `ZAPI_*` são fallback de demo/desenvolvimento (a fonte de verdade em produção é a aba Canais por tenant) e que `APP_URL` é usada para registrar o webhook do Telegram (`${APP_URL}/api/webhook/telegram`).
4. `AGENTS.md` DEVE ganhar uma seção curta sobre o módulo `lib/channels/`: o domínio usa `sendCaseMessage`/`sendClientMessage` (nunca adapters diretos), novos canais implementam `CommunicationChannel` e se registram no registry, segredos de canal vivem em `channel_configs` cifrados.
5. A documentação DEVE ser em pt-BR (regra do AGENTS.md).
6. Executar o pipeline completo `npm run lint && npm run build` como evidência final da entrega.
</requirements>

## Subtarefas

- [ ] Escrever `supabase_channel_platform_verify.sql` com as verificações do requisito 2
- [ ] Atualizar `.env.example`
- [ ] Atualizar `AGENTS.md` (seção do módulo de canais)
- [ ] Executar `npm run lint && npm run build` e registrar evidência
- [ ] Atualizar `tasks.md` com status finais

## Detalhes de Implementação

### Arquivos a Criar

- `supabase_channel_platform_verify.sql` — verificação da migration da tarefa 1

### Arquivos a Modificar

- `.env.example` — seções Telegram/Messaging/APP_URL
- `AGENTS.md` — seção do módulo de canais
- `docs/1806-integracao-canais-comunicacao/tasks.md` — status finais

### Arquivos Relevantes

- `supabase_collection_case_core_verify.sql` — padrão de verify SQL do projeto
- `AGENTS.md` — estrutura atual da documentação de padrões
- `.env.example` — formato de documentação de variáveis

### Arquivos Dependentes

- Nenhum

### ADRs Relacionados

- Todos os ADRs 001-006 são referenciados indiretamente; nenhum novo.

## Entregáveis

- [ ] Verify SQL executável com relatório PASS/FAIL
- [ ] `.env.example` e `AGENTS.md` atualizados
- [ ] Evidência fresca de `npm run lint && npm run build` passando

## Testes

### Testes de Integração

- [ ] Verify SQL executado no Supabase de desenvolvimento: todas as verificações PASS
- [ ] `npm run lint` sem erros
- [ ] `npm run build` compila (inclui typecheck)

## Critérios de Sucesso

- [ ] Verify SQL 100% PASS
- [ ] Pipeline verde
- [ ] Checklist manual do PRD (fluxo de ponta a ponta) executado e registrado
