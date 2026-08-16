// Rota pública (ver PUBLIC_PATHS em middleware.ts, prefixo /convite) que troca
// o token de convite/recovery por uma sessão real via verifyOtp, setando os
// cookies de sessão na resposta antes de redirecionar para /convite/aceitar.
// Ver lib/team-invite.ts (buildConfirmUrl) para o motivo de não usar mais o
// action_link bruto do Supabase Admin API.
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { EmailOtpType } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') || '/convite/aceitar';

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const invalidLinkUrl = new URL('/convite/aceitar', origin);
  invalidLinkUrl.searchParams.set('error', 'invalid_link');

  if (!tokenHash || !type || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(invalidLinkUrl);
  }

  const redirectRes = NextResponse.redirect(new URL(next, origin));
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookies) {
        cookies.forEach(({ name, value, options }) => {
          redirectRes.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    logger.warn('convite/confirmar: verifyOtp falhou', undefined, { type, error: error.message });
    return NextResponse.redirect(invalidLinkUrl);
  }

  return redirectRes;
}
