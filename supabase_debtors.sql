-- SQL script for creating the Debtors (Devedores) table in Supabase
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.debtors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  document TEXT, -- CPF or CNPJ
  address TEXT, -- Full street, number, neighborhood, city, state, zip
  notes TEXT
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.debtors ENABLE ROW LEVEL SECURITY;

-- Allow all for anon if user_id is null OR match user_id
DROP POLICY IF EXISTS "Usuários podem ver os próprios devedores" ON public.debtors;
CREATE POLICY "Usuários podem ver os próprios devedores" ON public.debtors
  FOR SELECT
  USING (
    user_id IS NULL 
    OR auth.uid() = user_id 
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

DROP POLICY IF EXISTS "Usuários podem inserir os próprios devedores" ON public.debtors;
CREATE POLICY "Usuários podem inserir os próprios devedores" ON public.debtors
  FOR INSERT
  WITH CHECK (
    user_id IS NULL OR auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Usuários podem atualizar os próprios devedores" ON public.debtors;
CREATE POLICY "Usuários podem atualizar os próprios devedores" ON public.debtors
  FOR UPDATE
  USING (
    user_id IS NULL 
    OR auth.uid() = user_id 
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

DROP POLICY IF EXISTS "Usuários podem deletar os próprios devedores" ON public.debtors;
CREATE POLICY "Usuários podem deletar os próprios devedores" ON public.debtors
  FOR DELETE
  USING (
    user_id IS NULL 
    OR auth.uid() = user_id 
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- Link debtors to cases table
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS debtor_id UUID REFERENCES public.debtors(id) ON DELETE SET NULL;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS debtor_email TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS debtor_document TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS debtor_address TEXT;
