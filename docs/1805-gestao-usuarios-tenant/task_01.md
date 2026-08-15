---
status: pending
title: "Migração SQL: papéis de 4 níveis, can_configure_ai, triggers de convite"
type: infra
complexity: alta
dependencies: []
---

# Tarefa 01: Migração SQL — papéis de 4 níveis, interruptor de configuração de IA, triggers de convite

## Visão Geral

Cria o substrato de persistência do qual toda outra tarefa depende: expande `tenant_members.role` de 3 para 4 valores (migrando linhas legadas `member` para `operador`), adiciona a coluna independente de override `can_configure_ai` e religa o trigger de cadastro de `auth.users` para que um usuário convidado entre no tenant convidante em vez de ganhar um tenant autônomo próprio. Esta é a tarefa de maior risco da funcionalidade porque `handle_new_user()` é essencial para todo cadastro do produto, não apenas desta funcionalidade.

<critical>
- SEMPRE LEIA o PRD e a TechSpec antes de começar (`../prd.md`, `../techspec.md`).
- REFERENCIE a seção 'Modelos de Dados' da TechSpec para o SQL exato — não duplique tipos de campos aqui além do necessário para orientar quem implementa.
- FOQUE NO "O QUÊ" — declare os objetos da migração; o agente implementador resolve a sintaxe Postgres exata.
- MINIMIZE CÓDIGO — os esboços de SQL abaixo são ilustrativos, não finais de copiar-e-colar.
- TESTES OBRIGATÓRIOS — verificação manual de que a migração aplica de forma idempotente e que o comportamento de auto-cadastro permanece inalterado quando os metadados de convite estão ausentes.
</critical>

<requirements>
- DEVE remover e recriar a restrição CHECK `tenant_members_role_check` (atualmente `CHECK (role IN ('owner','admin','member'))`, adicionada pelo `supabase_roles_permissions.sql` para a tarefa 17 do roadmap) para aceitar `('owner','admin','gestor','operador')`.
- DEVE executar `UPDATE public.tenant_members SET role = 'operador' WHERE role = 'member'` ANTES de re-adicionar a restrição, para que nenhuma linha existente a viole.
- DEVE adicionar `public.tenant_members.can_configure_ai BOOLEAN NOT NULL DEFAULT false`.
- DEVE modificar `public.handle_new_user()` (atualmente em `supabase_tenant_model.sql:892-918`) para fazer um branch sobre `NEW.raw_user_meta_data ->> 'invited_tenant_id'`: quando presente e `NEW.raw_user_meta_data ->> 'invited_role'` é um de `('admin','gestor','operador')`, inserir diretamente em `tenant_members` (`status='pending'`, `can_configure_ai` a partir do metadado `invited_can_configure_ai`) e em `profiles` com escopo naquele `invited_tenant_id`, e então `RETURN NEW` — pulando por completo o branch de auto-cadastro existente (novo tenant + associação owner) para aquela linha.
- DEVE deixar o caminho de auto-cadastro (sem metadados de convite) comportamentalmente idêntico ao de hoje — este é o caso de risco de regressão a verificar explicitamente.
- DEVE adicionar uma nova função de trigger `public.handle_invited_user_confirmed()` (`AFTER UPDATE ON auth.users`, uma linha) que define `tenant_members.status = 'active'` para `user_id = NEW.id` quando `OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL` e a linha está atualmente em `status = 'pending'`.
- DEVE usar `SECURITY DEFINER` e `SET search_path = public` em ambas as funções de trigger, seguindo a convenção existente do `handle_new_user()`.
- DEVE ser idempotente: `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`, `ADD COLUMN IF NOT EXISTS`, adição de restrição protegida (espelhe o padrão `DO $$ ... IF NOT EXISTS ...` já usado em `supabase_roles_permissions.sql`).
- NÃO DEVE tocar nas políticas RLS de `tenant_members` (`tenant_members_select/insert/update/delete`) — fora de escopo conforme o ADR-002, deixadas exatamente como estão.
</requirements>

## Subtarefas
- [ ] 01.1 Autorar `supabase_tenant_team_management.sql` na raiz do projeto, seguindo o estilo de nomeação/cabeçalho de comentário de `supabase_roles_permissions.sql`.
- [ ] 01.2 Escrever a migração de dados `member` → `operador` e a restrição `tenant_members_role_check` substituída.
- [ ] 01.3 Adicionar a coluna `can_configure_ai`.
- [ ] 01.4 Reescrever `handle_new_user()` com o branch de metadados de convite, preservando os INSERTs de auto-cadastro existentes inalterados no branch de fallback.
- [ ] 01.5 Adicionar `handle_invited_user_confirmed()` e o trigger `on_auth_user_confirmed`.
- [ ] 01.6 Aplicar a migração ao projeto Supabase e verificar manualmente tanto o caminho de auto-cadastro quanto um caminho de usuário convidado simulado (ver Testes).

## Detalhes de Implementação

Espelhe o SQL esboçado em 'Modelos de Dados' da TechSpec. O arquivo de migração fica ao lado de `supabase_tenant_model.sql` e `supabase_roles_permissions.sql` na raiz do projeto — este repositório não tem runner de migração, então documente no cabeçalho do arquivo que ele deve ser aplicado manualmente via o editor SQL do Supabase (conforme convenção do CLAUDE.md).

`handle_new_user()` atualmente lê (para referência, não divirja do comportamento do branch não-convite):
```sql
display_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'name'), ''), split_part(COALESCE(NEW.email, NEW.id::text), '@', 1), 'Tenant');
INSERT INTO public.tenants (name, slug, owner_user_id) VALUES (...) ON CONFLICT (owner_user_id) DO UPDATE ... RETURNING id INTO new_tenant_id;
INSERT INTO public.tenant_members (tenant_id, user_id, role) VALUES (new_tenant_id, NEW.id, 'owner') ON CONFLICT (tenant_id, user_id) DO NOTHING;
INSERT INTO public.profiles (id, tenant_id, name, email) VALUES (NEW.id, new_tenant_id, display_name, NEW.email) ON CONFLICT (id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id;
```
Adicione o branch de metadados de convite antes disso, retornando cedo quando ele se aplicar.

### Arquivos Relevantes
- `supabase_tenant_model.sql` — schema de `tenant_members`/`profiles`/`tenants`, `handle_new_user()` atual e trigger `on_auth_user_created` (linhas ~21-29, 892-923).
- `supabase_roles_permissions.sql` — precedente para o padrão de restrição CHECK protegida e a migração de papel existente que esta tarefa estende (tarefa 17: adicionou a restrição `owner/admin/member` sendo substituída aqui).

### Arquivos Dependentes
- `lib/api-auth.ts` (task_02) — seu tipo `TenantRole` e o mapa `ROLE_RANK` devem corresponder exatamente às quatro strings de papel em nível de banco.
- `hooks/useAuth.ts` (task_03) — lê `tenant_members.role` e `can_configure_ai` diretamente do client Supabase do lado do cliente.
- `app/api/tenants/[id]/members/*` (task_05) — a rota de convite define os metadados `invited_tenant_id`/`invited_role`/`invited_can_configure_ai` que o trigger desta migração consome.

### ADRs Relacionados
- [ADR-003: Convite via metadados do Supabase Auth, tenant_members como armazenamento único do estado do convite](adrs/adr-003.md) — Justificativa completa do design do trigger e das alternativas rejeitadas.
- [ADR-004: Rank de papéis de quatro níveis, substituindo member, retroaplicado nas rotas CRUD existentes sem proteção](adrs/adr-004.md) — Justificativa da migração de papel e da mudança de restrição.

## Entregáveis
- `supabase_tenant_team_management.sql` aplicado ao projeto (manualmente, conforme convenção do projeto).
- `tenant_members` aceita apenas `owner/admin/gestor/operador`; zero linhas permanecem com `role = 'member'`.
- `handle_new_user()` e `handle_invited_user_confirmed()` verificados tanto contra o caminho de auto-cadastro quanto contra o caminho de usuário convidado.
- Notas de verificação manual documentando a re-execução idempotente.

## Testes
- Fluxo manual SQL / Supabase Auth:
  - [ ] Um auto-cadastro novo (sem metadados de convite) ainda cria um novo tenant + associação `owner` + profile, inalterado do comportamento atual.
  - [ ] Simular um usuário convidado (inserir em `auth.users` com `raw_user_meta_data` contendo `invited_tenant_id`/`invited_role`/`invited_can_configure_ai`, ou usar `supabaseAdmin.auth.admin.inviteUserByEmail` diretamente uma vez que a task_05 exista) resulta em uma linha `tenant_members` com o tenant alvo, `status='pending'`, papel e `can_configure_ai` corretos e NENHUMA nova linha em `tenants`.
  - [ ] `SELECT role FROM tenant_members WHERE role = 'member'` retorna zero linhas após a migração.
  - [ ] Inserir `tenant_members.role = 'contributor'` (valor inválido) falha a restrição CHECK.
  - [ ] Simular confirmação de e-mail (`UPDATE auth.users SET email_confirmed_at = now() WHERE id = <invited_user_id>`) muda o `tenant_members.status` correspondente de `pending` para `active`.
  - [ ] Confirmar o e-mail de um membro já-`active` uma segunda vez (ou confirmar um usuário sem linha pendente) não gera erro e não cria/duplica linhas.
- Idempotência:
  - [ ] Re-executar o arquivo de migração completo uma segunda vez não produz erros.
- Advisor de segurança:
  - [ ] Nenhuma nova constatação alta/crítica introduzida nos triggers de `tenant_members`/`auth.users`.

## Critérios de Sucesso
- Migração aplicada sem erros; re-execução idempotente passa.
- Caminho de auto-cadastro verificado inalterado.
- Caminho de usuário convidado verificado ponta a ponta no nível do trigger (pending → active na confirmação).
- Nenhuma linha com `role = 'member'` permanece.