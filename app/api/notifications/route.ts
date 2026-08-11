import { NextRequest, NextResponse } from 'next/server';
import { requireRole, serverError } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenant = await requireRole(req, 'member', searchParams.get('tenant_id'));
  if ('response' in tenant) return tenant.response;

  try {
    const { ctx } = tenant;
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('limit') || '10', 10) || 10));
    const offset = (page - 1) * limit;
    const onlyUnread = searchParams.get('unread') === 'true';

    let query = ctx.supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('tenant_id', ctx.tenantId)
      .or(`user_id.eq.${ctx.userId},user_id.is.null`);

    if (onlyUnread) query = query.is('read_at', null);

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return serverError('notifications GET error', error);

    const { count: unreadCount, error: unreadError } = await ctx.supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', ctx.tenantId)
      .is('read_at', null)
      .or(`user_id.eq.${ctx.userId},user_id.is.null`);
    if (unreadError) return serverError('notifications unread count error', unreadError);

    return NextResponse.json({
      notifications: data || [],
      unread: unreadCount || 0,
      totalPages: Math.ceil((count || 0) / limit) || 1,
      total: count || 0,
    });
  } catch (error) {
    return serverError('notifications GET exception', error);
  }
}