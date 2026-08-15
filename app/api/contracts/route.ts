import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext, requireRole, serverError, TenantContext } from '@/lib/api-auth';

type ContractCreateBody = {
  tenant_id?: string | null;
  collection_policy_id?: string | null;
  client_name?: string | null;
  client_document?: string | null;
  client_address?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  contract_number?: string | null;
  type?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  total_value?: number | null;
  installments_count?: number | null;
  interest_rate?: number | null;
  penalty_rate?: number | null;
  monetary_correction_index?: string | null;
  guarantees?: string | null;
  guarantors?: string | null;
  negative_allowed?: boolean | null;
  protest_allowed?: boolean | null;
  forum?: string | null;
};

type DatabaseError = { code?: string; message?: string };

function getDatabaseError(error: unknown): DatabaseError {
  if (typeof error !== 'object' || error === null) return {};
  const candidate = error as Record<string, unknown>;
  return {
    code: typeof candidate.code === 'string' ? candidate.code : undefined,
    message: typeof candidate.message === 'string' ? candidate.message : undefined,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantContext = await requireTenantContext(req, searchParams.get('tenant_id'));
    if ('response' in tenantContext) return tenantContext.response;
    const { ctx } = tenantContext;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const supabase = ctx.supabase;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

const query = supabase
      .from('contracts')
      .select(`
        id,
        contract_number,
        type,
        created_at,
        clients (name, document)
      `, { count: 'exact' })
      .eq('tenant_id', ctx.tenantId);

    if (searchParams.get('include_archived') !== 'true') {
      query.is('archived_at', null);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      return serverError('contracts GET query error', error);
    }

    return NextResponse.json({ 
      contracts: data || [], 
      count: count || 0, 
      totalPages: Math.ceil((count || 0) / limit) 
    });
  } catch (error) {
    return serverError('contracts GET exception', error);
  }
}

export async function POST(req: NextRequest) {
  let database: TenantContext['supabase'] | null = null;
  let tenantId: string | null = null;
  let createdClientId: string | null = null;
  let createdContractId: string | null = null;

  try {
    const body = await req.json() as ContractCreateBody;
    const tenantContext = await requireRole(req, 'gestor', body.tenant_id);
    if ('response' in tenantContext) return tenantContext.response;

    database = tenantContext.ctx.supabase;
    tenantId = tenantContext.ctx.tenantId;
    const { userId } = tenantContext.ctx;
    const document = body.client_document?.trim() || '00000000000';

    if (body.collection_policy_id) {
      const { data: policy, error: policyError } = await database
        .from('collection_policies')
        .select('id')
        .eq('id', body.collection_policy_id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (policyError) throw policyError;
      if (!policy) {
        return NextResponse.json({ error: 'A política selecionada não pertence ao tenant ativo.' }, { status: 400 });
      }
    }

    let clientId: string;
    const { data: existingClients, error: existingClientError } = await database
      .from('clients')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('document', document)
      .limit(1);

    if (existingClientError) throw existingClientError;
    if (existingClients?.[0]?.id) {
      clientId = existingClients[0].id;
    } else {
      const { data: newClient, error: clientError } = await database
        .from('clients')
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          name: body.client_name?.trim() || 'Desconhecido',
          document,
          address: body.client_address || null,
          phone: body.client_phone || null,
          email: body.client_email || null,
        })
        .select('id')
        .single();

      if (clientError) throw clientError;
      clientId = newClient.id;
      createdClientId = clientId;
    }

    const { data: newContract, error: contractError } = await database
      .from('contracts')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        client_id: clientId,
        contract_number: body.contract_number || null,
        type: body.type || null,
        start_date: body.start_date || null,
        due_date: body.due_date || null,
        interest_rate: body.interest_rate ?? null,
        penalty_rate: body.penalty_rate ?? null,
        monetary_correction_index: body.monetary_correction_index || null,
        guarantees: body.guarantees || null,
        guarantors: body.guarantors || null,
        negative_allowed: body.negative_allowed ?? false,
        protest_allowed: body.protest_allowed ?? false,
        forum: body.forum || null,
        collection_policy_id: body.collection_policy_id || null,
      })
      .select('id')
      .single();

    if (contractError) throw contractError;
    const contractId = newContract.id;
    createdContractId = contractId;

    const installmentCount = Number(body.installments_count || 0);
    const totalValue = Number(body.total_value || 0);
    if (Number.isInteger(installmentCount) && installmentCount > 0 && totalValue > 0) {
      const installmentValue = totalValue / installmentCount;
      const installments: Array<Record<string, string | number>> = [];
      let currentDate = body.start_date ? new Date(body.start_date) : new Date();

      if (Number.isNaN(currentDate.getTime())) currentDate = new Date();
      for (let installmentNumber = 1; installmentNumber <= installmentCount; installmentNumber += 1) {
        currentDate.setMonth(currentDate.getMonth() + 1);
        installments.push({
          tenant_id: tenantId,
          contract_id: contractId,
          installment_number: installmentNumber,
          original_value: installmentValue,
          due_date: currentDate.toISOString().split('T')[0],
          status: 'pending',
        });
      }

      const { data: insertedInstallments, error: installmentsError } = await database
        .from('installments')
        .insert(installments)
        .select('id, installment_number, original_value, due_date, status');
      if (installmentsError) throw installmentsError;

      const financialTitles = (insertedInstallments || []).map((installment) => ({
        tenant_id: tenantId,
        contract_id: contractId,
        client_id: clientId,
        installment_number: installment.installment_number,
        original_value: installment.original_value,
        current_value: installment.original_value,
        due_date: installment.due_date,
        status: installment.status,
        legacy_installment_id: installment.id,
      }));

      const { error: financialTitlesError } = await database
        .from('financial_titles')
        .insert(financialTitles);
      if (financialTitlesError) throw financialTitlesError;
    }

    return NextResponse.json({ contract: { id: createdContractId }, client_id: clientId }, { status: 201 });
  } catch (error: unknown) {
    if (database && tenantId && createdContractId) {
      const { error: cleanupContractError } = await database
        .from('contracts')
        .delete()
        .eq('id', createdContractId)
        .eq('tenant_id', tenantId);
      if (cleanupContractError) console.error('[contracts POST] contract cleanup failed:', cleanupContractError);
    }
    if (database && tenantId && createdClientId) {
      const { error: cleanupClientError } = await database
        .from('clients')
        .delete()
        .eq('id', createdClientId)
        .eq('tenant_id', tenantId);
      if (cleanupClientError) console.error('[contracts POST] client cleanup failed:', cleanupClientError);
    }

    const databaseError = getDatabaseError(error);
    if (databaseError.code === '23505') {
      if (databaseError.message?.includes('contracts_contract_number_key')) {
        return NextResponse.json({ error: 'Este número de contrato já está cadastrado no sistema.' }, { status: 409 });
      }
      if (databaseError.message?.includes('clients_email_key')) {
        return NextResponse.json({ error: 'O email do cliente extraído já está cadastrado para outro cliente.' }, { status: 409 });
      }
      if (databaseError.message?.includes('clients_document_key')) {
        return NextResponse.json({ error: 'O documento do cliente extraído já está cadastrado.' }, { status: 409 });
      }
    }
    return serverError('contracts POST exception', error);
  }
}
