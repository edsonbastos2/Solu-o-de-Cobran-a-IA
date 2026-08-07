-- Núcleo canônico de casos de cobrança.
-- Pré-requisito: supabase_tenant_model.sql aplicado.
-- Esta migração é aditiva e preserva casos, mensagens e auditoria legados.

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS financial_title_id UUID,
  ADD COLUMN IF NOT EXISTS assigned_user_id UUID,
  ADD COLUMN IF NOT EXISTS legacy_context BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS before_state JSONB,
  ADD COLUMN IF NOT EXISTS after_state JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cases_financial_title_id_fkey'
      AND conrelid = 'public.cases'::regclass
  ) THEN
    ALTER TABLE public.cases
      ADD CONSTRAINT cases_financial_title_id_fkey
      FOREIGN KEY (financial_title_id)
      REFERENCES public.financial_titles(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cases_assigned_user_id_fkey'
      AND conrelid = 'public.cases'::regclass
  ) THEN
    ALTER TABLE public.cases
      ADD CONSTRAINT cases_assigned_user_id_fkey
      FOREIGN KEY (assigned_user_id)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS cases_financial_title_id_idx
  ON public.cases (financial_title_id);
CREATE INDEX IF NOT EXISTS cases_assigned_user_id_idx
  ON public.cases (assigned_user_id);
CREATE INDEX IF NOT EXISTS financial_titles_contract_due_date_idx
  ON public.financial_titles (contract_id, due_date);
CREATE INDEX IF NOT EXISTS financial_titles_tenant_status_due_date_idx
  ON public.financial_titles (tenant_id, status, due_date);

CREATE UNIQUE INDEX IF NOT EXISTS cases_one_active_per_financial_title_idx
  ON public.cases (financial_title_id)
  WHERE financial_title_id IS NOT NULL
    AND status IN ('not_started', 'in_negotiation', 'needs_attention');

-- Impede que uma atualização ou inserção associe o caso a outro tenant.
CREATE OR REPLACE FUNCTION public.ensure_case_context_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  title_tenant UUID;
BEGIN
  IF NEW.financial_title_id IS NOT NULL THEN
    SELECT tenant_id INTO title_tenant
    FROM public.financial_titles
    WHERE id = NEW.financial_title_id;

    IF title_tenant IS NULL THEN
      RAISE EXCEPTION 'Referenced financial title does not exist';
    END IF;

    IF NEW.tenant_id IS NULL THEN
      NEW.tenant_id := title_tenant;
    ELSIF NEW.tenant_id <> title_tenant THEN
      RAISE EXCEPTION 'Cross-tenant financial title relationship is not allowed';
    END IF;
  END IF;

  IF NEW.assigned_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.tenant_members tm
    WHERE tm.tenant_id = NEW.tenant_id
      AND tm.user_id = NEW.assigned_user_id
      AND tm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Assigned user does not belong to the case tenant';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_case_context_tenant ON public.cases;
CREATE TRIGGER ensure_case_context_tenant
  BEFORE INSERT OR UPDATE OF tenant_id, financial_title_id, assigned_user_id
  ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.ensure_case_context_tenant();

-- Backfill seguro: somente uma correspondência por caso, tenant, cliente,
-- vencimento e valor. Casos ambíguos permanecem sem vínculo.
UPDATE public.cases
SET legacy_context = true
WHERE financial_title_id IS NULL;

WITH candidates AS (
  SELECT
    c.id AS case_id,
    ft.id AS title_id,
    count(*) OVER (PARTITION BY c.id) AS match_count
  FROM public.cases c
  JOIN public.financial_titles ft
    ON ft.tenant_id = c.tenant_id
   AND ft.due_date = c.due_date
   AND ft.original_value = c.original_value
  JOIN public.contracts ct
    ON ct.id = ft.contract_id
   AND ct.tenant_id = c.tenant_id
  LEFT JOIN public.clients cl ON cl.id = COALESCE(ft.client_id, ct.client_id)
  WHERE c.financial_title_id IS NULL
    AND (
      (c.debtor_id IS NOT NULL AND COALESCE(ft.client_id, ct.client_id) = c.debtor_id)
      OR (c.debtor_id IS NULL AND cl.id = ct.client_id)
    )
), unique_candidates AS (
  SELECT case_id, (min(title_id::text))::uuid AS title_id
  FROM candidates
  WHERE match_count = 1
  GROUP BY case_id
)
UPDATE public.cases c
SET financial_title_id = uc.title_id,
    legacy_context = false
FROM unique_candidates uc
WHERE c.id = uc.case_id
  AND c.financial_title_id IS NULL;

DO $$
DECLARE
  linked_count BIGINT;
  incomplete_count BIGINT;
  ambiguous_count BIGINT;
BEGIN
  SELECT count(*) INTO linked_count
  FROM public.cases WHERE financial_title_id IS NOT NULL;
  SELECT count(*) INTO incomplete_count
  FROM public.cases WHERE financial_title_id IS NULL AND legacy_context IS TRUE;
  WITH matches AS (
    SELECT c.id
    FROM public.cases c
    JOIN public.financial_titles ft
      ON ft.tenant_id = c.tenant_id
      AND ft.due_date = c.due_date
      AND ft.original_value = c.original_value
    JOIN public.contracts ct ON ct.id = ft.contract_id AND ct.tenant_id = c.tenant_id
    WHERE c.financial_title_id IS NULL
      AND (
        (c.debtor_id IS NOT NULL AND COALESCE(ft.client_id, ct.client_id) = c.debtor_id)
        OR (c.debtor_id IS NULL AND COALESCE(ft.client_id, ct.client_id) = ct.client_id)
      )
    GROUP BY c.id
    HAVING count(*) > 1
  )
  SELECT count(*) INTO ambiguous_count FROM matches;
  RAISE NOTICE 'collection case backfill: linked=%, incomplete=%, ambiguous=%',
    linked_count, incomplete_count, ambiguous_count;
END $$;

-- As policies antigas permissivas não devem permanecer combinadas com a nova
-- fronteira de tenant. A policy canônica usa tenant_id como limite primário.
DROP POLICY IF EXISTS "Allow all operations for anon on cases" ON public.cases;
DROP POLICY IF EXISTS "Tenant isolation for cases" ON public.cases;
DROP POLICY IF EXISTS tenant_isolation ON public.cases;
DROP POLICY IF EXISTS collection_cases_tenant_access ON public.cases;
CREATE POLICY collection_cases_tenant_access ON public.cases
  FOR ALL
  USING (public.can_access_tenant(tenant_id))
  WITH CHECK (public.can_access_tenant(tenant_id));

CREATE OR REPLACE FUNCTION public.create_collection_case(
  p_financial_title_id UUID,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID := auth.uid();
  selected_tenant UUID;
  title_row RECORD;
  existing_case UUID;
  created_case public.cases%ROWTYPE;
BEGIN
  IF actor IS NULL THEN
    RETURN jsonb_build_object('case', NULL, 'error_code', 'AUTH_REQUIRED');
  END IF;

  IF public.app_is_super_admin(actor) THEN
    selected_tenant := p_tenant_id;
    IF selected_tenant IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.tenants t WHERE t.id = selected_tenant
    ) THEN
      RETURN jsonb_build_object('case', NULL, 'error_code', 'TENANT_REQUIRED');
    END IF;
  ELSE
    selected_tenant := public.tenant_for_user(actor);
    IF selected_tenant IS NULL OR (p_tenant_id IS NOT NULL AND p_tenant_id <> selected_tenant) THEN
      RETURN jsonb_build_object('case', NULL, 'error_code', 'TITLE_NOT_FOUND');
    END IF;
  END IF;

  -- Serializa tentativas concorrentes para o mesmo título antes do teste de
  -- duplicidade; o índice único também protege mudanças de status concorrentes.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_financial_title_id::text, 0));

  SELECT
    ft.*,
    ct.client_id AS contract_client_id,
    cl.name AS client_name,
    cl.phone AS client_phone,
    cl.email AS client_email,
    cl.document AS client_document,
    cl.address AS client_address
  INTO title_row
  FROM public.financial_titles ft
  JOIN public.contracts ct ON ct.id = ft.contract_id AND ct.tenant_id = ft.tenant_id
  LEFT JOIN public.clients cl ON cl.id = COALESCE(ft.client_id, ct.client_id)
  WHERE ft.id = p_financial_title_id
    AND ft.tenant_id = selected_tenant
  FOR UPDATE OF ft;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('case', NULL, 'error_code', 'TITLE_NOT_FOUND');
  END IF;

  IF lower(coalesce(title_row.status, '')) IN ('paid', 'settled', 'recovered', 'cancelled', 'canceled') THEN
    RETURN jsonb_build_object('case', NULL, 'error_code', 'TITLE_NOT_COLLECTIBLE');
  END IF;

  IF title_row.due_date >= current_date THEN
    RETURN jsonb_build_object('case', NULL, 'error_code', 'TITLE_NOT_OVERDUE');
  END IF;

  SELECT id INTO existing_case
  FROM public.cases
  WHERE financial_title_id = p_financial_title_id
    AND status IN ('not_started', 'in_negotiation', 'needs_attention')
  LIMIT 1;

  IF existing_case IS NOT NULL THEN
    RETURN jsonb_build_object('case', NULL, 'error_code', 'ACTIVE_CASE_EXISTS');
  END IF;

  INSERT INTO public.cases (
    tenant_id, user_id, name, phone, original_value, updated_value,
    due_date, max_discount_margin, status, debtor_id, debtor_email,
    debtor_document, debtor_address, financial_title_id, legacy_context
  ) VALUES (
    selected_tenant,
    actor,
    COALESCE(NULLIF(title_row.client_name, ''), NULLIF(title_row.description, ''), 'Cliente'),
    COALESCE(title_row.client_phone, ''),
    title_row.original_value,
    COALESCE(title_row.current_value, title_row.original_value),
    title_row.due_date,
    10,
    'not_started',
    (
      SELECT d.id
      FROM public.debtors d
      WHERE d.tenant_id = selected_tenant
        AND d.document = title_row.client_document
      ORDER BY d.created_at NULLS LAST
      LIMIT 1
    ),
    title_row.client_email,
    title_row.client_document,
    title_row.client_address,
    p_financial_title_id,
    false
  )
  RETURNING * INTO created_case;

  INSERT INTO public.audit_logs (
    case_id, tenant_id, user_id, actor_user_id, action, entity_type,
    entity_id, details, metadata, before_state, after_state
  ) VALUES (
    created_case.id, selected_tenant, actor, actor, 'CASE_CREATED', 'case',
    created_case.id, 'Caso criado a partir de título financeiro',
    jsonb_build_object('financial_title_id', p_financial_title_id),
    NULL, to_jsonb(created_case)
  );

  RETURN jsonb_build_object('case', to_jsonb(created_case), 'error_code', NULL);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('case', NULL, 'error_code', 'ACTIVE_CASE_EXISTS');
END;
$$;

REVOKE ALL ON FUNCTION public.create_collection_case(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_collection_case(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.create_collection_case(UUID, UUID) IS
  'Cria atomicamente um caso somente para título vencido, acessível e não quitado/cancelado.';
