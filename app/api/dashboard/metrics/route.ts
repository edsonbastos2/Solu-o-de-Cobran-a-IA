import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { format, parseISO, startOfMonth, subMonths } from 'date-fns';
import { getTenantAccess } from '@/lib/tenant';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedUserId = searchParams.get('userId') || req.headers.get('x-user-id');

    if (!supabase) {
      return NextResponse.json({ 
        contractsByMonth: [], 
        paymentStatus: [] 
      });
    }

    const { userId, isSuperAdmin } = await getTenantAccess(requestedUserId);

    if (!userId) {
      return NextResponse.json({ 
        contractsByMonth: [], 
        paymentStatus: [] 
      });
    }

    // Fetch contracts for the last 6 months
    const sixMonthsAgo = subMonths(new Date(), 5); // 5 + current = 6 months
    const startOfSixMonthsAgo = startOfMonth(sixMonthsAgo).toISOString();

    let contractsQuery = supabase
      .from('contracts')
      .select('id, created_at')
      .gte('created_at', startOfSixMonthsAgo)
      .order('created_at', { ascending: true });

    if (!isSuperAdmin) {
      contractsQuery = contractsQuery.eq('user_id', userId);
    }

    const { data: contracts, error: contractsError } = await contractsQuery;

    if (contractsError) {
      console.error(contractsError);
      return NextResponse.json({ error: contractsError.message }, { status: 400 });
    }

    // Group contracts by month
    const contractsByMonthMap: Record<string, number> = {};
    
    // Initialize last 6 months with 0
    for (let i = 5; i >= 0; i--) {
      const month = format(subMonths(new Date(), i), 'MMM/yyyy');
      contractsByMonthMap[month] = 0;
    }

    contracts?.forEach((contract: any) => {
      if (contract.created_at) {
        const month = format(parseISO(contract.created_at), 'MMM/yyyy');
        if (contractsByMonthMap[month] !== undefined) {
          contractsByMonthMap[month]++;
        }
      }
    });

    const contractsByMonth = Object.entries(contractsByMonthMap).map(([name, Novas]) => ({
      name,
      Novas
    }));

    // Fetch payment status for user's contracts
    let installments: any[] = [];
    if (isSuperAdmin) {
      const { data: instData, error: instErr } = await supabase.from('installments').select('status');
      if (instErr) throw instErr;
      installments = instData || [];
    } else {
      const userContractIds = contracts?.map((c: any) => c.id) || [];
      if (userContractIds.length > 0) {
        const { data: instData, error: instErr } = await supabase
          .from('installments')
          .select('status')
          .in('contract_id', userContractIds);
        if (instErr) throw instErr;
        installments = instData || [];
      }
    }

    let paid = 0;
    let pending = 0;

    installments.forEach((inst: any) => {
      if (inst.status === 'paid') {
        paid++;
      } else {
        pending++; // Count pending, late, in_negotiation as pending for this metric
      }
    });

    const paymentStatus = [
      { name: 'Realizados', value: paid },
      { name: 'Pendentes', value: pending }
    ];

    return NextResponse.json({ 
      contractsByMonth,
      paymentStatus
    });
  } catch (error: any) {
    console.error("Dashboard metrics API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
