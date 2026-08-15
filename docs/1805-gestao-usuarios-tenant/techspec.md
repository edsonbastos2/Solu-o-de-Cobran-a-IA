# TechSpec: Gestão de Equipe do Tenant com Permissões Baseadas em Papéis

## Resumo Executivo

Esta funcionalidade adiciona quatro papéis fixos (`owner`, `admin`, `gestor`, `operador`) à tabela `tenant_members` existente, uma coluna de override independente `can_configure_ai`, e um fluxo de convite por e-mail construído inteiramente sobre o `inviteUserByEmail` do Supabase Auth mais dois triggers Postgres em `auth.users` — sem novas tabelas. O estado do convite fica na coluna `status` existente de `tenant_members` (`pending` → `active`), transicionado automaticamente quando o usuário convidado confirma o e-mail dele, sem exigir uma nova rota de callback na aplicação.

Todas as mutações de gestão de equipe (convidar, alterar papel/permissão, reenviar, revogar, remover) passam pelo client admin de service role com a autorização aplicada no route handler (`requireRole(req, 'admin', ...)`), seguindo o padrão existente de `app/api/admin/users`, em vez de estender ainda mais a RLS de `tenant_members` (ver ADR-002). Como cerca de metade das rotas de mutação existentes do codebase não têm verificação de papel hoje, esta funcionalidade também retroaplica `requireRole(req, 'gestor', ...)` em toda mutação de registro de negócio sem proteção (clients, cases, contracts, negotiations, financial-titles, legal-processes) para que o `operador` seja de fato bloqueado de criar/editar/excluir — sem isso, a funcionalidade entregaria a interface para restringir o `operador` enquanto deixaria as APIs subjacentes abertas (ver ADR-004).

Trade-off principal: esta é uma mudança mais ampla do que "apenas adicionar uma tela de convite" — ela toca ~13 arquivos de rota existentes e um trigger de cadastro com o qual a maioria dos contribuidores nunca precisou se preocupar, em troca de o modelo de papéis ser efetivamente aplicado em todos os lugares onde precisa ser aplicado, em vez de apenas nos novos caminhos de código.

## Arquitetura do Sistema

### Visão Geral dos Componentes

- **`lib/api-auth.ts`** — estendido com o tipo `TenantRole` de 4 níveis, `ROLE_RANK` atualizado e um novo booleano `canConfigureAI` computado no `TenantContext`. A assinatura do `requireRole` existente não muda; apenas o conjunto de papéis cresce.
- **`app/api/tenants/[id]/members/*`** (novo) — convidar, listar, atualizar (papel/permissão), reenviar, revogar, remover. Usa o client admin de service role conforme o ADR-002.
- **Triggers Postgres em `auth.users`** (`handle_new_user` modificado, novo `handle_invited_user_confirmed`) — os únicos componentes que criam/ativam uma associação convidada; ver ADR-003.
- **`components/team-management-panel.tsx`** (novo) — lista da equipe + modais de convite/edição, renderizado como uma nova aba "Equipe" em `app/(dashboard)/settings/page.tsx`, ao lado de `components/tenant-ai-config-panel.tsx`.
- **Rotas de mutação de negócio existentes** (clients, cases, case-status, contracts, negotiations, financial-titles, legal-processes) — modificadas in-place para chamar `requireRole(req, 'gestor', ...)` em vez de `requireTenantContext`; ver ADR-004 para a lista completa.
- **`hooks/useAuth.ts`** — estendido para expor `role: TenantRole` (4 valores) e `canConfigureAI: boolean` para que a interface possa ocultar as ações de criar/editar/excluir e a aba de configuração de IA para papéis que não as possuem.
- **`lib/audit.ts`** — sem mudança de interface; as rotas de gestão de equipe chamam o `recordAuditAction` existente para convite/mudança de papel/mudança de permissão/remoção, consistente com o requisito do CLAUDE.md para qualquer mutação que altere estado.

### Fluxo de Dados

Convite: Interface → `POST /api/tenants/[id]/members/invite` (client admin, `requireRole('admin')`) → `supabaseAdmin.auth.admin.inviteUserByEmail(email, { data: {...} })` → o Supabase cria a linha `auth.users` → o trigger `handle_new_user()` dispara → insere `tenant_members` (`status='pending'`) + `profiles`. Aceitação: o usuário convidado define a senha pelo fluxo próprio do Supabase → `auth.users.email_confirmed_at` é definido → o trigger `handle_invited_user_confirmed()` dispara → `tenant_members.status='active'`. Nenhuma rota da aplicação está envolvida na aceitação.

## Design de Implementação

### Interfaces Principais

```typescript
// lib/api-auth.ts
export type TenantRole = 'owner' | 'admin' | 'gestor' | 'operador';

export interface TenantContext extends AuthContext {
  tenantId: string;
  role: TenantRole;
  canConfigureAI: boolean; // role in ('owner','admin') || tenant_members.can_configure_ai
  supabase: NonNullable<ReturnType<typeof getSupabaseServer>>;
}

const ROLE_RANK: Record<TenantRole, number> = { owner: 4, admin: 3, gestor: 2, operador: 1 };

export async function requireRole(
  req: NextRequest,
  minRole: TenantRole,
  requestedTenantId?: string | null
): Promise<{ ctx: TenantContext } | { response: NextResponse }>;

/** 403 a menos que ctx.canConfigureAI; use no lugar de requireRole para rotas de config de IA. */
export async function requireAIConfigPermission(
  req: NextRequest,
  requestedTenantId?: string | null
): Promise<{ ctx: TenantContext } | { response: NextResponse }>;
```

`requireTenantContext` computa `canConfigureAI` como `role === 'owner' || role === 'admin' || row.can_configure_ai === true` a partir da mesma linha `tenant_members` já buscada para `role`, sem custo extra de consulta.

### Modelos de Dados

`supabase_tenant_team_management.sql` (nova migração, seguindo o precedente do `supabase_roles_permissions.sql` existente):

```sql
ALTER TABLE public.tenant_members DROP CONSTRAINT IF EXISTS tenant_members_role_check;
UPDATE public.tenant_members SET role = 'operador' WHERE role = 'member';
ALTER TABLE public.tenant_members
  ADD CONSTRAINT tenant_members_role_check
  CHECK (role IN ('owner', 'admin', 'gestor', 'operador'));
ALTER TABLE public.tenant_members ALTER COLUMN role SET DEFAULT 'operador';
ALTER TABLE public.tenant_members
  ADD COLUMN IF NOT EXISTS can_configure_ai BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN public.tenant_members.status IS 'active | pending';
```

`handle_new_user()` (modificado) faz um branch sobre os metadados de convite antes de cair no caminho de auto-cadastro existente:

```sql
invited_tenant := NULLIF(NEW.raw_user_meta_data ->> 'invited_tenant_id', '')::UUID;
invited_role := NEW.raw_user_meta_data ->> 'invited_role';
IF invited_tenant IS NOT NULL AND invited_role IN ('admin','gestor','operador') THEN
  INSERT INTO public.tenant_members (tenant_id, user_id, role, status, can_configure_ai)
  VALUES (invited_tenant, NEW.id, invited_role, 'pending',
          COALESCE((NEW.raw_user_meta_data ->> 'invited_can_configure_ai')::boolean, false))
  ON CONFLICT (tenant_id, user_id) DO NOTHING;
  INSERT INTO public.profiles (id, tenant_id, name, email)
  VALUES (NEW.id, invited_tenant, display_name, NEW.email)
  ON CONFLICT (id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id;
  RETURN NEW;
END IF;
-- INSERTs de auto-cadastro existentes inalterados abaixo
```

Novo trigger, `handle_invited_user_confirmed()` / `on_auth_user_confirmed` (`AFTER UPDATE ON auth.users`):

```sql
IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
  UPDATE public.tenant_members SET status = 'active'
  WHERE user_id = NEW.id AND status = 'pending';
END IF;
RETURN NEW;
```

Formas TypeScript de requisição/resposta:

```typescript
interface TeamMember {
  id: string; userId: string; email: string; name: string;
  role: TenantRole; canConfigureAI: boolean; status: 'active' | 'pending';
  createdAt: string;
}
interface InviteMemberRequest {
  email: string; role: 'admin' | 'gestor' | 'operador'; canConfigureAI?: boolean;
}
```

### Endpoints da API

| Método | Caminho | Descrição | Papel mínimo |
|---|---|---|---|
| GET | `/api/tenants/[id]/members` | Listar membros da equipe (ativos + pendentes) | qualquer membro ativo |
| POST | `/api/tenants/[id]/members/invite` | Convidar por e-mail com papel + interruptor opcional de configuração de IA | admin |
| PATCH | `/api/tenants/[id]/members/[memberId]` | Alterar papel e/ou `canConfigureAI` | admin |
| DELETE | `/api/tenants/[id]/members/[memberId]` | Remover membro; se `status='pending'`, também exclui a linha órfã `auth.users` | admin |
| POST | `/api/tenants/[id]/members/[memberId]/resend` | Reenviar um convite pendente | admin |

Todas as rotas de nível admin rejeitam com 403 qualquer requisição em que `memberId` resolva para `role === 'owner'`, independente do papel de quem está agindo. `PATCH`/`DELETE` rejeitam que o ator alvo seu próprio papel/remoção de associação de uma forma que deixaria o tenant sem owner (a linha do owner simplesmente nunca é um alvo válido, conforme acima).

## Pontos de Integração

- **API Admin do Supabase Auth** (`inviteUserByEmail`, `deleteUser`) — exige SMTP configurado no projeto Supabase (fora deste codebase). Em falha, a rota de convite retorna um 4xx com uma mensagem que distingue "entrega de e-mail não configurada" de "usuário já existe" para que o owner/admin não fique no escuro.
- **`lib/audit.ts`** — `recordAuditAction` chamado após cada convite/mudança de papel/mudança de permissão/remoção bem-sucedido, com `entityType: 'tenant_member'`.
- **`lib/rate-limit.ts`** — `POST /invite` e `POST /resend` têm limite de taxa por tenant para conter spam/abuso de convites.

## Análise de Impacto

| Componente | Tipo de Impacto | Descrição e Risco | Ação Necessária |
|---|---|---|---|
| `lib/api-auth.ts` | Modificado | `TenantRole` cresce para 4 valores, `member` removido; `ROLE_RANK` e `canConfigureAI` adicionados | Atualizar tipo, mapa de ranks, consulta do `requireTenantContext`, adicionar `requireAIConfigPermission` |
| `hooks/useAuth.ts` | Modificado | O fallback de `role` hoje converte silenciosamente papéis desconhecidos para `'member'` (linha ~53) — deve ser atualizado para o novo conjunto de 4 valores ou papéis desconhecidos serão silenciosamente rebaixados | Atualizar a lógica de normalização e expor `canConfigureAI` |
| `supabase_tenant_team_management.sql` | Novo | Mudança do CHECK de papel + migração de dados (`member`→`operador`) + nova coluna + 2 mudanças de trigger | Aplicar manualmente conforme a convenção do projeto; testar em staging primeiro — isso toca triggers de `auth.users`, uma superfície compartilhada |
| `app/api/tenants/[id]/members/*` | Novo | 5 novas rotas conforme a tabela de Endpoints da API | Implementar conforme o ADR-002 |
| `components/team-management-panel.tsx`, `app/(dashboard)/settings/page.tsx` | Novo/Modificado | Nova aba "Equipe" | Implementar, seguir o padrão de aba do `tenant-ai-config-panel.tsx` |
| `app/api/tenants/[id]/ai-config/route.ts` | Modificado | PUT atualmente protegido com `requireRole('admin')`; deve passar para `requireAIConfigPermission` para que um `gestor`/`operador` permitido possa usá-lo | Troca de helper de auth de uma linha |
| `app/api/clients/route.ts` (POST), `app/api/clients/[id]/route.ts` (PUT/DELETE) | Modificado | Atualmente apenas `requireTenantContext` | Trocar para `requireRole('gestor')` |
| `app/api/cases/route.ts` (POST), `app/api/cases/[id]/route.ts` (PATCH/DELETE), `app/api/case-status/route.ts` (POST) | Modificado | Atualmente apenas `requireTenantContext`; o PATCH de `cases/[id]` e o `case-status` duplicam a mesma lógica de transição de status e devem ser protegidos de forma idêntica | Trocar para `requireRole('gestor')` em todos os três |
| `app/api/contracts/route.ts` (POST) | Modificado | Atualmente apenas `requireTenantContext` (`contracts/[id]` PUT/DELETE já são protegidos com `admin`, inalterados) | Trocar para `requireRole('gestor')` |
| `app/api/negotiations/route.ts` (POST), `app/api/negotiations/[id]/route.ts` (PATCH) | Modificado | Atualmente apenas `requireTenantContext` | Trocar para `requireRole('gestor')` |
| `app/api/financial-titles/[id]/route.ts` (PATCH) | Modificado | Atualmente apenas `requireTenantContext`; maior raio de impacto financeiro do grupo (cascateia para negativação/protesto/negociação) | Trocar para `requireRole('gestor')`, adicionar cobertura de teste explícita |
| `app/api/legal-processes/route.ts` (POST), `app/api/legal-processes/[id]/route.ts` (PATCH) | Modificado | Atualmente `requireRole('member')`, funcionalmente irrestrito sob o rank antigo | Trocar para `requireRole('gestor')` |
| `app/api/start-negotiation`, `app/api/chat`, `app/api/agent-message` | Inalterado | O envio de mensagens deve permanecer disponível para o `operador` (baseline do PRD) | Nenhuma — verificado explicitamente como não precisando de proteção `gestor` |
| `app/api/notifications/[id]/route.ts`, `app/api/message-templates/[id]/preview/route.ts` | Inalterado | Ação auto-restrita / preview sem persistência, corretamente aberta a qualquer papel | Nenhuma |
| `app/api/agents/simulate/route.ts` | Fora de escopo | Nenhuma verificação de auth (nem mesmo `requireUser`); lacuna pré-existente encontrada durante este levantamento, não relacionada ao modelo de papel/permissão | Sinalizar como ticket de follow-up, não corrigir aqui |
| `~15 rotas já protegidas com `admin`` (policies, agents, quarantines, protests, negativations, message-templates, contracts edit/delete, import) | Inalterado | O rank `admin` (3) já exclui `gestor`(2)/`operador`(1) sob o novo rank | Nenhuma (ver ADR-004, Alternativa 2) |

## Abordagem de Testes

### Testes Unitários

Não existe suíte de testes neste repositório (conforme o CLAUDE.md). A validação é feita via `npx tsc --noEmit`, `npm run lint` e verificação manual contra o checklist da Abordagem de Testes abaixo, consistente com a abordagem da skill `test-generator` existente no projeto.

### Testes de Integração (manuais, conforme convenção do projeto)

- Convidar um `gestor`, aceitar pelo link enviado por e-mail, confirmar que `tenant_members.status` se torna `active` e que o trigger não criou um segundo tenant.
- Convidar um `operador` com `canConfigureAI: true`; confirmar que ele alcança `PUT /api/tenants/[id]/ai-config` mas recebe 403 em `POST /api/clients`.
- Tentar convidar um e-mail que já é um usuário ativo em qualquer lugar do sistema; confirmar 409, não uma reatribuição silenciosa.
- Um admin tenta alterar ou remover o `owner`; confirmar 403 tanto no `PATCH` quanto no `DELETE`.
- `operador` tenta `POST /api/cases`, `PATCH /api/cases/[id]`, `POST /api/case-status`, `PATCH /api/financial-titles/[id]`, `POST /api/legal-processes`; confirmar 403 em todos os cinco.
- `operador` envia uma mensagem via `start-negotiation`/`chat`/`agent-message`; confirmar sucesso (acesso base intacto).
- Revogar um convite pendente e depois reconvidar o mesmo e-mail; confirmar que funciona (a linha órfã `auth.users` foi limpa).
- Reenviar um convite pendente; confirmar que nenhuma linha `tenant_members` duplicada é criada (`ON CONFLICT DO NOTHING` vale).
- Toda ação acima produz uma linha em `audit_logs` com o `actor_role` correto.

## Sequenciamento de Desenvolvimento

### Ordem de Construção

1. **Migração `supabase_tenant_team_management.sql`** (CHECK de papel, migração de dados `member`→`operador`, coluna `can_configure_ai`, ambas as funções de trigger) — sem dependências. Aplicar manualmente no Supabase conforme a convenção do projeto; verificar primeiro em um tenant não produtivo já que toca triggers de `auth.users`.
2. **Extensão de `lib/api-auth.ts`** (`TenantRole`, `ROLE_RANK`, `canConfigureAI`, `requireAIConfigPermission`) — depende do passo 1 (os novos valores de papel devem existir antes que o código os assuma).
3. **Atualização de `hooks/useAuth.ts`** — depende do passo 2 (consome a nova forma `TenantRole`/`canConfigureAI`).
4. **Retroaplicação das rotas de mutação existentes** (clients, cases, case-status, contracts, negotiations, financial-titles, legal-processes; e a troca de helper de auth da rota `ai-config`) — depende do passo 2.
5. **Novas rotas de gestão de equipe** (`app/api/tenants/[id]/members/*`) — depende dos passos 1–2 (precisa do comportamento do trigger e do `requireRole('admin')`).
6. **Interface de gestão de equipe** (`components/team-management-panel.tsx`, nova aba de Configurações) — depende dos passos 3 e 5 (consome tanto o hook de auth quanto a nova API).

### Dependências Técnicas

- O SMTP deve estar configurado no projeto Supabase para que os convites sejam de fato entregues; a rota de convite funciona e falha de forma graciosa sem ele, mas o teste de aceitação ponta a ponta (verificação do passo 6) exige que ele esteja configurado em algum lugar (por exemplo, um projeto de staging) pelo menos uma vez.

## Monitoramento e Observabilidade

- As linhas de `audit_logs` com `entity_type = 'tenant_member'` dão uma trilha consultável de todo convite/mudança de papel/mudança de permissão/remoção, já coberta pela infraestrutura de auditoria existente — nenhum novo sistema de observabilidade é necessário.
- Registrar (via `lib/logger` existente) qualquer falha de `inviteUserByEmail` de forma distinta dos demais erros de rota, já que "SMTP não configurado" é uma condição operacional que a equipe precisa notar rapidamente após esta funcionalidade entrar no ar, não um bug por requisição.

## Considerações Técnicas

### Decisões-Chave

Ver ADR-002, ADR-003, ADR-004 para a justificativa completa. Resumo:
- Mutações de gestão de equipe usam o client admin de service role, não RLS estendida (ADR-002).
- Convites são nativos do Supabase Auth (`inviteUserByEmail` + triggers cientes de metadados), sem nova tabela (ADR-003).
- O rank de papéis cresce para 4 níveis, `member` é aposentado via migração de dados, e ~7 arquivos de rota antes sem proteção são retroaplicados com `requireRole('gestor', ...)` (ADR-004).

### Riscos Conhecidos

- **Risco de regressão de trigger**: `handle_new_user()` é essencial para todo cadastro do produto, não apenas desta funcionalidade. O novo branch deve ser aditivo e testado contra o caminho de auto-cadastro existente (novo tenant + owner) para confirmar zero mudança de comportamento quando os metadados de convite estão ausentes.
- **Fallback silencioso de `hooks/useAuth.ts`**: hoje, qualquer valor de papel fora de `('owner','admin','member')` vira silenciosamente `'member'`. Uma vez que `member` não exista mais como papel, esse fallback deve mirar um padrão seguro (`'operador'`, o novo piso) em vez de continuar referenciando o valor aposentado — uma supervisão aqui concederia ou reteria silenciosamente affordances da interface.
- **Cascata de financial-titles**: proteger o PATCH de `financial-titles/[id]` no nível `gestor` muda quem pode disparar seus efeitos colaterais em cascata (limpa negativação, cancela protesto, cumpre negociação) — precisa de verificação manual explícita conforme a Abordagem de Testes, já que é a rota de maior impacto do conjunto de retroaplicação.

## Registros de Decisões de Arquitetura

- [ADR-001: Papéis fixos de equipe com um interruptor independente de permissão de configuração de IA](adrs/adr-001.md) — Quatro papéis fixos (owner/admin/gestor/operador) mais um override independente de configuração de IA, em vez de permissões por módulo ou um construtor de papéis personalizável pelo tenant.
- [ADR-002: Mutações de gestão de equipe passam pelo client admin de service role](adrs/adr-002.md) — Autorização aplicada inteiramente nos route handlers via client admin, seguindo o padrão existente de `admin/users`, em vez de estender a RLS de `tenant_members`.
- [ADR-003: Convite via metadados do Supabase Auth, tenant_members como armazenamento único do estado do convite](adrs/adr-003.md) — `inviteUserByEmail` + `handle_new_user()` ciente de metadados + um novo trigger de confirmação, reutilizando `tenant_members.status` em vez de uma tabela separada de convites.
- [ADR-004: Rank de papéis de quatro níveis, substituindo member, retroaplicado nas rotas CRUD existentes sem proteção](adrs/adr-004.md) — Estende o rank de papéis para 4 níveis e adiciona `requireRole('gestor', ...)` em ~7 arquivos de rota antes sem proteção para que as restrições do `operador` sejam de fato aplicadas, deixando intactas as rotas de conformidade existentes protegidas com `admin`.