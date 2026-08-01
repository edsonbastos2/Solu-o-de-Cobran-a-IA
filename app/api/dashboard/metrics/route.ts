import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { format, parseISO, startOfMonth, subMonths } from 'date-fns';

export async function GET(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ 
        contractsByMonth: [], 
        paymentStatus: [] 
      });
    }

    // Fetch contracts for the last 6 months
    const sixMonthsAgo = subMonths(new Date(), 5); // 5 + current = 6 months
    const startOfSixMonthsAgo = startOfMonth(sixMonthsAgo).toISOString();

    const { data: contracts, error: contractsError } = await supabase
      .from('contracts')
      .select('created_at')
      .gte('created_at', startOfSixMonthsAgo)
      .order('created_at', { ascending: true });

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

    // Fetch payment status
    // To calculate conversion rate of payments: realized (paid) vs pending/others
    const { data: installments, error: installmentsError } = await supabase
      .from('installments')
      .select('status');

    if (installmentsError) {
      console.error(installmentsError);
      return NextResponse.json({ error: installmentsError.message }, { status: 400 });
    }

    let paid = 0;
    let pending = 0;

    installments?.forEach((inst: any) => {
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
