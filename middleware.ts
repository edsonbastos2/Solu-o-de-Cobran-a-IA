import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

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

  // Cria um client server-side que lê/escreve cookies da request
  const res = NextResponse.next();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookies) {
        cookies.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  // Valida a sessão a partir dos cookies (e refresh automaticamente se preciso)
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

  // Repassa cookies atualizados (refresh de token) na resposta
  return res;
}

export const config = {
  matcher: [
    // Protege tudo exceto assets e arquivos estáticos
    '/((?!_next/static|_next/image|favicon.ico).*)'
  ]
};