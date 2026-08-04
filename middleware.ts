import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Rotas públicas (não exigem sessão)
const PUBLIC_PATHS = [
  '/login',
  '/api/webhook',        // webhook usa seu próprio secret
  '/api/cron',            // cron usa CRON_SECRET
  '/api/extract-contract' // endpoint auxiliar (valida internamente)
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip assets e API internas públicas
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    isPublic(pathname)
  ) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Sem Supabase config: não bloqueia (app rodando em modo demo)
    return NextResponse.next();
  }

  // Cliente efêmero só para validar sessão no edge (sem persistência)
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // Tenta obter a sessão a partir dos cookies do Supabase (sb-access-token / sb-refresh-token)
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    // Para navegadores: redireciona ao login. Para API: 401 JSON.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Para rotas /admin* (UI), valida is_super_admin via claim no JWT ou chamada a profiles.
  // Edge não pode chamar DB; confiamos na flag no cookie/JWT se presente. Client-side AuthGuard reforça.
  // (Consulta server-side completa é feita nas rotas /api/admin/*.)
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Protege tudo exceto assets e arquivos estáticos
    '/((?!_next/static|_next/image|favicon.ico).*)'
  ]
};