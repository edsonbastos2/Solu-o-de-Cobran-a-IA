import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSupabaseServer } from '@/lib/supabase-server';
import { requireUser } from '@/lib/api-auth';
import { resolveAIConfig } from '@/lib/ai-config';

const OPENCODE_BASE_URL = 'https://opencode.ai/zen/go/v1';
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

const SYSTEM_INSTRUCTION = `Você é o assistente virtual (Agente Especialista) de uma plataforma SaaS multiempresa de recuperação de crédito baseada em Inteligência Artificial, chamada CobrançaIA.

Seu objetivo é ensinar e guiar os usuários (operadores, advogados, gerentes e administradores) sobre como utilizar cada funcionalidade do sistema em tempo real.

O sistema foi desenvolvido para automatizar o ciclo de cobrança (prevenção, negociação, negativação, protesto, encaminhamento jurídico).
A IA do sistema (os Agentes de IA) faz as cobranças no WhatsApp do devedor respeitando regras rigorosas (Políticas), e o operador humano pode assumir o atendimento a qualquer instante.

### ESTRUTURA DO SISTEMA (MENUS E FUNCIONALIDADES):

1. **Dashboard (Painel Principal)**
   - **O que faz:** Exibe um resumo gerencial (métricas). Mostra o total de dívidas recuperadas, taxa de sucesso, acordos fechados e gráficos de desempenho financeiro.
   - **Uso:** Acompanhamento rápido da saúde da recuperação de crédito.

2. **Casos (Ao Vivo)**
   - **O que faz:** Lista todas as negociações em andamento (Casos de Cobrança).
   - **Uso:** O operador pode entrar em um caso para ver o histórico do chat da IA com o devedor (WhatsApp). Se a IA não conseguir resolver ou se o devedor pedir para falar com um humano, o operador pode pausar a IA e assumir o controle do chat por aqui, enviando mensagens manualmente.

3. **Contratos**
   - **O que faz:** Onde as dívidas dão entrada no sistema.
   - **Uso:** O usuário pode cadastrar manualmente os dados da dívida ou fazer upload de um PDF do contrato. Se fizer upload, o sistema usa IA para ler e extrair automaticamente os dados do devedor, valor da dívida, vencimentos, juros e multas.

4. **Clientes (Credores)**
   - **O que faz:** Cadastro de quem a sua empresa representa (quem é o dono do dinheiro).
   - **Uso:** Serve para vincular contratos a clientes específicos, gerindo a carteira de credores.

5. **Agentes IA**
   - **O que faz:** Configuração dos 'cobradores virtuais'.
   - **Uso:** O usuário pode criar agentes, dar-lhes um nome, definir o tom de voz (mais amigável, mais firme, formal), e testar/simular como eles responderiam antes de colocar em produção. É aqui que se integra com a API do WhatsApp para envio das mensagens automáticas.

6. **Políticas (Regras de Cobrança)**
   - **O que faz:** O "cérebro" das restrições. Define o limite de atuação da IA.
   - **Uso:** O usuário cria regras definindo percentuais máximos de desconto, parcelamentos permitidos, juros diários e prazos de tolerância. A IA NUNCA oferece acordos fora destas regras.

7. **Configurações**
   - **O que faz:** Gerenciamento do perfil do usuário e da conta.
   - **Uso:** Alterar nome, senha e preferências gerais da conta tenant.

8. **Painel Admin** (Apenas para Super Administradores)
   - **O que faz:** Gestão global do SaaS.
   - **Uso:** Criar, editar, ou excluir contas (tenants) da plataforma.

### REGRAS DIRETRIZES DE RESPOSTA DO ASSISTENTE:
- Responda SEMPRE em Português do Brasil (pt-BR).
- Seja educado, paciente, direto e use formatação (negrito, listas) para facilitar a leitura.
- Responda baseado EXCLUSIVAMENTE nas informações acima sobre o funcionamento do sistema.
- Se o usuário perguntar como fazer algo no sistema, guie-o para o menu correto.
- **RECUSE** responder a qualquer pergunta que não seja sobre o sistema CobrançaIA (ex: receitas, códigos de programação, curiosidades não relacionadas). Responda educadamente: "Sou especialista apenas no uso do sistema CobrançaIA. Como posso ajudar com a plataforma?"
- Você **não executa ações** (não cria contratos ou altera senhas), você apenas **ensina** como o usuário pode fazer isso na tela.`;

type ChatMessage = { role: string; content: string };

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.role === 'string' && typeof candidate.content === 'string';
}

function normalizeMessages(messages: ChatMessage[]) {
  return messages.map((message): { role: 'user' | 'assistant'; content: string } => ({
    role: message.role === 'model' || message.role === 'assistant' ? 'assistant' : 'user',
    content: message.content,
  }));
}

async function generateAssistantResponse(
  provider: string,
  model: string,
  apiKey: string,
  ollamaBaseUrl: string,
  messages: ChatMessage[],
) {
  const normalizedMessages = normalizeMessages(messages);

  if (provider === 'gemini') {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: normalizedMessages.map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      })),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    });
    return response.text || 'Desculpe, não consegui processar a resposta.';
  }

  if (provider === 'anthropic') {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model,
      system: SYSTEM_INSTRUCTION,
      messages: normalizedMessages.map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content,
      })),
      temperature: 0.3,
      max_tokens: 2048,
    });
    const text = response.content.find((item) => item.type === 'text');
    return text?.type === 'text' ? text.text : 'Desculpe, não consegui processar a resposta.';
  }

  const baseURL = provider === 'opencode'
    ? OPENCODE_BASE_URL
    : provider === 'openrouter'
      ? 'https://openrouter.ai/api/v1'
      : provider === 'ollama'
        ? `${ollamaBaseUrl.replace(/\/+$/, '')}/v1`
        : provider === 'groq'
          ? GROQ_BASE_URL
          : undefined;
  const client = new OpenAI({
    apiKey: provider === 'ollama' ? 'ollama' : apiKey,
    baseURL,
  });
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM_INSTRUCTION },
      ...normalizedMessages,
    ],
    temperature: 0.3,
    max_tokens: 2048,
  });
  return response.choices[0]?.message?.content || 'Desculpe, não consegui processar a resposta.';
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if ('response' in auth) return auth.response;

    const body = await req.json() as { messages?: unknown };
    const messages = Array.isArray(body.messages) ? body.messages.filter(isChatMessage) : null;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "Invalid messages format" }, { status: 400 });
    }

// Resolução centralizada de IA (ADR-003): bucket assistant do tenant do
    // usuário ativo. Em demo mode (sem Supabase) degrada para o fallback
    // hardcoded (opencode + OPENCODE_API_KEY).
    const admin = getSupabaseAdmin();
    const serverClient = getSupabaseServer(req);
    let tenantId = auth.ctx.currentTenantId;
    if (!tenantId && (admin || serverClient)) {
      const resolverForMembership = admin ?? serverClient!;
      const { data: membership } = await resolverForMembership
        .from('tenant_members')
        .select('tenant_id')
        .eq('user_id', auth.ctx.userId)
        .eq('status', 'active')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      tenantId = (membership as { tenant_id?: string | null } | null)?.tenant_id ?? null;
    }
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ativo não encontrado. Configure seu tenant antes de usar o assistente.' },
        { status: 404 }
      );
    }
    const ai = await resolveAIConfig({
      client: admin ?? serverClient,
      tenantId,
      bucket: 'assistant',
    });
    const provider = ai.provider;
    const model = ai.model;
    const apiKey = ai.apiKey;
    const ollamaBaseUrl = ai.ollamaBaseUrl;

    if (provider !== 'ollama' && !apiKey) {
      return NextResponse.json({
        error: `Nenhuma chave do provedor ${provider} foi configurada. Salve uma chave em Configurações > Modelos de IA ou configure a variável de ambiente correspondente.`
      }, { status: 503 });
    }

    const text = await generateAssistantResponse(provider, model, apiKey, ollamaBaseUrl, messages);
    return NextResponse.json({ text });
  } catch (error: unknown) {
    console.error('[help-chat] provider request failed:', error);
    return NextResponse.json({
      error: 'Não foi possível gerar a resposta agora. Verifique o provedor e tente novamente.',
      tip: "Verifique o provedor, modelo e chave configurados em Configurações > Modelos de IA."
    }, { status: 500 });
  }
}
