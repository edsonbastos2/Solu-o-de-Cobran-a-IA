-- ==============================================================================
-- SCRIPT DE SEGURANÇA E ISOLAMENTO MULTI-TENANT (ROW LEVEL SECURITY)
-- ==============================================================================
-- Este script garante a separação total dos dados entre empresas (tenants).
-- Apenas o Super Admin (bastose132@gmail.com ou is_super_admin=true) pode ver todos os dados.
-- Usuários comuns só enxergam os dados vinculados ao seu próprio user_id.

-- 1. Garante que todas as tabelas possuem a coluna user_id
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.collection_policies ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Ativa RLS em todas as tabelas principais
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Função auxilar para verificar se o usuário é Super Admin
CREATE OR REPLACE FUNCTION public.is_super_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND (is_super_admin = true OR email = 'bastose132@gmail.com')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Remover políticas permissivas antigas ou vulneráveis (como "Allow all operations for anon")
DROP POLICY IF EXISTS "Allow all operations for anon on cases" ON public.cases;
DROP POLICY IF EXISTS "Allow all operations for anon on messages" ON public.messages;
DROP POLICY IF EXISTS "Users can manage their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can manage their own contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can manage their own installments" ON public.installments;
DROP POLICY IF EXISTS "Tenant isolation for cases" ON public.cases;
DROP POLICY IF EXISTS "Tenant isolation for messages" ON public.messages;
DROP POLICY IF EXISTS "Tenant isolation for clients" ON public.clients;
DROP POLICY IF EXISTS "Tenant isolation for contracts" ON public.contracts;
DROP POLICY IF EXISTS "Tenant isolation for installments" ON public.installments;

-- 5. Criar Políticas Restritas para CASOS (cases)
CREATE POLICY "Tenant isolation for cases" ON public.cases
  FOR ALL
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  );

-- 6. Criar Políticas Restritas para MENSAGENS (messages)
CREATE POLICY "Tenant isolation for messages" ON public.messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.cases
      WHERE cases.id = messages.case_id
      AND (
        (auth.uid() IS NOT NULL AND cases.user_id = auth.uid())
        OR public.is_super_admin(auth.uid())
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cases
      WHERE cases.id = messages.case_id
      AND (
        (auth.uid() IS NOT NULL AND cases.user_id = auth.uid())
        OR public.is_super_admin(auth.uid())
      )
    )
  );

-- 7. Criar Políticas Restritas para CLIENTES (clients)
CREATE POLICY "Tenant isolation for clients" ON public.clients
  FOR ALL
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  );

-- 8. Criar Políticas Restritas para CONTRATOS (contracts)
CREATE POLICY "Tenant isolation for contracts" ON public.contracts
  FOR ALL
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  );

-- 9. Criar Políticas Restritas para PARCELAS (installments)
CREATE POLICY "Tenant isolation for installments" ON public.installments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.contracts
      WHERE contracts.id = installments.contract_id
      AND (
        (auth.uid() IS NOT NULL AND contracts.user_id = auth.uid())
        OR public.is_super_admin(auth.uid())
      )
    )
  );

-- 10. Atualiza política de perfis para super admin
DROP POLICY IF EXISTS "Superadmins podem ver todos os perfis" ON public.profiles;
CREATE POLICY "Superadmins podem ver todos os perfis"
  ON public.profiles
  FOR SELECT
  USING (
    auth.uid() = id
    OR public.is_super_admin(auth.uid())
  );
