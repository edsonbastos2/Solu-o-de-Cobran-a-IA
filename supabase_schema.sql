-- Execute this SQL in your Supabase project's SQL Editor

CREATE TABLE public.cases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  original_value NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  max_discount_margin NUMERIC NOT NULL, -- percentage like 10 for 10%
  status TEXT NOT NULL DEFAULT 'not_started', -- not_started, in_negotiation, needs_attention, closed
  updated_value NUMERIC NOT NULL
);

-- Enable Row Level Security (RLS) but allow all for this MVP
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for anon on cases" ON public.cases
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);


CREATE TABLE public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'user' (debtor), 'ai' (agent), 'system'
  content TEXT NOT NULL
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for anon on messages" ON public.messages
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
