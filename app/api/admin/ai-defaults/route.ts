import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireSuperAdmin, serverError } from '@/lib/api-auth';
import { auditAdminAction } from '@/lib/audit';
import {
  AIProvider,
  MODEL_WHITELISTS,
  PROVIDER_API_KEY_FIELD,
  SUPPORTED_PROVIDERS,
  VISION_CAPABLE,
} from '@/lib/ai-config';

const SYSTEM_BUCKETS = ['assistant', 'pdf_extraction'] as const;
type SystemBucket = (typeof SYSTEM_BUCKETS)[number];
const SECRET_PROVIDERS: AIProvider[] = ['opencode', 'gemini', 'openai', 'anthropic', 'openrouter', 'groq'];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isModelAllowed(provider: AIProvider, model: string, bucket: SystemBucket): boolean {
  if (provider === 'openrouter' || provider === 'ollama') return model.length > 0;
  const whitelist = MODEL_WHITELISTS[provider];
  if (whitelist.includes(model)) return true;
  if (provider === 'opencode' && bucket === 'pdf_extraction' && model === 'minimax-m3') return true;
  return false;
}

function maskRow(row: Record<string, unknown> | null) {
  const out: Record<string, unknown> = {};
  if (!row) return out;
  if (typeof row.provider === 'string') out.provider = row.provider;
  if (typeof row.model === 'string') out.model = row.model;
  if (typeof row.ollama_base_url === 'string') out.ollama_base_url = row.ollama_base_url;
  for (const p of SECRET_PROVIDERS) {
    const col = `${p}_api_key`;
    out[`${p}_api_key_set`] = typeof row[col] === 'string' && (row[col] as string).length > 0;
  }
  return out;
}

export async function GET(req: NextRequest) {
  try {
    const r = await requireSuperAdmin(req);
    if ('response' in r) return r.response;

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Supabase admin não configurado.' }, { status: 500 });
    }

    const { data: rows, error } = await admin
      .from('system_ai_defaults')
      .select('*');

    if (error) {
      return serverError('admin/ai-defaults GET error', error);
    }

    const byBucket = new Map<string, Record<string, unknown>>();
    for (const row of rows ?? []) {
      if (isObject(row) && typeof row.bucket === 'string') byBucket.set(row.bucket, row);
    }

    return NextResponse.json({
      assistant: maskRow(byBucket.get('assistant') ?? null),
      pdf_extraction: maskRow(byBucket.get('pdf_extraction') ?? null),
    });
  } catch (err) {
    return serverError('admin/ai-defaults GET exception', err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const r = await requireSuperAdmin(req);
    if ('response' in r) return r.response;
    const { userId } = r.ctx;

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Supabase admin não configurado.' }, { status: 500 });
    }

    const body = await req.json();
    const bucketRaw = body?.bucket;
    const providerRaw = body?.provider;
    const modelRaw = typeof body?.model === 'string' ? body.model.trim() : '';

    if (typeof bucketRaw !== 'string' || !SYSTEM_BUCKETS.includes(bucketRaw as SystemBucket)) {
      return NextResponse.json({ error: 'Bucket inválido.' }, { status: 400 });
    }
    const bucket = bucketRaw as SystemBucket;

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
        ? (typeof body.ollama_base_url === 'string' && body.ollama_base_url.trim()) ||
          'http://localhost:11434'
        : typeof body.ollama_base_url === 'string' && body.ollama_base_url.trim()
          ? body.ollama_base_url.trim()
          : undefined;

    const { data: existing, error: existingErr } = await admin
      .from('system_ai_defaults')
      .select('*')
      .eq('bucket', bucket)
      .maybeSingle();
    if (existingErr) {
      return serverError('admin/ai-defaults PUT read error', existingErr);
    }
    const prev = isObject(existing) ? existing : null;

    const newRow: Record<string, unknown> = {
      bucket,
      provider,
      model: modelRaw,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    if (ollamaBaseUrl !== undefined) {
      newRow.ollama_base_url = ollamaBaseUrl;
    } else if (prev && typeof prev.ollama_base_url === 'string') {
      newRow.ollama_base_url = prev.ollama_base_url;
    } else if (provider === 'ollama') {
      newRow.ollama_base_url = 'http://localhost:11434';
    } else {
      newRow.ollama_base_url = 'http://localhost:11434';
    }

    for (const p of SECRET_PROVIDERS) {
      const col = `${p}_api_key`;
      if (p === provider) {
        const secretField = PROVIDER_API_KEY_FIELD[p];
        const v = secretField ? body?.[secretField] : undefined;
        if (typeof v === 'string' && v.length > 0) {
          const { data: enc, error: encErr } = await admin.rpc('ai_encrypt', { plain: v });
          if (encErr || !enc) {
            return NextResponse.json(
              {
                error:
                  'A criptografia das chaves não está configurada. Aplique supabase_ai_keys_encryption.sql e configure a chave ai_keys_encryption_key no Vault.',
              },
              { status: 503 }
            );
          }
          newRow[col] = enc;
        } else if (prev && typeof prev[col] === 'string') {
          newRow[col] = prev[col]; // preserva segredo já salvo
        }
      } else if (prev && typeof prev[col] === 'string') {
        // Preserva segredos de outros provedores no mesmo bucket (não expostos).
        newRow[col] = prev[col];
      }
    }

    const { error: upErr } = await admin
      .from('system_ai_defaults')
      .upsert(newRow, { onConflict: 'bucket' });
    if (upErr) {
      return serverError('admin/ai-defaults PUT upsert error', upErr);
    }

    await auditAdminAction({
      actorUserId: userId,
      action: 'AI_SYSTEM_DEFAULTS_UPDATED',
      entityType: 'ai_config',
      // entityId omitido de propósito: bucket ('assistant'/'pdf_extraction') não é UUID
      // e audit_logs.entity_id é uuid — o bucket já consta em metadata.
      metadata: { bucket, provider, model: modelRaw },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError('admin/ai-defaults PUT exception', err);
  }
}