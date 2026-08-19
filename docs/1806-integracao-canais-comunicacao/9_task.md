---
status: pending
title: Vinculação segura do Telegram (link token + /start)
type: api
complexity: high
dependencies: ["6_task", "8_task"]
---

# Vinculação segura do Telegram (link token + /start)

## Visão Geral

Implementa o fluxo de vinculação seguro do PRD: geração de link com token temporário (uso único, 48h) na API, e o handler `/start <token>` no webhook do Telegram que valida o token, vincula o `chat_id` estável ao cliente e invalida o token.

<critical>
- Leia PRD e TechSpec antes de implementar
- Referencie as seções "Endpoints de API" (fluxo de vinculação) do TechSpec e o ADR-002
- Foque no QUÊ entregar, não no COMO
- Minimize alterações de código ao necessário
- Testes são obrigatórios
- Execute `npm run lint && npm run build` como pipeline de verificação
</critical>

<requirements>
1. `POST /api/clients/[id]/channel-links` DEVE exigir `requireRole(req, 'gestor')`, validar `body.channel === 'telegram'` e que o tenant possui config de Telegram habilitada (400 caso contrário, com mensagem "Configure o canal Telegram antes de gerar links").
2. A rota DEVE gerar token opaco de 128 bits (crypto Node), persistir apenas o SHA-256 em `channel_link_tokens` com `expires_at = now + 48h`, e retornar `{ link: 'https://t.me/<bot_username>?start=<token>', expires_at }` usando o `bot_username` da config do tenant.
3. A geração DEVE ter rate limit (10/hora por cliente) via `rateLimit` para evitar enumeração.
4. O handler `/start <token>` no webhook do Telegram DEVE: hashear o token recebido, buscar em `channel_link_tokens` do tenant, validar `used_at IS NULL` e `expires_at > now()`, e caso válido fazer upsert em `client_channels` (`external_id = String(chat.id)`, `username = msg.from.username`, `verified_at = now()`) scoped ao tenant do evento, marcar `used_at` (UPDATE com `.is('used_at', null)` — segunda execução concorrente afeta 0 linhas) e responder confirmação ao devedor.
5. Token inválido/expirado/usado DEVE responder mensagem clara sugerindo pedir um novo link ao operador — sem revelar qual condição falhou (prevenção de enumeração).
6. O upsert DEVE lidar com conflito `(tenant_id, channel, external_id)` já vinculado a outro cliente: recusar com log de auditoria `CLIENT_CHANNEL_LINK_CONFLICT` e não alterar a vinculação existente (responder ao devedor que a conta já está vinculada).
7. `/start case_<base64>` legado DEVE continuar funcionando (mantido pela tarefa 6) durante a transição.
8. `PATCH /api/cases/[id]` NÃO faz parte desta tarefa (tarefa 10).
9. Auditoria `CLIENT_CHANNEL_LINKED` (ator sistema) com `entityType: 'client'` e metadata `{ channel, external_id_length }` — sem conteúdo sensível.
10. A vinculação NÃO DEVE depender do username do Telegram em nenhuma query (identificador principal é o chat_id numérico).
</requirements>

## Subtarefas

- [ ] Rota `POST /api/clients/[id]/channel-links` com rate limit
- [ ] Handler `/start <token>` no webhook Telegram (distinto do legado `case_`)
- [ ] Upsert com tratamento de conflito + invalidação de token atômica
- [ ] Auditoria dos eventos de vinculação
- [ ] Compilar e lintar

## Detalhes de Implementação

### Arquivos a Criar

- `app/api/clients/[id]/channel-links/route.ts` — geração de link

### Arquivos a Modificar

- `app/api/webhook/telegram/route.ts` — branch `/start <token>` antes do legado `case_`

### Arquivos Relevantes

- `app/api/webhook/telegram/route.ts:52-77` — handler `/start` atual (legado) a preservar
- `app/api/tenants/[id]/channel-configs/route.ts` (tarefa 8) — fonte do `bot_username` e da checagem de canal habilitado
- `lib/api-auth.ts:149` — `requireRole`
- `lib/rate-limit.ts` — rate limit de geração
- `lib/audit.ts` — `recordAuditAction`

### Arquivos Dependentes

- `app/(dashboard)/clients/page.tsx` + modal (tarefa 12) — consome a rota de geração
- `lib/channels/message-service.ts` — passa a entregar por `client_channels` populado aqui

### ADRs Relacionados

- [ADR-002: Identidade de canal por cliente](adrs/adr-002.md) — token temporário, identificador estável, username como metadado

## Entregáveis

- [ ] Rota de geração de link com token hasheado em repouso
- [ ] Handler de vinculação com invalidação atômica
- [ ] Mensagens do bot (confirmação, token inválido, conta já vinculada) em pt-BR

## Testes

### Testes de Integração

- [ ] `POST /api/clients/[id]/channel-links` com canal Telegram não configurado → 400
- [ ] Link gerado + `/start <token>` válido → `client_channels` criado com chat_id, `used_at` preenchido, confirmação respondida
- [ ] Reuso do mesmo token → mensagem de token inválido, sem segunda vinculação
- [ ] Token expirado (UPDATE manual de `expires_at` para o passado) → recusado
- [ ] `/start` com token de outro tenant → não encontrado (isolamento)
- [ ] chat_id já vinculado a outro cliente do tenant → mensagem de conta já vinculada, vinculação original intacta
- [ ] Rate limit: 11ª geração em 1h para o mesmo cliente → 429

## Critérios de Sucesso

- [ ] `npm run build` compila
- [ ] `npm run lint` sem erros
- [ ] Token em claro não aparece em nenhuma tabela (verificar `channel_link_tokens` após fluxo completo)
