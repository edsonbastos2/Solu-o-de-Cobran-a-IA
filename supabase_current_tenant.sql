-- Contexto de tenant persistido para super-admin (workspace switcher).
-- Separado de profiles.tenant_id (tenant de origem, estrutural).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_tenant_id uuid;

COMMENT ON COLUMN public.profiles.current_tenant_id IS
  'Tenant atualmente selecionado pelo super-admin; NULL = sem contexto persistido.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_current_tenant_id_fkey') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_current_tenant_id_fkey
      FOREIGN KEY (current_tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_current_tenant_id_fkey;

-- Backfill: super-admin sem contexto passa a usar o tenant da membership ativa mais antiga.
UPDATE public.profiles p
SET current_tenant_id = m.tenant_id
FROM (
  SELECT DISTINCT ON (user_id) user_id, tenant_id
  FROM public.tenant_members
  WHERE status = 'active'
  ORDER BY user_id, created_at ASC
) m
WHERE p.id = m.user_id
  AND p.is_super_admin = true
  AND p.current_tenant_id IS NULL;
