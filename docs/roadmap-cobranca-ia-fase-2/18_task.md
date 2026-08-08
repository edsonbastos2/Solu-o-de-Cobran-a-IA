---
status: pending
title: Rate limiter multi-instância (Redis/Upstash)
type: infra
complexity: medium
dependencies: []
---

# Rate limiter multi-instância (Redis/Upstash)

## Visão Geral

`lib/rate-limit.ts` é in-memory (janela fixa), quebrando em deploy com mais de 1 réplica. Migrar para Redis/Upstash para suportar multi-instância. Necessário para escalar horizontalmente.

<critical>
- Leia o PRD e a TechSpec antes de implementar.
- Referencie as seções relevantes da TechSpec.
- DEVE manter a mesma API (`rateLimit(key, max, windowMs)`).
- Fallback in-memory se Redis não configurado (demo mode).
- Não introduzir latência significativa (<50ms).
- Execute `npm run lint && npm run build`.
</critical>

<requirements>
1. Implementar `rateLimit` usando Upstash Redis REST (sem conexão persistente).
2. Manter fallback in-memory quando `UPSTASH_REDIS_REST_URL` ausente.
3. Manter a assinatura atual `rateLimit(key, max, windowMs) → boolean` — os callers de webhook (`app/api/webhook/whatsapp/route.ts`, `app/api/webhook/telegram/route.ts`) já dependem do retorno booleano; não quebrá-los.
4. Documentar variável de ambiente em `.env.example`.
5. Testar em webhooks (whatsapp/telegram) e help-chat.
</requirements>

## Subtarefas

- [ ] Instalar `@upstash/redis` (ou usar fetch direto).
- [ ] Reescrever `lib/rate-limit.ts` com fallback.
- [ ] Adicionar `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` em `.env.example`.
- [ ] Validar em webhooks e help-chat.

## Detalhes de Implementação

### Arquivos a Modificar

- `lib/rate-limit.ts`.
- `.env.example`.

### Arquivos Relevantes

- `app/api/webhook/whatsapp/route.ts`, `app/api/webhook/telegram/route.ts`, `app/api/help-chat/route.ts`.

## Testes

### Testes de Integração

- [ ] Sem Redis, fallback in-memory funciona.
- [ ] Com Redis, limite respeitado entre instâncias (simulado).
- [ ] Latência <50ms.

## Critérios de Sucesso

- [ ] Rate limiter multi-instância funcional.
- [ ] Fallback preserva demo mode.
- [ ] `npm run lint && npm run build` sem erros.