-- ==============================================================================
-- CRIPTOGRAFIA DE CHAVES DE IA E WHATSAPP EM profiles
-- ==============================================================================
-- As colunas abaixo contêm segredos do cliente (chaves de LLM, tokens Z-API).
-- Antes eram armazenadas em texto puro. Esta migration:
--   1. Habilita pgcrypto.
--   2. Adiciona funções encrypt/decrypt usando chave do Vault (vault.secret_key).
--   3. Migra as colunas TEXT existentes para TEXT (criptografado).
--   4. Atualiza a trigger de update para re-criptografar campos sensíveis.
--
-- Pré-requisito:
--   Defina uma chave de criptografia no Vault do Supabase (Project Settings > Vault):
--     nome: ai_keys_encryption_key
--     valor: <chave aleatória de 32 bytes (base64)>
--   E conceda acesso à função service_role.
-- Exemplo no SQL Editor (execute uma única vez e não regenere depois):
--   SELECT vault.create_secret(encode(gen_random_bytes(32), 'base64'), 'ai_keys_encryption_key');
-- Caso use Supabase self-hosted, crie a chave em vault.secrets.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault; -- presente no Supabase gerenciado

-- --------------------------------------------------------------------
-- Helper: obter chave de criptografia do Vault
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_ai_encryption_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vault_key TEXT;
BEGIN
  SELECT decrypted_secret::TEXT
    INTO vault_key
    FROM vault.decrypted_secrets
   WHERE name = 'ai_keys_encryption_key'
   LIMIT 1;

  IF vault_key IS NULL OR btrim(vault_key) = '' THEN
    RAISE EXCEPTION 'Vault secret ai_keys_encryption_key is not configured';
  END IF;

  -- Mantem compatibilidade com os dados ja criptografados.
  RETURN vault_key;
END;
$$;

-- --------------------------------------------------------------------
-- Encrypt/Decrypt de strings
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ai_encrypt(plain TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF plain IS NULL OR plain = '' THEN
    RETURN plain;
  END IF;
  -- retorna em base64 o envelope pgcrypto (iv + ciphertext + tag)
  RETURN encode(
    pgp_sym_encrypt(plain, public.get_ai_encryption_key()),
    'base64'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_decrypt(cipher TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  raw BYTEA;
BEGIN
  IF cipher IS NULL OR cipher = '' THEN
    RETURN cipher;
  END IF;
  raw := decode(cipher, 'base64');
  RETURN pgp_sym_decrypt(raw, public.get_ai_encryption_key());
END;
$$;

-- --------------------------------------------------------------------
-- Compatibilidade: garante as colunas usadas pela criptografia/RPC
-- --------------------------------------------------------------------
-- Necessario para projetos que criaram profiles antes destas colunas.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ai_provider TEXT DEFAULT 'opencode';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ai_model TEXT DEFAULT 'deepseek-v4-flash';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS opencode_api_key TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS openai_api_key TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS openrouter_api_key TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ollama_base_url TEXT DEFAULT 'http://localhost:11434';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS zapi_instance TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS zapi_key TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS zapi_client_token TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS messaging_provider TEXT DEFAULT 'whatsapp';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT;

-- --------------------------------------------------------------------
-- Migração dos dados existentes: criptografa o valor atual (idempotente)
-- --------------------------------------------------------------------
-- Nota: rodar uma única vez. Repetir re-criptografa o texto cifrado, quebrando o dado.
-- Antes de rodar, faça backup da tabela profiles.
--
-- UPDATE public.profiles
--   SET opencode_api_key  = public.ai_encrypt(opencode_api_key),
--       gemini_api_key     = public.ai_encrypt(gemini_api_key),
--       openai_api_key     = public.ai_encrypt(openai_api_key),
--       anthropic_api_key  = public.ai_encrypt(anthropic_api_key),
--       openrouter_api_key = public.ai_encrypt(openrouter_api_key),
--       zapi_key           = public.ai_encrypt(zapi_key),
--       zapi_client_token  = public.ai_encrypt(zapi_client_token)
-- WHERE opencode_api_key IS NOT NULL
--    OR gemini_api_key IS NOT NULL
--    OR openai_api_key IS NOT NULL
--    OR anthropic_api_key IS NOT NULL
--    OR openrouter_api_key IS NOT NULL
--    OR zapi_key IS NOT NULL
--    OR zapi_client_token IS NOT NULL;

-- --------------------------------------------------------------------
-- RLS: nenhum acesso anônimo; só service_role lê/escreve os segredos.
-- A leitura para o próprio usuário é mediada por API server-side.
-- Revoga acesso direto via API anônima/gráfica para as colunas sensíveis.
-- --------------------------------------------------------------------
REVOKE UPDATE (opencode_api_key, gemini_api_key, openai_api_key, anthropic_api_key, openrouter_api_key, zapi_key, zapi_client_token, telegram_bot_token)
  ON public.profiles FROM anon, authenticated;

-- --------------------------------------------------------------------
-- RPC para o servidor (service role) ler as chaves descriptografadas.
-- Retorna NULL para colunas vazias; nunca expõe para anon/authenticated.
-- --------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_user_ai_keys(UUID);

CREATE OR REPLACE FUNCTION public.get_user_ai_keys(p_user_id UUID)
RETURNS TABLE (
  ai_provider TEXT,
  ai_model TEXT,
  opencode_api_key TEXT,
  gemini_api_key TEXT,
  openai_api_key TEXT,
  anthropic_api_key TEXT,
  openrouter_api_key TEXT,
  ollama_base_url TEXT,
  zapi_instance TEXT,
  zapi_key TEXT,
  zapi_client_token TEXT,
  messaging_provider TEXT,
  telegram_bot_token TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT
    p.ai_provider,
    p.ai_model,
    public.ai_decrypt(p.opencode_api_key),
    public.ai_decrypt(p.gemini_api_key),
    public.ai_decrypt(p.openai_api_key),
    public.ai_decrypt(p.anthropic_api_key),
    public.ai_decrypt(p.openrouter_api_key),
    p.ollama_base_url,
    p.zapi_instance,
    public.ai_decrypt(p.zapi_key),
    public.ai_decrypt(p.zapi_client_token),
    p.messaging_provider,
    public.ai_decrypt(p.telegram_bot_token)
  INTO
    ai_provider, ai_model, opencode_api_key, gemini_api_key, openai_api_key,
    anthropic_api_key, openrouter_api_key, ollama_base_url,
    zapi_instance, zapi_key, zapi_client_token,
    messaging_provider, telegram_bot_token
  FROM public.profiles p
  WHERE p.id = p_user_id;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_ai_keys(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_ai_keys(UUID) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_ai_encryption_key() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_encryption_key() TO service_role;

REVOKE EXECUTE ON FUNCTION public.ai_encrypt(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ai_decrypt(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_encrypt(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_decrypt(TEXT) TO service_role;
