import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSupabaseServer } from '@/lib/supabase-server';
import { requireUser, serverError } from '@/lib/api-auth';

// Campos sensíveis que devem ser criptografados antes de salvar
const SECRET_FIELDS = [
  'gemini_api_key',
  'openai_api_key',
  'anthropic_api_key',
  'openrouter_api_key',
  'zapi_key',
  'zapi_client_token'
] as const;

// GET: retorna o perfil do usuário logado, SEM as chaves (apenas flags indicando se estão configuradas)
export async function GET(req: NextRequest) {
  try {
    const r = await requireUser(req);
    if ('response' in r) return r.response;
    const { ctx } = r;

    const admin = getSupabaseAdmin();
    const client = admin || getSupabaseServer(req);
    if (!client) {
      return NextResponse.json({ error: 'Servidor não configurado.' }, { status: 500 });
    }

    const { data: profile, error } = await client
      .from('profiles')
      .select('id, name, phone, zapi_instance, ai_provider, ai_model, ollama_base_url, email, is_super_admin')
      .eq('id', ctx.userId)
      .maybeSingle();

    if (error) return serverError('settings GET error', error);
    if (!profile) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 });

    // Verifica quais chaves já estão configuradas (sem expor o valor)
    const flags: Record<string, boolean> = {};
    if (admin) {
      for (const f of SECRET_FIELDS) {
        const { data } = await admin.from('profiles').select(f).eq('id', ctx.userId).maybeSingle();
        flags[`${f}_set`] = !!(data && (data as any)[f]);
      }
    }

    return NextResponse.json({ profile, secrets: flags });
  } catch (err) {
    return serverError('settings GET exception', err);
  }
}

// PUT: salva o perfil, criptografando os campos sensíveis via RPC ai_encrypt
export async function PUT(req: NextRequest) {
  try {
    const r = await requireUser(req);
    if ('response' in r) return r.response;
    const { ctx } = r;

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Servidor não configurado.' }, { status: 500 });
    }

    const body = await req.json();
    const {
      name, phone,
      zapi_instance, zapi_key, zapi_client_token,
      ai_provider, ai_model,
      gemini_api_key, openai_api_key, anthropic_api_key, openrouter_api_key,
      ollama_base_url
    } = body;

    // Monta update apenas com campos fornecidos
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) update.name = typeof name === 'string' ? name.trim() || null : null;
    if (phone !== undefined) update.phone = typeof phone === 'string' ? phone.trim() || null : null;
    if (zapi_instance !== undefined) update.zapi_instance = typeof zapi_instance === 'string' ? zapi_instance.trim() || null : null;
    if (ai_provider !== undefined) update.ai_provider = typeof ai_provider === 'string' ? ai_provider : 'gemini';
    if (ai_model !== undefined) update.ai_model = typeof ai_model === 'string' ? ai_model : null;
    if (ollama_base_url !== undefined) update.ollama_base_url = typeof ollama_base_url === 'string' ? ollama_base_url : null;

    // Criptografa campos sensíveis SOMENTE se vierem preenchidos.
    // String vazia => limpa o campo ( salva NULL ).
    const secretInputs: Record<string, string | undefined> = {
      gemini_api_key, openai_api_key, anthropic_api_key, openrouter_api_key,
      zapi_key, zapi_client_token
    };

    for (const field of SECRET_FIELDS) {
      const v = secretInputs[field];
      if (v === undefined) continue; // não enviou => não altera
      if (v === '' || v === null) {
        update[field] = null; // limpa
        continue;
      }
      if (typeof v !== 'string') {
        return NextResponse.json({ error: `Campo inválido: ${field}` }, { status: 400 });
      }
      // Criptografa via RPC
      const { data: enc, error: encErr } = await admin.rpc('ai_encrypt', { plain: v });
      if (encErr || !enc) {
        return serverError(`settings PUT encrypt ${field} error`, encErr);
      }
      update[field] = enc;
    }

    const { error } = await admin.from('profiles').update(update).eq('id', ctx.userId);
    if (error) return serverError('settings PUT update error', error);

    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError('settings PUT exception', err);
  }
}