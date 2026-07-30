-- SQL Script para criar a tabela de audit_logs no Supabase

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários podem ver logs dos próprios casos" ON public.audit_logs;
CREATE POLICY "Usuários podem ver logs dos próprios casos"
  ON public.audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cases
      WHERE cases.id = audit_logs.case_id
      AND cases.user_id = auth.uid()
    )
  );

-- Trigger for cases table
CREATE OR REPLACE FUNCTION public.log_case_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (case_id, user_id, action, new_status, details)
    VALUES (NEW.id, NEW.user_id, 'CASE_CREATED', NEW.status, 'Caso criado');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.audit_logs (case_id, user_id, action, old_status, new_status, details)
      VALUES (NEW.id, NEW.user_id, 'STATUS_CHANGE', OLD.status, NEW.status, 'Status alterado de ' || OLD.status || ' para ' || NEW.status);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_case_change ON public.cases;
CREATE TRIGGER on_case_change
  AFTER INSERT OR UPDATE ON public.cases
  FOR EACH ROW EXECUTE PROCEDURE public.log_case_changes();

-- Trigger for messages table (Human intervention)
CREATE OR REPLACE FUNCTION public.log_human_intervention()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.role = 'human' THEN
    -- Assuming case_id is present and we can fetch user_id from cases table for simplicity if not in messages
    INSERT INTO public.audit_logs (case_id, action, details)
    VALUES (NEW.case_id, 'HUMAN_INTERVENTION', 'Mensagem enviada por humano: ' || substring(NEW.content from 1 for 50) || '...');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_human_message ON public.messages;
CREATE TRIGGER on_human_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE PROCEDURE public.log_human_intervention();
