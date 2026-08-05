-- SQL Script para criar a tabela de perfis (profiles) no Supabase

-- 1. Cria a tabela profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  phone TEXT,
  zapi_instance TEXT,
  zapi_key TEXT,
  zapi_client_token TEXT,
  messaging_provider TEXT DEFAULT 'whatsapp',
  telegram_bot_token TEXT,
  ai_provider TEXT DEFAULT 'opencode',
  ai_model TEXT DEFAULT 'deepseek-v4-flash',
  opencode_api_key TEXT,
  gemini_api_key TEXT,
  anthropic_api_key TEXT,
  openrouter_api_key TEXT,
  ollama_base_url TEXT DEFAULT 'http://localhost:11434',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Garante que as colunas existam caso a tabela já tenha sido criada anteriormente
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ai_provider TEXT DEFAULT 'opencode';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ai_model TEXT DEFAULT 'deepseek-v4-flash';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS opencode_api_key TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS openai_api_key TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS openrouter_api_key TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ollama_base_url TEXT DEFAULT 'http://localhost:11434';

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS zapi_client_token TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS messaging_provider TEXT DEFAULT 'whatsapp';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Cria políticas de segurança
-- Permitir que o usuário veja apenas o seu próprio perfil
DROP POLICY IF EXISTS "Usuários podem ver o próprio perfil" ON public.profiles;
CREATE POLICY "Usuários podem ver o próprio perfil"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Permitir que o usuário insira o próprio perfil
DROP POLICY IF EXISTS "Usuários podem inserir o próprio perfil" ON public.profiles;
CREATE POLICY "Usuários podem inserir o próprio perfil"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Permitir que o usuário atualize o próprio perfil
DROP POLICY IF EXISTS "Usuários podem atualizar o próprio perfil" ON public.profiles;
CREATE POLICY "Usuários podem atualizar o próprio perfil"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- 4. Função (Trigger) para criar automaticamente um perfil vazio quando um novo usuário se cadastrar (opcional, mas recomendado)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cria o gatilho na tabela auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- CORREÇÃO PARA A TABELA CASES:
-- Se a tabela cases tem RLS ativado (row-level security), precisamos garantir que ela tem a coluna user_id
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- Atualizar política de inserção de casos para exigir o auth.uid()
-- CREATE POLICY "Usuários podem inserir os próprios casos" ON public.cases FOR INSERT WITH CHECK (auth.uid() = user_id);

