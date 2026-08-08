import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { recordAuditAction } from '@/lib/audit';

type NegotiationRow = {
  id: string;
  tenant_id: string;
  case_id: string | null;
  status: string;
};

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('CRON_SECRET não configurado. Bloqueando endpoint de cron.');
    return NextResponse.json({ error: 'Servidor mal configurado.' }, { status: 503 });
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 500 });
  }

  try {
    const { data: expired, error } = await supabase
      .from('negotiations')
      .select('*')
      .eq('status', 'accepted')
      .lt('expires_at', new Date().toISOString());

    if (error) throw error;
    const rows = (expired || []) as NegotiationRow[];

    const defaulted: string[] = [];

    for (const negotiation of rows) {
      const { data: updated, error: updateError } = await supabase
        .from('negotiations')
        .update({ status: 'defaulted' })
        .eq('id', negotiation.id)
        .select('*')
        .single();
      if (updateError) {
        console.error(`Erro ao expirar acordo ${negotiation.id}:`, updateError);
        continue;
      }

      await recordAuditAction(supabase, {
        tenantId: negotiation.tenant_id,
        entityType: 'negotiation',
        entityId: negotiation.id,
        caseId: negotiation.case_id || undefined,
        actorUserId: null,
        action: 'NEGOTIATION_EXPIRED',
        before: negotiation,
        after: updated,
        metadata: { source: 'cron-negotiations-expiry' },
      });

      defaulted.push(negotiation.id);
    }

    return NextResponse.json({ ok: true, expired: defaulted, count: defaulted.length });
  } catch (error: unknown) {
    console.error('Cron negotiations-expiry error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}