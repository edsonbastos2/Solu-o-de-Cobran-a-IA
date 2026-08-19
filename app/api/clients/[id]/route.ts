import { NextRequest, NextResponse } from 'next/server';
import { requireRole, serverError } from '@/lib/api-auth';
import { validateFields } from '@/lib/api-validate';
import { recordAuditAction } from '@/lib/audit';
import { buildClientCaseFilter } from '@/lib/channels/message-service';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const tenantContext = await requireRole(req, 'gestor', new URL(req.url).searchParams.get('tenant_id'));
    if ('response' in tenantContext) return tenantContext.response;
    const { supabase, tenantId, role, userId } = tenantContext.ctx;

    const validation = validateFields(body, [
      { name: 'name', type: 'string' },
      { name: 'email', type: 'string' },
      { name: 'phone', type: 'string' }
    ]);
    if (validation) return validation;

    // Captura estado anterior completo (para auditoria reconstruir mutação)
    const { data: before } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!before) {
      return NextResponse.json({ error: 'Cliente não encontrado ou acesso negado.' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('clients')
      .update({
        name: body.name,
        email: body.email,
        phone: body.phone
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) return serverError('clients PUT update error', error);

    await recordAuditAction(supabase, {
      tenantId,
      entityType: 'client',
      entityId: id,
      actorUserId: userId,
      actorRole: role,
      action: 'CLIENT_UPDATED',
      before,
      after: data,
    });

    return NextResponse.json({ client: data });
  } catch (error: unknown) {
    return serverError('clients PUT exception', error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const tenantContext = await requireRole(req, 'gestor', new URL(req.url).searchParams.get('tenant_id'));
    if ('response' in tenantContext) return tenantContext.response;
    const { supabase, tenantId, userId, role } = tenantContext.ctx;

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (clientError) return serverError('clients DELETE lookup error', clientError);
    if (!client) return NextResponse.json({ error: 'Cliente não encontrado ou acesso negado.' }, { status: 404 });

    // Bloqueia exclusão se há contratos ou casos ativos vinculados
    const { data: activeContracts, error: contractError } = await supabase
      .from('contracts')
      .select('id')
      .eq('client_id', id)
      .eq('tenant_id', tenantId)
      .is('archived_at', null)
      .limit(1);
    if (contractError) return serverError('clients DELETE contracts check error', contractError);

    if (activeContracts && activeContracts.length > 0) {
      return NextResponse.json({ error: 'Não é possível excluir cliente com contratos ativos vinculados.' }, { status: 409 });
    }

    // cases não possui coluna client_id: casos do cliente são casados por
    // debtor_id direto ou pelos títulos financeiros do cliente.
    let caseFilter: string;
    try {
      caseFilter = await buildClientCaseFilter(supabase, tenantId, id);
    } catch (error) {
      return serverError('clients DELETE cases filter error', error);
    }
    const { data: activeCases, error: casesError } = await supabase
      .from('cases')
      .select('id')
      .or(caseFilter)
      .eq('tenant_id', tenantId)
      .limit(1);
    if (casesError) return serverError('clients DELETE cases check error', casesError);
    if (activeCases && activeCases.length > 0) {
      return NextResponse.json({ error: 'Não é possível excluir cliente com casos vinculados.' }, { status: 409 });
    }

    const { error: deleteError } = await supabase
      .from('clients')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (deleteError) return serverError('clients DELETE error', deleteError);

    await recordAuditAction(supabase, {
      tenantId,
      entityType: 'client',
      entityId: id,
      actorUserId: userId,
      actorRole: role,
      action: 'CLIENT_DELETED',
      before: client,
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return serverError('clients DELETE exception', error);
  }
}