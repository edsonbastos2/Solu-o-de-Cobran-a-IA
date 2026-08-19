import { NextRequest, NextResponse } from 'next/server';
import { requireRole, serverError } from '@/lib/api-auth';
import { recordAuditAction } from '@/lib/audit';
import { buildClientCaseFilter } from '@/lib/channels/message-service';

const ALLOWED_CHANNELS = ['whatsapp', 'telegram'] as const;
const OPEN_CASE_STATUSES = ['not_started', 'in_negotiation', 'needs_attention'];

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; channel: string }> }
) {
  const { id, channel } = await params;

  if (!ALLOWED_CHANNELS.includes(channel as (typeof ALLOWED_CHANNELS)[number])) {
    return NextResponse.json({ error: 'Canal inválido.' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const tenant = await requireRole(req, 'gestor', searchParams.get('tenant_id'));
  if ('response' in tenant) return tenant.response;

  try {
    const { ctx } = tenant;

    const { data: client, error: clientError } = await ctx.supabase
      .from('clients')
      .select('id')
      .eq('id', id)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();
    if (clientError) return serverError('client channel DELETE client lookup error', clientError);
    if (!client) {
      return NextResponse.json({ error: 'Cliente não encontrado ou acesso negado.' }, { status: 404 });
    }

    const { data: binding, error: bindingError } = await ctx.supabase
      .from('client_channels')
      .select('*')
      .eq('tenant_id', ctx.tenantId)
      .eq('client_id', id)
      .eq('channel', channel)
      .maybeSingle();
    if (bindingError) return serverError('client channel DELETE lookup error', bindingError);
    if (!binding) {
      return NextResponse.json(
        { error: 'Vinculação de canal não encontrada para este cliente.' },
        { status: 404 }
      );
    }

    const { error: deleteError } = await ctx.supabase
      .from('client_channels')
      .delete()
      .eq('tenant_id', ctx.tenantId)
      .eq('client_id', id)
      .eq('channel', channel);
    if (deleteError) return serverError('client channel DELETE error', deleteError);

    // Casos abertos usando o canal desvinculado voltam ao fallback legado
    // (active_channel = NULL) e seguem comunicáveis. cases não possui coluna
    // client_id: casos do cliente são casados por debtor_id ou títulos.
    let caseFilter: string;
    try {
      caseFilter = await buildClientCaseFilter(ctx.supabase, ctx.tenantId, id);
    } catch (error) {
      return serverError('client channel cases filter error', error);
    }
    const { data: openCases, error: openCasesError } = await ctx.supabase
      .from('cases')
      .select('id')
      .eq('tenant_id', ctx.tenantId)
      .or(caseFilter)
      .eq('active_channel', channel)
      .in('status', OPEN_CASE_STATUSES);
    if (openCasesError) return serverError('client channel cases lookup error', openCasesError);

    if (openCases && openCases.length > 0) {
      const caseIds = openCases.map((row) => row.id as string);
      const { error: clearError } = await ctx.supabase
        .from('cases')
        .update({ active_channel: null })
        .in('id', caseIds)
        .eq('tenant_id', ctx.tenantId);
      if (clearError) return serverError('client channel cases update error', clearError);
    }

    await recordAuditAction(ctx.supabase, {
      tenantId: ctx.tenantId,
      entityType: 'client',
      entityId: id,
      actorUserId: ctx.userId,
      actorRole: ctx.role,
      action: 'CLIENT_CHANNEL_UNLINKED',
      before: binding,
      metadata: { channel, affected_cases: openCases?.length ?? 0 },
    });

    return NextResponse.json({ ok: true, affected_cases: openCases?.length ?? 0 });
  } catch (error) {
    return serverError('client channel DELETE exception', error);
  }
}
