import { NextRequest, NextResponse } from 'next/server';
import { requireRole, serverError } from '@/lib/api-auth';

// Marca uma notificação como lida (PATCH { read: true }) ou volta para não-lida.
// Usuário só pode mutar suas PRÓPRIAS notificações (user_id = ctx.userId)
// além do filtro por tenant — evita que um member marque lidas as
// notificações de outro usuário do mesmo tenant.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const tenant = await requireRole(req, 'member', new URL(req.url).searchParams.get('tenant_id'));
  if ('response' in tenant) return tenant.response;

  try {
    const { ctx } = tenant;
    const { data: current, error: currentError } = await ctx.supabase
      .from('notifications')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', ctx.tenantId)
      .or(`user_id.eq.${ctx.userId},user_id.is.null`)
      .maybeSingle();
    if (currentError) return serverError('notifications PATCH lookup error', currentError);
    if (!current) return NextResponse.json({ error: 'Notificação não encontrada ou acesso negado.' }, { status: 404 });

    const read = body?.read === true;
    const { data: updated, error } = await ctx.supabase
      .from('notifications')
      .update({ read_at: read ? new Date().toISOString() : null })
      .eq('id', id)
      .eq('tenant_id', ctx.tenantId)
      .or(`user_id.eq.${ctx.userId},user_id.is.null`)
      .select()
      .single();

    if (error) return serverError('notifications PATCH update error', error);
    return NextResponse.json({ ok: true, notification: updated });
  } catch (error) {
    return serverError('notifications PATCH exception', error);
  }
}