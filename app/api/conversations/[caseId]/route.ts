import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext, serverError } from '@/lib/api-auth';
import { getConversation } from '@/lib/conversation-service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const { searchParams } = new URL(req.url);
  const tenant = await requireTenantContext(req, searchParams.get('tenant_id'));
  if ('response' in tenant) return tenant.response;

  try {
    const { ctx } = tenant;
    const conversation = await getConversation(ctx.supabase, ctx.tenantId, ctx.userId, ctx.role, caseId);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversa não encontrada ou acesso negado.' }, { status: 404 });
    }
    return NextResponse.json(conversation);
  } catch (error) {
    return serverError('conversation detail exception', error);
  }
}
