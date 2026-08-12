// Resolvedor central de configuração de IA por tenant (ticket 1804).
//
// Cadeia de resolução (ADR-003):
//   assistant      : tenant.ai.assistant        → system.assistant        → hardcoded
//   pdf_extraction : tenant.ai.pdf_extraction   → system.pdf_extraction   → hardcoded
//   agents         : agentModelOverride (model) → tenant.ai.agents
//                    → tenant.ai.assistant      → system.assistant        → hardcoded
//
// `source='tenant'`  : provedor E chave vieram de um bucket do tenant.
// `source='system'`  : vieram de uma linha de `system_ai_defaults`.
// `source='hardcoded'`: fallback final (opencode + OPENCODE_API_KEY).
//
// Consultado uma vez por request e reutilizado pelos call sites. Recebe o
// client admin (service role) para manter a descriptografia dos segredos
// server-side only (RPCs get_tenant_ai_keys / get_system_ai_keys).

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

export type AIBucket = 'assistant' | 'pdf_extraction' | 'agents';
export type AIProvider = 'opencode' | 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'ollama';

export interface AIResolved {
  provider: AIProvider;
  model: string;
  apiKey: string;
  ollamaBaseUrl: string;
  source: 'tenant' | 'system' | 'hardcoded';
}

// Whitelists de modelos por provedor (consolida DEFAULT_MODELS/VALID_MODELS
// que viviam em app/api/help-chat/route.ts). Usadas pelas rotas/UI.
export const DEFAULT_MODELS: Record<AIProvider, string> = {
  opencode: 'deepseek-v4-flash',
  gemini: 'gemini-3.5-flash',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-haiku',
  openrouter: 'meta-llama/llama-3-8b-instruct:free',
  ollama: 'llama3',
};

export const MODEL_WHITELISTS: Record<AIProvider, string[]> = {
  opencode: ['deepseek-v4-pro', 'deepseek-v4-flash'],
  gemini: ['gemini-3.5-flash', 'gemini-3.1-pro'],
  openai: ['gpt-4o', 'gpt-4o-mini'],
  anthropic: ['claude-3-5-sonnet', 'claude-3-haiku'],
  openrouter: ['meta-llama/llama-3-8b-instruct:free'],
  ollama: ['llama3'],
};

export const SUPPORTED_PROVIDERS: AIProvider[] = [
  'opencode',
  'gemini',
  'openai',
  'anthropic',
  'openrouter',
  'ollama',
];

// Provedores capazes de visão de documento (ADR-005). `pdf_extraction` só
// aceita estes; validado no write (tasks 03/04) e espelhado no runtime guard.
export const VISION_CAPABLE: Record<AIProvider, boolean> = {
  opencode: true,
  anthropic: true,
  openai: true,
  gemini: true,
  openrouter: false,
  ollama: false,
};

// Mapa provedor → campo de segredo no corpo da requisição (UI/API) e no
// JSONB do tenant (`<provider>_api_key_enc`). Reutilizado pelas rotas de write.
export const PROVIDER_API_KEY_FIELD: Record<AIProvider, string> = {
  opencode: 'opencode_api_key',
  gemini: 'gemini_api_key',
  openai: 'openai_api_key',
  anthropic: 'anthropic_api_key',
  openrouter: 'openrouter_api_key',
  ollama: 'ollama_api_key',
};

const ENV_KEY_FIELDS: Record<AIProvider, string | undefined> = {
  opencode: 'OPENCODE_API_KEY',
  gemini: 'GEMINI_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  ollama: undefined,
};

// Modelo vision-capable do gateway OpenCode reservado ao bucket pdf_extraction.
// Não integra a whitelist de chat por decisão de produto (o editor o expõe via
// PDF_OPENCODE_EXTRA_MODEL em lib/ai-config-client.ts). Os validadores de escrita
// (app/api/tenants/[id]/ai-config e app/api/admin/ai-defaults) aceitam essa
// exceção — o resolver PRECISA espelhá-la, senão troca silenciosamente o modelo
// por deepseek-v4-flash (texto puro) e a extração de PDF retorna tudo null.
const PDF_OPENCODE_VISION_MODEL = 'minimax-m3';

const HARDCODED_MODEL_BY_BUCKET: Record<AIBucket, string> = {
  assistant: 'deepseek-v4-flash',
  pdf_extraction: PDF_OPENCODE_VISION_MODEL,
  agents: 'deepseek-v4-flash',
};

interface AIRow {
  bucket: string;
  provider: string | null;
  model: string | null;
  opencode_api_key: string | null;
  gemini_api_key: string | null;
  openai_api_key: string | null;
  anthropic_api_key: string | null;
  openrouter_api_key: string | null;
  ollama_base_url: string | null;
}

function isProvider(v: string | null | undefined): v is AIProvider {
  return !!v && (SUPPORTED_PROVIDERS as string[]).includes(v);
}

function isValidModelFor(
  provider: AIProvider,
  model: string | null | undefined,
  bucket: AIBucket
): string {
  if (model && (MODEL_WHITELISTS[provider] as string[]).includes(model)) return model;
  // Exceção espelhada dos validadores de escrita: pdf_extraction via OpenCode
  // aceita o modelo vision-capable reservado, e o default do bucket nunca pode
  // degradar para um modelo texto-puro (deepseek-v4-flash não lê PDF/imagem).
  if (provider === 'opencode' && bucket === 'pdf_extraction') {
    return model === PDF_OPENCODE_VISION_MODEL ? model : PDF_OPENCODE_VISION_MODEL;
  }
  return DEFAULT_MODELS[provider];
}

function pickFromRow(
  row: AIRow,
  bucket: AIBucket
): { provider: AIProvider; model: string; apiKey: string; ollamaBaseUrl: string } | null {
  const provider = isProvider(row.provider) ? row.provider : null;
  if (!provider) return null;
  const ollamaBaseUrl = row.ollama_base_url || 'http://localhost:11434';
  if (provider === 'ollama') {
    return {
      provider,
      model: isValidModelFor(provider, row.model, bucket),
      apiKey: 'ollama-no-key',
      ollamaBaseUrl,
    };
  }
  const keyField = PROVIDER_API_KEY_FIELD[provider] as keyof AIRow;
  const bucketKey = (row[keyField] as string | null | undefined) || '';
  // Preserva o comportamento pré-migration: se o bucket declarou o provedor
  // mas não há segredo salvo, cai na env-var do provedor antes de desistir
  // do step (evita troca silenciosa de provedor em tenants que dependiam de
  // env). Só avança para o próximo step quando provedor E chave estão ambos
  // ausentes neste nível.
  const envName = ENV_KEY_FIELDS[provider];
  const envKey = envName ? process.env[envName] || '' : '';
  const apiKey = bucketKey || envKey;
  if (!apiKey) return null;
  return {
    provider,
    model: isValidModelFor(provider, row.model, bucket),
    apiKey,
    ollamaBaseUrl,
  };
}

function hardcodedFallback(bucket: AIBucket, agentModelOverride?: string): AIResolved {
  const override = bucket === 'agents' && agentModelOverride ? agentModelOverride : null;
  return {
    provider: 'opencode',
    model: override ?? HARDCODED_MODEL_BY_BUCKET[bucket],
    apiKey: process.env.OPENCODE_API_KEY ?? '',
    ollamaBaseUrl: 'http://localhost:11434',
    source: 'hardcoded',
  };
}

function logResolved(tenantId: string, bucket: AIBucket, resolved: AIResolved) {
  logger.info(
    '[ai-config] resolved',
    { tenantId, bucket },
    { provider: resolved.provider, model: resolved.model, source: resolved.source }
  );
}

export async function resolveAIConfig(opts: {
  client: SupabaseClient | null;
  tenantId: string;
  bucket: AIBucket;
  agentModelOverride?: string;
}): Promise<AIResolved> {
  const { client, tenantId, bucket, agentModelOverride } = opts;

  // Demo mode / env ausente: sem client admin nem server, cai direto no
  // fallback hardcoded (opencode + OPENCODE_API_KEY) preservando o
  // comportamento pré-migration.
  if (!client) {
    const fallback = hardcodedFallback(bucket, agentModelOverride);
    logResolved(tenantId, bucket, fallback);
    return fallback;
  }

  const tenantRowMap = new Map<string, AIRow>();
  const systemRowMap = new Map<string, AIRow>();

  const { data: tenantRows, error: tErr } = await client.rpc('get_tenant_ai_keys', {
    p_tenant_id: tenantId,
  });
  if (tErr) {
    logger.warn('[ai-config] get_tenant_ai_keys failed', { tenantId }, { error: tErr.message });
  } else if (Array.isArray(tenantRows)) {
    for (const r of tenantRows as AIRow[]) {
      if (r && r.bucket) tenantRowMap.set(r.bucket, r);
    }
  }

  const { data: systemRows, error: sErr } = await client.rpc('get_system_ai_keys');
  if (sErr) {
    logger.warn('[ai-config] get_system_ai_keys failed', undefined, { error: sErr.message });
  } else if (Array.isArray(systemRows)) {
    for (const r of systemRows as AIRow[]) {
      if (r && r.bucket) systemRowMap.set(r.bucket, r);
    }
  }

  const useOverride = bucket === 'agents' && !!agentModelOverride;

  const chain: Array<{ row: AIRow | undefined; source: 'tenant' | 'system' }> =
    bucket === 'agents'
      ? [
          { row: tenantRowMap.get('agents'), source: 'tenant' },
          { row: tenantRowMap.get('assistant'), source: 'tenant' },
          { row: systemRowMap.get('assistant'), source: 'system' },
        ]
      : [
          { row: tenantRowMap.get(bucket), source: 'tenant' },
          { row: systemRowMap.get(bucket), source: 'system' },
        ];

  for (const step of chain) {
    if (!step.row) continue;
    const picked = pickFromRow(step.row, bucket);
    if (!picked) continue;
    const resolved: AIResolved = {
      provider: picked.provider,
      model: useOverride ? (agentModelOverride as string) : picked.model,
      apiKey: picked.apiKey,
      ollamaBaseUrl: picked.ollamaBaseUrl,
      source: step.source,
    };
    logResolved(tenantId, bucket, resolved);
    return resolved;
  }

  const fallback = hardcodedFallback(bucket, agentModelOverride);
  logResolved(tenantId, bucket, fallback);
  return fallback;
}

// Helper exposto para consulta das env-vars de provedor (consolidadas aqui
// pelo task_05). O resolvedor usa OPENCODE_API_KEY no nível hardcoded final
// e, dentro de cada step, a env-var do provedor escolhido quando o bucket
// não trouxer segredo — mantendo compatibilidade com tenants que dependiam
// de env antes da migração. Rotas/UI não devem ler process.env diretamente.
export function envKeyFor(provider: AIProvider): string | undefined {
  return ENV_KEY_FIELDS[provider];
}