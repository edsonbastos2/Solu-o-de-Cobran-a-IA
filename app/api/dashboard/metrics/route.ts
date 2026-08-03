import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerWithAdminFallback } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabaseServerWithAdminFallback(req);
    if (!supabase) {
      return NextResponse.json({
        total_cases: 0,
        active_cases: 0,
        recovered_amount: 0,
        pending_amount: 0,
        success_rate: 0
      });
    }

    // Since RLS is enabled and handles isolation, we can just query the tables
    // The query will automatically be filtered down to the current user's data

    // Cases
    const { data: cases, error: casesError } = await supabase
      .from('cases')
      .select('status, updated_value, original_value, created_at');

    if (casesError) throw casesError;

    const total_cases = cases?.length || 0;
    const active_cases = cases?.filter(c => c.status === 'in_progress' || c.status === 'negotiation' || c.status === 'promise_to_pay').length || 0;
    const resolved_cases = cases?.filter(c => c.status === 'paid' || c.status === 'agreed').length || 0;
    
    let pending_amount = 0;
    cases?.forEach(c => {
      if (c.status !== 'paid' && c.status !== 'agreed') {
        pending_amount += Number(c.updated_value || c.original_value || 0);
      }
    });

    const success_rate = total_cases > 0 ? (resolved_cases / total_cases) * 100 : 0;

    // Contracts and Installments for Recovered Amount
    const { data: contracts, error: contractsError } = await supabase
      .from('contracts')
      .select('id');
      
    let recovered_amount = 0;
    
    if (!contractsError && contracts && contracts.length > 0) {
      const userContractIds = contracts.map((c: any) => c.id);
      
      const { data: installments, error: instErr } = await supabase
        .from('installments')
        .select('amount')
        .in('contract_id', userContractIds)
        .eq('status', 'paid');
        
      if (!instErr && installments) {
        recovered_amount = installments.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
      }
    }

    const paymentStatus = [
      { name: 'Resolvidos', value: resolved_cases },
      { name: 'Em Andamento', value: active_cases },
      { name: 'Outros', value: total_cases - resolved_cases - active_cases }
    ].filter(item => item.value > 0);

    const contractsByMonth: any[] = [];
    if (cases) {
      const monthMap = new Map<string, number>();
      cases.forEach(c => {
        const date = new Date(c.created_at || Date.now());
        const monthYear = `${date.toLocaleString('pt-BR', { month: 'short' })} ${date.getFullYear()}`;
        monthMap.set(monthYear, (monthMap.get(monthYear) || 0) + 1);
      });
      monthMap.forEach((count, monthYear) => {
        contractsByMonth.push({ name: monthYear, Novas: count });
      });
    }

    // Default if empty to show something on the chart instead of crashing or being totally empty
    if (paymentStatus.length === 0) {
      paymentStatus.push({ name: 'Sem dados', value: 1 });
    }
    
    return NextResponse.json({
      total_cases,
      active_cases,
      recovered_amount,
      pending_amount,
      success_rate: Math.round(success_rate),
      paymentStatus,
      contractsByMonth
    });

  } catch (error: any) {
    console.error('Error fetching dashboard metrics:', error);
    return NextResponse.json({ error: error.message || 'Erro ao carregar métricas' }, { status: 500 });
  }
}
