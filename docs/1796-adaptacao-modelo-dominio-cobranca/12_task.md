---
status: completed
title: Endurecer webhooks e cron
type: whatsapp
complexity: high
dependencies: ["10_task", "11_task"]
---

# Endurecer webhooks e cron

## Visão Geral

Garantir que WhatsApp, Telegram e jobs automáticos resolvam tenant e caso antes de ler ou alterar dados. O fluxo externo deve continuar funcional sem misturar carteiras de empresas.

<critical>
- Leia as seções de Integração e Observabilidade da TechSpec.
- Preserve contratos públicos dos webhooks quando possível.
- Identificadores externos ambíguos DEVEM ser rejeitados.
- Service role não substitui validação de tenant.
</critical>

<requirements>
1. Webhooks DEVEM validar segredo/assinatura quando aplicável.
2. A busca de caso DEVE incluir tenant da instância ou bot.
3. Eventos duplicados DEVEM ser tratados sem duplicar mensagens.
4. Cron DEVE processar cada tenant no contexto correto.
5. Mensagens e status automáticos DEVEM gerar auditoria.
</requirements>

## Subtarefas

- [x] Revisar resolução de tenant por instância/bot.
- [x] Corrigir WhatsApp e Telegram.
- [x] Corrigir cron de follow-up e alertas.
- [x] Adicionar logs estruturados.

## Detalhes de Implementação

### Arquivos a Criar

- Nenhum, salvo helper existente que precise ser criado após inspeção.

### Arquivos a Modificar

- `lib/webhook-tenant.ts` — resolução de tenant.
- `app/api/webhook/whatsapp/route.ts` — escopo e idempotência.
- `app/api/webhook/telegram/route.ts` — escopo e deep link.
- `app/api/cron/follow-up/route.ts` — processamento tenant-safe.
- `app/api/cron/alert-admin/route.ts` — alertas tenant-safe.

### Arquivos Relevantes

- `lib/whatsapp.ts` — envio existente.
- `lib/agent.ts` — processamento de conversa.

### Arquivos Dependentes

- `16_task.md` — verificação integrada.

## Entregáveis

- [x] Webhooks isolados por tenant.
- [x] Cron sem mistura de carteiras.
- [x] Idempotência e logs.

## Testes

### Testes Unitários

- [x] Segredo inválido é rejeitado.
- [x] Instância desconhecida não resolve tenant.

### Testes de Integração

- [x] Evento duplicado não cria mensagem duplicada.
- [x] Mesmo telefone em dois tenants não cruza casos.
- [x] Deep link de outro tenant é rejeitado.
- [x] Cron processa casos de tenants distintos isoladamente.

## Critérios de Sucesso

- [x] Nenhum webhook acessa caso sem contexto válido.
- [x] Mensagens externas continuam chegando ao caso correto.
- [x] Logs permitem rastrear tenant e evento.
- [x] `npm run lint` sem erros.
- [x] `npm run build` sem erros.
