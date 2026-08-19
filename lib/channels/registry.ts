import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../logger';
import type { CommunicationChannel } from './channel';
import { telegramChannel } from './telegram-channel';
import type { ChannelContext, ChannelId, ChannelCredentials } from './types';
import { whatsappChannel } from './whatsapp-channel';

export interface ChannelConfigRow {
  id: string;
  tenant_id: string;
  channel: ChannelId;
  enabled: boolean;
  bot_username: string | null;
  bot_token_enc: string | null;
  webhook_secret_enc: string | null;
  webhook_secret_hash: string | null;
  webhook_url: string | null;
  webhook_status: string;
  webhook_last_error: string | null;
  zapi_instance: string | null;
  zapi_key_enc: string | null;
  zapi_client_token_enc: string | null;
  /** Opcional: não faz parte do CONFIG_COLUMNS de resolução do registry. */
  migrated_at?: string | null;
}

export interface ResolvedChannel {
  channel: CommunicationChannel;
  ctx: ChannelContext;
}

const CONFIG_COLUMNS =
  'id, tenant_id, channel, enabled, bot_username, bot_token_enc, webhook_secret_enc, webhook_secret_hash, webhook_url, webhook_status, webhook_last_error, zapi_instance, zapi_key_enc, zapi_client_token_enc';

const ADAPTERS: Record<ChannelId, CommunicationChannel> = {
  whatsapp: whatsappChannel,
  telegram: telegramChannel,
};

/** Cache de resolução em escopo de request (Map criado pelo caller) — nunca global entre requests. */
export type ChannelCache = Map<string, ResolvedChannel | null>;

async function decryptSecret(database: SupabaseClient, cipher: string): Promise<string | null> {
  const { data, error } = await database.rpc('ai_decrypt', { cipher });
  if (error) {
    logger.error('Falha ao decriptar segredo de canal (infra de cifragem aplicada?)', undefined, { error: error.message });
    return null;
  }
  return typeof data === 'string' && data.length > 0 ? data : null;
}

async function buildContextFromConfig(
  database: SupabaseClient,
  tenantId: string,
  channel: ChannelId,
  config: ChannelConfigRow
): Promise<ChannelContext | null> {
  if (channel === 'telegram') {
    if (!config.bot_token_enc) {
      logger.warn('Config de canal telegram sem token cifrado', { tenantId });
      return null;
    }
    const botToken = await decryptSecret(database, config.bot_token_enc);
    if (!botToken) return null;
    return { tenantId, enabled: true, credentials: { botToken } };
  }

  const zapiInstanceId = config.zapi_instance;
  if (!zapiInstanceId || !config.zapi_key_enc) {
    logger.warn('Config de canal whatsapp incompleta', { tenantId });
    return null;
  }
  const zapiKey = await decryptSecret(database, config.zapi_key_enc);
  if (!zapiKey) return null;
  const zapiClientToken = config.zapi_client_token_enc
    ? await decryptSecret(database, config.zapi_client_token_enc)
    : null;
  return {
    tenantId,
    enabled: true,
    credentials: {
      zapiInstanceId,
      zapiKey,
      ...(zapiClientToken ? { zapiClientToken } : {}),
    },
  };
}

/** Fallback demo: env vars globais quando o tenant não tem channel_configs. */
function buildDemoContext(tenantId: string, channel: ChannelId): ChannelContext | null {
  if (channel === 'telegram') {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return null;
    return { tenantId, enabled: true, credentials: { botToken } };
  }
  const zapiInstanceId = process.env.ZAPI_INSTANCE_ID;
  const zapiKey = process.env.ZAPI_TOKEN;
  if (!zapiInstanceId || !zapiKey) return null;
  const zapiClientToken = process.env.ZAPI_CLIENT_TOKEN;
  const credentials: ChannelCredentials = zapiClientToken
    ? { zapiInstanceId, zapiKey, zapiClientToken }
    : { zapiInstanceId, zapiKey };
  return { tenantId, enabled: true, credentials };
}

async function resolveChannel(
  database: SupabaseClient,
  tenantId: string,
  channel: ChannelId
): Promise<ResolvedChannel | null> {
  const { data: config, error } = await database
    .from('channel_configs')
    .select(CONFIG_COLUMNS)
    .eq('tenant_id', tenantId)
    .eq('channel', channel)
    .maybeSingle();

  if (error) {
    logger.error('Falha ao carregar config de canal', { tenantId }, { error: error.message, channel });
    return null;
  }

  if (config) {
    const row = config as ChannelConfigRow;
    if (!row.enabled) return null;
    const ctx = await buildContextFromConfig(database, tenantId, channel, row);
    return ctx ? { channel: ADAPTERS[channel], ctx } : null;
  }

  const ctx = buildDemoContext(tenantId, channel);
  return ctx ? { channel: ADAPTERS[channel], ctx } : null;
}

/**
 * Resolve o adapter + contexto de credenciais de um canal para um tenant.
 * Retorna null quando o canal não está configurado/habilitado.
 */
export async function getChannel(
  database: SupabaseClient,
  tenantId: string,
  channel: ChannelId,
  cache?: ChannelCache
): Promise<ResolvedChannel | null> {
  const cacheKey = `${tenantId}:${channel}`;
  if (cache?.has(cacheKey)) {
    return cache.get(cacheKey) ?? null;
  }
  const resolved = await resolveChannel(database, tenantId, channel);
  cache?.set(cacheKey, resolved);
  return resolved;
}

/**
 * Lookup do webhook por secret_token (ADR-005): hash SHA-256 calculado em Node,
 * uma consulta autentica a origem, resolve o tenant e o canal habilitado.
 */
export async function resolveChannelByWebhookSecret(
  database: SupabaseClient,
  secret: string
): Promise<{ tenantId: string; channel: ChannelId; config: ChannelConfigRow } | null> {
  const secretHash = createHash('sha256').update(secret).digest('hex');
  const { data, error } = await database
    .from('channel_configs')
    .select(CONFIG_COLUMNS)
    .eq('webhook_secret_hash', secretHash)
    .eq('enabled', true)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      logger.error('Falha no lookup de webhook por secret', undefined, { error: error.message });
    }
    return null;
  }

  const config = data as ChannelConfigRow;
  return { tenantId: config.tenant_id, channel: config.channel, config };
}
