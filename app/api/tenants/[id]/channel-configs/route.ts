import { createHash, randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireTenantContext, requireRole, serverError } from '@/lib/api-auth';
import { recordAuditAction } from '@/lib/audit';
import { logger } from '@/lib/logger';
import type { ChannelConfigRow } from '@/lib/channels/registry';

const CHANNELS = ['telegram', 'whatsapp'] as const;
type Channel = (typeof CHANNELS)[number];

const CONFIG_COLUMNS =
  'id, tenant_id, channel, enabled, bot_username, bot_token_enc, webhook_secret_enc, webhook_secret_hash, webhook_url, webhook_status, webhook_last_error, zapi_instance, zapi_key_enc, zapi_client_token_enc, migrated_at';

const TELEGRAM_TIMEOUT_MS = 10000;

type AdminClient = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

interface OwnerMessagingProfile {
  zapi_instance?: string | null;
  zapi_key?: string | null;
  zapi_client_token?: string | null;
  telegram_bot_token?: string | null;
}

interface TelegramBotInfo {
  id: number;
  username?: string;
}

class EncryptionUnavailableError extends Error {}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function encryptionUnavailableResponse() {
  return NextResponse.json(
    {
      error:
        'A criptografia dos segredos não está configurada. Aplique supabase_ai_keys_encryption.sql e configure a chave ai_keys_encryption_key no Vault.',
    },
    { status: 503 }
  );
}

async function encryptSecret(admin: AdminClient, plain: string): Promise<string> {
  const { data, error } = await admin.rpc('ai_encrypt', { plain });
  if (error || !data) {
    throw new EncryptionUnavailableError(error?.message ?? 'ai_encrypt falhou');
  }
  return data as string;
}

async function decryptSecret(admin: AdminClient, cipher: string): Promise<string | null> {
  const { data, error } = await admin.rpc('ai_decrypt', { cipher });
  if (error || !data) return null;
  return data as string;
}

async function telegramApiCall<T>(
  botToken: string,
  method: string,
  body?: Record<string, unknown>
): Promise<{ ok: boolean; result?: T; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
        signal: controller.signal,
      });
      const data: unknown = await response.json().catch(() => null);
      if (response.ok && isObject(data) && data.ok === true) {
        return { ok: true, result: (data as { result: T }).result };
      }
      const description =
        isObject(data) && typeof data.description === 'string' ? data.description : `HTTP ${response.status}`;
      return { ok: false, error: description };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    return { ok: false, error: isTimeout ? 'Tempo limite na API do Telegram' : 'Erro de rede na API do Telegram' };
  }
}

function maskConfig(row: ChannelConfigRow | null, channel: Channel) {
  return {
    channel,
    enabled: row?.enabled ?? false,
    bot_username: row?.bot_username ?? null,
    webhook_status: row?.webhook_status ?? 'unregistered',
    webhook_last_error: row?.webhook_last_error ?? null,
    webhook_url: row?.webhook_url ?? null,
    zapi_instance: row?.zapi_instance ?? null,
    bot_token_set: Boolean(row?.bot_token_enc),
    webhook_secret_set: Boolean(row?.webhook_secret_enc),
    zapi_key_set: Boolean(row?.zapi_key_enc),
    zapi_client_token_set: Boolean(row?.zapi_client_token_enc),
    migrated_at: row?.migrated_at ?? null,
  };
}

/** One-shot (ADR-003): constrói a config migrada do owner; null quando não há credenciais legadas. */
async function buildMigratedConfig(
  admin: AdminClient,
  tenantId: string,
  channel: Channel,
  owner: OwnerMessagingProfile
): Promise<Record<string, unknown> | null> {
  const base: Record<string, unknown> = {
    tenant_id: tenantId,
    channel,
    enabled: true,
    migrated_at: new Date().toISOString(),
  };
  if (channel === 'telegram') {
    if (typeof owner.telegram_bot_token !== 'string' || !owner.telegram_bot_token) return null;
    return { ...base, bot_token_enc: await encryptSecret(admin, owner.telegram_bot_token) };
  }
  if (!owner.zapi_instance && !owner.zapi_key) return null;
  const row: Record<string, unknown> = { ...base };
  if (owner.zapi_instance) row.zapi_instance = owner.zapi_instance;
  if (owner.zapi_key) row.zapi_key_enc = await encryptSecret(admin, owner.zapi_key);
  if (owner.zapi_client_token) row.zapi_client_token_enc = await encryptSecret(admin, owner.zapi_client_token);
  return row;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const search = new URL(req.url).searchParams;
    const requestedTenantId = search.get('tenant_id') ?? id;

    // Membros podem LER a config do tenant; PUT/DELETE exigem admin.
    const tctx = await requireTenantContext(req, requestedTenantId);
    if ('response' in tctx) return tctx.response;
    const { tenantId } = tctx.ctx;

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: 'Configuração de canais indisponível em modo demo.' },
        { status: 503 }
      );
    }

    const { data: tenant, error: tenantErr } = await admin
      .from('tenants')
      .select('owner_user_id')
      .eq('id', tenantId)
      .maybeSingle();
    if (tenantErr || !tenant) {
      return NextResponse.json(
        { error: 'Tenant não encontrado.', code: 'TENANT_NOT_FOUND' },
        { status: 404 }
      );
    }

    const { data: rowsData, error: rowsErr } = await admin
      .from('channel_configs')
      .select(CONFIG_COLUMNS)
      .eq('tenant_id', tenantId);
    if (rowsErr) return serverError('channel-configs GET query error', rowsErr);
    let configs = ((rowsData as ChannelConfigRow[]) ?? []).filter(Boolean);

    // Migração one-shot (padrão ai-config): canais sem config herdam as
    // credenciais de mensageria do owner, re-cifradas com ai_encrypt.
    const missing = CHANNELS.filter((ch) => !configs.some((r) => r.channel === ch));
    const needsStamp = configs.some((r) => !r.migrated_at);

    if (missing.length > 0 && tenant.owner_user_id) {
      const { data: ownerRows } = await admin.rpc('get_user_ai_keys', {
        p_user_id: tenant.owner_user_id as string,
      });
      const owner =
        Array.isArray(ownerRows) && ownerRows[0] ? (ownerRows[0] as OwnerMessagingProfile) : null;
      if (owner) {
        for (const channel of missing) {
          const migrated = await buildMigratedConfig(admin, tenantId, channel, owner);
          if (!migrated) continue;
          // 23505 = GET concorrente já migrou (idempotência via UNIQUE tenant_id+channel).
          const { error: insertErr } = await admin.from('channel_configs').insert(migrated);
          if (insertErr && insertErr.code !== '23505') {
            return serverError('channel-configs GET migration error', insertErr);
          }
        }
      }
    }

    if (missing.length > 0 || needsStamp) {
      // Carimba migrated_at em linhas existentes sem stamp (ex.: PUT antes do
      // primeiro GET) — UPDATE condicional, padrão ai-config.
      if (needsStamp) {
        const { error: stampErr } = await admin
          .from('channel_configs')
          .update({ migrated_at: new Date().toISOString() })
          .eq('tenant_id', tenantId)
          .is('migrated_at', null);
        if (stampErr) return serverError('channel-configs GET stamp error', stampErr);
      }
      const { data: refetch, error: refetchErr } = await admin
        .from('channel_configs')
        .select(CONFIG_COLUMNS)
        .eq('tenant_id', tenantId);
      if (refetchErr) return serverError('channel-configs GET refetch error', refetchErr);
      configs = ((refetch as ChannelConfigRow[]) ?? []).filter(Boolean);
    }

    const response: Record<string, unknown> = {};
    for (const channel of CHANNELS) {
      response[channel] = maskConfig(
        configs.find((r) => r.channel === channel) ?? null,
        channel
      );
    }
    return NextResponse.json(response);
  } catch (err) {
    if (err instanceof EncryptionUnavailableError) return encryptionUnavailableResponse();
    return serverError('channel-configs GET exception', err, true);
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

    const rctx = await requireRole(req, 'admin', requestedTenantId);
    if ('response' in rctx) return rctx.response;
    const { tenantId, userId, role } = rctx.ctx;

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: 'Configuração de canais indisponível em modo demo.' },
        { status: 503 }
      );
    }

    const body: unknown = await req.json().catch(() => null);
    if (!isObject(body)) {
      return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 });
    }
    const channelRaw = body.channel;
    if (typeof channelRaw !== 'string' || !CHANNELS.includes(channelRaw as Channel)) {
      return NextResponse.json({ error: 'Canal inválido.' }, { status: 400 });
    }
    const channel = channelRaw as Channel;

    const { data: existingData, error: existingErr } = await admin
      .from('channel_configs')
      .select(CONFIG_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('channel', channel)
      .maybeSingle();
    if (existingErr) return serverError('channel-configs PUT lookup error', existingErr);
    const existing = (existingData as ChannelConfigRow | null) ?? null;

    let enabled: boolean;
    if (body.enabled === undefined || body.enabled === null) {
      enabled = existing?.enabled ?? true;
    } else if (typeof body.enabled === 'boolean') {
      enabled = body.enabled;
    } else {
      return NextResponse.json({ error: 'enabled deve ser um booleano.' }, { status: 400 });
    }

    const update: Record<string, unknown> = {
      enabled,
      updated_at: new Date().toISOString(),
    };

    if (channel === 'telegram') {
      const appUrl = (process.env.APP_URL || '').replace(/\/+$/, '');
      if (enabled && !appUrl) {
        return NextResponse.json(
          {
            error:
              'Configure a variável de ambiente APP_URL (URL pública do app, ex.: https://seu-app.com) antes de registrar o webhook do Telegram.',
          },
          { status: 400 }
        );
      }

      let botTokenPlain: string | null = null;
      const newBotToken = typeof body.bot_token === 'string' ? body.bot_token.trim() : '';
      if (newBotToken) {
        const me = await telegramApiCall<TelegramBotInfo>(newBotToken, 'getMe');
        if (!me.ok || !me.result?.username) {
          return NextResponse.json({ error: 'Token do bot Telegram inválido.' }, { status: 400 });
        }
        botTokenPlain = newBotToken;
        update.bot_username = me.result.username;
        update.bot_token_enc = await encryptSecret(admin, newBotToken);
      } else if (existing?.bot_token_enc) {
        // Segredo ausente preserva o ciphertext (padrão ai-config); decripta
        // apenas para re-registrar o webhook.
        botTokenPlain = await decryptSecret(admin, existing.bot_token_enc);
        if (enabled && !botTokenPlain) return encryptionUnavailableResponse();
      } else if (enabled) {
        return NextResponse.json(
          { error: 'Token do bot é obrigatório para habilitar o canal Telegram.' },
          { status: 400 }
        );
      }

      let webhookSecretPlain: string | null = null;
      if (!existing?.webhook_secret_enc) {
        // ADR-005: secret aleatório (charset A-Za-z0-9_-, 43 chars base64url).
        webhookSecretPlain = randomBytes(32).toString('base64url');
        update.webhook_secret_enc = await encryptSecret(admin, webhookSecretPlain);
        update.webhook_secret_hash = createHash('sha256').update(webhookSecretPlain).digest('hex');
      }

      if (enabled && botTokenPlain) {
        if (!webhookSecretPlain && existing?.webhook_secret_enc) {
          webhookSecretPlain = await decryptSecret(admin, existing.webhook_secret_enc);
        }
        if (!webhookSecretPlain) return encryptionUnavailableResponse();

        const webhookUrl = `${appUrl}/api/webhook/telegram`;
        const firstRegistration = !existing || !existing.webhook_secret_enc;
        const setWebhook = await telegramApiCall(botTokenPlain, 'setWebhook', {
          url: webhookUrl,
          secret_token: webhookSecretPlain,
          drop_pending_updates: firstRegistration,
        });
        update.webhook_url = webhookUrl;
        if (setWebhook.ok) {
          update.webhook_status = 'active';
          update.webhook_last_error = null;
        } else {
          update.webhook_status = 'error';
          update.webhook_last_error = setWebhook.error ?? 'Falha desconhecida ao registrar o webhook';
          logger.error(
            'Falha no setWebhook do Telegram',
            { tenantId },
            { channel, error: update.webhook_last_error }
          );
        }
      }
    } else {
      const zapiInstance = typeof body.zapi_instance === 'string' ? body.zapi_instance.trim() : '';
      if (zapiInstance) update.zapi_instance = zapiInstance;
      const zapiKey = typeof body.zapi_key === 'string' ? body.zapi_key.trim() : '';
      if (zapiKey) update.zapi_key_enc = await encryptSecret(admin, zapiKey);
      const zapiClientToken =
        typeof body.zapi_client_token === 'string' ? body.zapi_client_token.trim() : '';
      if (zapiClientToken) {
        update.zapi_client_token_enc = await encryptSecret(admin, zapiClientToken);
      }
    }

    let savedRow: ChannelConfigRow;
    if (existing) {
      const { data: updated, error: upErr } = await admin
        .from('channel_configs')
        .update(update)
        .eq('id', existing.id)
        .eq('tenant_id', tenantId)
        .select(CONFIG_COLUMNS)
        .single();
      if (upErr || !updated) return serverError('channel-configs PUT update error', upErr);
      savedRow = updated as ChannelConfigRow;
    } else {
      const { data: inserted, error: insErr } = await admin
        .from('channel_configs')
        .insert({ ...update, tenant_id: tenantId, channel })
        .select(CONFIG_COLUMNS)
        .single();
      if (insErr || !inserted) return serverError('channel-configs PUT insert error', insErr);
      savedRow = inserted as ChannelConfigRow;
    }

    await recordAuditAction(admin, {
      tenantId,
      entityType: 'channel_config',
      entityId: savedRow.id,
      actorUserId: userId,
      actorRole: role,
      action: 'CHANNEL_CONFIG_UPDATED',
      metadata: { channel, enabled, webhook_status: savedRow.webhook_status },
    });

    const response: Record<string, unknown> = { ok: true, config: maskConfig(savedRow, channel) };
    if (savedRow.webhook_status === 'error' && savedRow.webhook_last_error) {
      response.warning = `Configuração salva, mas o registro do webhook falhou: ${savedRow.webhook_last_error}. Salve novamente para tentar re-registrar.`;
    }
    return NextResponse.json(response);
  } catch (err) {
    if (err instanceof EncryptionUnavailableError) return encryptionUnavailableResponse();
    return serverError('channel-configs PUT exception', err, true);
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const search = new URL(req.url).searchParams;
    const requestedTenantId = search.get('tenant_id') ?? id;
    const channelRaw = search.get('channel');

    const rctx = await requireRole(req, 'admin', requestedTenantId);
    if ('response' in rctx) return rctx.response;
    const { tenantId, userId, role } = rctx.ctx;

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: 'Configuração de canais indisponível em modo demo.' },
        { status: 503 }
      );
    }

    if (typeof channelRaw !== 'string' || !CHANNELS.includes(channelRaw as Channel)) {
      return NextResponse.json(
        { error: 'Canal inválido. Use ?channel=whatsapp ou ?channel=telegram.' },
        { status: 400 }
      );
    }
    const channel = channelRaw as Channel;

    const { data: existingData, error: existingErr } = await admin
      .from('channel_configs')
      .select(CONFIG_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('channel', channel)
      .maybeSingle();
    if (existingErr) return serverError('channel-configs DELETE lookup error', existingErr);
    const existing = (existingData as ChannelConfigRow | null) ?? null;
    if (!existing) {
      return NextResponse.json(
        { error: 'Configuração não encontrada para este canal.' },
        { status: 404 }
      );
    }

    // Telegram: remove o webhook registrado antes de zerar os segredos.
    let webhookDeleted = false;
    if (channel === 'telegram' && existing.bot_token_enc) {
      const botToken = await decryptSecret(admin, existing.bot_token_enc);
      if (botToken) {
        const del = await telegramApiCall(botToken, 'deleteWebhook');
        webhookDeleted = del.ok;
        if (!del.ok) {
          logger.warn(
            'Falha no deleteWebhook do Telegram',
            { tenantId },
            { channel, error: del.error }
          );
        }
      }
    }

    const { error: upErr } = await admin
      .from('channel_configs')
      .update({
        enabled: false,
        bot_username: null,
        bot_token_enc: null,
        webhook_secret_enc: null,
        webhook_secret_hash: null,
        webhook_url: null,
        webhook_status: 'unregistered',
        webhook_last_error: null,
        zapi_instance: null,
        zapi_key_enc: null,
        zapi_client_token_enc: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .eq('tenant_id', tenantId);
    if (upErr) return serverError('channel-configs DELETE update error', upErr);

    await recordAuditAction(admin, {
      tenantId,
      entityType: 'channel_config',
      entityId: existing.id,
      actorUserId: userId,
      actorRole: role,
      action: 'CHANNEL_CONFIG_DELETED',
      metadata: { channel, webhook_deleted: webhookDeleted },
    });

    return NextResponse.json({ ok: true, webhook_deleted: webhookDeleted });
  } catch (err) {
    return serverError('channel-configs DELETE exception', err, true);
  }
}
