import { NextRequest, NextResponse } from 'next/server';
import { processChat } from '@/lib/agent';
import { requireTenantContext, serverError } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const caseId = body?.caseId;
  const message = typeof body?.message === 'string' ? body.message : '';
  if (typeof caseId !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'caseId e mensagem são obrigatórios.' }, { status: 400 });
  }

  const tenant = await requireTenantContext(req, body?.tenant_id);
  if ('response' in tenant) return tenant.response;

  try {
    const { ctx } = tenant;
    const result = await processChat(caseId, message, ctx.supabase, ctx.tenantId);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'Caso não encontrado') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return serverError('chat error', error);
  }
}
