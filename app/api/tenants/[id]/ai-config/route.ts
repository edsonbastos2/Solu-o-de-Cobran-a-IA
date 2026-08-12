import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireTenantContext, requireRole, serverError } from '@/lib/api-auth';
import { recordAuditAction } from '@/lib/audit';
import {
  AIBucket,
  AIProvider,
  DEFAULT_MODELS,
  MODEL_WHITELISTS,
  PROVIDER_API_KEY_FIELD,
  SUPPORTED_PROVIDERS,
  VISION_CAPABLE,
} from '@/lib/ai-config';

const BUCKETS: AIBucket[] = ['assistant', 'pdf_extraction', 'agents'];
const SECRET_PROVIDERS: AIProvider[] = ['opencode', 'gemini', 'openai', 'anthropic', 'openrouter'];

interface OwnerAiProfile {
  ai_provider?: string | null;
  ai_model?: string | null;
  ollama_base_url?: string | null;
  opencode_api_key?: string | null;
  gemini_api_key?: string | null;
  openai_api_key?: string | null;
  anthropic_api_key?: string | null;
  openrouter_api_key?: string | null;
}

type RawBucket = Record<string, unknown> | null;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isModelAllowed(provider: AIProvider, model: string, bucket: AIBucket): boolean {
  if (provider === 'openrouter' || provider === 'ollama') return model.length > 0;
  const whitelist = MODEL_WHITELISTS[provider];
  if (whitelist.includes(model)) return true;
  // Exceção documentada: fallback hardcoded de pdf_extraction usa minimax-m3
  // via opencode (não está na whitelist de chat); permitir no bucket pdf.
  if (provider === 'opencode' && bucket === 'pdf_extraction' && model === 'minimax-m3') return true;
  return false;
}

function maskBucket(raw: RawBucket) {
  const out: Record<string, unknown> = {};
  if (!isObject(raw)) return out;
  if (typeof raw.provider === 'string') out.provider = raw.provider;
  if (typeof raw.model === 'string') out.model = raw.model;
  if (typeof raw.ollama_base_url === 'string') out.ollama_base_url = raw.ollama_base_url;
  for (const p of SECRET_PROVIDERS) {
    const enc = raw[`${p}_api_key_enc`];
    out[`${p}_api_key_set`] = typeof enc === 'string' && enc.length > 0;
  }
  return out;
}

function ownerHasAiConfig(p: OwnerAiProfile): boolean {
  const provider = (p.ai_provider || 'opencode').toLowerCase();
  if (provider !== 'opencode') return true;
  const model = p.ai_model;
  if (model && model !== 'deepseek-v4-flash') return true;
  for (const f of [
    'opencode_api_key',
    'gemini_api_key',
    'openai_api_key',
    'anthropic_api_key',
    'openrouter_api_key',
  ] as const) {
    const v = p[f];
    if (typeof v === 'string' && v.length > 0) return true;
  }
  return false;
}

async function buildMigratedBucket(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  p: OwnerAiProfile
): Promise<Record<string, unknown>> {
  const provider = ((p.ai_provider || 'opencode').toLowerCase() as AIProvider);
  const model = p.ai_model || DEFAULT_MODELS[provider];
  const bucket: Record<string, unknown> = { provider, model };
  if (provider === 'ollama') {
    bucket.ollama_base_url = p.ollama_base_url || 'http://localhost:11434';
    return bucket;
  }
  const plainKey = p[PROVIDER_API_KEY_FIELD[provider] as keyof OwnerAiProfile];
  if (typeof plainKey === 'string' && plainKey.length > 0) {
    const { data: enc, error: encErr } = await admin.rpc('ai_encrypt', { plain: plainKey });
    if (!encErr && typeof enc === 'string') {
      bucket[`${provider}_api_key_enc`] = enc;
    }
  }
  return bucket;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const search = new URL(req.url).searchParams;
    const requestedTenantId = search.get('tenant_id') ?? id;

    // Membros podem LER a config (PRD: membros consomem a config do tenant,
    // sem poder alterá-la). PUT exige admin.
    const tctx = await requireTenantContext(req, requestedTenantId);
    if ('response' in tctx) return tctx.response;
    const { tenantId } = tctx.ctx;

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: 'Configuração de IA por tenant indisponível em modo demo.' },
        { status: 503 }
      );
    }

    const { data: tenant, error: tenantErr } = await admin
      .from('tenants')
      .select('settings, ai_migrated_at, owner_user_id')
      .eq('id', tenantId)
      .maybeSingle();

    if (tenantErr || !tenant) {
      return NextResponse.json(
        { error: 'Tenant não encontrado.', code: 'TENANT_NOT_FOUND' },
        { status: 404 }
      );
    }

    let settings: Record<string, unknown> = isObject(tenant.settings) ? tenant.settings : {};
    let ai: Record<string, unknown> | null = isObject(settings.ai) ? settings.ai : null;
    let migratedAt: string | null = tenant.ai_migrated_at;

    if (!migratedAt) {
      const ownerUserId = tenant.owner_user_id as string | null;
      let ownerProfile: OwnerAiProfile | null = null;
      if (ownerUserId) {
        const { data: ownerRows } = await admin.rpc('get_user_ai_keys', { p_user_id: ownerUserId });
        ownerProfile = (Array.isArray(ownerRows) && ownerRows[0]) ? (ownerRows[0] as OwnerAiProfile) : null;
      }

      const existingAssistant = ai ? ai.assistant : null;

      if (isObject(existingAssistant)) {
        // Usuário já configurou o bucket assistant (PUT antes do primeiro GET):
        // apenas carimba ai_migrated_at para não tentar migrar depois.
        const { error: stampErr } = await admin
          .from('tenants')
          .update({ ai_migrated_at: new Date().toISOString() })
          .eq('id', tenantId)
          .is('ai_migrated_at', null);
        if (stampErr) {
          return serverError('ai-config GET stamp error', stampErr);
        }
      } else if (ownerProfile && ownerHasAiConfig(ownerProfile)) {
        // Migração one-shot: copia config de IA do owner para o bucket assistant,
        // re-criptografando a chave via ai_encrypt. UPDATE condicional (WHERE
        // ai_migrated_at IS NULL) garante idempotência sob GETs concorrentes.
        const migratedBucket = await buildMigratedBucket(admin, ownerProfile);
        ai = ai ?? {};
        ai.assistant = migratedBucket;
        settings = { ...settings, ai };
        const { error: upErr } = await admin
          .from('tenants')
          .update({
            settings,
            ai_migrated_at: new Date().toISOString(),
          })
          .eq('id', tenantId)
          .is('ai_migrated_at', null);
        if (upErr) {
          return serverError('ai-config GET migration error', upErr);
        }
      }
      //	else: owner sem config de IA → não carimba (mantém fallback de sistema/hardcoded)

      // Re-busca estado autoritativo após a migração condicional.
      const { data: refetch } = await admin
        .from('tenants')
        .select('settings, ai_migrated_at')
        .eq('id', tenantId)
        .maybeSingle();
      if (refetch) {
        settings = isObject(refetch.settings) ? refetch.settings : settings;
        ai = isObject(settings.ai) ? settings.ai : null;
        migratedAt = refetch.ai_migrated_at;
      }
    }

    const response = {
      assistant: maskBucket(ai ? (ai.assistant as RawBucket) : null),
      pdf_extraction: maskBucket(ai ? (ai.pdf_extraction as RawBucket) : null),
      agents: maskBucket(ai ? (ai.agents as RawBucket) : null),
      migrated_at: migratedAt,
    };

    return NextResponse.json(response);
  } catch (err) {
    return serverError('ai-config GET exception', err, true);
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const search = new URL(req.url).searchParams;
    const requestedTenantId = search.get('tenant_id') ?? id;

    const tctx = await requireRole(req, 'admin', requestedTenantId);
    if ('response' in tctx) return tctx.response;
    const { tenantId, userId } = tctx.ctx;

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: 'Configuração de IA por tenant indisponível em modo demo.' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const bucketRaw = body?.bucket;
    const providerRaw = body?.provider;
    const modelRaw = typeof body?.model === 'string' ? body.model.trim() : '';

    if (typeof bucketRaw !== 'string' || !BUCKETS.includes(bucketRaw as AIBucket)) {
      return NextResponse.json({ error: 'Bucket inválido.' }, { status: 400 });
    }
    const bucket = bucketRaw as AIBucket;

    if (typeof providerRaw !== 'string' || !SUPPORTED_PROVIDERS.includes(providerRaw as AIProvider)) {
      return NextResponse.json({ error: 'Provedor inválido.' }, { status: 400 });
    }
    const provider = providerRaw as AIProvider;

    if (!modelRaw) {
      return NextResponse.json({ error: 'Modelo é obrigatório.' }, { status: 400 });
    }
    if (!isModelAllowed(provider, modelRaw, bucket)) {
      return NextResponse.json(
        { error: 'Modelo não suportado para este provedor.' },
        { status: 400 }
      );
    }

    if (bucket === 'pdf_extraction' && !VISION_CAPABLE[provider]) {
      return NextResponse.json(
        { error: 'Provedor não suporta visão de documento.' },
        { status: 400 }
      );
    }

    const ollamaBaseUrl =
      provider === 'ollama'
        ? (typeof body.ollama_base_url === 'string' && body.ollama_base_url.trim()) || 'http://localhost:11434'
        : typeof body.ollama_base_url === 'string' && body.ollama_base_url.trim()
          ? body.ollama_base_url.trim()
          : undefined;

    const { data: tenant, error: tenantErr } = await admin
      .from('tenants')
      .select('settings, ai_migrated_at')
      .eq('id', tenantId)
      .maybeSingle();
    if (tenantErr || !tenant) {
      return NextResponse.json(
        { error: 'Tenant não encontrado.', code: 'TENANT_NOT_FOUND' },
        { status: 404 }
      );
    }

    const settings: Record<string, unknown> = isObject(tenant.settings) ? { ...tenant.settings } : {};
    const ai: Record<string, unknown> = isObject(settings.ai) ? { ...settings.ai } : {};
    const existingBucket: RawBucket = isObject(ai[bucket]) ? (ai[bucket] as RawBucket) : null;

    const newBucket: Record<string, unknown> = { provider, model: modelRaw };
    if (ollamaBaseUrl) newBucket.ollama_base_url = ollamaBaseUrl;

    if (provider !== 'ollama') {
      const encField = `${provider}_api_key_enc`;
      const secretField = PROVIDER_API_KEY_FIELD[provider];
      const secretValue = secretField ? body?.[secretField] : undefined;
      if (typeof secretValue === 'string' && secretValue.length > 0) {
        const { data: enc, error: encErr } = await admin.rpc('ai_encrypt', { plain: secretValue });
        if (encErr || !enc) {
          return NextResponse.json(
            {
              error:
                'A criptografia das chaves não está configurada. Aplique supabase_ai_keys_encryption.sql e configure a chave ai_keys_encryption_key no Vault.',
            },
            { status: 503 }
          );
        }
        newBucket[encField] = enc;
      } else if (existingBucket && typeof existingBucket[encField] === 'string') {
        // Segredo omitido/vazio => preserva o ciphertext já salvo para este provedor.
        newBucket[encField] = existingBucket[encField];
      }
    }

    ai[bucket] = newBucket;
    settings.ai = ai;

    const { error: upErr } = await admin
      .from('tenants')
      .update({ settings, updated_at: new Date().toISOString() })
      .eq('id', tenantId);
    if (upErr) {
      return serverError('ai-config PUT update error', upErr);
    }

    await recordAuditAction(admin, {
      tenantId,
      entityType: 'ai_config',
      entityId: tenantId,
      actorUserId: userId,
      actorRole: tctx.ctx.role,
      action: 'AI_CONFIG_UPDATED',
      metadata: { bucket, provider, model: modelRaw },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError('ai-config PUT exception', err, true);
  }
}