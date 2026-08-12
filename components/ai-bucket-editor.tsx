'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Save } from 'lucide-react';
import {
  AIProvider,
  AIBucket,
  DEFAULT_MODELS,
  MODEL_WHITELISTS,
  PDF_OPENCODE_EXTRA_MODEL,
  PROVIDER_API_KEY_FIELD,
  PROVIDER_KEY_PLACEHOLDERS,
  PROVIDER_LABELS,
  SUPPORTED_PROVIDERS,
  VISION_CAPABLE,
  isProvider,
} from '@/lib/ai-config-client';

export interface BucketValue {
  provider?: string;
  model?: string;
  ollama_base_url?: string;
  opencode_api_key_set?: boolean;
  gemini_api_key_set?: boolean;
  openai_api_key_set?: boolean;
  anthropic_api_key_set?: boolean;
  openrouter_api_key_set?: boolean;
}

export interface AiBucketEditorProps {
  bucket: AIBucket;
  title: string;
  description?: string;
  value: BucketValue;
  sourceBadge?: string;
  disabled?: boolean;
  saving?: boolean;
  visionOnly?: boolean;
  onSave: (payload: {
    provider: AIProvider;
    model: string;
    ollama_base_url?: string;
    secretField: string;
    secret?: string;
  }) => Promise<void> | void;
}

export function AiBucketEditor({
  bucket,
  title,
  description,
  value,
  sourceBadge,
  disabled,
  saving,
  visionOnly,
  onSave,
}: AiBucketEditorProps) {
  const [provider, setProvider] = useState<AIProvider>(
    isProvider(value.provider) ? value.provider : 'opencode'
  );
  const [model, setModel] = useState<string>(value.model || DEFAULT_MODELS.opencode);
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState<string>(value.ollama_base_url || 'http://localhost:11434');
  const [secret, setSecret] = useState<string>('');
  const [localSaving, setLocalSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localSaved, setLocalSaved] = useState(false);

  // Re-sincroniza quando o valor vindo do servidor muda (ex.: após recarga).
  useEffect(() => {
    const p = isProvider(value.provider) ? value.provider : 'opencode';
    setProvider(p);
    setModel(value.model || DEFAULT_MODELS[p]);
    setOllamaBaseUrl(value.ollama_base_url || 'http://localhost:11434');
    setSecret('');
  }, [value.provider, value.model, value.ollama_base_url]);

  const modelOptions = MODEL_WHITELISTS[provider];
  // O modelo vision-capable do OpenCode (minimax-m3) só é oferecido no bucket
  // pdf_extraction — o servidor (tasks 03/04) só aceita essa combinação.
  const effectiveModelOptions =
    visionOnly && provider === 'opencode' && !modelOptions.includes(PDF_OPENCODE_EXTRA_MODEL)
      ? [...modelOptions, PDF_OPENCODE_EXTRA_MODEL]
      : modelOptions;
  const isFreeFormModel = provider === 'ollama' || provider === 'openrouter';
  const secretSetKey = `${PROVIDER_API_KEY_FIELD[provider]}_set` as keyof BucketValue;
  const secretSet = Boolean(value[secretSetKey]);
  const secretField = PROVIDER_API_KEY_FIELD[provider];

  const handleProviderChange = (next: AIProvider) => {
    setProvider(next);
    // Ajusta o modelo para um valor válido do novo provedor.
    if (MODEL_WHITELISTS[next].includes(model)) {
      // mantém sefor válido
    } else {
      setModel(DEFAULT_MODELS[next]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    setLocalSaving(true);
    setLocalSaved(false);
    setLocalError(null);
    try {
      const trimmedModel = model.trim();
      if (!trimmedModel) {
        setLocalError('Modelo é obrigatório.');
        setLocalSaving(false);
        return;
      }
      await onSave({
        provider,
        model: trimmedModel,
        ollama_base_url: provider === 'ollama' ? ollamaBaseUrl.trim() || 'http://localhost:11434' : undefined,
        secretField,
        secret: provider === 'ollama' ? undefined : secret || undefined,
      });
      setSecret('');
      setLocalSaved(true);
      setTimeout(() => setLocalSaved(false), 3000);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setLocalSaving(false);
    }
  };

  const readOnly = disabled;
  const busy = saving || localSaving;

  return (
    <div className="bg-[#111318] border border-white/5 rounded-xl p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          {title}
        </h3>
        {sourceBadge && (
          <span
            className="text-xs px-2 py-1 rounded-full border border-white/10 bg-white/5 text-slate-300"
            role="status"
            aria-label={`Origem da configuração: ${sourceBadge}`}
          >
            {sourceBadge}
          </span>
        )}
      </div>
      {description && <p className="text-sm text-slate-500 mb-6">{description}</p>}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor={`${bucket}-provider`}
              className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2"
            >
              Provedor de IA
            </label>
            <select
              id={`${bucket}-provider`}
              value={provider}
              disabled={readOnly}
              onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
              className="w-full bg-[#0e1014] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {SUPPORTED_PROVIDERS.map((p) => (
                <option
                  key={p}
                  value={p}
                  disabled={visionOnly && !VISION_CAPABLE[p] ? true : undefined}
                >
                  {PROVIDER_LABELS[p]}
                  {visionOnly && !VISION_CAPABLE[p] ? ' (sem visão de documento)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor={`${bucket}-model`}
              className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2"
            >
              Modelo
            </label>
            {isFreeFormModel ? (
              <input
                id={`${bucket}-model`}
                type="text"
                value={model}
                disabled={readOnly}
                onChange={(e) => setModel(e.target.value)}
                placeholder={DEFAULT_MODELS[provider]}
                className="w-full bg-[#0e1014] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              />
            ) : (
              <select
                id={`${bucket}-model`}
                value={effectiveModelOptions.includes(model) ? model : effectiveModelOptions[0]}
                disabled={readOnly}
                onChange={(e) => setModel(e.target.value)}
                className="w-full bg-[#0e1014] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {effectiveModelOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {provider === 'ollama' ? (
          <div>
            <label
              htmlFor={`${bucket}-ollama-url`}
              className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2"
            >
              URL Base do Ollama
            </label>
            <input
              id={`${bucket}-ollama-url`}
              type="text"
              value={ollamaBaseUrl}
              disabled={readOnly}
              onChange={(e) => setOllamaBaseUrl(e.target.value)}
              placeholder="http://localhost:11434"
              className="w-full bg-[#0e1014] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-2">Certifique-se de que o servidor do Ollama está rodando e acessível pela aplicação.</p>
          </div>
        ) : (
          <div className="pt-4 border-t border-white/5">
            <label
              htmlFor={`${bucket}-secret`}
              className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2"
            >
              Chave de API do provedor
              {secretSet && (
                <span className="ml-2 inline-flex items-center text-emerald-400 normal-case tracking-normal">
                  <CheckCircle2 className="w-3 h-3 mr-1" />salvo
                </span>
              )}
            </label>
            <input
              id={`${bucket}-secret`}
              type="password"
              value={secret}
              disabled={readOnly}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={secretSet ? '•••••• (preencha para substituir)' : PROVIDER_KEY_PLACEHOLDERS[provider]}
              className="w-full bg-[#0e1014] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-2">Deixe em branco para preservar a chave já salva. Sem chave, o sistema usa o padrão de sistema ou o fallback hardcoded.</p>
          </div>
        )}

        {localError && (
          <p className="text-sm text-red-400" role="alert">{localError}</p>
        )}

        {!readOnly && (
          <div className="flex items-center justify-end gap-3">
            {localSaved && (
              <span className="text-emerald-400 text-sm font-medium flex items-center">
                <Save className="w-4 h-4 mr-1.5" />Salvo!
              </span>
            )}
            <button
              type="submit"
              disabled={busy}
              className="bg-emerald-500 text-black px-5 py-2 rounded-lg font-semibold text-sm hover:bg-emerald-400 transition-colors disabled:opacity-50 flex items-center"
            >
              {busy ? 'Salvando...' : 'Salvar bucket'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}