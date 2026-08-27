import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext, serverError } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limit';
import { transferConversation } from '@/lib/conversation-service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const body = await req.json().catch(() => null);
  const toOperatorId = typeof body?.toOperatorId === 'string' ? body.toOperatorId : '';
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  const expectedVersion = Number(body?.expectedVersion);

  if (!toOperatorId) {
    return NextResponse.json({ error: 'toOperatorId é obrigatório.' }, { status: 400 });
  }
  if (reason.length > 500) {
    return NextResponse.json({ error: 'Motivo excede o limite de 500 caracteres.' }, { status: 400 });
  }
  if (!Number.isFinite(expectedVersion) || expectedVersion < 1) {
    return NextResponse.json({ error: 'expectedVersion é obrigatório.' }, { status: 400 });
  }

  const tenant = await requireTenantContext(req, body?.tenant_id);
  if ('response' in tenant) return tenant.response;

  if (!(await rateLimit(`conversations:transfer:${tenant.ctx.userId}`, 20, 60_000))) {
    return NextResponse.json({ error: 'Muitas requisições. Tente novamente em instantes.' }, { status: 429 });
  }

  try {
    const { ctx } = tenant;
    const result = await transferConversation(ctx.supabase, ctx.tenantId, ctx.userId, ctx.role, caseId, {
      toOperatorId,
      reason: reason || undefined,
      expectedVersion,
    });
    if (!result.ok) {
      const status = RESULT_STATUS[result.error_code] ?? 500;
      return NextResponse.json(
        { error: RESULT_MESSAGE[result.error_code] ?? 'Não foi possível transferir a conversa.', code: result.error_code },
        { status }
      );
    }
    return NextResponse.json(result.conversation);
  } catch (error) {
    return serverError('conversation transfer exception', error);
  }
}

const RESULT_STATUS: Record<string, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  VERSION_CONFLICT: 409,
  INVALID_STATE: 422,
  INVALID_OPERATOR: 422,
  INTERNAL_ERROR: 500,
};

const RESULT_MESSAGE: Record<string, string> = {
  NOT_FOUND: 'Conversa não encontrada ou acesso negado.',
  FORBIDDEN: 'Permissão insuficiente para transferir conversas.',
  VERSION_CONFLICT: 'A conversa foi alterada por outro operador. Atualize antes de tentar novamente.',
  INVALID_STATE: 'Estado da conversa não permite transferência.',
  INVALID_OPERATOR: 'Operador destinatário inválido ou pertence a outro tenant.',
  INTERNAL_ERROR: 'Erro interno do servidor.',
};
