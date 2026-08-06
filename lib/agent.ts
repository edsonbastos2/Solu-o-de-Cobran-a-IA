import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendMessage } from '@/lib/messaging';
import { getCollectionStage } from '@/lib/finance';
import { fetchAgents } from '@/lib/multi-agent';
import { recordAuditAction } from '@/lib/audit';
import { CaseWithRelations } from '@/lib/types';

const OPENCODE_BASE_URL = 'https://opencode.ai/zen/go/v1';

type ConversationMessage = {
  role: 'user' | 'ai' | 'human' | 'system';
  content: string;
};

type LlmMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callLLM(
  prompt: string,
  history: ConversationMessage[] | null,
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

        let messages: LlmMessage[] = [];
        if (history) {
          messages.push({ role: 'system', content: prompt });
          messages = messages.concat(history.map((msg) => ({
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

        let messages: Array<Exclude<LlmMessage, { role: 'system' }>> = [];
        let system = "";
        if (history) {
          system = prompt;
          messages = history.map((msg) => ({
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
    } catch (error: unknown) {
      attempt++;
      const errorMessage = getErrorMessage(error);
      const errorStatus = typeof error === 'object' && error !== null && 'status' in error
        ? error.status
        : undefined;
      const errorCode = typeof error === 'object' && error !== null && 'code' in error
        ? error.code
        : undefined;

      const isTransient =
        errorMessage.includes('503') ||
        errorMessage.includes('429') ||
        errorStatus === 503 ||
        errorStatus === 429 ||
        errorCode === 'ECONNRESET' ||
        errorCode === 'ETIMEDOUT';

      if (isTransient && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`Transient error in AI call (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`, errorMessage);
        await sleep(delay);
        continue;
      }

      throw error;
    }
  }

  return "";
}

export async function processChat(caseId: string, message: string, database?: SupabaseClient, tenantId?: string) {
  if (!database) {
    throw new Error("Supabase não configurado.");
  }
  if (!message.trim()) throw new Error('Mensagem vazia.');

  let caseQuery = database
    .from('cases')
    .select(`*, financial_titles (id, contract_id, installment_number, original_value, current_value, due_date, status, contracts (id, contract_number, clients (id, name, document)))`)
    .eq('id', caseId);
  if (tenantId) caseQuery = caseQuery.eq('tenant_id', tenantId);
  const { data: caseData, error: caseError } = await caseQuery.single();

  if (caseError || !caseData) {
    throw new Error("Caso não encontrado");
  }

  const relatedCase = caseData as CaseWithRelations;
  const resolvedTenantId = tenantId || relatedCase.tenant_id;
  if (!resolvedTenantId) throw new Error('Tenant não encontrado para o caso.');

  const stage = getCollectionStage(
    caseData.due_date,
    caseData.max_discount_margin,
    caseData.status
  );
  const financialTitle = Array.isArray(relatedCase.financial_titles)
    ? relatedCase.financial_titles[0]
    : relatedCase.financial_titles;
  const relatedContract = financialTitle?.contracts;
  const relatedClient = relatedContract?.clients;
  const domainContext = `
CONTEXTO CANÔNICO DA OBRIGAÇÃO:
Cliente: ${relatedClient?.name || caseData.name}
Documento: ${relatedClient?.document || caseData.debtor_document || 'não informado'}
Contrato: ${relatedContract?.contract_number || 'não informado'}
Título: ${financialTitle?.external_reference || financialTitle?.installment_number || 'legado'}
Vencimento: ${financialTitle?.due_date || caseData.due_date}
Status do título: ${financialTitle?.status || 'não informado'}`;

  let aiProvider = 'opencode';
  let aiModel = 'deepseek-v4-flash';
  let apiKey = process.env.OPENCODE_API_KEY || '';
  let ollamaBaseUrl = 'http://localhost:11434';

  if (caseData.user_id) {
    const admin = getSupabaseAdmin();
    let profile: AiProfile | null = null;
    if (admin) {
      const { data: rpcData, error: rpcErr } = await admin
        .rpc('get_user_ai_keys', { p_user_id: caseData.user_id });
      if (!rpcErr && rpcData && rpcData.length > 0) {
        profile = rpcData[0] as AiProfile;
      }
    }
    if (!profile) {
      const client = admin || database;
      const { data } = await client!
        .from('profiles')
        .select('*')
        .eq('id', caseData.user_id)
        .single();
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
    throw new Error(`Chave de API não configurada para o provedor ${aiProvider}. Configure nas opções (Settings) ou nas variáveis de ambiente.`);
  }

  let historyQuery = database
    .from('messages')
    .select('*')
    .eq('case_id', caseId);
  if (tenantId) historyQuery = historyQuery.eq('tenant_id', tenantId);
  const { data: historyData, error: historyError } = await historyQuery.order('created_at', { ascending: true });

  if (historyError) throw historyError;

  const { error: userMessageError } = await database.from('messages').insert({
    tenant_id: resolvedTenantId,
    case_id: caseId,
    role: 'user',
    content: message.trim()
  });
  if (userMessageError) throw userMessageError;

  await recordAuditAction(database, {
    tenantId: resolvedTenantId,
    entityType: 'message',
    entityId: caseId,
    caseId,
    actorUserId: caseData.user_id || null,
    action: 'DEBTOR_MESSAGE_RECEIVED',
    metadata: { role: 'user', content_length: message.trim().length },
  });

  const currentHistory = [...(historyData || []), { role: 'user', content: message }];

  const agentsList = await fetchAgents(caseData.user_id, database, resolvedTenantId || caseData.tenant_id);
  const activeAgents = agentsList.filter(a => a.is_active);
  const supervisor = activeAgents.find(a => a.role_type === 'supervisor');
  const qualidade = activeAgents.find(a => a.role_type === 'qualidade');

  let aiText = "Desculpe, ocorreu um erro de comunicação com a inteligência artificial.";

  try {
    if (!supervisor || activeAgents.length <= 1) {
      aiText = await callLLM(
          `Você é um agente de cobrança. Cliente: ${caseData.name}. Dívida: R$ ${Number(caseData.updated_value || caseData.original_value).toFixed(2)}. Atraso: ${stage.diasAtraso} dias. Desconto Máximo: ${stage.effectiveMaxDiscount}%. ${domainContext} Responda a mensagem.`,
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
Valor: R$ ${Number(caseData.updated_value || caseData.original_value).toFixed(2)}
Atraso: ${stage.diasAtraso} dias
Desconto Máximo Permitido: ${stage.effectiveMaxDiscount}%
${domainContext}

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
Valor Atualizado: R$ ${Number(caseData.updated_value || caseData.original_value).toFixed(2)}
Atraso: ${stage.diasAtraso} dias
Desconto Máximo Autorizado: ${stage.effectiveMaxDiscount}%
${domainContext}

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
  } catch (error: unknown) {
    console.error("AI API Error:", error);
    throw new Error(`Erro na IA: ${getErrorMessage(error)}`);
  }

  const { error: aiMessageError } = await database.from('messages').insert({
    tenant_id: resolvedTenantId,
    case_id: caseId,
    role: 'ai',
    content: aiText
  });
  if (aiMessageError) throw aiMessageError;

  await recordAuditAction(database, {
    tenantId: resolvedTenantId,
    entityType: 'message',
    entityId: caseId,
    caseId,
    actorUserId: caseData.user_id || null,
    action: 'AI_MESSAGE_SENT',
    metadata: { role: 'ai', content_length: aiText.length },
  });

  const cleanAiText = aiText
    .replace(/\[HANDOFF\]/g, '')
    .replace(/\[ACORDO_FECHADO\]/g, '')
    .trim();

  if (caseData.phone || caseData.telegram_chat_id) {
    const destination = caseData.telegram_chat_id || caseData.phone;
    sendMessage(destination, cleanAiText, caseData.user_id).catch(async err => {
      console.error("Error in background message send:", err);

      if (database) {
        const provider = caseData.telegram_chat_id ? 'Telegram' : 'WhatsApp';
        await database.from('messages').insert({
          tenant_id: resolvedTenantId,
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
    const statusQuery = database.from('cases').update({ status: newStatus }).eq('id', caseId);
    if (tenantId) statusQuery.eq('tenant_id', tenantId);
    const { data: updatedCase, error: statusError } = await statusQuery.select('*').single();
    if (statusError) throw statusError;
    await recordAuditAction(database, {
      tenantId: resolvedTenantId,
      entityType: 'case',
      entityId: caseId,
      caseId,
      actorUserId: caseData.user_id || null,
      action: newStatus === 'closed' ? 'CASE_CLOSED' : 'STATUS_CHANGE',
      before: caseData,
      after: updatedCase,
      metadata: { source: 'ai_pipeline' },
    });
  }

  return { text: aiText, newStatus, stage };
}
