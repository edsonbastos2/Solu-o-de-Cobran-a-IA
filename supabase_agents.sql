-- SQL script for creating the Agents (Agentes IA) table in Supabase
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role_type TEXT NOT NULL, -- 'supervisor', 'cobranca', 'negociacao', 'financeiro', 'juridico', 'qualidade', 'analise_credito', 'custom'
  icon TEXT DEFAULT 'Bot',
  color TEXT DEFAULT 'bg-blue-600',
  description TEXT,
  system_prompt TEXT NOT NULL,
  model TEXT DEFAULT 'gemini-3.5-flash',
  temperature NUMERIC DEFAULT 0.2,
  max_discount NUMERIC DEFAULT 10,
  tone TEXT DEFAULT 'profissional', -- 'empatico', 'firme', 'formal', 'analitico', 'negociador'
  is_active BOOLEAN DEFAULT true,
  rules JSONB DEFAULT '{}'::jsonb
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- Allow users to manage their own agents or see default global agents (user_id IS NULL)
DROP POLICY IF EXISTS "Usuários podem ver agentes" ON public.agents;
CREATE POLICY "Usuários podem ver agentes" ON public.agents
  FOR SELECT
  USING (
    user_id IS NULL 
    OR auth.uid() = user_id 
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

DROP POLICY IF EXISTS "Usuários podem criar agentes" ON public.agents;
CREATE POLICY "Usuários podem criar agentes" ON public.agents
  FOR INSERT
  WITH CHECK (
    user_id IS NULL OR auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Usuários podem atualizar agentes" ON public.agents;
CREATE POLICY "Usuários podem atualizar agentes" ON public.agents
  FOR UPDATE
  USING (
    user_id IS NULL 
    OR auth.uid() = user_id 
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

DROP POLICY IF EXISTS "Usuários podem deletar agentes" ON public.agents;
CREATE POLICY "Usuários podem deletar agentes" ON public.agents
  FOR DELETE
  USING (
    auth.uid() = user_id 
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );
