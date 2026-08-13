import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { resolveAIConfig } from '@/lib/ai-config';
import { sendMessage } from '@/lib/messaging';
import { requireTenantContext, serverError } from '@/lib/api-auth';
import { recordAuditAction } from '@/lib/audit';
import { getActiveQuarantine } from '@/lib/quarantine';

const OPENCODE_BASE_URL = 'https://opencode.ai/zen/go/v1';
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

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
    const body = await req.json();
    const { caseId } = body;
    if (typeof caseId !== 'string') {
      return NextResponse.json({ error: 'caseId é obrigatório.' }, { status: 400 });
    }

    const tenant = await requireTenantContext(req, body.tenant_id);
    if ('response' in tenant) return tenant.response;
    const { ctx } = tenant;

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Supabase não configurado." }, { status: 500 });
    }

    const { data: caseData, error: caseError } = await ctx.supabase
      .from('cases')
      .select('*, financial_titles(id, installment_number, original_value, current_value, due_date, status, contracts(id, contract_number, clients(name, document)))')
      .eq('id', caseId)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();

    if (caseError || !caseData) {
      return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
    }

    if (caseData.status !== 'not_started') {
      return NextResponse.json({ error: "Este caso já foi iniciado." }, { status: 400 });
    }

    // Guard de quarentena: caso em quarentena não inicia negociação automatizada.
    const quarantine = await getActiveQuarantine(ctx.supabase, caseId, ctx.tenantId);
    if (quarantine) {
      return NextResponse.json({
        error: `Caso em quarentena (${quarantine.status}): negociação bloqueada. Motivo: ${quarantine.reason || 'não informado'}.`,
      }, { status: 409 });
    }

// Resolução centralizada de IA (ADR-003): bucket assistant do tenant.
    const ai = await resolveAIConfig({
      client: admin,
      tenantId: ctx.tenantId,
      bucket: 'assistant',
    });
    const aiProvider = ai.provider;
    const aiModel = ai.model;
    const apiKey = ai.apiKey;
    const ollamaBaseUrl = ai.ollamaBaseUrl;

    if (!apiKey) {
      return NextResponse.json({ error: `Chave de API não configurada para o provedor ${aiProvider}. Configure nas opções (Settings) ou nas variáveis de ambiente.` }, { status: 500 });
    }

    const title = Array.isArray(caseData.financial_titles) ? caseData.financial_titles[0] : caseData.financial_titles;
    const relatedContract = title?.contracts;
    const relatedClient = relatedContract?.clients;
    const minAcceptable = Number(caseData.updated_value || caseData.original_value) * (1 - caseData.max_discount_margin / 100);
    const systemPrompt = SYSTEM_PROMPT
      .replace(/{name}/g, relatedClient?.name || caseData.name)
      .replace('{updated_value}', Number(caseData.updated_value || caseData.original_value).toFixed(2))
      .replace('{max_discount_margin}', caseData.max_discount_margin.toString())
      .replace('{min_acceptable}', minAcceptable.toFixed(2))
      + `\n\nCONTEXTO CANÔNICO:\nContrato: ${relatedContract?.contract_number || 'não informado'}\nTítulo: ${title?.installment_number || 'legado'}\nVencimento: ${title?.due_date || caseData.due_date}\nStatus do título: ${title?.status || 'não informado'}`;

    let aiText = "Olá, precisamos falar sobre uma pendência. Poderia confirmar se estou falando com " + caseData.name + "?";

    try {
      if (aiProvider === 'opencode') {
        const openai = new OpenAI({ apiKey, baseURL: OPENCODE_BASE_URL });
        const response = await openai.chat.completions.create({
          model: aiModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'Gere a primeira mensagem de contato baseada nas instruções.' }
          ],
          temperature: 0.3,
          max_tokens: 2048
        });
        if (response.choices[0].message.content) aiText = response.choices[0].message.content;
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
      } else if (aiProvider === 'groq') {
        const openai = new OpenAI({ apiKey, baseURL: GROQ_BASE_URL });
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
    } catch (error: unknown) {
      console.error("AI API Error:", error);
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: `Erro na API do ${aiProvider}: ${message}` }, { status: 500 });
    }

    const { error: messageError } = await ctx.supabase.from('messages').insert({
      tenant_id: ctx.tenantId,
      case_id: caseId,
      role: 'ai',
      content: aiText
    });
    if (messageError) throw messageError;

    await recordAuditAction(ctx.supabase, {
      tenantId: ctx.tenantId,
      entityType: 'message',
      entityId: caseId,
      caseId,
      actorUserId: ctx.userId,
      action: 'AI_MESSAGE_SENT',
      metadata: { source: 'start-negotiation', content_length: aiText.length },
    });

    if (caseData.phone || caseData.telegram_chat_id) {
      const destination = caseData.telegram_chat_id || caseData.phone;
      sendMessage(destination, aiText, caseData.user_id).catch(err => {
        console.error("Error in background message send:", err);
      });
    }

    const { data: updatedCase, error: statusError } = await ctx.supabase
      .from('cases')
      .update({ status: 'in_negotiation' })
      .eq('id', caseId)
      .eq('tenant_id', ctx.tenantId)
      .select('*')
      .single();
    if (statusError) throw statusError;
    await recordAuditAction(ctx.supabase, {
      tenantId: ctx.tenantId,
      entityType: 'case',
      entityId: caseId,
      caseId,
      actorUserId: ctx.userId,
      action: 'STATUS_CHANGE',
      before: caseData,
      after: updatedCase,
      metadata: { source: 'start-negotiation' },
    });

    return NextResponse.json({ text: aiText, newStatus: 'in_negotiation' });

  } catch (error: unknown) {
    return serverError('start-negotiation error', error);
  }
}
