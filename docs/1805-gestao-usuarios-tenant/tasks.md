# Gestão de Equipe do Tenant com Permissões Baseadas em Papéis — Lista de Tarefas

## Tarefas

| # | Título | Status | Complexidade | Dependências |
|---|--------|--------|------------|--------------|
| 01 | Migração SQL: papéis de 4 níveis, `can_configure_ai`, triggers de convite | pendente | alta | — |
| 02 | `lib/api-auth.ts`: `TenantRole` (4 valores), `requireAIConfigPermission` | pendente | média | task_01 |
| 03 | `hooks/useAuth.ts`: expor `role`/`canConfigureAI`, corrigir fallback de `member` | pendente | baixa | task_02 |
| 04 | Retroaplicar `requireRole('gestor', ...)` nas rotas de mutação existentes | pendente | alta | task_02 |
| 05 | Rotas de API de gestão de equipe (`app/api/tenants/[id]/members/*`) | pendente | alta | task_01, task_02 |
| 06 | Interface de gestão de equipe: aba "Equipe" em Configurações | pendente | alta | task_03, task_05 |