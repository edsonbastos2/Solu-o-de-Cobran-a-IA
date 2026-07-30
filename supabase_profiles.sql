-- SQL Script para criar a tabela de perfis (profiles) no Supabase

-- 1. Cria a tabela profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  phone TEXT,
  zapi_instance TEXT,
  zapi_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilita Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Cria políticas de segurança
-- Permitir que o usuário veja apenas o seu próprio perfil
CREATE POLICY "Usuários podem ver o próprio perfil"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Permitir que o usuário insira o próprio perfil
CREATE POLICY "Usuários podem inserir o próprio perfil"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Permitir que o usuário atualize o próprio perfil
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
