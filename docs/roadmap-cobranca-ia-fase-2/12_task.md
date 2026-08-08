---
status: pending
title: Biblioteca de templates de mensagens
type: backend
complexity: medium
dependencies: []
---

# Biblioteca de templates de mensagens

## Visão Geral

Não há tabela/UI para biblioteca de mensagens — apesar de `suggestedQuestions` no estágio, nada é persistido. Criar tabela `message_templates` (canal, estágio, idioma, variáveis como `{nome}`, `{valor}`, `{vencimento}`) e UI `/templates` com preview usando dado real de um caso. O Especialista pode usar template como fallback quando a LLM falha ou como base para variação. Reduz custo de LLM e garante conformidade CDC auditável.

<critical>
- Leia o PRD e a TechSpec antes de implementar.
- Referencie as seções relevantes da TechSpec.
- Templates passam por revisão de compliance (CDC Art. 42).
- Variáveis DEVE ser substituídas server-side, nunca no cliente.
- Preview DEVE usar um caso real do tenant (não mock global).
- Execute `npm run lint && npm run build`.
</critical>

<requirements>
1. Nova tabela `message_templates` (migration): id, tenant_id, name, channel, stage, language, body, variables JSONB, is_active, created_by, created_at.
2. `GET/POST /api/message-templates` e `PUT/DELETE /api/message-templates/[id]`.
3. Variáveis suportadas: `{nome}`, `{valor}`, `{vencimento}`, `{dias_atraso}`, `{empresa}`, `{dias_para_negativacao}`.
4. Preview `POST /api/message-templates/[id]/preview` aceita `case_id` e retorna body com variáveis substituídas.
5. UI `/templates` com editor e preview.
6. Especialista em `lib/agent.ts` pode receber template como fallback quando LLM falha.
</requirements>

## Subtarefas

- [ ] Criar migration `message_templates`.
- [ ] CRUD `/api/message-templates` e `/api/message-templates/[id]`.
- [ ] Endpoint de preview com substituição de variáveis.
- [ ] UI `app/templates/page.tsx` (editor + preview).
- [ ] Integrar fallback no Especialista em `lib/agent.ts`.
- [ ] Seed de templates padrão por estágio.

## Detalhes de Implementação

### Arquivos a Criar

- Migration SQL `message_templates`.
- `app/api/message-templates/route.ts`, `app/api/message-templates/[id]/route.ts`
- `app/templates/page.tsx`

### Arquivos a Modificar

- `lib/agent.ts` — fallback para template.
- `lib/types.ts` — tipo `MessageTemplate`.

### Arquivos Relevantes

- `lib/finance.ts` — estágios e variáveis.

## Testes

### Testes de Integração

- [ ] Template com variáveis substitui corretamente com dado real.
- [ ] Template inativo não aparece na lista de seleção.
- [ ] Especialista usa template quando LLM retorna erro.
- [ ] Tenant isolado.

## Critérios de Sucesso

- [ ] Templates criáveis e com preview.
- [ ] Fallback de IA funcional.
- [ ] `npm run lint && npm run build` sem erros.