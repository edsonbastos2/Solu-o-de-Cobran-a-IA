# Tarefas — Ticket 1806: Plataforma de Canais de Comunicação com Integração Telegram

Specs: `prd.md` e `techspec.md` neste diretório. ADRs 001–006 em `adrs/`.

| # | Tarefa | Tipo | Complexidade | Dependências | Status |
|---|---|---|---|---|---|
| 1 | Migration SQL `supabase_channel_platform.sql` (tabelas, colunas, RLS, backfill) | supabase | high | — | completed |
| 2 | Interface `CommunicationChannel` (`lib/channels/types.ts` + `channel.ts`) | backend | low | — | completed |
| 3 | Adapters `whatsapp-channel.ts` e `telegram-channel.ts` | backend | medium | 2 | completed |
| 4 | `registry.ts` — resolução de canal + config por tenant | backend | medium | 1, 3 | completed |
| 5 | `message-service.ts` + `lib/messaging.ts` como fachada | backend | high | 4 | completed |
| 6 | `inbound.ts` + refatoração dos webhooks em adaptadores finos | api | high | 4 | completed |
| 7 | Migração dos callers do domínio para o message-service | refactor | high | 5 | completed |
| 8 | Rota `/api/tenants/[id]/channel-configs` (GET/PUT/DELETE) | api | high | 4 | completed |
| 9 | Vinculação segura do Telegram (link token + `/start`) | api | high | 6, 8 | completed |
| 10 | Canal ativo por caso (PATCH `active_channel` + unlink de canal) | api | medium | 5 | completed |
| 11 | UI: aba Canais em Configurações | frontend | high | 8 | completed |
| 12 | UI: vinculação de Telegram nos clientes + canal ativo no caso | frontend | high | 9, 10 | completed |
| 13 | Verify SQL + `.env.example` + documentação de padrões | docs | medium | 1, 7, 9, 10, 11, 12 | completed |

## Notas de Orquestração

- Tarefas 1 e 2 podem rodar em paralelo; 3 depende apenas de 2.
- O pipeline de verificação do projeto é `npm run lint && npm run build` (não há suite de testes automatizada — ver AGENTS.md); scripts `*_verify.sql` cobrem a camada de banco.
- A migration (tarefa 1) deve ser aplicada manualmente ao Supabase antes de qualquer código que leia as tabelas novas.
