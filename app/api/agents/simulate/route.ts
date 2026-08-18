import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireTenantContext, serverError } from '@/lib/api-auth';
import { resolveAIConfig } from '@/lib/ai-config';
import { processMultiAgentSimulation } from '@/lib/multi-agent';

export async function POST(req: NextRequest) {
  try {
    const { message, caseInfo, agentsList } = await req.json();

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
    }

    // Resolve o tenant + config de IA (bucket 'agents') do mesmo modo que o
    // processChat: tenant.ai.agents → tenant.ai.assistant → system.assistant →
    // fallback hardcoded. Sem isso a simulação hardcodeava o gateway OpenCode
    // e enviava modelos inválidos (ex: gemini-3.5-flash) → 401.
    const searchParams = new URL(req.url).searchParams;
    const tctx = await requireTenantContext(req, searchParams.get('tenant_id'));
    if ('response' in tctx) return tctx.response;
    const { tenantId } = tctx.ctx;

    const admin = getSupabaseAdmin();
    const ai = await resolveAIConfig({
      client: admin ?? tctx.ctx.supabase,
      tenantId,
      bucket: 'agents',
    });

    if (!ai.apiKey) {
      return NextResponse.json(
        {
          error: `Chave de API não configurada para o provedor ${ai.provider}. Configure em Configurações do Tenant → bucket "Agentes", ou nos Padrões de IA do Sistema.`,
        },
        { status: 400 }
      );
    }

    const defaultCaseInfo = caseInfo || {
      name: 'João Silva',
      updated_value: 2450.00,
      diasAtraso: 45,
      effective_max_discount: 15
    };

    const simulationResult = await processMultiAgentSimulation(
      message.trim(),
      defaultCaseInfo,
      agentsList,
      ai
    );

    return NextResponse.json(simulationResult);
  } catch (error: unknown) {
    return serverError('Simulation error', error, true);
  }
}
