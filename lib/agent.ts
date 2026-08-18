import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { resolveAIConfig, resolveAgentModel } from '@/lib/ai-config';
import { sendMessage } from '@/lib/messaging';
import { getCollectionStage } from '@/lib/finance';
import { fetchAgents } from '@/lib/multi-agent';
import { recordAuditAction } from '@/lib/audit';
import { CaseWithRelations } from '@/lib/types';
import { logger } from '@/lib/logger';
import { getActiveQuarantine } from '@/lib/quarantine';
import { resolveTemplateVariables } from '@/lib/message-templates';

const OPENCODE_BASE_URL = 'https://opencode.ai/zen/go/v1';
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

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

/**
 * Modelos de raciocínio (MiniMax, DeepSeek-R1, Qwen, Kimi, GLM, Grok)costumam
 * prefixar a resposta com um bloco <think>...</think> contendo o chain-of-thought
 * interno. Esse conteúdo NÃO pode chegar ao devedor no WhatsApp — é vazamento de
 * prompt interno. Remove o bloco e trim o resultado.
 */
export function stripThinkBlocks(text: string): string {
  if (!text) return text;
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<reflection>[\s\S]*?<\/reflection>/gi, '')
    .trim();
}

const AGREEMENT_AMOUNT_RE = /\bR\$\s*[\d]{1,3}(?:\.[\d]{3})*(?:,[\d]{2})?\b/gi;
const DISCOUNT_RE = /(\d+(?:[.,]\d+)?)\s*%/g;
const INSTALLMENT_RE = /(\d+)\s*(?:x|vezes?|parcelas?)\b/gi;

/**
 * Converte um valor monetário em formato pt-BR (ex: "R$ 1.234,56") para número.
 * Retorna null quando não há fração monetária válida.
 */
function parseBRLAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.');
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

function clampPercent(value: number | null): number | null {
  if (value === null) return null;
  return Math.min(100, Math.max(0, Math.round(value * 100) / 100));
}

/** Extrai prazo de expiração da resposta da IA ("até 15/08/2026" ou "até 15/08"). */
function parseDeadline(content: string): string | null {
  const match = content.match(/(?:at[ée]|venc(?:e|endo em))\s+(?:dia\s+)?(\d{1,2})\s*[\/-]\s*(\d{1,2})(?:\s*[\/-]\s*(\d{2,4}))?/i);
  if (!match) return null;
  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const yearRaw = match[3] ? Number.parseInt(match[3], 10) : new Date().getFullYear();
  const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (isNaN(date.getTime())) return null;
  date.setUTCHours(23, 59, 59, 999);
  return date.toISOString();
}

export interface ParsedAgreement {
  originalValue: number | null;
  proposedValue: number | null;
  agreedValue: number | null;
  discountPercent: number | null;
  installmentCount: number | null;
  expiresAt: string | null;
}

/**
 * Extrai os termos do acordo (valor, parcelas, desconto, prazo) da resposta
 * gerada pela IA quando a tag [ACORDO_FECHADO] está presente.
 */
export function parseAgreement(content: string): ParsedAgreement {
  const amounts = Array.from(content.matchAll(AGREEMENT_AMOUNT_RE)).map((m) => ({
    value: parseBRLAmount(m[0]),
    index: m.index ?? -1,
  }));

  const lastAgreementKeyword = Math.max(
    content.toLowerCase().lastIndexOf('acordo'),
    content.toLowerCase().lastIndexOf('fech'),
    content.toLowerCase().lastIndexOf('pagamento')
  );

  let agreedValue: number | null = null;
  if (amounts.length > 0) {
    const candidate =
      lastAgreementKeyword >= 0
        ? amounts.filter((a) => a.index >= lastAgreementKeyword).pop() ?? amounts[amounts.length - 1]
        : amounts[amounts.length - 1];
    agreedValue = candidate.value;
  }

  let originalValue: number | null = null;
  let proposedValue: number | null = null;
  const lower = content.toLowerCase();
  for (const { value, index } of amounts) {
    const windowStart = Math.max(0, index - 30);
    const window = lower.slice(windowStart, index);
    if (/original|valor\s+(?:total|inicial)/.test(window)) originalValue = value;
    if (/propost|proposta|sugerid/.test(window)) proposedValue = value;
  }
  if (originalValue === null && amounts[0]) originalValue = amounts[0].value;
  if (proposedValue !== null && agreedValue === proposedValue) proposedValue = null;

  let discountPercent: number | null = null;
  for (const match of content.matchAll(DISCOUNT_RE)) {
    const candidate = Number.parseFloat(match[1].replace(',', '.'));
    if (Number.isFinite(candidate)) {
      discountPercent = clampPercent(candidate);
      break;
    }
  }

  let installmentCount: number | null = null;
  for (const match of content.matchAll(INSTALLMENT_RE)) {
    const parsed = Number.parseInt(match[1], 10);
    if (Number.isFinite(parsed) && parsed > 1) {
      installmentCount = parsed;
      break;
    }
  }

  return {
    originalValue,
    proposedValue,
    agreedValue,
    discountPercent,
    installmentCount,
    expiresAt: parseDeadline(content),
  };
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function callLLM(
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
      if (aiProvider === 'opencode' || aiProvider === 'openai' || aiProvider === 'ollama' || aiProvider === 'openrouter' || aiProvider === 'groq') {
        const client = new OpenAI({
          apiKey: aiProvider === 'openrouter' ? apiKey : (aiProvider === 'ollama' ? 'ollama' : apiKey),
          baseURL: aiProvider === 'opencode' ? OPENCODE_BASE_URL : (aiProvider === 'openrouter' ? 'https://openrouter.ai/api/v1' : (aiProvider === 'ollama' ? `${ollamaBaseUrl.replace(/\/+$/, '')}/v1` : (aiProvider === 'groq' ? GROQ_BASE_URL : undefined)))
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
        logger.warn('Transient error in AI call', undefined, { attempt, maxRetries, errorMessage });
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

  // Guard de quarentena: caso em quarentena não recebe respostas automatizadas.
  const quarantine = await getActiveQuarantine(database, caseId, resolvedTenantId);
  if (quarantine) {
    throw new Error(`Caso em quarentena (${quarantine.status}): mensagens automáticas bloqueadas. Motivo: ${quarantine.reason || 'não informado'}.`);
  }

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

  // Resolução centralizada de IA (ADR-003): bucket 'agents' do tenant →
  // bucket assistant do tenant → default de sistema → fallback hardcoded.
  // O override de modelo por agente (supervisor/especialista/qualidade) é
  // aplicado em cada callLLM via `agentRow.model || aiModel`.
  const admin = getSupabaseAdmin();
  const ai = await resolveAIConfig({
    client: admin ?? database,
    tenantId: resolvedTenantId,
    bucket: 'agents',
  });
  const aiProvider = ai.provider;
  const aiModel = ai.model;
  const apiKey = ai.apiKey;
  const ollamaBaseUrl = ai.ollamaBaseUrl;

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
      aiText = stripThinkBlocks(await callLLM(
          `Você é um agente de cobrança. Cliente: ${caseData.name}. Dívida: R$ ${Number(caseData.updated_value || caseData.original_value).toFixed(2)}. Atraso: ${stage.diasAtraso} dias. Desconto Máximo: ${stage.effectiveMaxDiscount}%. ${domainContext} Responda a mensagem.`,
        currentHistory,
        aiProvider,
        aiModel,
        apiKey,
        ollamaBaseUrl,
        0.2
      ));
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
        const supResponse = await callLLM(supervisorPrompt, null, aiProvider, resolveAgentModel(supervisor.model, ai), apiKey, ollamaBaseUrl, Number(supervisor.temperature) || 0.1, 'json_object');
        const parsed = JSON.parse(supResponse.replace(/```json/g, '').replace(/```/g, '').trim());
        if (parsed.selected_role) routing = parsed;
      } catch (err) {
        logger.warn('Supervisor fallback reasoning triggered', undefined, { error: getErrorMessage(err) });
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

      let rawDraft: string;
      let usedTemplate = false;
      try {
        rawDraft = stripThinkBlocks(await callLLM(specialistPrompt, currentHistory, aiProvider, resolveAgentModel(specialist.model, ai), apiKey, ollamaBaseUrl, Number(specialist.temperature) || 0.2));
      } catch (specialistErr) {
        // Fallback: template ativo do tenant compatível com o estágio.
        logger.warn('Especialista falhou, usando template como fallback', undefined, { error: getErrorMessage(specialistErr), stage: stage.id });
        rawDraft = await templateFallback(database, resolvedTenantId, caseId, stage.id);
        usedTemplate = true;
      }
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

          const qualityRes = await callLLM(qualityPrompt, null, aiProvider, resolveAgentModel(qualidade.model, ai), apiKey, ollamaBaseUrl, Number(qualidade.temperature) || 0.1, 'json_object');
          const qParsed = JSON.parse(qualityRes.replace(/```json/g, '').replace(/```/g, '').trim());
          if (qParsed.corrected_response && (!qParsed.approved || qParsed.complianceScore < 90)) {
            aiText = stripThinkBlocks(qParsed.corrected_response);
          }
        } catch (qErr) {
          logger.warn('Quality agent audit skipped due to parse error', undefined, { error: getErrorMessage(qErr) });
        }
      }

      if (usedTemplate) {
        aiText = `${aiText}\n\n[Template de fallback aplicado por indisponibilidade da IA]`;
      }
    }
  } catch (error: unknown) {
    logger.error('AI API Error', undefined, { error: getErrorMessage(error) });
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
      logger.error('Background message send failed', { tenantId: resolvedTenantId, caseId }, { error: getErrorMessage(err) });

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

  // Persiste o acordo formal antes de encerrar o caso quando a IA emite
  // [ACORDO_FECHADO]. Falhas não interrompem o fluxo do chat.
  if (aiText.includes('[ACORDO_FECHADO]')) {
    const agreement = parseAgreement(aiText);
    const fallbackValue = Number(caseData.updated_value || caseData.original_value) || 0;
    const defaultExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const insert: Record<string, unknown> = {
      tenant_id: resolvedTenantId,
      client_id: relatedClient?.id ?? null,
      contract_id: relatedContract?.id ?? null,
      financial_title_id: financialTitle?.id ?? null,
      case_id: caseId,
      status: 'accepted',
      original_value: (agreement.originalValue ?? Number(caseData.original_value)) || null,
      proposed_value: agreement.proposedValue,
      agreed_value: (agreement.agreedValue ?? fallbackValue) || null,
      discount_percent: agreement.discountPercent,
      installment_count: agreement.installmentCount,
      expires_at:
        agreement.expiresAt && new Date(agreement.expiresAt).getTime() > Date.now()
          ? agreement.expiresAt
          : defaultExpiry,
      accepted_at: new Date().toISOString(),
      created_by: caseData.user_id || null,
      metadata: { source: 'ai_pipeline' },
    };

    try {
      const { data: negotiation, error: negotiationError } = await database
        .from('negotiations')
        .insert(insert)
        .select('*')
        .single();
      if (negotiationError) throw negotiationError;

      await recordAuditAction(database, {
        tenantId: resolvedTenantId,
        entityType: 'negotiation',
        entityId: negotiation.id,
        caseId,
        actorUserId: caseData.user_id || null,
        action: 'NEGOTIATION_CREATED',
        after: negotiation,
        metadata: { source: 'ai_pipeline' },
      });
    } catch (negotiationErr) {
      logger.error('Falha ao registrar acordo formal do pipeline', { tenantId: resolvedTenantId, caseId }, { error: getErrorMessage(negotiationErr) });
      try {
        await recordAuditAction(database, {
          tenantId: resolvedTenantId,
          entityType: 'negotiation',
          entityId: caseId,
          caseId,
          actorUserId: caseData.user_id || null,
          action: 'NEGOTIATION_CREATE_FAILED',
          details: getErrorMessage(negotiationErr),
          metadata: { source: 'ai_pipeline' },
        });
      } catch (auditErr) {
        logger.error('Falha ao auditar falha de registro de acordo', { tenantId: resolvedTenantId, caseId }, { error: getErrorMessage(auditErr) });
      }
    }
  }

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

/**
 * Fallback quando a LLM do especialista falha: busca o template ativo do tenant
 * compatível com o estágio e resolve as variáveis com o dado real do caso.
 * Lança erro se nenhum template estiver disponível (o caller decide).
 */
async function templateFallback(
  database: SupabaseClient,
  tenantId: string,
  caseId: string,
  stageId: string
): Promise<string> {
  const { data: template, error } = await database
    .from('message_templates')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('stage', stageId === 'especializada' ? 'especializada' : stageId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !template) {
    throw new Error('Especialista indisponível e nenhum template de fallback cadastrado para o estágio.');
  }

  const { body } = await resolveTemplateVariables(
    { supabase: database, tenantId, caseId },
    template.body
  );
  return body;
}
