import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

const SYSTEM_PROMPT = `Você é um agente de cobrança de dívidas educado, focado e objetivo trabalhando para um escritório de advocacia.
Seu objetivo é fechar um acordo de pagamento com o devedor.

REGRAS ESTRITAS:
1. Você não pode ofender, ameaçar ou constranger o devedor em NENHUMA hipótese.
2. Você pode oferecer descontos ou parcelamentos, MAS o valor final NUNCA pode ser inferior ao (Valor Atualizado - Margem de Desconto).
3. Se o usuário estiver confuso, pedir para falar com humano, ou ficar agressivo, encerre a negociação e diga: "[HANDOFF] Transferindo para um de nossos especialistas humanos."
4. Você deve usar um tom corporativo, mas acessível, adequado para o WhatsApp.
5. ANTES de fechar o acordo, você DEVE confirmar claramente com o devedor se ele aceita os valores e as condições propostas (por exemplo, perguntando "Você confirma este acordo para pagamento via Pix/boleto?").
6. APENAS quando o devedor disser expressamente que concorda ou aceita os valores (seja à vista ou parcelado), encerre dizendo: "[ACORDO_FECHADO] Perfeito, estamos gerando o link/Pix ou boleto para pagamento."
7. FOCO ABSOLUTO: Você é EXCLUSIVAMENTE um agente de cobrança. Se o devedor perguntar ou tentar conversar sobre QUALQUER outro assunto fora do escopo financeiro, da dívida ou da negociação (ex: receitas, programação, política, piadas, ou assuntos gerais), você DEVE recusar educadamente e redirecionar a conversa para a negociação da dívida. Diga algo como: "Sou um assistente virtual focado apenas em renegociação de pendências financeiras e não posso ajudar com outros assuntos. Voltando à nossa proposta..."

INFORMAÇÕES DO CASO:
Nome: {name}
Valor Atualizado da Dívida: R$ {updated_value}
Desconto Máximo Autorizado: {max_discount_margin}% (ou seja, o mínimo aceitável é R$ {min_acceptable})`;

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
      aiModel = profile.ai_model || (aiProvider === 'gemini' ? 'gemini-3.5-flash' : aiProvider === 'openai' ? 'gpt-4o-mini' : aiProvider === 'ollama' ? 'llama3' : 'claude-3-haiku');
      
      if (aiProvider === 'gemini') {
        apiKey = profile.gemini_api_key || process.env.GEMINI_API_KEY || '';
      } else if (aiProvider === 'openai') {
        apiKey = profile.openai_api_key || process.env.OPENAI_API_KEY || '';
      } else if (aiProvider === 'anthropic') {
        apiKey = profile.anthropic_api_key || process.env.ANTHROPIC_API_KEY || '';
      } else if (aiProvider === 'ollama') {
        ollamaBaseUrl = profile.ollama_base_url || 'http://localhost:11434';
        apiKey = 'ollama-no-key'; // Ollama doesn't require an API key by default
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

  // 4. Construct Prompt
  const minAcceptable = caseData.updated_value * (1 - caseData.max_discount_margin / 100);
  const systemPrompt = SYSTEM_PROMPT
    .replace('{name}', caseData.name)
    .replace('{updated_value}', caseData.updated_value.toFixed(2))
    .replace('{max_discount_margin}', caseData.max_discount_margin.toString())
    .replace('{min_acceptable}', minAcceptable.toFixed(2));

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
    } else if (aiProvider === 'ollama') {
      const openai = new OpenAI({ 
        apiKey: 'ollama', 
        baseURL: `${ollamaBaseUrl.replace(/\/+$/, '')}/v1` 
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

  // Clean up internal tags for the user
  const cleanAiText = aiText
    .replace('[HANDOFF]', '')
    .replace('[ACORDO_FECHADO]', '')
    .trim();

  // Send to real WhatsApp (if configured)
  if (caseData.phone) {
    // Run asynchronously, don't await so we can return response quickly
    sendWhatsAppMessage(caseData.phone, cleanAiText).catch(err => {
      console.error("Error in background WhatsApp send:", err);
    });
  }

  // 6. Check for Handoff or Close
  let newStatus = caseData.status;
  if (newStatus === 'not_started') newStatus = 'in_negotiation';
  if (aiText.includes('[HANDOFF]')) newStatus = 'needs_attention';
  if (aiText.includes('[ACORDO_FECHADO]')) newStatus = 'closed';

  if (newStatus !== caseData.status) {
    await supabase.from('cases').update({ status: newStatus }).eq('id', caseId);
  }

  return { text: aiText, newStatus };
}
