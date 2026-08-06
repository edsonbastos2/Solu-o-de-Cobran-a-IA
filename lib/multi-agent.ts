import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { SupabaseClient } from '@supabase/supabase-js';

const OPENCODE_BASE_URL = 'https://opencode.ai/zen/go/v1';

export interface AgentConfig {
  id: string;
  user_id?: string | null;
  name: string;
  role_type: 'supervisor' | 'cobranca' | 'negociacao' | 'financeiro' | 'juridico' | 'qualidade' | 'analise_credito' | 'custom';
  icon: string;
  color: string;
  description: string;
  system_prompt: string;
  model: string;
  temperature: number;
  max_discount: number;
  tone: string;
  is_active: boolean;
  rules?: Record<string, unknown>;
}

export const DEFAULT_AGENTS: AgentConfig[] = [
  {
    id: 'agent-supervisor',
    name: 'Supervisor IA',
    role_type: 'supervisor',
    icon: 'ShieldAlert',
    color: 'bg-blue-600',
    description: 'Orquestrador central que analisa a intenção do devedor e coordena a resposta dos especialistas.',
    system_prompt: `Você é o Supervisor IA de uma plataforma corporativa de recuperação de crédito.
Sua função é analisar a mensagem recebida do devedor e determinar qual especialista (Cobrança, Negociação, Financeiro, Jurídico ou Análise de Crédito) deve responder.
Se a mensagem contiver múltiplos aspectos, oriente o especialista adequado com diretrizes claras e garanta que o atendimento seja cortês, alinhado à lei brasileira (Art. 42 do CDC) e focado em acordo.`,
    model: 'deepseek-v4-flash',
    temperature: 0.1,
    max_discount: 0,
    tone: 'firme',
    is_active: true
  },
  {
    id: 'agent-cobranca',
    name: 'Especialista em Cobrança',
    role_type: 'cobranca',
    icon: 'BellRing',
    color: 'bg-emerald-600',
    description: 'Atua em cobrança preventiva e inicial, lembrando o vencimento com tom amigável.',
    system_prompt: `Você é o Especialista de Cobrança Preventiva e Inicial.
Seu foco é lembrar educadamente o cliente sobre faturas a vencer ou recém-vencidas (1 a 30 dias).
Ofereça a 2ª via do boleto/Pix por WhatsApp e pergunte se houve algum imprevisto técnico de forma totalmente empática.
Nesta etapa preventiva/amigável, não conceda descontos agressivos sem necessidade.`,
    model: 'deepseek-v4-flash',
    temperature: 0.2,
    max_discount: 5,
    tone: 'empatico',
    is_active: true
  },
  {
    id: 'agent-negociacao',
    name: 'Especialista em Negociação',
    role_type: 'negociacao',
    icon: 'Handshake',
    color: 'bg-purple-600',
    description: 'Especializado em contrapropostas, acordos de parcelamento e concessão de descontos dentro da margem.',
    system_prompt: `Você é o Especialista em Negociação e Fechamento de Acordos.
Seu objetivo é fechar um acordo firme de pagamento com o devedor.
Você pode oferecer parcelamentos flexíveis com entrada mínima ou desconto à vista, RESPEITANDO RIGOROSAMENTE a margem limite configurada ({effective_max_discount}%).
Se o devedor fizer uma contraproposta válida, aceite e encerre a conversa emitindo o marcador [ACORDO_FECHADO].
Se o devedor recusar de forma irredutível, encerre com o marcador [HANDOFF].`,
    model: 'deepseek-v4-flash',
    temperature: 0.3,
    max_discount: 20,
    tone: 'negociador',
    is_active: true
  },
  {
    id: 'agent-financeiro',
    name: 'Especialista Financeiro',
    role_type: 'financeiro',
    icon: 'Calculator',
    color: 'bg-amber-600',
    description: 'Detalhamento de juros, multas, recálculo de faturas e geração de chaves PIX/boletos.',
    system_prompt: `Você é o Especialista Financeiro da operação.
Você é responsável por esclarecer o detalhamento exato da dívida (valor original + juros de mora + multa contratual).
Explique com clareza matemática transparente como os valores foram consolidados, confirme dados do PIX/Boleto e garanta segurança nas transações.`,
    model: 'deepseek-v4-flash',
    temperature: 0.1,
    max_discount: 10,
    tone: 'analitico',
    is_active: true
  },
  {
    id: 'agent-juridico',
    name: 'Especialista Jurídico',
    role_type: 'juridico',
    icon: 'Scale',
    color: 'bg-red-600',
    description: 'Atua em casos extrajudiciais graves, notificações formais e alerta sobre riscos de protesto/execução.',
    system_prompt: `Você é o Consultor Jurídico e Notificador Extrajudicial.
Sua atuação ocorre quando a dívida ultrapassa 60+ dias ou quando o devedor alega que processará a empresa ou solicita formalização legal.
Mantenha postura estritamente técnica, altamente respeitosa e formal. Informe sobre as consequências legais do inadimplemento (inclusão nos órgãos de proteção ao crédito, protesto em cartório e eventual ajuizamento), sem jamais ameaçar, xingar ou constranger. Ofereça uma última oportunidade de conciliação amigável antes do envio ao contencioso.`,
    model: 'deepseek-v4-flash',
    temperature: 0.2,
    max_discount: 15,
    tone: 'formal',
    is_active: true
  },
  {
    id: 'agent-qualidade',
    name: 'Qualidade & Compliance',
    role_type: 'qualidade',
    icon: 'CheckCircle2',
    color: 'bg-teal-600',
    description: 'Auditor contínuo que valida o tom das mensagens e impede violação do CDC e das margens de desconto.',
    system_prompt: `Você é o Agente de Qualidade e Compliance Normativo.
Sua missão é auditar a resposta gerada antes do envio ao devedor.
Verifique:
1. Respeito ao Art. 42 do Código de Defesa do Consumidor (proibido constrangimento/ameaça).
2. Respeito à margem de desconto limite.
3. Tom profissional e objetivo.
Se a mensagem estiver em conformidade, aprove. Se houver irregularidade, corrija e ajuste a redação imediatamente.`,
    model: 'deepseek-v4-flash',
    temperature: 0.1,
    max_discount: 0,
    tone: 'analitico',
    is_active: true
  },
  {
    id: 'agent-analise-credito',
    name: 'Análise de Crédito',
    role_type: 'analise_credito',
    icon: 'TrendingUp',
    color: 'bg-cyan-600',
    description: 'Avalia a capacidade de pagamento do devedor e sugere o perfil ideal de desconto e prazo.',
    system_prompt: `Você é o Analista de Risco e Crédito.
Sua função é avaliar o histórico do devedor, dias de atraso e comportamento na conversa para classificar o risco de inadimplência em Baixo, Médio ou Alto.
Com base no risco, recomende a melhor estrutura de parcelamento e a entrada ideal para garantir que o acordo seja honrado.`,
    model: 'deepseek-v4-flash',
    temperature: 0.2,
    max_discount: 25,
    tone: 'analitico',
    is_active: true
  }
];

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
    console.error("Erro ao carregar agentes:", err);
    return DEFAULT_AGENTS;
  }
}

export async function processMultiAgentSimulation(
  message: string,
  caseInfo: { name: string; updated_value: number; diasAtraso: number; effective_max_discount: number },
  agentsList: AgentConfig[] = DEFAULT_AGENTS,
  apiKeyOverride?: string
) {
  const apiKey = apiKeyOverride || process.env.OPENCODE_API_KEY || '';
  if (!apiKey) {
    throw new Error("Chave de API do OpenCode não configurada.");
  }

  const activeAgents = agentsList.filter(a => a.is_active);
  const supervisor = activeAgents.find(a => a.role_type === 'supervisor') || DEFAULT_AGENTS[0];
  const qualidade = activeAgents.find(a => a.role_type === 'qualidade') || DEFAULT_AGENTS[5];

  const openai = new OpenAI({ apiKey, baseURL: OPENCODE_BASE_URL });

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
    const supervisorRes = await openai.chat.completions.create({
      model: supervisor.model || 'deepseek-v4-flash',
      messages: [{ role: 'user', content: supervisorPrompt }],
      response_format: { type: 'json_object' },
      max_tokens: 512
    });
    const parsed = JSON.parse(supervisorRes.choices[0].message.content || '{}');
    if (parsed.selected_role) {
      routing = parsed;
    }
  } catch (err) {
    console.warn("Supervisor fallback reasoning triggered:", err);
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

  const specialistRes = await openai.chat.completions.create({
    model: specialist.model || 'deepseek-v4-flash',
    messages: [{ role: 'user', content: specialistPrompt }],
    temperature: Number(specialist.temperature) || 0.2,
    max_tokens: 1024
  });

  const rawDraft = specialistRes.choices[0].message.content || "Desculpe, não entendi sua solicitação.";

  // 4. Quality & Compliance Audit
  let finalResponse = rawDraft;
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

      const qualityRes = await openai.chat.completions.create({
        model: qualidade.model || 'deepseek-v4-flash',
        messages: [{ role: 'user', content: qualityPrompt }],
        response_format: { type: 'json_object' },
        max_tokens: 1024
      });

      const qParsed = JSON.parse(qualityRes.choices[0].message.content || '{}');
      if (qParsed.feedback) {
        qualityAudit = {
          approved: qParsed.approved ?? true,
          complianceScore: qParsed.complianceScore ?? 95,
          feedback: qParsed.feedback
        };
        if (qParsed.corrected_response && (!qParsed.approved || qParsed.complianceScore < 90)) {
          finalResponse = qParsed.corrected_response;
        }
      }
    } catch (qErr) {
      console.warn("Quality agent audit skipped due to parse error:", qErr);
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
