import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { SupabaseClient } from '@supabase/supabase-js';
import { getCollectionStage } from '@/lib/finance';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { Case, Message, Negotiation, CaseInsights } from '@/lib/types';

const OPENCODE_BASE_URL = 'https://opencode.ai/zen/go/v1';
const MAX_MESSAGES_FOR_LLM = 50;

type AiProfile = {
  ai_provider?: string;
  ai_model?: string;
  opencode_api_key?: string;
  gemini_api_key?: string;
  openai_api_key?: string;
  anthropic_api_key?: string;
  openrouter_api_key?: string;
  ollama_base_url?: string;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

/** Normaliza e valida a resposta JSON bruta da IA em um CaseInsights consistente. */
function sanitizeInsights(content: string): CaseInsights {
  const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = null;
  }
  const obj = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};

  const sentimentTrend = Array.isArray(obj.sentiment_trend)
    ? obj.sentiment_trend
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map((item) => ({
          date: typeof item.date === 'string' ? item.date.slice(0, 10) : '',
          score: clampNumber(item.score, -1, 1, 0),
        }))
        .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date))
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];

  let mainObjections = Array.isArray(obj.main_objections)
    ? obj.main_objections.filter((o): o is string => typeof o === 'string').map((o) => o.trim())
    : [];
  if (mainObjections.length > 5) mainObjections = mainObjections.slice(0, 5);

  const themeSummary =
    typeof obj.theme_summary === 'string' && obj.theme_summary.trim()
      ? obj.theme_summary.trim()
      : 'Sem sumarização disponível.';

  const agreementProbability = clampNumber(obj.agreement_probability, 0, 1, 0);

  const recommendedTone =
    typeof obj.recommended_tone === 'string' && obj.recommended_tone.trim()
      ? obj.recommended_tone.trim()
      : 'neutro';

  return {
    sentiment_trend: sentimentTrend,
    main_objections: mainObjections,
    theme_summary: themeSummary,
    agreement_probability: agreementProbability,
    recommended_tone: recommendedTone,
  };
}

export async function generateCaseInsights(
  supabase: SupabaseClient,
  caseId: string,
  tenantId: string
): Promise<CaseInsights | { error: string }> {
  try {
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (caseError || !caseData) {
      return { error: 'Caso não encontrado' };
    }
    const caseRow = caseData as Case;

    const { data: messagesData, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('case_id', caseId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });
    if (messagesError) throw messagesError;
    const allMessages = (messagesData || []) as Message[];

    const { data: negotiationsData, error: negotiationsError } = await supabase
      .from('negotiations')
      .select('*')
      .eq('case_id', caseId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });
    if (negotiationsError) throw negotiationsError;
    const negotiations = (negotiationsData || []) as Negotiation[];

    if (allMessages.length === 0) {
      return {
        sentiment_trend: [],
        main_objections: [],
        theme_summary: 'Sem histórico de mensagens.',
        agreement_probability: 0,
        recommended_tone: 'neutro',
      };
    }

    let messagesToUse = allMessages;
    let earlySummary: string | null = null;
    if (allMessages.length > MAX_MESSAGES_FOR_LLM) {
      const truncatedCount = allMessages.length - MAX_MESSAGES_FOR_LLM;
      const dropped = allMessages.slice(0, truncatedCount);
      messagesToUse = allMessages.slice(truncatedCount);

      const roleCounts = new Map<string, number>();
      for (const m of dropped) {
        roleCounts.set(m.role, (roleCounts.get(m.role) || 0) + 1);
      }
      const roleParts = Array.from(roleCounts.entries())
        .map(([role, count]) => `${count} de ${role.toUpperCase()}`)
        .join(', ');

      const firstDate = dropped[0] ? new Date(dropped[0].created_at).toISOString().slice(0, 10) : '';
      const lastDroppedDate = dropped[dropped.length - 1]
        ? new Date(dropped[dropped.length - 1].created_at).toISOString().slice(0, 10)
        : '';

      earlySummary = `Histórico inicial: ${truncatedCount} mensagens de ${roleParts}, período ${firstDate} a ${lastDroppedDate}.`;
    }

    const stage = getCollectionStage(caseRow.due_date, caseRow.max_discount_margin, caseRow.status);

    const negotiationsSummary = negotiations
      .map((n) => {
        const parts: string[] = [`status: ${n.status}`];
        if (n.agreed_value != null) parts.push(`agreed_value: ${n.agreed_value}`);
        if (n.discount_percent != null) parts.push(`discount_percent: ${n.discount_percent}%`);
        if (n.installment_count != null) parts.push(`installment_count: ${n.installment_count}`);
        return `- ${parts.join(', ')}`;
      })
      .join('\n');

    const messageLines = messagesToUse
      .map((m, index) => {
        const dateStr = new Date(m.created_at).toISOString().slice(0, 10);
        const safeContent = (m.content || '').replace(/\s+/g, ' ').trim().slice(0, 1000);
        return `${index + 1}. [${m.role}] ${dateStr}: ${safeContent}`;
      })
      .join('\n');

    const prompt = `Você é um especialista em análise de cobrança e negociação de dívidas. Baseado nos dados e no histórico abaixo, gere insights estratégicos para orientar a equipe.

DADOS DO CASO:
Nome do devedor: ${caseRow.name}
Valor original: R$ ${Number(caseRow.original_value || 0).toFixed(2)}
Valor atualizado: R$ ${Number(caseRow.updated_value || caseRow.original_value || 0).toFixed(2)}
Data de vencimento: ${caseRow.due_date || 'não informada'}
Estágio: ${stage.id} - "${stage.name}" (${stage.diasAtraso} dias de atraso)
Margem efetiva de desconto: ${stage.effectiveMaxDiscount}%

RESUMO DE NEGOCIAÇÕES (${negotiations.length}):
${negotiationsSummary || 'Nenhuma negociação registrada.'}

${earlySummary ? `\n${earlySummary}\n` : ''}
HISTÓRICO DE MENSAGENS (${messagesToUse.length}):
${messageLines}

Responda APENAS com um objeto JSON válido (sem markdown, sem texto adicional), no formato:
{
  "sentiment_trend": [{"date": "AAAA-MM-DD", "score": 0.5}],
  "main_objections": ["objeção 1", "objeção 2"],
  "theme_summary": "resumo em pt-BR",
  "agreement_probability": 0.6,
  "recommended_tone": "tom recomendado"
}

REGRAS:
- "sentiment_trend": score de sentimento por dia entre -1 (muito negativo/irritado) e +1 (muito positivo/cooperativo); agrupe as mensagens por dia usando data no formato AAAA-MM-DD (date-only).
- "main_objections": principais objeções/barreiras do devedor, no máximo 5 itens.
- "theme_summary": resumo conciso do tema da conversa, em pt-BR.
- "agreement_probability": probabilidade estimada de fechamento de acordo entre 0 e 1.
- "recommended_tone": tom de abordagem recomendado, em pt-BR.`;

    let aiProvider = 'opencode';
    let aiModel = 'deepseek-v4-flash';
    let apiKey = process.env.OPENCODE_API_KEY || '';
    let ollamaBaseUrl = 'http://localhost:11434';

    if (caseRow.user_id) {
      const admin = getSupabaseAdmin();
      let profile: AiProfile | null = null;
      if (admin) {
        const { data: rpcData, error: rpcErr } = await admin.rpc('get_user_ai_keys', { p_user_id: caseRow.user_id });
        if (!rpcErr && rpcData && rpcData.length > 0) profile = rpcData[0] as AiProfile;
      }
      if (!profile && admin) {
        const { data } = await admin.from('profiles').select('*').eq('id', caseRow.user_id).single();
        profile = data as AiProfile | null;
      }

      if (profile) {
        aiProvider = profile.ai_provider || 'opencode';
        aiModel = profile.ai_model || (aiProvider === 'opencode' ? 'deepseek-v4-flash' : aiProvider === 'gemini' ? 'gemini-3.5-flash' : aiProvider === 'openai' ? 'gpt-4o-mini' : aiProvider === 'ollama' ? 'llama3' : aiProvider === 'openrouter' ? 'meta-llama/llama-3-8b-instruct:free' : 'claude-3-haiku');

        if (aiProvider === 'opencode') {
          apiKey = profile.opencode_api_key || process.env.OPENCODE_API_KEY || '';
        } else if (aiProvider === 'gemini') {
          apiKey = profile.gemini_api_key || process.env.GEMINI_API_KEY || '';
        } else if (aiProvider === 'openai') {
          apiKey = profile.openai_api_key || process.env.OPENAI_API_KEY || '';
        } else if (aiProvider === 'anthropic') {
          apiKey = profile.anthropic_api_key || process.env.ANTHROPIC_API_KEY || '';
        } else if (aiProvider === 'openrouter') {
          apiKey = profile.openrouter_api_key || process.env.OPENROUTER_API_KEY || '';
        } else if (aiProvider === 'ollama') {
          ollamaBaseUrl = profile.ollama_base_url || 'http://localhost:11434';
          apiKey = 'ollama-no-key';
        }
      }
    }

    if (!apiKey) {
      return { error: `Chave de API não configurada para o provedor ${aiProvider}. Configure nas opções (Settings) ou nas variáveis de ambiente.` };
    }

    let content = '';
    if (aiProvider === 'opencode' || aiProvider === 'openai' || aiProvider === 'ollama' || aiProvider === 'openrouter') {
      const openai = new OpenAI({
        apiKey: aiProvider === 'ollama' ? 'ollama' : apiKey,
        baseURL: aiProvider === 'opencode'
          ? OPENCODE_BASE_URL
          : aiProvider === 'openrouter'
            ? 'https://openrouter.ai/api/v1'
            : aiProvider === 'ollama'
              ? `${ollamaBaseUrl.replace(/\/+$/, '')}/v1`
              : undefined,
      });
      const response = await openai.chat.completions.create({
        model: aiModel,
        messages: [
          { role: 'system', content: 'Você é um analista de insights de cobrança. Sempre responda com JSON válido.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
        max_tokens: 2048,
      });
      content = response.choices[0].message.content || '';
    } else if (aiProvider === 'anthropic') {
      const anthropic = new Anthropic({ apiKey });
      const response = await anthropic.messages.create({
        model: aiModel,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      });
      if (response.content[0].type === 'text') {
        content = response.content[0].text;
      }
    }

    if (!content.trim()) {
      return { error: `Falha ao gerar insights com o provedor ${aiProvider}.` };
    }

    return sanitizeInsights(content);
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}
