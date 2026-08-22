import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext, serverError, ROLE_RANK } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limit';
import { listConversations } from '@/lib/conversation-service';
import type { ConversationFilter } from '@/lib/types';

const ALLOWED_FILTERS: ConversationFilter[] = [
  'all',
  'unread',
  'ai',
  'human',
  'waiting_debtor',
  'waiting_operator',
  'negotiating',
  'closed',
  'mine',
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenant = await requireTenantContext(req, searchParams.get('tenant_id'));
  if ('response' in tenant) return tenant.response;

  if (!(await rateLimit(`conversations:list:${tenant.ctx.userId}`, 60, 60_000))) {
    return NextResponse.json({ error: 'Muitas requisições. Tente novamente em instantes.' }, { status: 429 });
  }

  try {
    const { ctx } = tenant;
    const page = Number.parseInt(searchParams.get('page') ?? '1', 10);
    const limit = Number.parseInt(searchParams.get('limit') ?? '20', 10);
    const search = searchParams.get('search')?.trim() ?? '';
    const filterParam = searchParams.get('filter') ?? 'all';
    const assigneeParam = searchParams.get('assignee');

    const filter = ALLOWED_FILTERS.includes(filterParam as ConversationFilter)
      ? (filterParam as ConversationFilter)
      : null;
    if (!filter) {
      return NextResponse.json({ error: 'Filtro inválido.' }, { status: 400 });
    }

    // Filtro por responsável é exclusivo de gestor/admin/owner (PRD).
    const assignee =
      assigneeParam && (ROLE_RANK[ctx.role] ?? 1) >= ROLE_RANK.gestor ? assigneeParam : undefined;

    const result = await listConversations(ctx.supabase, ctx.tenantId, ctx.userId, {
      page: Number.isFinite(page) && page > 0 ? page : 1,
      limit: Number.isFinite(limit) ? Math.min(100, Math.max(1, limit)) : 20,
      search: search || undefined,
      filter,
      assignee,
    });

    return NextResponse.json(result);
  } catch (error) {
    return serverError('conversations list exception', error);
  }
}
