-- Atualização para suportar Super Admin
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

-- Atualiza emails existentes (se possível, puxando da auth.users)
-- (Requer permissão de superuser no banco, caso não rode, pode ignorar pois os novos terão email)
UPDATE public.profiles p SET email = u.email FROM auth.users u WHERE p.id = u.id AND p.email IS NULL;

-- Atualiza a função trigger para salvar o email do usuário ao cadastrar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Definir bastose132@gmail.com como super admin (se já existir)
UPDATE public.profiles SET is_super_admin = true WHERE email = 'bastose132@gmail.com';

-- Novas políticas para o perfil do Super Admin ver e editar todos os perfis
DROP POLICY IF EXISTS "Superadmins podem ver todos os perfis" ON public.profiles;
CREATE POLICY "Superadmins podem ver todos os perfis"
  ON public.profiles
  FOR SELECT
  USING (
    auth.jwt() ->> 'email' = 'bastose132@gmail.com' 
    OR 
    is_super_admin = true
    OR
    auth.uid() = id
  );

DROP POLICY IF EXISTS "Superadmins podem atualizar todos os perfis" ON public.profiles;
CREATE POLICY "Superadmins podem atualizar todos os perfis"
  ON public.profiles
  FOR UPDATE
  USING (
    auth.jwt() ->> 'email' = 'bastose132@gmail.com' 
    OR 
    is_super_admin = true
    OR
    auth.uid() = id
  );

-- Atualiza a política original para evitar conflitos (opcional, pois já cobrimos tudo na nova política)
DROP POLICY IF EXISTS "Usuários podem ver o próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar o próprio perfil" ON public.profiles;
