import { NextRequest, NextResponse } from 'next/server';
import { processMultiAgentSimulation } from '@/lib/multi-agent';

// FIXME(ticket 1805 levantamento): rota sem nenhuma verificação de auth (nem requireUser) — pré-existente, fora de escopo deste ticket, acompanhar em follow-up separado.
export async function POST(req: NextRequest) {
  try {
    const { message, caseInfo, agentsList, apiKey } = await req.json();

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
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
      apiKey
    );

    return NextResponse.json(simulationResult);
  } catch (error: unknown) {
    console.error("Simulation error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro na simulação do multi-agente." }, { status: 500 });
  }
}
