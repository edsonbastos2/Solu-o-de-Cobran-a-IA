import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext, serverError } from '@/lib/api-auth';
import { getStats } from '@/lib/crm/board-service';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenant = await requireTenantContext(req, searchParams.get('tenant_id'));
  if ('response' in tenant) return tenant.response;

  try {
    const { ctx } = tenant;
    const stats = await getStats(ctx.supabase, ctx);
    return NextResponse.json({ stats });
  } catch (error) {
    return serverError('crm stats GET exception', error);
  }
}
