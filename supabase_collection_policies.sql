-- Tabela de Políticas de Cobrança
CREATE TABLE IF NOT EXISTS public.collection_policies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Tenant
  name TEXT NOT NULL, -- e.g., "Padrão", "Premium"
  interest_rate NUMERIC, -- juros padrão (%)
  penalty_rate NUMERIC, -- multa padrão (%)
  monetary_correction_index TEXT, -- índice padrão (ex: IGPM, IPCA)
  negative_allowed BOOLEAN DEFAULT false,
  days_to_negative INTEGER, -- Negativar após X dias
  protest_allowed BOOLEAN DEFAULT false,
  days_to_protest INTEGER, -- Protestar após X dias
  active BOOLEAN DEFAULT true
);

ALTER TABLE public.collection_policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own collection policies" ON public.collection_policies;
CREATE POLICY "Users can manage their own collection policies" ON public.collection_policies
  FOR ALL USING (user_id IS NULL OR auth.uid() = user_id OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true);

-- Adicionar relacionamento de política ao contrato e campos de sobrescrita
ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS collection_policy_id UUID REFERENCES public.collection_policies(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS override_days_to_negative INTEGER,
ADD COLUMN IF NOT EXISTS override_days_to_protest INTEGER;
