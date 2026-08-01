-- 1. Clients Table (Replaces Debtors as the root entity for individuals/companies)
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Tenant
  name TEXT NOT NULL,
  document TEXT NOT NULL UNIQUE, -- CPF/CNPJ
  address TEXT,
  phone TEXT,
  email TEXT UNIQUE
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own clients" ON public.clients;
CREATE POLICY "Users can manage their own clients" ON public.clients
  FOR ALL USING (user_id IS NULL OR auth.uid() = user_id OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true);

-- 2. Contracts Table
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Tenant
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  contract_number TEXT UNIQUE,
  type TEXT,
  start_date DATE,
  due_date DATE,
  clauses TEXT,
  interest_rate NUMERIC, -- juros
  penalty_rate NUMERIC, -- multa
  monetary_correction_index TEXT, -- indice
  guarantees TEXT,
  guarantors TEXT, -- fiadores
  negative_allowed BOOLEAN DEFAULT false,
  protest_allowed BOOLEAN DEFAULT false,
  forum TEXT,
  document_url TEXT
);
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own contracts" ON public.contracts;
CREATE POLICY "Users can manage their own contracts" ON public.contracts
  FOR ALL USING (user_id IS NULL OR auth.uid() = user_id OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true);

-- 3. Installments Table (Títulos Financeiros)
CREATE TABLE IF NOT EXISTS public.installments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE NOT NULL,
  installment_number INTEGER NOT NULL,
  original_value NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  status TEXT DEFAULT 'pending' -- pending, paid, late, in_negotiation
);
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own installments" ON public.installments;
CREATE POLICY "Users can manage their own installments" ON public.installments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.contracts 
      WHERE contracts.id = installments.contract_id 
      AND (contracts.user_id IS NULL OR auth.uid() = contracts.user_id OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true)
    )
  );
