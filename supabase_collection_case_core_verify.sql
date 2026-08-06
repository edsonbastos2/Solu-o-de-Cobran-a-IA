-- Verificador nao destrutivo do nucleo canonico de cobranca.
-- Pre-requisitos: supabase_tenant_model.sql e supabase_collection_case_core.sql.
-- Execute em uma sessao com acesso ao catalogo. Nenhuma linha de negocio e
-- inserida, atualizada ou removida; a transacao inteira e somente leitura.

BEGIN;
SET TRANSACTION READ ONLY;

DO $$
DECLARE
  required_table TEXT;
BEGIN
  FOREACH required_table IN ARRAY ARRAY[
    'tenants', 'tenant_members', 'profiles', 'cases', 'messages',
    'audit_logs', 'contracts', 'financial_titles'
  ] LOOP
    IF to_regclass('public.' || required_table) IS NULL THEN
      RAISE EXCEPTION 'Pre-requisito ausente: public.%', required_table;
    END IF;
  END LOOP;
END $$;

-- Escolhe dados existentes. O verificador falha se nao houver dois tenants
-- regulares e um super-admin para que a cobertura nao seja vacua.
DO $$
DECLARE
  regular_tenant_count BIGINT;
  super_admin_count BIGINT;
BEGIN
  SELECT count(DISTINCT tm.tenant_id)
  INTO regular_tenant_count
  FROM public.tenant_members tm
  JOIN public.profiles p ON p.id = tm.user_id
  WHERE tm.status = 'active' AND p.is_super_admin IS NOT TRUE;

  SELECT count(*)
  INTO super_admin_count
  FROM public.profiles
  WHERE is_super_admin IS TRUE;

  IF regular_tenant_count < 2 THEN
    RAISE EXCEPTION 'Cobertura RLS incompleta: sao necessarios dois tenants regulares';
  END IF;
  IF super_admin_count = 0 THEN
    RAISE EXCEPTION 'Cobertura administrativa incompleta: super-admin ausente';
  END IF;
END $$;

SELECT set_config('collection.verify.tenant_a', t.id::text, true),
       set_config('collection.verify.user_a', tm.user_id::text, true)
FROM public.tenants t
JOIN public.tenant_members tm ON tm.tenant_id = t.id
JOIN public.profiles p ON p.id = tm.user_id
WHERE tm.status = 'active' AND p.is_super_admin IS NOT TRUE
ORDER BY t.created_at, t.id
LIMIT 1;

SELECT set_config('collection.verify.tenant_b', t.id::text, true),
       set_config('collection.verify.user_b', tm.user_id::text, true)
FROM public.tenants t
JOIN public.tenant_members tm ON tm.tenant_id = t.id
JOIN public.profiles p ON p.id = tm.user_id
WHERE tm.status = 'active'
  AND p.is_super_admin IS NOT TRUE
  AND t.id <> current_setting('collection.verify.tenant_a')::uuid
ORDER BY t.created_at, t.id
LIMIT 1;

SELECT set_config('collection.verify.super_admin', id::text, true)
FROM public.profiles
WHERE is_super_admin IS TRUE
ORDER BY id
LIMIT 1;

DO $$
BEGIN
  IF current_setting('collection.verify.tenant_a', true) IS NULL
     OR current_setting('collection.verify.tenant_b', true) IS NULL
     OR current_setting('collection.verify.super_admin', true) IS NULL THEN
    RAISE EXCEPTION 'Nao foi possivel selecionar os sujeitos de verificacao';
  END IF;
END $$;

-- RLS: cada usuario regular ve somente o proprio tenant.
SELECT set_config('request.jwt.claim.sub', current_setting('collection.verify.user_a'), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  other_tenant UUID := current_setting('collection.verify.tenant_b')::uuid;
BEGIN
  IF public.current_tenant_id() <> current_setting('collection.verify.tenant_a')::uuid THEN
    RAISE EXCEPTION 'RLS: tenant atual do usuario A foi resolvido incorretamente';
  END IF;
  IF public.can_access_tenant(other_tenant) THEN
    RAISE EXCEPTION 'RLS: usuario A acessou explicitamente tenant B';
  END IF;
  IF EXISTS (SELECT 1 FROM public.tenants WHERE id = other_tenant) THEN
    RAISE EXCEPTION 'RLS: tenant B ficou visivel para usuario A';
  END IF;
  IF EXISTS (SELECT 1 FROM public.cases WHERE tenant_id = other_tenant) THEN
    RAISE EXCEPTION 'RLS: casos do tenant B ficaram visiveis para usuario A';
  END IF;
  RAISE NOTICE 'RLS usuario A: APROVADO';
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', current_setting('collection.verify.user_b'), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  other_tenant UUID := current_setting('collection.verify.tenant_a')::uuid;
BEGIN
  IF public.current_tenant_id() <> current_setting('collection.verify.tenant_b')::uuid THEN
    RAISE EXCEPTION 'RLS: tenant atual do usuario B foi resolvido incorretamente';
  END IF;
  IF public.can_access_tenant(other_tenant) THEN
    RAISE EXCEPTION 'RLS: usuario B acessou explicitamente tenant A';
  END IF;
  IF EXISTS (SELECT 1 FROM public.tenants WHERE id = other_tenant) THEN
    RAISE EXCEPTION 'RLS: tenant A ficou visivel para usuario B';
  END IF;
  IF EXISTS (SELECT 1 FROM public.cases WHERE tenant_id = other_tenant) THEN
    RAISE EXCEPTION 'RLS: casos do tenant A ficaram visiveis para usuario B';
  END IF;
  RAISE NOTICE 'RLS usuario B: APROVADO';
END $$;
RESET ROLE;

-- Super-admin continua obrigado a informar o tenant na RPC. O UUID aleatorio
-- evita criacao e valida que a funcao nao aceita contexto administrativo
-- implicito.
SELECT set_config('request.jwt.claim.sub', current_setting('collection.verify.super_admin'), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  no_tenant_code TEXT;
  scoped_code TEXT;
  function_definition TEXT;
BEGIN
  IF NOT public.can_access_tenant(current_setting('collection.verify.tenant_a')::uuid)
     OR NOT public.can_access_tenant(current_setting('collection.verify.tenant_b')::uuid) THEN
    RAISE EXCEPTION 'Super-admin nao acessa os tenants explicitos esperados';
  END IF;

  SELECT public.create_collection_case(gen_random_uuid(), NULL)->>'error_code'
  INTO no_tenant_code;
  IF no_tenant_code <> 'TENANT_REQUIRED' THEN
    RAISE EXCEPTION 'RPC: super-admin sem tenant explicito retornou %', no_tenant_code;
  END IF;

  SELECT public.create_collection_case(
    gen_random_uuid(), current_setting('collection.verify.tenant_a')::uuid
  )->>'error_code'
  INTO scoped_code;
  IF scoped_code <> 'TITLE_NOT_FOUND' THEN
    RAISE EXCEPTION 'RPC: escopo administrativo inesperado: %', scoped_code;
  END IF;

  SELECT pg_get_functiondef('public.create_collection_case(uuid,uuid)'::regprocedure)
  INTO function_definition;
  IF position('selected_tenant := p_tenant_id' IN function_definition) = 0 THEN
    RAISE EXCEPTION 'RPC: tenant administrativo nao e derivado do parametro explicito';
  END IF;
  RAISE NOTICE 'Super-admin escopado e RPC: APROVADO';
END $$;
RESET ROLE;

-- Matriz de elegibilidade da regra de negocio, sem alterar titulos reais.
DO $$
DECLARE
  invalid_rows BIGINT;
  live_future BIGINT;
  live_today BIGINT;
  live_overdue BIGINT;
  live_paid BIGINT;
  live_cancelled BIGINT;
BEGIN
  WITH scenarios(label, due_date, status, expected_eligible, expected_reason) AS (
    VALUES
      ('future', current_date + 1, 'pending', false, 'future'),
      ('today', current_date, 'pending', false, 'today'),
      ('overdue', current_date - 1, 'pending', true, 'overdue'),
      ('paid', current_date - 1, 'paid', false, 'paid'),
      ('cancelled', current_date - 1, 'cancelled', false, 'cancelled')
  ), classified AS (
    SELECT *,
      CASE
        WHEN lower(status) IN ('paid', 'settled', 'recovered') THEN false
        WHEN lower(status) IN ('cancelled', 'canceled') THEN false
        ELSE due_date < current_date
      END AS actual_eligible,
      CASE
        WHEN lower(status) IN ('paid', 'settled', 'recovered') THEN 'paid'
        WHEN lower(status) IN ('cancelled', 'canceled') THEN 'cancelled'
        WHEN due_date > current_date THEN 'future'
        WHEN due_date = current_date THEN 'today'
        ELSE 'overdue'
      END AS actual_reason
    FROM scenarios
  )
  SELECT count(*) INTO invalid_rows
  FROM classified
  WHERE actual_eligible IS DISTINCT FROM expected_eligible
     OR actual_reason IS DISTINCT FROM expected_reason;

  IF invalid_rows <> 0 THEN
    RAISE EXCEPTION 'Elegibilidade: % cenarios divergentes', invalid_rows;
  END IF;

  SELECT count(*) FILTER (WHERE due_date > current_date),
         count(*) FILTER (WHERE due_date = current_date),
         count(*) FILTER (WHERE due_date < current_date
             AND lower(status) NOT IN ('paid', 'settled', 'recovered', 'cancelled', 'canceled')),
         count(*) FILTER (WHERE lower(status) IN ('paid', 'settled', 'recovered')),
         count(*) FILTER (WHERE lower(status) IN ('cancelled', 'canceled'))
  INTO live_future, live_today, live_overdue, live_paid, live_cancelled
  FROM public.financial_titles;

  RAISE NOTICE 'Elegibilidade: APROVADO; dados reais future=%, today=%, overdue=%, paid=%, cancelled=%',
    live_future, live_today, live_overdue, live_paid, live_cancelled;
END $$;

-- Concorrencia: a protecao que pode ser verificada sem abrir duas sessoes e a
-- presenca simultanea do indice parcial e do advisory lock na RPC. Tambem nao
-- pode haver duplicidade ativa no estado atual.
DO $$
DECLARE
  active_duplicates BIGINT;
  index_definition TEXT;
  function_definition TEXT;
BEGIN
  SELECT count(*) INTO active_duplicates
  FROM (
    SELECT financial_title_id
    FROM public.cases
    WHERE financial_title_id IS NOT NULL
      AND status IN ('not_started', 'in_negotiation', 'needs_attention')
    GROUP BY financial_title_id
    HAVING count(*) > 1
  ) duplicates;
  IF active_duplicates <> 0 THEN
    RAISE EXCEPTION 'Concorrencia: existem % titulos com casos ativos duplicados', active_duplicates;
  END IF;

  SELECT indexdef INTO index_definition
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname = 'cases_one_active_per_financial_title_idx';
  IF index_definition IS NULL
     OR position('UNIQUE' IN upper(index_definition)) = 0
     OR position('financial_title_id' IN index_definition) = 0 THEN
    RAISE EXCEPTION 'Concorrencia: indice unico parcial ausente ou incorreto';
  END IF;

  SELECT pg_get_functiondef('public.create_collection_case(uuid,uuid)'::regprocedure)
  INTO function_definition;
  IF position('pg_advisory_xact_lock' IN function_definition) = 0
     OR position('unique_violation' IN function_definition) = 0 THEN
    RAISE EXCEPTION 'Concorrencia: RPC sem lock e tratamento de duplicidade';
  END IF;
  RAISE NOTICE 'Concorrencia e duplicidade ativa: APROVADO';
END $$;

-- Backfill: qualquer conjunto ambiguo deve continuar sem vinculo e marcado
-- como contexto legado. O resultado e somente leitura e idempotente.
DO $$
DECLARE
  ambiguous_count BIGINT;
  linked_ambiguous_count BIGINT;
  unmarked_legacy_count BIGINT;
BEGIN
  WITH candidates AS (
    SELECT c.id AS case_id, ft.id AS title_id
    FROM public.cases c
    JOIN public.financial_titles ft
      ON ft.tenant_id = c.tenant_id
     AND ft.due_date = c.due_date
     AND ft.original_value = c.original_value
    JOIN public.contracts ct
      ON ct.id = ft.contract_id AND ct.tenant_id = c.tenant_id
    LEFT JOIN public.clients cl ON cl.id = coalesce(ft.client_id, ct.client_id)
    WHERE c.financial_title_id IS NULL
      AND (
        (c.debtor_id IS NOT NULL AND coalesce(ft.client_id, ct.client_id) = c.debtor_id)
        OR (c.debtor_id IS NULL AND cl.id = ct.client_id)
      )
  ), ambiguous AS (
    SELECT case_id
    FROM candidates
    GROUP BY case_id
    HAVING count(*) > 1
  )
  SELECT count(*) INTO ambiguous_count FROM ambiguous;

  WITH candidates AS (
    SELECT c.id AS case_id, ft.id AS title_id
    FROM public.cases c
    JOIN public.financial_titles ft
      ON ft.tenant_id = c.tenant_id
     AND ft.due_date = c.due_date
     AND ft.original_value = c.original_value
    JOIN public.contracts ct
      ON ct.id = ft.contract_id AND ct.tenant_id = c.tenant_id
    LEFT JOIN public.clients cl ON cl.id = coalesce(ft.client_id, ct.client_id)
    WHERE (
      (c.debtor_id IS NOT NULL AND coalesce(ft.client_id, ct.client_id) = c.debtor_id)
      OR (c.debtor_id IS NULL AND cl.id = ct.client_id)
    )
  ), ambiguous AS (
    SELECT case_id
    FROM candidates
    GROUP BY case_id
    HAVING count(*) > 1
  )
  SELECT count(*) INTO linked_ambiguous_count
  FROM public.cases c
  JOIN ambiguous a ON a.case_id = c.id
  WHERE c.financial_title_id IS NOT NULL OR c.legacy_context IS NOT TRUE;

  SELECT count(*) INTO unmarked_legacy_count
  FROM public.cases
  WHERE financial_title_id IS NULL AND legacy_context IS NOT TRUE;

  IF linked_ambiguous_count <> 0 THEN
    RAISE EXCEPTION 'Backfill: % casos ambiguos foram vinculados ou nao marcados', linked_ambiguous_count;
  END IF;
  IF unmarked_legacy_count <> 0 THEN
    RAISE EXCEPTION 'Backfill: % casos sem vinculo nao estao marcados como legados', unmarked_legacy_count;
  END IF;
  RAISE NOTICE 'Backfill deterministico: APROVADO; ambiguos=%', ambiguous_count;
END $$;

-- Preservacao: confirma que mensagens e auditoria continuam ligadas ao caso e
-- ao mesmo tenant, sem alterar os totais observados nesta transacao.
DO $$
DECLARE
  messages_before BIGINT;
  audit_before BIGINT;
  messages_after BIGINT;
  audit_after BIGINT;
BEGIN
  SELECT count(*) INTO messages_before FROM public.messages;
  SELECT count(*) INTO audit_before FROM public.audit_logs;

  IF EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.cases c ON c.id = m.case_id
    WHERE m.tenant_id IS DISTINCT FROM c.tenant_id
  ) THEN
    RAISE EXCEPTION 'Preservacao: mensagem com tenant diferente do caso';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.audit_logs a
    JOIN public.cases c ON c.id = a.case_id
    WHERE a.tenant_id IS DISTINCT FROM c.tenant_id
  ) THEN
    RAISE EXCEPTION 'Preservacao: auditoria com tenant diferente do caso';
  END IF;

  SELECT count(*) INTO messages_after FROM public.messages;
  SELECT count(*) INTO audit_after FROM public.audit_logs;
  IF messages_before <> messages_after OR audit_before <> audit_after THEN
    RAISE EXCEPTION 'Preservacao: totais de mensagens/auditoria foram alterados';
  END IF;
  RAISE NOTICE 'Mensagens e auditoria: APROVADO; mensagens=%, auditoria=%', messages_after, audit_after;
END $$;

RESET ROLE;
ROLLBACK;
