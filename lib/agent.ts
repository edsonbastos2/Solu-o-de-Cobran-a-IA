import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { getCollectionStage } from '@/lib/finance';
import { fetchAgents, AgentConfig } from '@/lib/multi-agent';

// Helper function to call the selected AI provider
async function callLLM(
  prompt: string,
  history: any[] | null,
  aiProvider: string,
  aiModel: string,
  apiKey: string,
  ollamaBaseUrl: string,
  temperature: number,
  responseFormat?: 'json_object'
): Promise<string> {
  if (aiProvider === 'gemini') {
    const ai = new GoogleGenAI({ apiKey });
    
    // For supervisor and quality, we don't necessarily need the full history as they operate on the current message/draft,
    // but for specialist we do. We pass history as text or format it.
    // To simplify across all providers and roles, we will just format the history into the system prompt 
    // or as a continuous conversation if it's the specialist.
    
    let contents: any[] = [];
    if (history && history.length > 0) {
       contents = history.map((msg: any) => ({
        role: (msg.role === 'ai' || msg.role === 'human') ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));
    } else {
       // If no history, just need an empty contents array to append to
    }
    // We expect the 'prompt' to contain the current task. 
    // Wait, Gemini systemInstruction is passed in config. We will treat 'prompt' as systemInstruction 
    // if history is provided, and the last message is already in history.
    // Actually, to make it consistent, if history is provided, 'prompt' is system Instruction, and we don't append a new message.
    // If history is not provided, 'prompt' is just the content of a new user message.

    const reqContents = history ? contents : [{ role: 'user', parts: [{ text: prompt }] }];

    const response = await ai.models.generateContent({
      model: aiModel,
      contents: reqContents,
      config: {
        systemInstruction: history ? prompt : undefined,
        temperature,
        responseMimeType: responseFormat === 'json_object' ? 'application/json' : 'text/plain'
      }
    });
    return response.text || "";
    
  } else if (aiProvider === 'openai' || aiProvider === 'ollama' || aiProvider === 'openrouter') {
    const client = new OpenAI({ 
      apiKey: aiProvider === 'openrouter' ? apiKey : (aiProvider === 'ollama' ? 'ollama' : apiKey), 
      baseURL: aiProvider === 'openrouter' ? 'https://openrouter.ai/api/v1' : (aiProvider === 'ollama' ? `${ollamaBaseUrl.replace(/\/+$/, '')}/v1` : undefined) 
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
      response_format: responseFormat === 'json_object' ? { type: 'json_object' } : undefined
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
}

export async function processChat(caseId: string, message: string) {
  if (!supabase) {
    throw new Error("Supabase não configurado.");
  }

  // 1. Fetch case details
  const { data: caseData, error: caseError } = await supabase
    .from('cases')
    .select('*')
    .eq('id', caseId)
    .single();

  if (caseError || !caseData) {
    throw new Error("Caso não encontrado");
  }

  // Calculate collection stage
  const stage = getCollectionStage(
    caseData.due_date,
    caseData.max_discount_margin,
    caseData.status
  );

  // Fetch AI configuration from user profile
  let aiProvider = 'gemini';
  let aiModel = 'gemini-3.5-flash';
  let apiKey = process.env.GEMINI_API_KEY || '';
  let ollamaBaseUrl = 'http://localhost:11434';

  if (caseData.user_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', caseData.user_id)
      .single();

    if (profile) {
      aiProvider = profile.ai_provider || 'gemini';
      aiModel = profile.ai_model || (aiProvider === 'gemini' ? 'gemini-3.5-flash' : aiProvider === 'openai' ? 'gpt-4o-mini' : aiProvider === 'ollama' ? 'llama3' : aiProvider === 'openrouter' ? 'meta-llama/llama-3-8b-instruct:free' : 'claude-3-haiku');
      
      if (aiProvider === 'gemini') {
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

  // 2. Fetch conversation history
  const { data: historyData, error: historyError } = await supabase
    .from('messages')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true });

  if (historyError) throw historyError;

  // 3. Save user message
  await supabase.from('messages').insert({
    case_id: caseId,
    role: 'user',
    content: message
  });
  
  // Update history with new message for the AI call
  const currentHistory = [...(historyData || []), { role: 'user', content: message }];

  // 4. Fetch Configured Agents
  const agentsList = await fetchAgents(caseData.user_id);
  const activeAgents = agentsList.filter(a => a.is_active);
  const supervisor = activeAgents.find(a => a.role_type === 'supervisor');
  const qualidade = activeAgents.find(a => a.role_type === 'qualidade');
  
  let aiText = "Desculpe, ocorreu um erro de comunicação com a inteligência artificial.";
  
  try {
    if (!supervisor || activeAgents.length <= 1) {
      // Fallback to single agent mode if multi-agent is not configured properly
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
      // MULTI-AGENT WORKFLOW
      
      // Step A: Supervisor Classification
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
      
      // Step B: Specialist Draft
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
      
      // Step C: Quality Check
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

  // 5. Save AI response
  await supabase.from('messages').insert({
    case_id: caseId,
    role: 'ai',
    content: aiText
  });

  // Clean up internal tags for WhatsApp sending
  const cleanAiText = aiText
    .replace(/\[HANDOFF\]/g, '')
    .replace(/\[ACORDO_FECHADO\]/g, '')
    .trim();

  if (caseData.phone) {
    sendWhatsAppMessage(caseData.phone, cleanAiText, caseData.user_id).catch(err => {
      console.error("Error in background WhatsApp send:", err);
    });
  }

  // 6. Check for Handoff or Close
  let newStatus = caseData.status;
  if (newStatus === 'not_started') newStatus = 'in_negotiation';
  if (aiText.includes('[HANDOFF]') || stage.id === 'especializada') newStatus = 'needs_attention';
  if (aiText.includes('[ACORDO_FECHADO]')) newStatus = 'closed';

  if (newStatus !== caseData.status) {
    await supabase.from('cases').update({ status: newStatus }).eq('id', caseId);
  }

  return { text: aiText, newStatus, stage };
}
