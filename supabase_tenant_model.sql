-- Canonical tenant model for the collection platform.
-- Run after the existing baseline SQL files. This migration is additive and
-- preserves auth.users, profiles and all existing business rows.

CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_key
  ON public.tenants (slug);
CREATE UNIQUE INDEX IF NOT EXISTS tenants_owner_user_id_key
  ON public.tenants (owner_user_id);

CREATE TABLE IF NOT EXISTS public.tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS tenant_members_user_id_idx
  ON public.tenant_members (user_id);

-- Every current auth user receives one tenant. The generated slug is stable
-- and collision-free, while the display name can be changed later.
INSERT INTO public.tenants (name, slug, owner_user_id)
SELECT
  COALESCE(NULLIF(trim(p.name), ''), split_part(COALESCE(u.email, u.id::text), '@', 1), 'Tenant'),
  'tenant-' || replace(left(u.id::text, 8), '-', ''),
  u.id
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
ON CONFLICT (owner_user_id) DO NOTHING;

INSERT INTO public.tenant_members (tenant_id, user_id, role)
SELECT t.id, t.owner_user_id, 'owner'
FROM public.tenants t
ON CONFLICT (tenant_id, user_id) DO NOTHING;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tenant_id UUID;

UPDATE public.profiles p
SET tenant_id = t.id
FROM public.tenants t
WHERE t.owner_user_id = p.id
  AND p.tenant_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_tenant_id_fkey'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Add the explicit tenant root to existing tables. user_id is intentionally
-- retained for application compatibility and historical audit semantics.
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.installments ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.collection_policies ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.debtors ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- First associate legacy rows with the tenant that owns their existing user.
UPDATE public.debtors d
SET tenant_id = t.id
FROM public.tenants t
WHERE d.tenant_id IS NULL AND d.user_id = t.owner_user_id;

UPDATE public.cases c
SET tenant_id = t.id
FROM public.tenants t
WHERE c.tenant_id IS NULL AND c.user_id = t.owner_user_id;

UPDATE public.cases c
SET tenant_id = d.tenant_id
FROM public.debtors d
WHERE c.tenant_id IS NULL AND c.debtor_id = d.id;

UPDATE public.clients c
SET tenant_id = t.id
FROM public.tenants t
WHERE c.tenant_id IS NULL AND c.user_id = t.owner_user_id;

UPDATE public.clients c
SET tenant_id = d.tenant_id
FROM public.debtors d
WHERE c.tenant_id IS NULL AND c.id = d.id;

UPDATE public.clients c
SET tenant_id = ca.tenant_id
FROM public.cases ca
WHERE c.tenant_id IS NULL AND c.id = ca.debtor_id;

UPDATE public.contracts c
SET tenant_id = t.id
FROM public.tenants t
WHERE c.tenant_id IS NULL AND c.user_id = t.owner_user_id;

UPDATE public.contracts c
SET tenant_id = cl.tenant_id
FROM public.clients cl
WHERE c.tenant_id IS NULL AND c.client_id = cl.id;

UPDATE public.contracts c
SET tenant_id = ca.tenant_id
FROM public.cases ca
WHERE c.tenant_id IS NULL AND c.id = ca.id;

UPDATE public.collection_policies p
SET tenant_id = t.id
FROM public.tenants t
WHERE p.tenant_id IS NULL AND p.user_id = t.owner_user_id;

UPDATE public.agents a
SET tenant_id = t.id
FROM public.tenants t
WHERE a.tenant_id IS NULL AND a.user_id = t.owner_user_id;

-- Rows created by old global/demo migrations had no owner. Keep them by
-- assigning them to the first existing tenant instead of making them public.
DO $$
DECLARE
  fallback_tenant UUID;
BEGIN
  SELECT id INTO fallback_tenant FROM public.tenants ORDER BY created_at, id LIMIT 1;
  IF fallback_tenant IS NULL THEN
    RAISE EXCEPTION 'At least one authenticated user is required to create tenants';
  END IF;

  UPDATE public.debtors SET tenant_id = fallback_tenant WHERE tenant_id IS NULL;
  UPDATE public.cases SET tenant_id = fallback_tenant WHERE tenant_id IS NULL;
  UPDATE public.clients SET tenant_id = fallback_tenant WHERE tenant_id IS NULL;
  UPDATE public.contracts SET tenant_id = fallback_tenant WHERE tenant_id IS NULL;
  UPDATE public.collection_policies SET tenant_id = fallback_tenant WHERE tenant_id IS NULL;
  UPDATE public.agents SET tenant_id = fallback_tenant WHERE tenant_id IS NULL;
END $$;

-- Keep the old user_id column populated for old clients and integrations.
UPDATE public.debtors d
SET user_id = t.owner_user_id
FROM public.tenants t
WHERE d.user_id IS NULL AND d.tenant_id = t.id;

UPDATE public.cases c
SET user_id = t.owner_user_id
FROM public.tenants t
WHERE c.user_id IS NULL AND c.tenant_id = t.id;

UPDATE public.clients c
SET user_id = t.owner_user_id
FROM public.tenants t
WHERE c.user_id IS NULL AND c.tenant_id = t.id;

UPDATE public.contracts c
SET user_id = t.owner_user_id
FROM public.tenants t
WHERE c.user_id IS NULL AND c.tenant_id = t.id;

UPDATE public.collection_policies p
SET user_id = t.owner_user_id
FROM public.tenants t
WHERE p.user_id IS NULL AND p.tenant_id = t.id;

UPDATE public.agents a
SET user_id = t.owner_user_id
FROM public.tenants t
WHERE a.user_id IS NULL AND a.tenant_id = t.id;

UPDATE public.installments i
SET tenant_id = c.tenant_id
FROM public.contracts c
WHERE i.tenant_id IS NULL AND i.contract_id = c.id;

UPDATE public.messages m
SET tenant_id = c.tenant_id
FROM public.cases c
WHERE m.tenant_id IS NULL AND m.case_id = c.id;

UPDATE public.audit_logs a
SET tenant_id = c.tenant_id
FROM public.cases c
WHERE a.tenant_id IS NULL AND a.case_id = c.id;

UPDATE public.audit_logs a
SET tenant_id = t.id
FROM public.tenants t
WHERE a.tenant_id IS NULL AND a.user_id = t.owner_user_id;

DO $$
DECLARE
  fallback_tenant UUID;
BEGIN
  SELECT id INTO fallback_tenant FROM public.tenants ORDER BY created_at, id LIMIT 1;
  UPDATE public.installments SET tenant_id = fallback_tenant WHERE tenant_id IS NULL;
  UPDATE public.messages SET tenant_id = fallback_tenant WHERE tenant_id IS NULL;
  UPDATE public.audit_logs SET tenant_id = fallback_tenant WHERE tenant_id IS NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_tenant_id_not_null') THEN
    ALTER TABLE public.profiles ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
END $$;

ALTER TABLE public.cases ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.messages ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.clients ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.contracts ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.installments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.collection_policies ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.agents ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.debtors ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.audit_logs ALTER COLUMN tenant_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cases_tenant_id_fkey') THEN
    ALTER TABLE public.cases ADD CONSTRAINT cases_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_tenant_id_fkey') THEN
    ALTER TABLE public.messages ADD CONSTRAINT messages_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_tenant_id_fkey') THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contracts_tenant_id_fkey') THEN
    ALTER TABLE public.contracts ADD CONSTRAINT contracts_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'installments_tenant_id_fkey') THEN
    ALTER TABLE public.installments ADD CONSTRAINT installments_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collection_policies_tenant_id_fkey') THEN
    ALTER TABLE public.collection_policies ADD CONSTRAINT collection_policies_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agents_tenant_id_fkey') THEN
    ALTER TABLE public.agents ADD CONSTRAINT agents_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'debtors_tenant_id_fkey') THEN
    ALTER TABLE public.debtors ADD CONSTRAINT debtors_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_tenant_id_fkey') THEN
    ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Domain entities below are tenant-owned and intentionally use JSONB metadata
-- so different B2B verticals can extend the model without schema forks.
CREATE TABLE IF NOT EXISTS public.contract_clauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  clause_number INTEGER,
  title TEXT,
  content TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.contract_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL DEFAULT 'contract',
  file_name TEXT,
  storage_path TEXT,
  mime_type TEXT,
  file_size BIGINT,
  extracted_text TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.contract_guarantees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  guarantee_type TEXT NOT NULL,
  description TEXT,
  amount NUMERIC,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.contract_guarantors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  relationship TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.contract_responsibles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'responsible',
  document TEXT,
  email TEXT,
  phone TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.financial_titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  installment_number INTEGER NOT NULL,
  external_reference TEXT,
  description TEXT,
  original_value NUMERIC NOT NULL,
  current_value NUMERIC,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  legacy_installment_id UUID UNIQUE REFERENCES public.installments(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  active BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,
  definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  status TEXT NOT NULL DEFAULT 'draft',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  audience_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.negotiations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  financial_title_id UUID REFERENCES public.financial_titles(id) ON DELETE SET NULL,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open',
  original_value NUMERIC,
  proposed_value NUMERIC,
  agreed_value NUMERIC,
  discount_percent NUMERIC,
  installment_count INTEGER,
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.quarantines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  financial_title_id UUID REFERENCES public.financial_titles(id) ON DELETE SET NULL,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.negativations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  financial_title_id UUID REFERENCES public.financial_titles(id) ON DELETE SET NULL,
  provider TEXT,
  external_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.protests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  financial_title_id UUID REFERENCES public.financial_titles(id) ON DELETE SET NULL,
  provider TEXT,
  external_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.legal_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  financial_title_id UUID REFERENCES public.financial_titles(id) ON DELETE SET NULL,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  process_number TEXT,
  process_type TEXT NOT NULL DEFAULT 'collection',
  court TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  filing_date DATE,
  lawyer_name TEXT,
  lawyer_contact TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Copy existing installments into the canonical financial-title table.
INSERT INTO public.financial_titles (
  id, tenant_id, contract_id, client_id, installment_number,
  original_value, current_value, due_date, status, legacy_installment_id,
  created_at
)
SELECT
  i.id, i.tenant_id, i.contract_id, c.client_id, i.installment_number,
  i.original_value, i.original_value, i.due_date, i.status, i.id,
  i.created_at
FROM public.installments i
JOIN public.contracts c ON c.id = i.contract_id
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS tenants_status_idx ON public.tenants (status);
CREATE INDEX IF NOT EXISTS profiles_tenant_id_idx ON public.profiles (tenant_id);
CREATE INDEX IF NOT EXISTS cases_user_id_idx ON public.cases (user_id);
CREATE INDEX IF NOT EXISTS cases_debtor_id_idx ON public.cases (debtor_id);
CREATE INDEX IF NOT EXISTS cases_tenant_id_idx ON public.cases (tenant_id);
CREATE INDEX IF NOT EXISTS messages_case_id_idx ON public.messages (case_id);
CREATE INDEX IF NOT EXISTS messages_tenant_id_idx ON public.messages (tenant_id);
CREATE INDEX IF NOT EXISTS clients_user_id_idx ON public.clients (user_id);
CREATE INDEX IF NOT EXISTS clients_tenant_id_idx ON public.clients (tenant_id);
CREATE INDEX IF NOT EXISTS contracts_user_id_idx ON public.contracts (user_id);
CREATE INDEX IF NOT EXISTS contracts_client_id_idx ON public.contracts (client_id);
CREATE INDEX IF NOT EXISTS contracts_collection_policy_id_idx ON public.contracts (collection_policy_id);
CREATE INDEX IF NOT EXISTS contracts_tenant_id_idx ON public.contracts (tenant_id);
CREATE INDEX IF NOT EXISTS installments_contract_id_idx ON public.installments (contract_id);
CREATE INDEX IF NOT EXISTS installments_tenant_id_idx ON public.installments (tenant_id);
CREATE INDEX IF NOT EXISTS policies_user_id_idx ON public.collection_policies (user_id);
CREATE INDEX IF NOT EXISTS policies_tenant_id_idx ON public.collection_policies (tenant_id);
CREATE INDEX IF NOT EXISTS agents_user_id_idx ON public.agents (user_id);
CREATE INDEX IF NOT EXISTS agents_tenant_id_idx ON public.agents (tenant_id);
CREATE INDEX IF NOT EXISTS debtors_user_id_idx ON public.debtors (user_id);
CREATE INDEX IF NOT EXISTS debtors_tenant_id_idx ON public.debtors (tenant_id);
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS audit_logs_case_id_idx ON public.audit_logs (case_id);
CREATE INDEX IF NOT EXISTS audit_logs_actor_user_id_idx ON public.audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS audit_logs_tenant_id_idx ON public.audit_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS contract_clauses_tenant_id_idx ON public.contract_clauses (tenant_id, contract_id);
CREATE INDEX IF NOT EXISTS contract_clauses_contract_id_idx ON public.contract_clauses (contract_id);
CREATE INDEX IF NOT EXISTS contract_documents_tenant_id_idx ON public.contract_documents (tenant_id, contract_id);
CREATE INDEX IF NOT EXISTS contract_documents_contract_id_idx ON public.contract_documents (contract_id);
CREATE INDEX IF NOT EXISTS contract_documents_uploaded_by_idx ON public.contract_documents (uploaded_by);
CREATE INDEX IF NOT EXISTS contract_guarantees_tenant_id_idx ON public.contract_guarantees (tenant_id, contract_id);
CREATE INDEX IF NOT EXISTS contract_guarantees_contract_id_idx ON public.contract_guarantees (contract_id);
CREATE INDEX IF NOT EXISTS contract_guarantors_tenant_id_idx ON public.contract_guarantors (tenant_id, contract_id);
CREATE INDEX IF NOT EXISTS contract_guarantors_contract_id_idx ON public.contract_guarantors (contract_id);
CREATE INDEX IF NOT EXISTS contract_responsibles_tenant_id_idx ON public.contract_responsibles (tenant_id, contract_id);
CREATE INDEX IF NOT EXISTS contract_responsibles_contract_id_idx ON public.contract_responsibles (contract_id);
CREATE INDEX IF NOT EXISTS contract_responsibles_client_id_idx ON public.contract_responsibles (client_id);
CREATE INDEX IF NOT EXISTS financial_titles_tenant_due_date_idx ON public.financial_titles (tenant_id, due_date);
CREATE INDEX IF NOT EXISTS financial_titles_contract_id_idx ON public.financial_titles (contract_id);
CREATE INDEX IF NOT EXISTS financial_titles_client_id_idx ON public.financial_titles (client_id);
CREATE INDEX IF NOT EXISTS workflows_tenant_id_idx ON public.workflows (tenant_id);
CREATE INDEX IF NOT EXISTS workflows_created_by_idx ON public.workflows (created_by);
CREATE INDEX IF NOT EXISTS campaigns_tenant_id_idx ON public.campaigns (tenant_id);
CREATE INDEX IF NOT EXISTS campaigns_workflow_id_idx ON public.campaigns (workflow_id);
CREATE INDEX IF NOT EXISTS campaigns_created_by_idx ON public.campaigns (created_by);
CREATE INDEX IF NOT EXISTS negotiations_tenant_id_idx ON public.negotiations (tenant_id);
CREATE INDEX IF NOT EXISTS negotiations_client_id_idx ON public.negotiations (client_id);
CREATE INDEX IF NOT EXISTS negotiations_contract_id_idx ON public.negotiations (contract_id);
CREATE INDEX IF NOT EXISTS negotiations_financial_title_id_idx ON public.negotiations (financial_title_id);
CREATE INDEX IF NOT EXISTS negotiations_case_id_idx ON public.negotiations (case_id);
CREATE INDEX IF NOT EXISTS negotiations_created_by_idx ON public.negotiations (created_by);
CREATE INDEX IF NOT EXISTS quarantines_tenant_id_idx ON public.quarantines (tenant_id);
CREATE INDEX IF NOT EXISTS quarantines_financial_title_id_idx ON public.quarantines (financial_title_id);
CREATE INDEX IF NOT EXISTS quarantines_case_id_idx ON public.quarantines (case_id);
CREATE INDEX IF NOT EXISTS quarantines_reviewed_by_idx ON public.quarantines (reviewed_by);
CREATE INDEX IF NOT EXISTS negativations_tenant_id_idx ON public.negativations (tenant_id);
CREATE INDEX IF NOT EXISTS negativations_client_id_idx ON public.negativations (client_id);
CREATE INDEX IF NOT EXISTS negativations_financial_title_id_idx ON public.negativations (financial_title_id);
CREATE INDEX IF NOT EXISTS protests_tenant_id_idx ON public.protests (tenant_id);
CREATE INDEX IF NOT EXISTS protests_client_id_idx ON public.protests (client_id);
CREATE INDEX IF NOT EXISTS protests_financial_title_id_idx ON public.protests (financial_title_id);
CREATE INDEX IF NOT EXISTS legal_processes_tenant_id_idx ON public.legal_processes (tenant_id);
CREATE INDEX IF NOT EXISTS legal_processes_client_id_idx ON public.legal_processes (client_id);
CREATE INDEX IF NOT EXISTS legal_processes_contract_id_idx ON public.legal_processes (contract_id);
CREATE INDEX IF NOT EXISTS legal_processes_financial_title_id_idx ON public.legal_processes (financial_title_id);
CREATE INDEX IF NOT EXISTS legal_processes_case_id_idx ON public.legal_processes (case_id);
CREATE INDEX IF NOT EXISTS legal_processes_created_by_idx ON public.legal_processes (created_by);

-- Tenant-scoped uniqueness. The old global constraints are not valid for SaaS.
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_document_key;
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_email_key;
ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_contract_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS clients_tenant_document_key
  ON public.clients (tenant_id, document) WHERE document IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS clients_tenant_email_key
  ON public.clients (tenant_id, email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS contracts_tenant_number_key
  ON public.contracts (tenant_id, contract_number) WHERE contract_number IS NOT NULL;

CREATE OR REPLACE FUNCTION public.tenant_for_user(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tm.tenant_id
  FROM public.tenant_members tm
  WHERE tm.user_id = p_user_id AND tm.status = 'active'
  ORDER BY CASE WHEN tm.role = 'owner' THEN 0 ELSE 1 END, tm.created_at
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT public.tenant_for_user(auth.uid()) $$;

CREATE OR REPLACE FUNCTION public.app_is_super_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND is_super_admin IS TRUE
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_tenant(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.app_is_super_admin(auth.uid())
      OR (p_tenant_id IS NOT NULL AND p_tenant_id = public.current_tenant_id())
$$;

-- New writes may still send user_id. Resolve it to the explicit tenant and
-- populate user_id from the tenant owner when only tenant_id is supplied.
CREATE OR REPLACE FUNCTION public.set_legacy_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_tenant UUID;
  resolved_owner UUID;
  legacy_user_id UUID;
BEGIN
  IF to_jsonb(NEW) ? 'user_id' THEN
    legacy_user_id := NULLIF(to_jsonb(NEW)->>'user_id', '')::UUID;
  END IF;

  IF NEW.tenant_id IS NULL AND legacy_user_id IS NOT NULL THEN
    resolved_tenant := public.tenant_for_user(legacy_user_id);
    NEW.tenant_id := resolved_tenant;
  END IF;

  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.current_tenant_id();
  END IF;

  IF NEW.tenant_id IS NOT NULL AND (to_jsonb(NEW) ? 'user_id') AND legacy_user_id IS NULL THEN
    SELECT owner_user_id INTO resolved_owner
    FROM public.tenants WHERE id = NEW.tenant_id;
    NEW := jsonb_populate_record(NEW, jsonb_build_object('user_id', resolved_owner));
  END IF;

  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.ensure_relationship_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_id UUID;
  parent_tenant UUID;
BEGIN
  parent_id := NULLIF(to_jsonb(NEW)->>TG_ARGV[1], '')::UUID;
  IF parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  EXECUTE format('SELECT tenant_id FROM public.%I WHERE id = $1', TG_ARGV[0])
    INTO parent_tenant USING parent_id;

  IF parent_tenant IS NULL THEN
    RAISE EXCEPTION 'Referenced % does not exist', TG_ARGV[0];
  END IF;

  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := parent_tenant;
  ELSIF NEW.tenant_id <> parent_tenant THEN
    RAISE EXCEPTION 'Cross-tenant relationship is not allowed';
  END IF;

  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.sync_installment_title()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  UPDATE public.financial_titles
  SET original_value = NEW.original_value,
      current_value = COALESCE(current_value, NEW.original_value),
      due_date = NEW.due_date,
      status = NEW.status,
      updated_at = timezone('utc'::text, now())
  WHERE legacy_installment_id = NEW.id;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.sync_title_installment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 OR NEW.legacy_installment_id IS NULL THEN
    RETURN NEW;
  END IF;
  UPDATE public.installments
  SET original_value = NEW.original_value,
      due_date = NEW.due_date,
      status = NEW.status,
      tenant_id = NEW.tenant_id
  WHERE id = NEW.legacy_installment_id;
  RETURN NEW;
END $$;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['cases', 'messages', 'clients', 'contracts', 'installments', 'collection_policies', 'agents', 'debtors', 'audit_logs'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_legacy_tenant_on_%I ON public.%I', table_name, table_name);
    EXECUTE format('CREATE TRIGGER set_legacy_tenant_on_%I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_legacy_tenant()', table_name, table_name);
  END LOOP;

  FOREACH table_name IN ARRAY ARRAY['contract_clauses', 'contract_documents', 'contract_guarantees', 'contract_guarantors', 'contract_responsibles', 'financial_titles', 'workflows', 'campaigns', 'negotiations', 'quarantines', 'negativations', 'protests', 'legal_processes'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_tenant_on_%I ON public.%I', table_name, table_name);
    EXECUTE format('CREATE TRIGGER set_tenant_on_%I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_legacy_tenant()', table_name, table_name);
  END LOOP;
END $$;

DO $$
DECLARE
  table_name TEXT;
  parent_table TEXT;
  column_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['contract_clauses', 'contract_documents', 'contract_guarantees', 'contract_guarantors', 'contract_responsibles', 'financial_titles'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS ensure_contract_tenant_on_%I ON public.%I', table_name, table_name);
    EXECUTE format('CREATE TRIGGER ensure_contract_tenant_on_%I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.ensure_relationship_tenant(''contracts'', ''contract_id'')', table_name, table_name);
  END LOOP;

  FOREACH table_name IN ARRAY ARRAY['negotiations', 'quarantines', 'negativations', 'protests', 'legal_processes'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS ensure_contract_tenant_on_%I ON public.%I', table_name, table_name);
    EXECUTE format('CREATE TRIGGER ensure_contract_tenant_on_%I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.ensure_relationship_tenant(''contracts'', ''contract_id'')', table_name, table_name);
  END LOOP;

  -- Children with case_id also inherit the case tenant.
  FOREACH table_name IN ARRAY ARRAY['negotiations', 'quarantines', 'legal_processes'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS ensure_case_tenant_on_%I ON public.%I', table_name, table_name);
    EXECUTE format('CREATE TRIGGER ensure_case_tenant_on_%I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.ensure_relationship_tenant(''cases'', ''case_id'')', table_name, table_name);
  END LOOP;

  -- A contract and a client must always belong to the same tenant.
  FOREACH table_name IN ARRAY ARRAY['contract_responsibles', 'financial_titles', 'negotiations', 'negativations', 'protests', 'legal_processes'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS ensure_client_tenant_on_%I ON public.%I', table_name, table_name);
    EXECUTE format('CREATE TRIGGER ensure_client_tenant_on_%I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.ensure_relationship_tenant(''clients'', ''client_id'')', table_name, table_name);
  END LOOP;

  EXECUTE 'DROP TRIGGER IF EXISTS ensure_contract_tenant_on_installments ON public.installments';
  EXECUTE 'CREATE TRIGGER ensure_contract_tenant_on_installments BEFORE INSERT OR UPDATE ON public.installments FOR EACH ROW EXECUTE FUNCTION public.ensure_relationship_tenant(''contracts'', ''contract_id'')';

  -- Messages and audit rows are always scoped by their case when present.
  EXECUTE 'DROP TRIGGER IF EXISTS ensure_case_tenant_on_messages ON public.messages';
  EXECUTE 'CREATE TRIGGER ensure_case_tenant_on_messages BEFORE INSERT OR UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.ensure_relationship_tenant(''cases'', ''case_id'')';
  EXECUTE 'DROP TRIGGER IF EXISTS ensure_case_tenant_on_audit_logs ON public.audit_logs';
  EXECUTE 'CREATE TRIGGER ensure_case_tenant_on_audit_logs BEFORE INSERT OR UPDATE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.ensure_relationship_tenant(''cases'', ''case_id'')';

  -- Keep the legacy installments table and canonical financial titles aligned.
  EXECUTE 'DROP TRIGGER IF EXISTS sync_installment_title ON public.installments';
  EXECUTE 'CREATE TRIGGER sync_installment_title AFTER INSERT OR UPDATE ON public.installments FOR EACH ROW EXECUTE FUNCTION public.sync_installment_title()';
  EXECUTE 'DROP TRIGGER IF EXISTS sync_title_installment ON public.financial_titles';
  EXECUTE 'CREATE TRIGGER sync_title_installment AFTER INSERT OR UPDATE ON public.financial_titles FOR EACH ROW EXECUTE FUNCTION public.sync_title_installment()';
END $$;

-- Remove every old policy from tenant-owned tables before installing one
-- consistent policy per table. This also removes the historic user_id IS NULL
-- escape hatch that exposed shared rows between tenants.
DO $$
DECLARE
  table_name TEXT;
  policy_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'tenants', 'tenant_members', 'profiles', 'cases', 'messages', 'clients',
    'contracts', 'installments', 'collection_policies', 'agents', 'debtors',
    'audit_logs', 'contract_clauses', 'contract_documents',
    'contract_guarantees', 'contract_guarantors', 'contract_responsibles',
    'financial_titles', 'workflows', 'campaigns', 'negotiations', 'quarantines',
    'negativations', 'protests', 'legal_processes'
  ] LOOP
    FOR policy_name IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = table_name
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, table_name);
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_select ON public.tenants
  FOR SELECT USING (public.can_access_tenant(id));
CREATE POLICY tenant_insert ON public.tenants
  FOR INSERT WITH CHECK (owner_user_id = (SELECT auth.uid()));
CREATE POLICY tenant_update ON public.tenants
  FOR UPDATE USING (owner_user_id = (SELECT auth.uid()) OR public.app_is_super_admin((SELECT auth.uid())))
  WITH CHECK (owner_user_id = (SELECT auth.uid()) OR public.app_is_super_admin((SELECT auth.uid())));

CREATE POLICY tenant_members_select ON public.tenant_members
  FOR SELECT USING (user_id = (SELECT auth.uid()) OR public.can_access_tenant(tenant_id));
CREATE POLICY tenant_members_insert ON public.tenant_members
  FOR INSERT WITH CHECK (
    public.app_is_super_admin((SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.owner_user_id = (SELECT auth.uid()))
  )
;
CREATE POLICY tenant_members_update ON public.tenant_members
  FOR UPDATE USING (
    public.app_is_super_admin((SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.owner_user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    public.app_is_super_admin((SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.owner_user_id = (SELECT auth.uid()))
  );
CREATE POLICY tenant_members_delete ON public.tenant_members
  FOR DELETE USING (
    public.app_is_super_admin((SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.owner_user_id = (SELECT auth.uid()))
  );

CREATE POLICY profile_select ON public.profiles
  FOR SELECT USING (id = (SELECT auth.uid()) OR public.app_is_super_admin((SELECT auth.uid())));
CREATE POLICY profile_insert ON public.profiles
  FOR INSERT WITH CHECK (id = (SELECT auth.uid()));
CREATE POLICY profile_update ON public.profiles
  FOR UPDATE USING (id = (SELECT auth.uid()) OR public.app_is_super_admin((SELECT auth.uid())))
  WITH CHECK (id = (SELECT auth.uid()) OR public.app_is_super_admin((SELECT auth.uid())));

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'cases', 'messages', 'clients', 'contracts', 'installments',
    'collection_policies', 'agents', 'debtors', 'audit_logs',
    'contract_clauses', 'contract_documents', 'contract_guarantees',
    'contract_guarantors', 'contract_responsibles', 'financial_titles',
    'workflows', 'campaigns', 'negotiations', 'quarantines', 'negativations',
    'protests', 'legal_processes'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON public.%I FOR ALL USING (public.can_access_tenant(tenant_id)) WITH CHECK (public.can_access_tenant(tenant_id))', table_name);
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO authenticated;
REVOKE ALL ON FUNCTION public.tenant_for_user(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_legacy_tenant() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_relationship_tenant() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_installment_title() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_title_installment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.app_is_super_admin(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_tenant(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_is_super_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_tenant(UUID) TO authenticated;

-- New users automatically get a profile, tenant and owner membership.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id UUID;
  display_name TEXT;
BEGIN
  display_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'name'), ''), split_part(COALESCE(NEW.email, NEW.id::text), '@', 1), 'Tenant');

  INSERT INTO public.tenants (name, slug, owner_user_id)
  VALUES (display_name, 'tenant-' || replace(left(NEW.id::text, 8), '-', ''), NEW.id)
  ON CONFLICT (owner_user_id) DO UPDATE SET updated_at = timezone('utc'::text, now())
  RETURNING id INTO new_tenant_id;

  INSERT INTO public.tenant_members (tenant_id, user_id, role)
  VALUES (new_tenant_id, NEW.id, 'owner')
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  INSERT INTO public.profiles (id, tenant_id, name, email)
  VALUES (NEW.id, new_tenant_id, display_name, NEW.email)
  ON CONFLICT (id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMENT ON TABLE public.tenants IS 'B2B tenant root. Each existing auth user was migrated to one tenant.';
COMMENT ON TABLE public.tenant_members IS 'Membership boundary for future teams and tenant-level roles.';
COMMENT ON TABLE public.financial_titles IS 'Canonical financial receivables linked to contracts; installments is retained as a compatibility table.';
