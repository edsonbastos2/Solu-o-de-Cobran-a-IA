-- ==============================================================================
-- TABELA DE EVENTOS DE WEBHOOK PARA IDEMPOTÊNCIA
-- ==============================================================================
-- Garante que mensagens duplicadas enviadas pelo Z-API não sejam processadas duas vezes
-- (impede chamadas duplicadas à IA e custo/consumo indevido).

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: apenas service role (server-side) acessa. Negar acesso anônimo/authenticated.
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.webhook_events FROM anon, authenticated;
GRANT SELECT, INSERT ON public.webhook_events TO service_role;

-- Índice para limpar eventos antigos (job opcional)
CREATE INDEX IF NOT EXISTS webhook_events_created_at_idx ON public.webhook_events (created_at);