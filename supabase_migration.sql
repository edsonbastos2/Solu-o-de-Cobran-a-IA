-- 1. Create the new tables (if they don't exist)
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own clients" ON public.clients;
CREATE POLICY "Users can manage their own clients" ON public.clients
  FOR ALL USING (user_id IS NULL OR auth.uid() = user_id OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true);


CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  contract_number TEXT,
  type TEXT,
  start_date DATE,
  due_date DATE,
  clauses TEXT,
  interest_rate NUMERIC,
  penalty_rate NUMERIC,
  monetary_correction_index TEXT,
  guarantees TEXT,
  guarantors TEXT,
  negative_allowed BOOLEAN DEFAULT false,
  protest_allowed BOOLEAN DEFAULT false,
  forum TEXT,
  document_url TEXT
);
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own contracts" ON public.contracts;
CREATE POLICY "Users can manage their own contracts" ON public.contracts
  FOR ALL USING (user_id IS NULL OR auth.uid() = user_id OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true);


CREATE TABLE IF NOT EXISTS public.installments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE NOT NULL,
  installment_number INTEGER NOT NULL,
  original_value NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  status TEXT DEFAULT 'pending'
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

-- 2. Migrate Debtors to Clients
INSERT INTO public.clients (id, created_at, user_id, name, document, address, phone, email)
SELECT 
  id, 
  created_at, 
  user_id, 
  name, 
  COALESCE(document, '00000000000'), 
  address, 
  phone, 
  email
FROM public.debtors
ON CONFLICT (id) DO NOTHING;

-- 3. Migrate Cases to Contracts and Installments
DO $$
DECLARE
    case_record RECORD;
    new_client_id UUID;
    new_contract_id UUID;
    mapped_status TEXT;
BEGIN
    FOR case_record IN SELECT * FROM public.cases LOOP
        
        -- Determine client_id
        IF case_record.debtor_id IS NOT NULL THEN
            new_client_id := case_record.debtor_id;
        ELSE
            -- Create a new client for this case if no debtor was linked
            new_client_id := gen_random_uuid();
            INSERT INTO public.clients (id, created_at, name, document, phone, email, address)
            VALUES (
                new_client_id, 
                case_record.created_at, 
                case_record.name, 
                COALESCE(case_record.debtor_document, '00000000000'), 
                case_record.phone, 
                case_record.debtor_email, 
                case_record.debtor_address
            );
        END IF;

        -- Create a contract for this case, using the case ID to preserve relations if needed
        new_contract_id := case_record.id;
        
        INSERT INTO public.contracts (
            id, created_at, client_id, contract_number, type, due_date
        ) VALUES (
            new_contract_id, 
            case_record.created_at, 
            new_client_id, 
            'Caso Antigo: ' || left(case_record.id::text, 8), 
            'Migração do Sistema Anterior', 
            case_record.due_date
        ) ON CONFLICT (id) DO NOTHING;

        -- Map status
        mapped_status := CASE case_record.status
            WHEN 'closed' THEN 'paid'
            WHEN 'needs_attention' THEN 'late'
            WHEN 'in_negotiation' THEN 'in_negotiation'
            ELSE 'pending'
        END;

        -- Create an installment for this case
        INSERT INTO public.installments (
            contract_id, created_at, installment_number, original_value, due_date, status
        ) VALUES (
            new_contract_id,
            case_record.created_at,
            1,
            case_record.original_value,
            case_record.due_date,
            mapped_status
        );

    END LOOP;
END $$;
