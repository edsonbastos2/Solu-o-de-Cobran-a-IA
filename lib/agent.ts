import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendMessage } from '@/lib/messaging';
import { getCollectionStage } from '@/lib/finance';
import { fetchAgents, AgentConfig } from '@/lib/multi-agent';

const OPENCODE_BASE_URL = 'https://opencode.ai/zen/go/v1';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callLLM(
  prompt: string,
  history: any[] | null,
  aiProvider: string,
  aiModel: string,
  apiKey: string,
  ollamaBaseUrl: string,
  temperature: number,
  responseFormat?: 'json_object',
  maxRetries = 3
): Promise<string> {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      if (aiProvider === 'opencode' || aiProvider === 'openai' || aiProvider === 'ollama' || aiProvider === 'openrouter') {
        const client = new OpenAI({
          apiKey: aiProvider === 'openrouter' ? apiKey : (aiProvider === 'ollama' ? 'ollama' : apiKey),
          baseURL: aiProvider === 'opencode' ? OPENCODE_BASE_URL : (aiProvider === 'openrouter' ? 'https://openrouter.ai/api/v1' : (aiProvider === 'ollama' ? `${ollamaBaseUrl.replace(/\/+$/, '')}/v1` : undefined))
        });

        let messages: any[] = [];
        if (history) {
          messages.push({ role: 'system', content: prompt });
          messages = messages.concat(history.map((msg: any) => ({
            role: (msg.role === 'ai' || msg.role === 'human') ? 'assistant' : 'user',
            content: msg.content
          })));
        } else {
          messages.push({ role: 'user', content: prompt });
        }

        const response = await client.chat.completions.create({
          model: aiModel,
          messages: messages,
          temperature,
          response_format: responseFormat === 'json_object' ? { type: 'json_object' as const } : undefined,
          max_tokens: 2048
        });
        return response.choices[0].message.content || "";

      } else if (aiProvider === 'anthropic') {
        const anthropic = new Anthropic({ apiKey });

        let messages: any[] = [];
        let system = "";
        if (history) {
          system = prompt;
          messages = history.map((msg: any) => ({
            role: (msg.role === 'ai' || msg.role === 'human') ? 'assistant' : 'user',
            content: msg.content
          }));
        } else {
          messages.push({ role: 'user', content: prompt });
        }

        const response = await anthropic.messages.create({
          model: aiModel,
          system: system || undefined,
          max_tokens: 1024,
          messages: messages,
          temperature
        });

        if (response.content[0].type === 'text') {
          return response.content[0].text;
        }
        return "";
      }

      return "";
    } catch (error: any) {
      attempt++;

      const isTransient =
        error.message?.includes('503') ||
        error.message?.includes('429') ||
        error.status === 503 ||
        error.status === 429 ||
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT';

      if (isTransient && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`Transient error in AI call (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`, error.message);
        await sleep(delay);
        continue;
      }

      throw error;
    }
  }

  return "";
}

export async function processChat(caseId: string, message: string) {
  if (!supabase) {
    throw new Error("Supabase não configurado.");
  }

  const { data: caseData, error: caseError } = await supabase
    .from('cases')
    .select('*')
    .eq('id', caseId)
    .single();

  if (caseError || !caseData) {
    throw new Error("Caso não encontrado");
  }

  const stage = getCollectionStage(
    caseData.due_date,
    caseData.max_discount_margin,
    caseData.status
  );

  let aiProvider = 'opencode';
  let aiModel = 'deepseek-v4-flash';
  let apiKey = process.env.OPENCODE_API_KEY || '';
  let ollamaBaseUrl = 'http://localhost:11434';

  if (caseData.user_id) {
    const admin = getSupabaseAdmin();
    let profile: any = null;
    if (admin) {
      const { data: rpcData, error: rpcErr } = await admin
        .rpc('get_user_ai_keys', { p_user_id: caseData.user_id });
      if (!rpcErr && rpcData && rpcData.length > 0) {
        profile = rpcData[0];
      }
    }
    if (!profile) {
      const client = admin || supabase;
      const { data } = await client!
        .from('profiles')
        .select('*')
        .eq('id', caseData.user_id)
        .single();
      profile = data;
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
    throw new Error(`Chave de API não configurada para o provedor ${aiProvider}. Configure nas opções (Settings) ou nas variáveis de ambiente.`);
  }

  const { data: historyData, error: historyError } = await supabase
    .from('messages')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true });

  if (historyError) throw historyError;

  await supabase.from('messages').insert({
    case_id: caseId,
    role: 'user',
    content: message
  });

  const currentHistory = [...(historyData || []), { role: 'user', content: message }];

  const agentsList = await fetchAgents(caseData.user_id);
  const activeAgents = agentsList.filter(a => a.is_active);
  const supervisor = activeAgents.find(a => a.role_type === 'supervisor');
  const qualidade = activeAgents.find(a => a.role_type === 'qualidade');

  let aiText = "Desculpe, ocorreu um erro de comunicação com a inteligência artificial.";

  try {
    if (!supervisor || activeAgents.length <= 1) {
      aiText = await callLLM(
        `Você é um agente de cobrança. Cliente: ${caseData.name}. Dívida: R$ ${caseData.updated_value}. Atraso: ${stage.diasAtraso} dias. Desconto Máximo: ${stage.effectiveMaxDiscount}%. Responda a mensagem.`,
        currentHistory,
        aiProvider,
        aiModel,
        apiKey,
        ollamaBaseUrl,
        0.2
      );
    } else {
      const supervisorPrompt = `${supervisor.system_prompt}

MENSAGEM DO DEVEDOR: "${message}"
CASO:
Cliente: ${caseData.name}
Valor: R$ ${caseData.updated_value.toFixed(2)}
Atraso: ${stage.diasAtraso} dias
Desconto Máximo Permitido: ${stage.effectiveMaxDiscount}%

Especialistas Disponíveis:
${activeAgents.filter(a => a.role_type !== 'supervisor' && a.role_type !== 'qualidade').map(a => `- ${a.name} (role: ${a.role_type}): ${a.description}`).join('\n')}

Retorne um JSON: { "selected_role": "role", "reasoning": "...", "guidance": "..." }`;

      let routing = {
        selected_role: 'cobranca',
        reasoning: 'Atendimento inicial padrão.',
        guidance: 'Apresente o caso e pergunte como podemos ajudar.'
      };

      try {
        const supResponse = await callLLM(supervisorPrompt, null, aiProvider, supervisor.model || aiModel, apiKey, ollamaBaseUrl, Number(supervisor.temperature) || 0.1, 'json_object');
        const parsed = JSON.parse(supResponse.replace(/```json/g, '').replace(/```/g, '').trim());
        if (parsed.selected_role) routing = parsed;
      } catch (err) {
        console.warn("Supervisor fallback reasoning triggered:", err);
      }

      const specialist = activeAgents.find(a => a.role_type === routing.selected_role) || activeAgents.find(a => a.role_type === 'negociacao') || activeAgents[0];

      const specialistPrompt = `${specialist.system_prompt.replace(/{effective_max_discount}/g, stage.effectiveMaxDiscount.toString())}

DIRETRIZES DO SUPERVISOR:
${routing.guidance}

INFORMAÇÕES DO CASO:
Nome: ${caseData.name}
Valor Atualizado: R$ ${caseData.updated_value.toFixed(2)}
Atraso: ${stage.diasAtraso} dias
Desconto Máximo Autorizado: ${stage.effectiveMaxDiscount}%

Se o acordo for fechado, inclua a tag [ACORDO_FECHADO]. Se necessitar intervenção humana, inclua [HANDOFF].`;

      const rawDraft = await callLLM(specialistPrompt, currentHistory, aiProvider, specialist.model || aiModel, apiKey, ollamaBaseUrl, Number(specialist.temperature) || 0.2);
      aiText = rawDraft || "Desculpe, não entendi sua solicitação.";

      if (qualidade && qualidade.is_active) {
        try {
          const qualityPrompt = `${qualidade.system_prompt}

REGRAS OBRIGATÓRIAS:
- Proibido qualquer tom ameaçador ou abusivo (CDC Art. 42).
- Desconto não pode ultrapassar ${stage.effectiveMaxDiscount}%.

RESPOSTA GERADA PELO ESPECIALISTA (${specialist.name}):
"${rawDraft}"

Retorne um JSON: { "approved": boolean, "complianceScore": number, "feedback": "...", "corrected_response": "..." }`;

          const qualityRes = await callLLM(qualityPrompt, null, aiProvider, qualidade.model || aiModel, apiKey, ollamaBaseUrl, Number(qualidade.temperature) || 0.1, 'json_object');
          const qParsed = JSON.parse(qualityRes.replace(/```json/g, '').replace(/```/g, '').trim());
          if (qParsed.corrected_response && (!qParsed.approved || qParsed.complianceScore < 90)) {
            aiText = qParsed.corrected_response;
          }
        } catch (qErr) {
          console.warn("Quality agent audit skipped due to parse error:", qErr);
        }
      }
    }
  } catch (error: any) {
    console.error("AI API Error:", error);
    throw new Error(`Erro na IA: ${error.message || String(error)}`);
  }

  await supabase.from('messages').insert({
    case_id: caseId,
    role: 'ai',
    content: aiText
  });

  const cleanAiText = aiText
    .replace(/\[HANDOFF\]/g, '')
    .replace(/\[ACORDO_FECHADO\]/g, '')
    .trim();

  if (caseData.phone || caseData.telegram_chat_id) {
    const destination = caseData.telegram_chat_id || caseData.phone;
    sendMessage(destination, cleanAiText, caseData.user_id).catch(async err => {
      console.error("Error in background message send:", err);

      if (supabase) {
        const provider = caseData.telegram_chat_id ? 'Telegram' : 'WhatsApp';
        await supabase.from('messages').insert({
          case_id: caseId,
          role: 'system',
          content: `Falha ao enviar mensagem via ${provider}. Verifique suas configurações.`
        });
      }
    });
  }

  let newStatus = caseData.status;
  if (newStatus === 'not_started') newStatus = 'in_negotiation';
  if (aiText.includes('[HANDOFF]') || stage.id === 'especializada') newStatus = 'needs_attention';
  if (aiText.includes('[ACORDO_FECHADO]')) newStatus = 'closed';

  if (newStatus !== caseData.status) {
    await supabase.from('cases').update({ status: newStatus }).eq('id', caseId);
  }

  return { text: aiText, newStatus, stage };
}
