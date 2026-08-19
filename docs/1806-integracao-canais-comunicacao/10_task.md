---
status: pending
title: Canal ativo por caso (PATCH active_channel + unlink de canal)
type: api
complexity: medium
dependencies: ["5_task"]
---

# Canal ativo por caso (PATCH active_channel + unlink de canal)

## Visão Geral

Expõe a troca manual do canal ativo do caso (PATCH em cases/[id]) e a remoção de vinculação de canal de um cliente (correção de associação indevida), ambos com validação contra os canais realmente vinculados do cliente.

<critical>
- Leia PRD e TechSpec antes de implementar
- Referencie as seções "Endpoints de API" e "Modelo de Dados" do TechSpec
- Foque no QUÊ entregar, não no COMO
- Minimize alterações de código ao necessário
- Testes são obrigatórios
- Execute `npm run lint && npm run build` como pipeline de verificação
</critical>

<requirements>
1. `PATCH /api/cases/[id]` DEVE estender a whitelist de campos (hoje `['status','assigned_user_id']` na linha 107-111) com `active_channel` (`'whatsapp'|'telegram'`).
2. A alteração de `active_channel` DEVE validar que o cliente do caso possui `client_channels` ativo no canal informado; sem vinculação → 422/400 com mensagem "Cliente não possui o canal X vinculado".
3. A troca DEVE gravar auditoria (`recordAuditAction`, action `CASE_CHANNEL_CHANGED`) com old/new value.
4. `DELETE /api/clients/[id]/channels/[channel]` DEVE exigir `requireRole(req, 'gestor')`, remover a linha de `client_channels` scoped ao tenant e audituar `CLIENT_CHANNEL_UNLINKED`.
5. O unlink de canal que está ativo em casos abertos DEVE: definir `active_channel = NULL` nesses casos (voltam ao fallback legado) OU recusar com 409 — implementar a opção de definir NULL com auditoria, mantendo o caso comunicável pelo fallback.
6. `GET /api/cases/[id]` DEVE retornar `active_channel` do caso e os canais vinculados do cliente (para a UI da tarefa 12 renderizar o seletor) — estender o `CASE_SELECT`/payload com `client_channels` aninhado no client.
7. `lib/types.ts` DEVE ganhar `active_channel?: 'whatsapp'|'telegram'` em `Case` e o tipo `ClientChannel` (`id, channel, external_id?, username?, verified_at?` — external_id NÃO DEVERIA ser exposto ao frontend; usar apenas canal/username/verified_at).
8. Mutações DEVEM filtrar por `tenant_id` do contexto em todas as queries (padrão das rotas existentes).
</requirements>

## Subtarefas

- [ ] Estender PATCH de cases com `active_channel` + validação + auditoria
- [ ] Criar `DELETE /api/clients/[id]/channels/[channel]` com tratamento de casos abertos
- [ ] Estender GET do caso com canal ativo e canais do cliente (sem external_id)
- [ ] Atualizar `lib/types.ts`
- [ ] Compilar e lintar

## Detalhes de Implementação

### Arquivos a Criar

- `app/api/clients/[id]/channels/[channel]/route.ts` — DELETE de vinculação

### Arquivos a Modificar

- `app/api/cases/[id]/route.ts` — PATCH (whitelist + validação), GET (payload com canais)
- `lib/types.ts` — `Case.active_channel`, `ClientChannel`

### Arquivos Relevantes

- `app/api/cases/[id]/route.ts:94-178` — PATCH atual com whitelist e `STATUS_TRANSITIONS`
- `app/api/cases/[id]/route.ts:15-27` — `CASE_SELECT` aninhado (cases → client) para incluir `client_channels`
- `app/api/clients/[id]/route.ts` — padrão de rota com `requireRole` e 404 "não encontrado ou acesso negado"

### Arquivos Dependentes

- `app/(dashboard)/cases/[id]/page.tsx` (tarefa 12) — UI do seletor de canal ativo
- `lib/channels/message-service.ts` (tarefa 5) — consome `active_channel` (resolução já implementada lá)

### ADRs Relacionados

- [ADR-002: Identidade de canal por cliente com canal ativo por caso](adrs/adr-002.md) — troca explícita pelo operador

## Entregáveis

- [ ] PATCH com `active_channel` validado
- [ ] DELETE de vinculação com auditoria e tratamento de casos abertos
- [ ] GET do caso expondo canal ativo + canais vinculados (sem identificadores externos)

## Testes

### Testes de Integração

- [ ] PATCH `active_channel='telegram'` com cliente vinculado → 200 e campo atualizado + auditoria
- [ ] PATCH `active_channel='telegram'` sem vinculação → 422/400 com mensagem específica
- [ ] PATCH como `operador` (role abaixo de gestor) → 403 (PATCH exige gestor — comportamento atual)
- [ ] DELETE de vinculação telegram com caso aberto usando o canal → vinculação removida, `active_channel` do caso NULL, auditoria
- [ ] GET do caso → `active_channel` e `client.client_channels` presentes, sem `external_id`

## Critérios de Sucesso

- [ ] `npm run build` compila
- [ ] `npm run lint` sem erros
- [ ] Nenhuma query sem filtro de tenant nas mutações
