import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `Você é um agente de cobrança de dívidas educado, focado e objetivo trabalhando para um escritório de advocacia.
Seu objetivo é fechar um acordo de pagamento com o devedor.

REGRAS ESTritas:
1. Você não pode ofender, ameaçar ou constranger o devedor em NENHUMA hipótese.
2. Você pode oferecer descontos ou parcelamentos, MAS o valor final NUNCA pode ser inferior ao (Valor Atualizado - Margem de Desconto).
3. Se o usuário estiver confuso, pedir para falar com humano, ou ficar agressivo, encerre a negociação e diga: "[HANDOFF] Transferindo para um de nossos especialistas humanos."
4. Você deve usar um tom corporativo, mas acessível, adequado para o WhatsApp.
5. ANTES de fechar o acordo, você DEVE confirmar claramente com o devedor se ele aceita os valores e as condições propostas (por exemplo, perguntando "Você confirma este acordo para pagamento via Pix/boleto?").
6. APENAS quando o devedor disser expressamente que concorda ou aceita os valores (seja à vista ou parcelado), encerre dizendo: "[ACORDO_FECHADO] Perfeito, estamos gerando o link/Pix ou boleto para pagamento."

INFORMAÇÕES DO CASO:
Nome: {name}
Valor Atualizado da Dívida: R$ {updated_value}
Desconto Máximo Autorizado: {max_discount_margin}% (ou seja, o mínimo aceitável é R$ {min_acceptable})
`;

export async function POST(req: NextRequest) {
  try {
    const { caseId, message } = await req.json();

    // In a real scenario, we check if supabase client exists and is valid
    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
    }

    // 1. Fetch case details
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .single();

    if (caseError || !caseData) {
      return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
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

    const contents = historyData?.map((msg: any) => ({
      role: (msg.role === 'ai' || msg.role === 'human') ? 'model' : 'user',
      parts: [{ text: msg.content }]
    })) || [];
    
    // Add current user message
    contents.push({ role: 'user', parts: [{ text: message }] });

    let response;
    let retries = 3;
    let delay = 1000;
    
    const models = ['gemini-3.6-flash', 'gemini-3.1-pro-preview', 'gemini-flash-latest'];
    let currentModelIndex = 0;
    
    while (retries > 0) {
      try {
        response = await ai.models.generateContent({
          model: models[currentModelIndex],
          contents: contents,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.2
          }
        });
        break;
      } catch (error: any) {
        const errorString = error?.message || String(error) || '';
        const isCapacityError = error?.status === 503 || errorString.includes('503') || errorString.includes('UNAVAILABLE') || errorString.includes('high demand');
        const isQuotaError = error?.status === 429 || errorString.includes('429') || errorString.includes('quota');
        const isNotFoundError = error?.status === 404 || errorString.includes('404') || errorString.includes('not found');
        
        if (retries > 1 && (isCapacityError || isQuotaError || isNotFoundError)) {
          retries--;
          if (currentModelIndex < models.length - 1) {
            currentModelIndex++;
          }
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
        } else {
          // If we exhausted retries or got an unrecoverable error, return a graceful message.
          console.error("Gemini API Error:", errorString);
          return NextResponse.json({ error: `Erro na API do Gemini: ${errorString.substring(0, 100)}... Verifique sua chave de API ou limites de uso.` }, { status: 500 });
        }
      }
    }

    const aiText = response?.text || "Desculpe, não entendi.";

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

    return NextResponse.json({ text: aiText, newStatus });
  } catch (error: any) {
    console.error("Gemini Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
