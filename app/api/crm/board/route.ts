import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext, serverError } from '@/lib/api-auth';
import { getBoard } from '@/lib/crm/board-service';
import { CRM_PRIORITIES, CRM_STAGES, CrmStage } from '@/lib/crm/stages';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenant = await requireTenantContext(req, searchParams.get('tenant_id'));
  if ('response' in tenant) return tenant.response;

  try {
    const { ctx } = tenant;
    const search = (searchParams.get('search') || '').slice(0, 100).trim();
    const operator = (searchParams.get('operator') || '').slice(0, 100).trim();
    const priorityParam = (searchParams.get('priority') || '').slice(0, 20).trim();
    const stageParam = (searchParams.get('stage') || '').slice(0, 40).trim();
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('limit') || '20', 10) || 20));

    if (priorityParam && !(CRM_PRIORITIES as readonly string[]).includes(priorityParam)) {
      return NextResponse.json({ error: 'Prioridade inválida. Use alta, media ou baixa.' }, { status: 400 });
    }
    if (stageParam && !(CRM_STAGES as readonly string[]).includes(stageParam)) {
      return NextResponse.json({ error: 'Etapa inválida.' }, { status: 400 });
    }

    const { columns } = await getBoard(ctx.supabase, ctx, {
      search,
      operator: operator || undefined,
      priority: priorityParam || undefined,
      stage: stageParam ? (stageParam as CrmStage) : undefined,
      page,
      limit,
    });

    return NextResponse.json({ columns });
  } catch (error) {
    return serverError('crm board GET exception', error);
  }
}
