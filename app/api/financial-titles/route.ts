import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext, serverError } from '@/lib/api-auth';
import { getFinancialTitleEligibility } from '@/lib/finance';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const contractId = searchParams.get('contract_id');
  const requestedTenantId = searchParams.get('tenant_id');

  if (!contractId || !UUID_PATTERN.test(contractId)) {
    return NextResponse.json({ error: 'contract_id é obrigatório e deve ser um UUID válido.' }, { status: 400 });
  }

  const tenant = await requireTenantContext(req, requestedTenantId);
  if ('response' in tenant) return tenant.response;

  try {
    const { ctx } = tenant;
    const { data: contract, error: contractError } = await ctx.supabase
      .from('contracts')
      .select('id')
      .eq('id', contractId)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();

    if (contractError) return serverError('financial titles contract lookup error', contractError);
    if (!contract) return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 });

    const { data: titles, error } = await ctx.supabase
      .from('financial_titles')
      .select('id, tenant_id, contract_id, client_id, installment_number, external_reference, description, original_value, current_value, due_date, status, paid_at, legacy_installment_id, metadata, created_at, updated_at')
      .eq('tenant_id', ctx.tenantId)
      .eq('contract_id', contractId)
      .order('installment_number', { ascending: true });

    if (error) return serverError('financial titles query error', error);

    const financialTitles = (titles || []).map((title) => {
      const eligibility = getFinancialTitleEligibility(title.due_date, title.status);
      return {
        ...title,
        original_value: Number(title.original_value),
        current_value: title.current_value == null ? null : Number(title.current_value),
        eligible: eligibility.eligible,
        eligibility_reason: eligibility.reason,
        days_overdue: eligibility.daysOverdue,
      };
    });

    return NextResponse.json({ financial_titles: financialTitles });
  } catch (error) {
    return serverError('financial titles exception', error);
  }
}
