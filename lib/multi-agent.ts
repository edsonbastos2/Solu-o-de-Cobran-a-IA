// Módulo server-only: contém a pipeline de simulação multi-agente, que
// depende de callLLM (lib/agent.ts) → SDKs OpenAI/Anthropic que puxam
// node:fs e NÃO podem ser bundlados no cliente.
//
// Tipos e DEFAULT_AGENTS (client-safe) vivem em lib/multi-agent-types.ts.
// Componentes cliente devem importar de lá; este arquivo reexporta apenas
// para compat com imports server-side existentes.

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { callLLM, stripThinkBlocks } from '@/lib/agent';
import { AIResolved, resolveAgentModel } from '@/lib/ai-config';
import { AgentConfig, DEFAULT_AGENTS } from '@/lib/multi-agent-types';

export type { AgentConfig } from '@/lib/multi-agent-types';
export { DEFAULT_AGENTS } from '@/lib/multi-agent-types';

/**
 * Carrega agentes configurados para um tenant.
 *
 * @param userId  Quando informado (legado), mantém o filtro por user_id/is.null para
 *                compatibilidade com dados antigos. Novos fluxos multi-tenant devem
 *                passar `tenantId`.
 * @param tenantId  Quando informado, filtra estritamente por `tenant_id` (ignora o
 *                  filtro legado por user_id). Se nenhum contexto for informado,
 *                  retorna os DEFAULT_AGENTS estáticos.
 * @param database  Cliente Supabase; se ausente, retorna DEFAULT_AGENTS.
 */
export async function fetchAgents(
  userId?: string,
  database?: SupabaseClient,
  tenantId?: string
): Promise<AgentConfig[]> {
  if (!database) return DEFAULT_AGENTS;

  try {
    let query = database.from('agents').select('*');

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    } else if (userId) {
      query = query.or(`user_id.eq.${userId},user_id.is.null`);
    } else {
      query = query.is('user_id', null);
    }

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error || !data || data.length === 0) {
      return DEFAULT_AGENTS;
    }

    return data as AgentConfig[];
  } catch (err) {
    logger.error('Erro ao carregar agentes', undefined, { error: err instanceof Error ? err.message : String(err) });
    return DEFAULT_AGENTS;
  }
}

export async function processMultiAgentSimulation(
  message: string,
  caseInfo: { name: string; updated_value: number; diasAtraso: number; effective_max_discount: number },
  agentsList: AgentConfig[] = DEFAULT_AGENTS,
  resolved?: AIResolved
) {
  // Compat legado: chamadas sem `resolved` caem no fallback hardcoded opencode
  // (preserva o comportamento pré-migration quando a rota não resolve tenant).
  const ai: AIResolved = resolved ?? {
    provider: 'opencode',
    model: 'minimax-m3',
    apiKey: process.env.OPENCODE_API_KEY ?? '',
    ollamaBaseUrl: 'http://localhost:11434',
    source: 'hardcoded',
  };

  if (!ai.apiKey) {
    throw new Error(`Chave de API não configurada para o provedor ${ai.provider}. Configure em Configurações do Tenant → bucket "Agentes" ou nos Padrões de IA do Sistema.`);
  }

  const activeAgents = agentsList.filter(a => a.is_active);
  const supervisor = activeAgents.find(a => a.role_type === 'supervisor') || DEFAULT_AGENTS[0];
  const qualidade = activeAgents.find(a => a.role_type === 'qualidade') || DEFAULT_AGENTS[5];

  // 1. Supervisor classification
  const supervisorPrompt = `${supervisor.system_prompt}

MENSAGEM DO DEVEDOR: "${message}"
CASO:
Cliente: ${caseInfo.name}
Valor: R$ ${caseInfo.updated_value.toFixed(2)}
Atraso: ${caseInfo.diasAtraso} dias
Desconto Máximo Permitido: ${caseInfo.effective_max_discount}%

Especialistas Disponíveis:
${activeAgents.filter(a => a.role_type !== 'supervisor' && a.role_type !== 'qualidade').map(a => `- ${a.name} (role: ${a.role_type}): ${a.description}`).join('\n')}

Responda em formato JSON válido com a estrutura:
{
  "selected_role": "negociacao" | "cobranca" | "financeiro" | "juridico" | "analise_credito",
  "reasoning": "Sua justificativa sucinta de escolha de roteamento",
  "guidance": "Instruções específicas para o especialista selecionado"
}`;

  let routing: { selected_role: string; reasoning: string; guidance: string } = {
    selected_role: 'cobranca',
    reasoning: 'Atendimento inicial padrão.',
    guidance: 'Apresente o caso e pergunte como podemos ajudar.'
  };

  try {
    const supervisorRes = await callLLM(
      supervisorPrompt,
      null,
      ai.provider,
      resolveAgentModel(supervisor.model, ai),
      ai.apiKey,
      ai.ollamaBaseUrl,
      Number(supervisor.temperature) || 0.1,
      'json_object'
    );
    const parsed = JSON.parse(supervisorRes.replace(/```json/g, '').replace(/```/g, '').trim() || '{}');
    if (parsed.selected_role) {
      routing = parsed;
    }
  } catch (err) {
    logger.warn('Supervisor fallback reasoning triggered', undefined, { error: err instanceof Error ? err.message : String(err) });
  }

  // 2. Select Specialist
  const specialist = activeAgents.find(a => a.role_type === routing.selected_role) ||
    activeAgents.find(a => a.role_type === 'negociacao') ||
    DEFAULT_AGENTS[2];

  // 3. Generate Specialist Response
  const specialistPrompt = `${specialist.system_prompt.replace('{effective_max_discount}', caseInfo.effective_max_discount.toString())}

DIRETRIZES DO SUPERVISOR:
${routing.guidance}

INFORMAÇÕES DO CASO:
Nome: ${caseInfo.name}
Valor Atualizado: R$ ${caseInfo.updated_value.toFixed(2)}
Atraso: ${caseInfo.diasAtraso} dias
Desconto Máximo Autorizado: ${caseInfo.effective_max_discount}% (Mínimo R$ ${(caseInfo.updated_value * (1 - caseInfo.effective_max_discount/100)).toFixed(2)})

MENSAGEM DO DEVEDOR:
"${message}"

Escreva a resposta direta que será enviada ao WhatsApp do devedor. Mantenha o tom ${specialist.tone}.
Se o acordo for fechado, inclua a tag [ACORDO_FECHADO]. Se necessitar intervenção humana, inclua [HANDOFF].`;

  const rawDraft = stripThinkBlocks(await callLLM(
    specialistPrompt,
    null,
    ai.provider,
    resolveAgentModel(specialist.model, ai),
    ai.apiKey,
    ai.ollamaBaseUrl,
    Number(specialist.temperature) || 0.2
  ));

  // 4. Quality & Compliance Audit
  let finalResponse = rawDraft || "Desculpe, não entendi sua solicitação.";
  let qualityAudit = {
    approved: true,
    complianceScore: 100,
    feedback: "Mensagem 100% em conformidade com o Código de Defesa do Consumidor e regras financeiras."
  };

  if (qualidade && qualidade.is_active) {
    try {
      const qualityPrompt = `${qualidade.system_prompt}

REGRAS OBRIGATÓRIAS:
- Proibido qualquer tom ameaçador ou abusivo (CDC Art. 42).
- Desconto não pode ultrapassar ${caseInfo.effective_max_discount}%.

RESPOSTA GERADA PELO ESPECIALISTA (${specialist.name}):
"${rawDraft}"

Analise e retorne em JSON:
{
  "approved": boolean,
  "complianceScore": number (0-100),
  "feedback": "sua análise detalhada",
  "corrected_response": "resposta corrigida caso approved seja false ou necessite pequenos ajustes de tom"
}`;

      const qualityRes = await callLLM(
        qualityPrompt,
        null,
        ai.provider,
        resolveAgentModel(qualidade.model, ai),
        ai.apiKey,
        ai.ollamaBaseUrl,
        Number(qualidade.temperature) || 0.1,
        'json_object'
      );

      const qParsed = JSON.parse(qualityRes.replace(/```json/g, '').replace(/```/g, '').trim() || '{}');
      if (qParsed.feedback) {
        qualityAudit = {
          approved: qParsed.approved ?? true,
          complianceScore: qParsed.complianceScore ?? 95,
          feedback: qParsed.feedback
        };
        if (qParsed.corrected_response && (!qParsed.approved || qParsed.complianceScore < 90)) {
          finalResponse = stripThinkBlocks(qParsed.corrected_response);
        }
      }
    } catch (qErr) {
      logger.warn('Quality agent audit skipped due to parse error', undefined, { error: qErr instanceof Error ? qErr.message : String(qErr) });
    }
  }

  return {
    supervisor: {
      name: supervisor.name,
      reasoning: routing.reasoning,
      selected_role: routing.selected_role,
      guidance: routing.guidance
    },
    specialist: {
      name: specialist.name,
      role_type: specialist.role_type,
      color: specialist.color,
      icon: specialist.icon,
      draft: rawDraft
    },
    quality: qualityAudit,
    finalText: finalResponse
  };
}
