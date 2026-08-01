-- Resolvendo a duplicação antes de aplicar as restrições UNIQUE

-- 1. Tratar duplicatas de 'document' na tabela clients (Mantém o mais recente, altera os antigos)
UPDATE public.clients
SET document = document || '-' || substr(id::text, 1, 8)
WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() over (partition by document order by created_at desc) as rn
    FROM public.clients
    WHERE document IS NOT NULL
  ) t
  WHERE t.rn > 1
);

-- 2. Tratar duplicatas de 'email' na tabela clients
UPDATE public.clients
SET email = substr(id::text, 1, 8) || '-' || email
WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() over (partition by email order by created_at desc) as rn
    FROM public.clients
    WHERE email IS NOT NULL
  ) t
  WHERE t.rn > 1
);

-- 3. Tratar duplicatas de 'contract_number' na tabela contracts
UPDATE public.contracts
SET contract_number = contract_number || '-' || substr(id::text, 1, 8)
WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() over (partition by contract_number order by created_at desc) as rn
    FROM public.contracts
    WHERE contract_number IS NOT NULL
  ) t
  WHERE t.rn > 1
);

-- Adicionando restrições de unicidade (UNIQUE) aos campos solicitados
ALTER TABLE public.clients ADD CONSTRAINT clients_document_key UNIQUE (document);
ALTER TABLE public.clients ADD CONSTRAINT clients_email_key UNIQUE (email);
ALTER TABLE public.contracts ADD CONSTRAINT contracts_contract_number_key UNIQUE (contract_number);
