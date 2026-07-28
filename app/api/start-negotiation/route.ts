import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `Você é um agente de cobrança de dívidas educado, focado e objetivo trabalhando para um escritório de advocacia.
Seu objetivo é iniciar a abordagem para tentar fechar um acordo de pagamento com o devedor.

REGRAS ESTRITAS:
1. Você não pode ofender, ameaçar ou constranger o devedor em NENHUMA hipótese.
2. Você pode oferecer descontos ou parcelamentos, MAS o valor final NUNCA pode ser inferior ao (Valor Atualizado - Margem de Desconto).
3. Você deve usar um tom corporativo, mas acessível, adequado para o WhatsApp.
4. INICIE A CONVERSA: Faça uma saudação inicial educada, identifique-se como representante de cobrança, diga que está entrando em contato referente a uma pendência, e pergunte se a pessoa é o(a) {name}.

INFORMAÇÕES DO CASO:
Nome: {name}
Valor Atualizado da Dívida: R$ {updated_value}
Desconto Máximo Autorizado: {max_discount_margin}% (ou seja, o mínimo aceitável é R$ {min_acceptable})`;

export async function POST(req: NextRequest) {
  try {
    const { caseId } = await req.json();

    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
    }

    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .single();

    if (caseError || !caseData) {
      return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
    }

    if (caseData.status !== 'not_started') {
      return NextResponse.json({ error: "Este caso já foi iniciado." }, { status: 400 });
    }

    const minAcceptable = caseData.updated_value * (1 - caseData.max_discount_margin / 100);
    const systemPrompt = SYSTEM_PROMPT
      .replace(/{name}/g, caseData.name)
      .replace('{updated_value}', caseData.updated_value.toFixed(2))
      .replace('{max_discount_margin}', caseData.max_discount_margin.toString())
      .replace('{min_acceptable}', minAcceptable.toFixed(2));

    let response;
    let retries = 3;
    let delay = 1000;
    
    const models = ['gemini-3.6-flash', 'gemini-3.1-pro-preview', 'gemini-flash-latest'];
    let currentModelIndex = 0;
    
    while (retries > 0) {
      try {
        response = await ai.models.generateContent({
          model: models[currentModelIndex],
          contents: "Gere a primeira mensagem de contato baseada nas instruções.",
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.3
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
          console.error("Gemini API Error:", errorString);
          return NextResponse.json({ error: `Erro na API do Gemini: ${errorString.substring(0, 100)}... Verifique sua chave de API ou limites de uso.` }, { status: 500 });
        }
      }
    }

    const aiText = response?.text || "Olá, precisamos falar sobre uma pendência. Poderia confirmar se estou falando com " + caseData.name + "?";

    await supabase.from('messages').insert({
      case_id: caseId,
      role: 'ai',
      content: aiText
    });

    if (caseData.phone) {
      sendWhatsAppMessage(caseData.phone, aiText).catch(err => {
        console.error("Error in background WhatsApp send:", err);
      });
    }

    await supabase.from('cases').update({ status: 'in_negotiation' }).eq('id', caseId);

    return NextResponse.json({ text: aiText, newStatus: 'in_negotiation' });
  } catch (error: any) {
    console.error("Gemini Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
