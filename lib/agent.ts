import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { getCollectionStage } from '@/lib/finance';

const SYSTEM_PROMPT = `Você é um agente de cobrança de dívidas educado, focado e objetivo trabalhando para um escritório corporativo e advocatício.
Seu objetivo é fechar um acordo de pagamento com o devedor respeitando rigorosamente o ESTÁGIO DE COBRANÇA e as Regras de Negócio.

ESTÁGIO ATUAL DE COBRANÇA: {stage_name}
DIAS EM ATRASO: {dias_atraso} dia(s)
MARGEM DE DESCONTO MÁXIMA PERMITIDA PARA ESTE ESTÁGIO: {effective_max_discount}% (Mínimo aceitável: R$ {min_acceptable})

OBJETIVOS E DIRETRIZES DO ESTÁGIO:
{stage_guidelines}

REGRAS ESTRITAS DE CONDUTA:
1. Você não pode ofender, ameaçar ou constranger o devedor em NENHUMA hipótese.
2. Você NUNCA pode oferecer desconto superior à margem permitida para este estágio ({effective_max_discount}%).
3. Na Cobrança Preventiva (antes do vencimento), NENHUM desconto pode ser oferecido (margem 0%). Apenas lembre do vencimento e ofereça o boleto/Pix.
4. Na Cobrança Amigável (1 a 30 dias de atraso), pergunte empaticamente o motivo do atraso ("Houve algum problema?"), ofereça a 2ª via do boleto/Pix, pergunte se prefere parcelar e qual a melhor data de pagamento.
5. Na Cobrança Negocial (31 a 180 dias), aplique a política da empresa com opções de desconto à vista, parcelamento flexível com entrada mínima e desconto sobre juros.
6. Na Cobrança Especializada (>180 dias ou sem resposta), informe educadamente que o caso está sendo encaminhado ao supervisor especializado/jurídico e inclua o comando [HANDOFF].
7. Se o devedor solicitar atendimento humano, ficar confuso ou agressivo, encerre dizendo: "[HANDOFF] Transferindo para um de nossos supervisores especialistas."
8. APENAS quando o devedor aceitar expressamente os valores e condições, encerre dizendo: "[ACORDO_FECHADO] Perfeito! Confirmamos seu acordo. Estamos gerando o link/Pix para pagamento."
9. FOCO ABSOLUTO: Você é EXCLUSIVAMENTE um assistente de cobrança e renegociação. Se o devedor conversar sobre qualquer outro assunto fora do escopo financeiro, recuse educadamente e redirecione para a dívida.

INFORMAÇÕES DO CASO:
Nome do Cliente: {name}
Valor Atualizado da Dívida: R$ {updated_value}
Data de Vencimento: {due_date_formatted}`;

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

  // 4. Construct Prompt according to Collection Stage
  const minAcceptable = caseData.updated_value * (1 - stage.effectiveMaxDiscount / 100);
  
  let stageGuidelinesText = "";
  if (stage.id === 'preventiva') {
    stageGuidelinesText = `- OBJETIVO: Lembrar do vencimento e prevenir atrasos.\n- Pergunte ao cliente se deseja receber o boleto/Pix via WhatsApp.\n- Esclareça dúvidas sobre o pagamento.\n- NÃO ofereça descontos nesta fase.`;
  } else if (stage.id === 'amigavel') {
    stageGuidelinesText = `- OBJETIVO: Entender o motivo do atraso e facilitar a quitação.\n- Pergunte empaticamente: "Houve algum problema com o recebimento do boleto?"\n- Pergunta obrigatória: "Deseja a 2ª via do boleto por WhatsApp?" ou "Prefere parcelar?"\n- Pergunte qual a melhor data para pagamento.\n- Desconto máximo permitido: 5%.`;
  } else if (stage.id === 'negocial') {
    stageGuidelinesText = `- OBJETIVO: Aplicar regras de negociação da empresa.\n- Ofereça opções de desconto à vista e parcelamento com entrada mínima.\n- Desconto máximo nesta fase: ${stage.effectiveMaxDiscount}%.`;
  } else {
    stageGuidelinesText = `- OBJETIVO: Transferir para cobrança especializada/supervisor.\n- A dívida tem grande atraso (${stage.diasAtraso} dias) ou requer suporte técnico.\n- Diga que o caso foi encaminhado para o supervisor responsável para análise especial e inclua a tag [HANDOFF].`;
  }

  const systemPrompt = SYSTEM_PROMPT
    .replace('{stage_name}', stage.name)
    .replace('{dias_atraso}', stage.diasAtraso.toString())
    .replace(/{effective_max_discount}/g, stage.effectiveMaxDiscount.toString())
    .replace('{min_acceptable}', minAcceptable.toFixed(2))
    .replace('{stage_guidelines}', stageGuidelinesText)
    .replace('{name}', caseData.name)
    .replace('{updated_value}', caseData.updated_value.toFixed(2))
    .replace('{due_date_formatted}', new Date(caseData.due_date).toLocaleDateString('pt-BR'));

  let aiText = "Desculpe, ocorreu um erro de comunicação com a inteligência artificial.";

  try {
    if (aiProvider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey });
      
      const contents = historyData?.map((msg: any) => ({
        role: (msg.role === 'ai' || msg.role === 'human') ? 'model' : 'user',
        parts: [{ text: msg.content }]
      })) || [];
      contents.push({ role: 'user', parts: [{ text: message }] });

      const response = await ai.models.generateContent({
        model: aiModel,
        contents: contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.2
        }
      });
      aiText = response.text || "Desculpe, não entendi.";
      
    } else if (aiProvider === 'openai') {
      const openai = new OpenAI({ apiKey });
      
      const messages: any[] = [
        { role: 'system', content: systemPrompt },
        ...(historyData?.map((msg: any) => ({
          role: (msg.role === 'ai' || msg.role === 'human') ? 'assistant' : 'user',
          content: msg.content
        })) || []),
        { role: 'user', content: message }
      ];

      const response = await openai.chat.completions.create({
        model: aiModel,
        messages: messages,
        temperature: 0.2
      });
      aiText = response.choices[0].message.content || "Desculpe, não entendi.";

    } else if (aiProvider === 'anthropic') {
      const anthropic = new Anthropic({ apiKey });
      
      const messages: any[] = [
        ...(historyData?.map((msg: any) => ({
          role: (msg.role === 'ai' || msg.role === 'human') ? 'assistant' : 'user',
          content: msg.content
        })) || []),
        { role: 'user', content: message }
      ];

      const response = await anthropic.messages.create({
        model: aiModel,
        system: systemPrompt,
        max_tokens: 1024,
        messages: messages,
        temperature: 0.2
      });
      
      if (response.content[0].type === 'text') {
        aiText = response.content[0].text;
      }
    } else if (aiProvider === 'ollama' || aiProvider === 'openrouter') {
      const openai = new OpenAI({ 
        apiKey: aiProvider === 'openrouter' ? apiKey : 'ollama', 
        baseURL: aiProvider === 'openrouter' ? 'https://openrouter.ai/api/v1' : `${ollamaBaseUrl.replace(/\/+$/, '')}/v1` 
      });
      
      const messages: any[] = [
        { role: 'system', content: systemPrompt },
        ...(historyData?.map((msg: any) => ({
          role: (msg.role === 'ai' || msg.role === 'human') ? 'assistant' : 'user',
          content: msg.content
        })) || []),
        { role: 'user', content: message }
      ];

      const response = await openai.chat.completions.create({
        model: aiModel,
        messages: messages,
        temperature: 0.2
      });
      aiText = response.choices[0].message.content || "Desculpe, não entendi.";
    }
  } catch (error: any) {
    console.error("AI API Error:", error);
    throw new Error(`Erro na API do ${aiProvider}: ${error.message || String(error)}`);
  }

  // 5. Save AI response
  await supabase.from('messages').insert({
    case_id: caseId,
    role: 'ai',
    content: aiText
  });

  // Clean up internal tags for WhatsApp sending
  const cleanAiText = aiText
    .replace('[HANDOFF]', '')
    .replace('[ACORDO_FECHADO]', '')
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
