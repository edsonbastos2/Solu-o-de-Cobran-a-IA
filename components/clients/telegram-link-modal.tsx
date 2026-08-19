'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Clock, Copy, RefreshCw, Send, X } from 'lucide-react';
import { Client } from '@/lib/types';
import { fetchWithAuth } from '@/lib/api';

interface TelegramLinkModalProps {
  client: Client;
  tenantQuery?: string;
  onClose: () => void;
}

interface LinkResult {
  link: string;
  expires_at: string;
}

export function TelegramLinkModal({ client, tenantQuery = '', onClose }: TelegramLinkModalProps) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<LinkResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateLink = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      const res = await fetchWithAuth(
        `/api/clients/${client.id}/channel-links${tenantQuery ? `?${tenantQuery}` : ''}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel: 'telegram' }),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        let msg = data?.error || 'Não foi possível gerar o link de vinculação.';
        if (res.status === 400 && /configur/i.test(String(data?.error || ''))) {
          msg =
            'O canal Telegram não está configurado para este tenant. Configure-o em Configurações > Canais antes de gerar links.';
        } else if (res.status === 429) {
          msg =
            'Limite de geração de links atingido para este cliente. Aguarde cerca de uma hora e tente novamente.';
        } else if (res.status === 403) {
          msg = 'Você não tem permissão para gerar links de vinculação.';
        }
        setError(msg);
        return;
      }
      setResult({ link: data.link, expires_at: data.expires_at });
    } catch {
      setError('Não foi possível conectar ao servidor.');
    } finally {
      setLoading(false);
    }
  }, [client.id, tenantQuery]);

  useEffect(() => {
    generateLink();
  }, [generateLink]);

  const handleCopy = async () => {
    if (!result) return;
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(result.link);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      // Fallback para contextos sem Clipboard API (ex.: HTTP).
      try {
        const textarea = document.createElement('textarea');
        textarea.value = result.link;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        ok = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const alreadyLinked = (client.client_channels || []).some((c) => c.channel === 'telegram');
  const expiresLabel = result
    ? new Date(result.expires_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Vincular Telegram"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Send className="w-5 h-5 text-sky-600" />
            Vincular Telegram
          </h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            data-testid="telegram-link-close"
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            Envie o link abaixo para <strong className="text-gray-900">{client.name}</strong>. Ao abrir
            o link no Telegram e enviar o comando inicial, o canal ficará vinculado a este cliente.
          </p>

          {alreadyLinked && (
            <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
              Este cliente já possui o Telegram vinculado. Um novo link substituirá a vinculação
              atual após a confirmação do devedor.
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 py-6 text-sm text-gray-500" data-testid="telegram-link-loading">
              <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
              Gerando link de vinculação...
            </div>
          )}

          {error && (
            <div role="alert" data-testid="telegram-link-error" className="space-y-3">
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
              <button
                type="button"
                onClick={generateLink}
                className="text-xs font-semibold text-red-700 underline underline-offset-2"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {result && (
            <>
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Link de vinculação
                </span>
                <code
                  data-testid="telegram-link-url"
                  className="mt-1 block rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-800 break-all font-mono"
                >
                  {result.link}
                </code>
              </div>

              <button
                type="button"
                onClick={handleCopy}
                data-testid="telegram-link-copy"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copiado!' : 'Copiar link'}
              </button>

              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
              >
                <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                <p>
                  O link expira em 48 horas (até {expiresLabel}) e pode ser usado apenas uma vez.
                  Após esse prazo, gere um novo link.
                </p>
              </div>

              <button
                type="button"
                onClick={generateLink}
                data-testid="telegram-link-regenerate"
                className="text-xs font-semibold text-blue-600 underline underline-offset-2"
              >
                Gerar novo link
              </button>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            data-testid="telegram-link-done"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}
