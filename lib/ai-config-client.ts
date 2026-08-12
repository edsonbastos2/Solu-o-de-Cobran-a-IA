// Espelho client-side das constantes de IA definidas em lib/ai-config.ts.
// Mantido separado para NÃO puxar @supabase/supabase-js (runtime) nem o
// resolvedor server-side para o bundle do cliente. Se alterar lib/ai-config.ts,
// atualize os valores aqui (DEFAULT_MODELS / MODEL_WHITELISTS / VISION_CAPABLE).

export type AIProvider = 'opencode' | 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'ollama';
export type AIBucket = 'assistant' | 'pdf_extraction' | 'agents';

export const SUPPORTED_PROVIDERS: AIProvider[] = [
  'opencode',
  'gemini',
  'openai',
  'anthropic',
  'openrouter',
  'ollama',
];

export const PROVIDER_LABELS: Record<AIProvider, string> = {
  opencode: 'OpenCode Zen (DeepSeek)',
  gemini: 'Google Gemini',
  openai: 'OpenAI (ChatGPT)',
  anthropic: 'Anthropic (Claude)',
  openrouter: 'OpenRouter',
  ollama: 'Ollama (Local)',
};

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

// Modelo vision-capable do gateway OpenCode usado pelo fallback hardcoded de
// pdf_extraction (lib/ai-config.ts). Oferecido no editor APENAS para o bucket
// pdf_extraction com provedor opencode (o servidor valida essa combinação).
export const PDF_OPENCODE_EXTRA_MODEL = 'minimax-m3';

// Provedores capazes de visão de documento (ADR-005) — pdf_extraction só aceita estes.
export const VISION_CAPABLE: Record<AIProvider, boolean> = {
  opencode: true,
  anthropic: true,
  openai: true,
  gemini: true,
  openrouter: false,
  ollama: false,
};

export const PROVIDER_API_KEY_FIELD: Record<AIProvider, string> = {
  opencode: 'opencode_api_key',
  gemini: 'gemini_api_key',
  openai: 'openai_api_key',
  anthropic: 'anthropic_api_key',
  openrouter: 'openrouter_api_key',
  ollama: 'ollama_api_key',
};

export const PROVIDER_KEY_PLACEHOLDERS: Record<AIProvider, string> = {
  opencode: 'sk-...',
  gemini: 'AIzaSy...',
  openai: 'sk-...',
  anthropic: 'sk-ant-...',
  openrouter: 'sk-or-v1-...',
  ollama: '',
};

export function isProvider(v: unknown): v is AIProvider {
  return typeof v === 'string' && (SUPPORTED_PROVIDERS as string[]).includes(v);
}