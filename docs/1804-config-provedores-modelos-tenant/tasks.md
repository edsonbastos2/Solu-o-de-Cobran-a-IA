# Configuração de Provedores e Modelos de IA por Tenant — Task List

Ticket: `1804` · Slug: `config-provedores-modelos-tenant`

## Tasks

| # | Title | Status | Complexity | Dependencies |
|---|-------|--------|------------|--------------|
| 01 | Migration SQL: `tenants.ai_migrated_at`, `system_ai_defaults`, RPCs `get_tenant_ai_keys`/`get_system_ai_keys` | done | medium | — |
| 02 | Resolver central `lib/ai-config.ts` (cadeias assistant/pdf_extraction/agents) | done | high | task_01 |
| 03 | API `app/api/tenants/[id]/ai-config` (GET+PUT + migração lazy) | done | high | task_01, task_02 |
| 04 | API `app/api/admin/ai-defaults` (GET+PUT, super-admin) | done | medium | task_01, task_02 |
| 05 | Wire chat call sites ao resolver (`agent.ts`, `case-insights.ts`, `start-negotiation`, `help-chat`) | done | high | task_02 |
| 06 | Wire rotas de extração ao resolver (`extract-contract` + `debtors/extract-pdf` com auth+tenant) | done | high | task_01, task_02 |
| 07 | UI Settings — aba "Configurações do Tenant" + IA por-usuário read-only + banner de migração | done | high | task_03 |
| 08 | UI Admin — página `app/(dashboard)/admin/ai-defaults` | done | medium | task_04 |
| 09 | Docs `.env.example` + verificação final `lint`/`build`/`tsc --noEmit` | done | low | task_02, task_05, task_06, task_07, task_08 |

## Dependency graph

```
01 ──┬──> 02 ──┬──> 03 ──> 07 ──┐
     │         ├──> 04 ──> 08 ──┤
     │         ├──> 05 ─────────┤
     └─────────┴──> 06 ─────────┴──> 09
```

## Notes on testing

O projeto **não possui suite de testes automatizada** (ver `AGENTS.md`). A validação de cada tarefa é via compilação TypeScript (`npm run build`, `npx tsc --noEmit`), ESLint (`npm run lint`) e checklist manual por tarefa. As seções "Tests" declaram esses passos + cenários manuais por bucket, conforme a realidade do projeto.

## Verification evidence (Task 09 — execução fresca)

Trindade estática (evidência coletada ao final da implementação, branch de trabalho):

- `npx tsc --noEmit` → **exit 0** (sem erros de tipo). Inclui o fix de um bug pré-existente em `app/api/cron/score-propensity/route.ts` (`result.components` → `result.factors`, alinhado a `PropensityResult` em `lib/propensity.ts`) que bloqueava o gate.
- `npm run lint` → **0 erros**, 3 warnings pré-existentes (prefer-const em `components/pagination.tsx`/`lib/utils.ts`, no-console em `lib/logger.ts`). Nenhum warning nos novos arquivos.
- `npm run build` (typecheck do Next.js) → **exit 0**; rota nova `/api/tenants/[id]/ai-config` e página `/admin/ai-defaults` incluídas no build.

Security advisor (`supabase_get_advisors`, security):

- **Nenhum finding high/critical introduzido pela feature.**
- Único finding em objeto novo: `public.system_ai_defaults` → `rls_enabled_no_policy` level **INFO**. Intencional e desejável: a tabela é service-role-only (`REVOKE anon, authenticated` + `GRANT service_role`) e o RLS deny-all adiciona defesa em profundidade (service_role bypassa RLS).
- As RPCs novas `get_tenant_ai_keys(UUID)` e `get_system_ai_keys()` são `SECURITY DEFINER` com `REVOKE ... FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE TO service_role` — **não** flaggadas pelo advisor (não chamáveis por anon/authenticated).
- Demais findings (webhook_events, current_member_role, is_tenant_manager, app_is_super_admin, can_access_tenant, current_tenant_id, create_collection_case, is_super_admin, auth_leaked_password_protection) são **pré-existentes**, não introduzidos por esta feature.

Migração SQL aplicada ao projeto Supabase remoto via `supabase_apply_migration` (`ai_config_tenant_storage_primitives`): `tenants.ai_migrated_at`, `system_ai_defaults`, `get_tenant_ai_keys`, `get_system_ai_keys`. Idempotente (`IF NOT EXISTS` / `OR REPLACE`). Arquivo canonical: `supabase_ai_config_tenant.sql` na raiz.

Manual matrix por bucket (a executar em ambiente dev com LLM real — declarada em tasks 02/05/06):
- assistant tenant set → `source=tenant` • assistant vazio + system set → `source=system` • ambos vazios → `source=hardcoded` (opencode/deepseek-v4-flash/OPENCODE_API_KEY).
- pdf_extraction tenant set (anthropic) → `source=tenant` • vazio + system anthropic → `source=system` • ambos vazios → `source=hardcoded` (opencode/minimax-m3/OPENCODE_API_KEY).
- agents: agentRow.model override → substitui só modelo; tenant.agents vazio cai em tenant.assistant.

Decisões de maestro (desvios deliberados, documentados para revisão):
- **GET `/api/tenants/[id]/ai-config`** admite qualquer membro do tenant (read-only para membros); PUT exige admin. Atende a user story do PRD ("membro consome a config"). A asserção literal "GET sem admin → 403" do task_03 não foi honrada para membros (apenas não-membros recebem 403/404).
- **Resolvedor** consultou a env-var do provedor escolhido dentro de cada step (ex.: `GEMINI_API_KEY`) quando o bucket do tenant declara o provedor mas não traz segredo — para evitar troca silenciosa de provedor em tenants que dependiam de env pré-migração. `source` continua refletindo o nível do bucket (tenant/sistema). O fallback hardcoded final permanece `opencode` + `OPENCODE_API_KEY`.
- **`processMultiAgentSimulation`** (`lib/multi-agent.ts`) mantida com `apiKeyOverride || OPENCODE_API_KEY`: é um harness de simulação "bring-your-own-key" usado por `/api/agents/simulate` (recebe `apiKey` do body); wirar ao resolver mudaria a semântica de teste. As menções do task_05 sobre este arquivo são "Dependent Files"/note, não MUST.
- **`extract-contract`** mantém `requireUser` (não `requireTenantContext`) para preservar o onboarding do super-admin sem tenant selecionado; o tenantId é resolvido via `currentTenantId` + fallback de membership, e passado como `''` ao resolvedor quando ausente (degrada para system → hardcoded).
- Bucket JSONB do tenant escrito por read-modify-write do `settings` (preserva outros buckets) em vez de `jsonb_set` server-side; aceitável para escritas de baixa frequência.
- Migração lazy só carimba `ai_migrated_at` quando o owner tinha config real (provedor não-default OU modelo não-default OU chave) ou quando já existe bucket assistant preenchido — evita trancar tenants puro-default fora do fallback de sistema.