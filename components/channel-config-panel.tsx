'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, MessageSquare, Send, X } from 'lucide-react';
import { useActiveTenant } from '@/hooks/use-active-tenant';
import { fetchWithAuth } from '@/lib/api';

type ChannelName = 'telegram' | 'whatsapp';

interface ChannelConfig {
  channel: string;
  enabled: boolean;
  bot_username: string | null;
  webhook_status: string;
  webhook_last_error: string | null;
  webhook_url: string | null;
  zapi_instance: string | null;
  bot_token_set: boolean;
  webhook_secret_set: boolean;
  zapi_key_set: boolean;
  zapi_client_token_set: boolean;
  migrated_at: string | null;
}

type ChannelConfigs = Record<'telegram' | 'whatsapp', ChannelConfig>;

interface Feedback {
  type: 'success' | 'warning' | 'error';
  message: string;
}

/** Janela para considerar a migração one-shot como "recente" (banner informativo). */
const MIGRATION_BANNER_WINDOW_MS = 5 * 60 * 1000;

const INPUT_CLASS =
  'w-full bg-[#0e1014] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors';

function WebhookStatusBadge({ config }: { config: ChannelConfig }) {
  if (config.webhook_status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Webhook ativo
      </span>
    );
  }
  if (config.webhook_status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-400">
        <AlertTriangle className="h-3.5 w-3.5" />
        Webhook com erro
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-400">
      <AlertTriangle className="h-3.5 w-3.5" />
      Webhook não registrado
    </span>
  );
}

function EnabledToggle({
  channel,
  enabled,
  disabled,
  onToggle,
}: {
  channel: ChannelName;
  enabled: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <span className="flex items-center gap-2">
      <span className={`text-xs font-medium ${enabled ? 'text-emerald-400' : 'text-slate-500'}`}>
        {enabled ? 'Habilitado' : 'Desabilitado'}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`${enabled ? 'Desabilitar' : 'Habilitar'} canal ${channel}`}
        data-testid={`channel-toggle-${channel}`}
        onClick={onToggle}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
          enabled ? 'bg-emerald-500' : 'bg-slate-700'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </span>
  );
}

function FeedbackMessage({ channel, feedback }: { channel: ChannelName; feedback?: Feedback }) {
  if (!feedback) return null;
  const color =
    feedback.type === 'success'
      ? 'text-emerald-400'
      : feedback.type === 'warning'
        ? 'text-amber-400'
        : 'text-red-400';
  return (
    <p
      role={feedback.type === 'error' ? 'alert' : 'status'}
      data-testid={`channel-feedback-${channel}`}
      className={`text-xs font-medium ${color}`}
    >
      {feedback.message}
    </p>
  );
}

export function ChannelConfigPanel() {
  const { tenantId, tenantQuery, isAdmin } = useActiveTenant();
  const [configs, setConfigs] = useState<ChannelConfigs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMigrationBanner, setShowMigrationBanner] = useState(false);

  // Segredos: inputs vazios que só são enviados quando preenchidos.
  const [telegramToken, setTelegramToken] = useState('');
  const [zapiInstance, setZapiInstance] = useState('');
  const [zapiKey, setZapiKey] = useState('');
  const [zapiClientToken, setZapiClientToken] = useState('');

  const [savingChannel, setSavingChannel] = useState<ChannelName | null>(null);
  const [feedback, setFeedback] = useState<Partial<Record<ChannelName, Feedback>>>({});

  const loadConfigs = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/tenants/${tenantId}/channel-configs?${tenantQuery}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Falha ao carregar a configuração de canais.');
      }
      const json = (await res.json()) as ChannelConfigs;
      setConfigs(json);
      setZapiInstance(json.whatsapp?.zapi_instance || '');
      const recentlyMigrated = Object.values(json).some(
        (c) => c.migrated_at && Date.now() - new Date(c.migrated_at).getTime() < MIGRATION_BANNER_WINDOW_MS
      );
      if (recentlyMigrated) setShowMigrationBanner(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar a configuração de canais.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, tenantQuery]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const putChannel = async (channel: ChannelName, body: Record<string, unknown>) => {
    const res = await fetchWithAuth(`/api/tenants/${tenantId}/channel-configs?${tenantQuery}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erro ao salvar a configuração do canal.');
    return data as { ok?: boolean; warning?: string };
  };

  const toggleChannel = async (channel: ChannelName) => {
    if (!configs) return;
    const next = !configs[channel].enabled;
    setConfigs({ ...configs, [channel]: { ...configs[channel], enabled: next } });
    setSavingChannel(channel);
    setFeedback((prev) => ({ ...prev, [channel]: undefined }));
    try {
      await putChannel(channel, { channel, enabled: next });
      await loadConfigs();
    } catch (e) {
      setConfigs((prev) =>
        prev ? { ...prev, [channel]: { ...prev[channel], enabled: !next } } : prev
      );
      setFeedback((prev) => ({
        ...prev,
        [channel]: {
          type: 'error',
          message: e instanceof Error ? e.message : 'Erro ao alterar o status do canal.',
        },
      }));
    } finally {
      setSavingChannel(null);
    }
  };

  const saveChannel = async (channel: ChannelName, fields: Record<string, string>) => {
    if (!configs) return;
    setSavingChannel(channel);
    setFeedback((prev) => ({ ...prev, [channel]: undefined }));
    try {
      // Envia apenas os segredos preenchidos; vazios preservam o ciphertext salvo.
      const body: Record<string, unknown> = {
        channel,
        enabled: configs[channel].enabled,
      };
      for (const [key, value] of Object.entries(fields)) {
        if (value !== '') body[key] = value;
      }
      const data = await putChannel(channel, body);
      setFeedback((prev) => ({
        ...prev,
        [channel]: data.warning
          ? { type: 'warning', message: data.warning }
          : { type: 'success', message: 'Configuração salva com sucesso.' },
      }));
      if (channel === 'telegram') {
        setTelegramToken('');
      } else {
        setZapiKey('');
        setZapiClientToken('');
      }
      await loadConfigs();
    } catch (e) {
      setFeedback((prev) => ({
        ...prev,
        [channel]: {
          type: 'error',
          message: e instanceof Error ? e.message : 'Erro ao salvar a configuração do canal.',
        },
      }));
    } finally {
      setSavingChannel(null);
    }
  };

  if (!tenantId) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 p-4 rounded-xl text-sm">
        Selecione um tenant ativo para gerenciar a configuração de canais.
      </div>
    );
  }

  if (loading && !configs) {
    return <div className="text-slate-500 text-sm">Carregando configuração de canais…</div>;
  }

  const telegram = configs?.telegram;
  const whatsapp = configs?.whatsapp;

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start text-sm">
          <AlertTriangle className="w-5 h-5 mr-3 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {showMigrationBanner && (
        <div
          data-testid="channel-migration-banner"
          className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 p-4 rounded-xl flex items-start text-sm"
        >
          <AlertTriangle className="w-5 h-5 mr-3 shrink-0 mt-0.5" />
          <p className="flex-1">
            As credenciais de mensageria do seu perfil foram copiadas automaticamente para este tenant
            (migração única). Revise-as abaixo e ajuste se necessário.
          </p>
          <button
            type="button"
            onClick={() => setShowMigrationBanner(false)}
            aria-label="Dispensar aviso"
            className="ml-2 text-emerald-300/70 hover:text-emerald-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!isAdmin && (
        <div className="bg-blue-500/10 border border-blue-500/20 text-blue-300 p-4 rounded-xl text-sm">
          Você é membro deste tenant. A configuração abaixo é somente leitura — apenas administradores
          podem alterá-la.
        </div>
      )}

      {/* Telegram */}
      {telegram && (
        <div className="bg-[#111318] border border-white/5 rounded-xl p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center">
                <Send className="w-4 h-4 mr-2 text-sky-400" />
                Telegram
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Negociação automatizada por bot do Telegram (Bot API).
              </p>
            </div>
            <EnabledToggle
              channel="telegram"
              enabled={telegram.enabled}
              disabled={!isAdmin || savingChannel === 'telegram'}
              onToggle={() => toggleChannel('telegram')}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <WebhookStatusBadge config={telegram} />
            {telegram.bot_username && (
              <span className="text-xs text-slate-400">
                Bot: <span className="text-slate-300 font-medium">@{telegram.bot_username}</span>
              </span>
            )}
          </div>
          {telegram.webhook_status === 'error' && telegram.webhook_last_error && (
            <p role="alert" className="text-xs text-red-400 mb-4">
              {telegram.webhook_last_error}
            </p>
          )}

          <p className="text-xs text-slate-500 mb-4">
            Como obter o token: no Telegram, converse com{' '}
            <a
              href="https://t.me/BotFather"
              target="_blank"
              rel="noreferrer"
              className="text-sky-400 hover:underline"
            >
              @BotFather
            </a>{' '}
            e use o comando <code className="bg-slate-800 px-1 py-0.5 rounded">/newbot</code>. Copie o
            token gerado e cole abaixo — o webhook é registrado automaticamente ao salvar.
          </p>

          <div className="mb-4">
            <label
              htmlFor="channel-bot-token"
              className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2"
            >
              Token do Bot
              {telegram.bot_token_set && (
                <span className="ml-2 inline-flex items-center text-emerald-400 normal-case tracking-normal">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  configurado
                </span>
              )}
            </label>
            <input
              id="channel-bot-token"
              type="password"
              value={telegramToken}
              onChange={(e) => setTelegramToken(e.target.value)}
              placeholder={
                telegram.bot_token_set
                  ? '•••••• (configurado — preencha para substituir)'
                  : '123456:ABC-DEF1234gh...'
              }
              disabled={!isAdmin}
              data-testid="channel-bot-token"
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <FeedbackMessage channel="telegram" feedback={feedback.telegram} />
            <button
              type="button"
              onClick={() => saveChannel('telegram', { bot_token: telegramToken })}
              disabled={!isAdmin || savingChannel === 'telegram'}
              data-testid="channel-save-telegram"
              className="bg-emerald-500 text-black px-4 py-2 rounded-lg font-semibold text-xs hover:bg-emerald-400 transition-colors disabled:opacity-50 shrink-0"
            >
              {savingChannel === 'telegram' ? 'Salvando...' : 'Salvar Telegram'}
            </button>
          </div>
        </div>
      )}

      {/* WhatsApp */}
      {whatsapp && (
        <div className="bg-[#111318] border border-white/5 rounded-xl p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center">
                <MessageSquare className="w-4 h-4 mr-2 text-emerald-500" />
                WhatsApp (Z-API)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Envio e recebimento de mensagens via instância Z-API.
              </p>
            </div>
            <EnabledToggle
              channel="whatsapp"
              enabled={whatsapp.enabled}
              disabled={!isAdmin || savingChannel === 'whatsapp'}
              onToggle={() => toggleChannel('whatsapp')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label
                htmlFor="channel-zapi-instance"
                className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2"
              >
                ID da Instância (Instance ID)
              </label>
              <input
                id="channel-zapi-instance"
                type="text"
                value={zapiInstance}
                onChange={(e) => setZapiInstance(e.target.value)}
                placeholder="Ex: 3AXXXXXX..."
                disabled={!isAdmin}
                data-testid="channel-zapi-instance"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label
                htmlFor="channel-zapi-key"
                className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2"
              >
                Token da Instância
                {whatsapp.zapi_key_set && (
                  <span className="ml-2 inline-flex items-center text-emerald-400 normal-case tracking-normal">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    configurado
                  </span>
                )}
              </label>
              <input
                id="channel-zapi-key"
                type="password"
                value={zapiKey}
                onChange={(e) => setZapiKey(e.target.value)}
                placeholder={whatsapp.zapi_key_set ? '•••••• (configurado — preencha para substituir)' : 'Ex: A5B2C...'}
                disabled={!isAdmin}
                data-testid="channel-zapi-key"
                className={INPUT_CLASS}
              />
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="channel-zapi-client-token"
                className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2"
              >
                Token de Segurança (Client-Token)
                {whatsapp.zapi_client_token_set && (
                  <span className="ml-2 inline-flex items-center text-emerald-400 normal-case tracking-normal">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    configurado
                  </span>
                )}
              </label>
              <input
                id="channel-zapi-client-token"
                type="password"
                value={zapiClientToken}
                onChange={(e) => setZapiClientToken(e.target.value)}
                placeholder={
                  whatsapp.zapi_client_token_set
                    ? '•••••• (configurado — preencha para substituir)'
                    : '••••••••••••••••'
                }
                disabled={!isAdmin}
                data-testid="channel-zapi-client-token"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <FeedbackMessage channel="whatsapp" feedback={feedback.whatsapp} />
            <button
              type="button"
              onClick={() =>
                saveChannel('whatsapp', {
                  zapi_instance: zapiInstance,
                  zapi_key: zapiKey,
                  zapi_client_token: zapiClientToken,
                })
              }
              disabled={!isAdmin || savingChannel === 'whatsapp'}
              data-testid="channel-save-whatsapp"
              className="bg-emerald-500 text-black px-4 py-2 rounded-lg font-semibold text-xs hover:bg-emerald-400 transition-colors disabled:opacity-50 shrink-0"
            >
              {savingChannel === 'whatsapp' ? 'Salvando...' : 'Salvar WhatsApp'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
