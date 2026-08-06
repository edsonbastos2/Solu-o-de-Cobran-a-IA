# Tarefas: Núcleo de Cobrança Centrado no Domínio

| # | Título | Tipo | Complexidade | Dependências | Arquivo |
|---|---|---|---|---|---|
| 1 | Congelar baseline de dados e rotas | docs | medium | nenhuma | [1_task.md](1_task.md) |
| 2 | Criar resolução segura de tenant no servidor | backend | medium | 1 | [2_task.md](2_task.md) |
| 3 | Adicionar schema canônico de casos | supabase | high | 1 | [3_task.md](3_task.md) |
| 4 | Implementar backfill determinístico | supabase | medium | 3 | [4_task.md](4_task.md) |
| 5 | Criar RPC transacional de criação | supabase | high | 2, 3, 4 | [5_task.md](5_task.md) |
| 6 | Consolidar tipos e regras puras | refactor | medium | 5 | [6_task.md](6_task.md) |
| 7 | Criar leitura autenticada de títulos | api | medium | 2, 5, 6 | [7_task.md](7_task.md) |
| 8 | Migrar `GET/POST /api/cases` | api | medium | 5, 6, 7 | [8_task.md](8_task.md) |
| 9 | Fortalecer detalhe, PATCH, DELETE e auditoria | api | medium | 5, 6 | [9_task.md](9_task.md) |
| 10 | Corrigir rotas alternativas de mutação | api | medium | 9 | [10_task.md](10_task.md) |
| 11 | Corrigir pipeline de IA server-side | ai | high | 9, 10 | [11_task.md](11_task.md) |
| 12 | Endurecer webhooks e cron | whatsapp | high | 10, 11 | [12_task.md](12_task.md) |
| 13 | Migrar a tela de contratos | frontend | medium | 7, 8 | [13_task.md](13_task.md) |
| 14 | Atualizar a lista de casos | frontend | low | 8 | [14_task.md](14_task.md) |
| 15 | Atualizar o workspace do caso | frontend | medium | 9, 11 | [15_task.md](15_task.md) |
| 16 | Executar verificação integrada e preparar rollout | supabase | medium | 1-15 | [16_task.md](16_task.md) |
