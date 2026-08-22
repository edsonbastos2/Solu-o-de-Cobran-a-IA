import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext, serverError } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limit';
import { markConversationRead } from '@/lib/conversation-service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const body = await req.json().catch(() => null);

  const tenant = await requireTenantContext(req, body?.tenant_id ?? null);
  if ('response' in tenant) return tenant.response;

  if (!(await rateLimit(`conversations:read:${tenant.ctx.userId}`, 60, 60_000))) {
    return NextResponse.json({ error: 'Muitas requisições. Tente novamente em instantes.' }, { status: 429 });
  }

  try {
    const { ctx } = tenant;
    const ok = await markConversationRead(ctx.supabase, ctx.tenantId, ctx.userId, caseId);
    if (!ok) {
      return NextResponse.json({ error: 'Não foi possível registrar a leitura.' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError('conversation read exception', error);
  }
}
