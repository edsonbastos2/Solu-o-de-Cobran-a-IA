import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { serverError } from '@/lib/api-auth';

const SYSTEM_PROMPT = `Você é um agente de cobrança de dívidas educado, focado e objetivo trabalhando para um escritório de advocacia.
Seu objetivo é iniciar a abordagem para tentar fechar um acordo de pagamento com o devedor.

REGRAS ESTRITAS:
1. Você não pode ofender, ameaçar ou constranger o devedor em NENHUMA hipótese.
2. Você pode oferecer descontos ou parcelamentos, MAS o valor final NUNCA pode ser inferior ao (Valor Atualizado - Margem de Desconto).
3. Você deve usar um tom corporativo, mas acessível, adequado para o WhatsApp.
4. INICIE A CONVERSA: Faça uma saudação inicial educada, identifique-se como representante de cobrança, diga que está entrando em contato referente a uma pendência, e pergunte se a pessoa é o(a) {name}.
5. FOCO ABSOLUTO: Você é EXCLUSIVAMENTE um agente de cobrança. Se o devedor tentar conversar sobre QUALQUER outro assunto fora do escopo financeiro ou da negociação, você DEVE recusar educadamente e redirecionar a conversa.

INFORMAÇÕES DO CASO:
Nome: {name}
Valor Atualizado da Dívida: R$ {updated_value}
Desconto Máximo Autorizado: {max_discount_margin}% (ou seja, o mínimo aceitável é R$ {min_acceptable})`;

export async function POST(req: NextRequest) {
  try {
    const { caseId } = await req.json();

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Supabase não configurado." }, { status: 500 });
    }

    const { data: caseData, error: caseError } = await admin
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

    // Fetch AI configuration from user profile (via RPC com chaves descriptografadas)
    let aiProvider = 'gemini';
    let aiModel = 'gemini-3.5-flash';
    let apiKey = process.env.GEMINI_API_KEY || '';
    let ollamaBaseUrl = 'http://localhost:11434';

    if (caseData.user_id) {
      let profile: any = null;
      const { data: rpcData, error: rpcErr } = await admin.rpc('get_user_ai_keys', { p_user_id: caseData.user_id });
      if (!rpcErr && rpcData && rpcData.length > 0) profile = rpcData[0];
      if (!profile) {
        const { data } = await admin.from('profiles').select('*').eq('id', caseData.user_id).single();
        profile = data;
      }

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
      return NextResponse.json({ error: `Chave de API não configurada para o provedor ${aiProvider}. Configure nas opções (Settings) ou nas variáveis de ambiente.` }, { status: 500 });
    }

    const minAcceptable = caseData.updated_value * (1 - caseData.max_discount_margin / 100);
    const systemPrompt = SYSTEM_PROMPT
      .replace(/{name}/g, caseData.name)
      .replace('{updated_value}', caseData.updated_value.toFixed(2))
      .replace('{max_discount_margin}', caseData.max_discount_margin.toString())
      .replace('{min_acceptable}', minAcceptable.toFixed(2));

    let aiText = "Olá, precisamos falar sobre uma pendência. Poderia confirmar se estou falando com " + caseData.name + "?";

    try {
      if (aiProvider === 'gemini') {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: aiModel,
          contents: "Gere a primeira mensagem de contato baseada nas instruções.",
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.3
          }
        });
        if (response.text) aiText = response.text;
      } else if (aiProvider === 'openai') {
        const openai = new OpenAI({ apiKey });
        const response = await openai.chat.completions.create({
          model: aiModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'Gere a primeira mensagem de contato baseada nas instruções.' }
          ],
          temperature: 0.3
        });
        if (response.choices[0].message.content) aiText = response.choices[0].message.content;
      } else if (aiProvider === 'anthropic') {
        const anthropic = new Anthropic({ apiKey });
        const response = await anthropic.messages.create({
          model: aiModel,
          system: systemPrompt,
          max_tokens: 1024,
          messages: [
            { role: 'user', content: 'Gere a primeira mensagem de contato baseada nas instruções.' }
          ],
          temperature: 0.3
        });
        if (response.content[0].type === 'text') {
          aiText = response.content[0].text;
        }
      } else if (aiProvider === 'ollama' || aiProvider === 'openrouter') {
        const openai = new OpenAI({ 
          apiKey: aiProvider === 'openrouter' ? apiKey : 'ollama', 
          baseURL: aiProvider === 'openrouter' ? 'https://openrouter.ai/api/v1' : `${ollamaBaseUrl.replace(/\/+$/, '')}/v1` 
        });
        const response = await openai.chat.completions.create({
          model: aiModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'Gere a primeira mensagem de contato baseada nas instruções.' }
          ],
          temperature: 0.3
        });
        if (response.choices[0].message.content) aiText = response.choices[0].message.content;
      }
    } catch (error: any) {
      console.error("AI API Error:", error);
      return NextResponse.json({ error: `Erro na API do ${aiProvider}: ${error.message || String(error)}` }, { status: 500 });
    }

    await admin.from('messages').insert({
      case_id: caseId,
      role: 'ai',
      content: aiText
    });

    if (caseData.phone) {
      sendWhatsAppMessage(caseData.phone, aiText, caseData.user_id).catch(err => {
        console.error("Error in background WhatsApp send:", err);
      });
    }

    await admin.from('cases').update({ status: 'in_negotiation' }).eq('id', caseId);

    return NextResponse.json({ text: aiText, newStatus: 'in_negotiation' });

  } catch (error: any) {
    return serverError('start-negotiation error', error);
  }
}
