import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { recordAuditAction } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { logger } from '@/lib/logger';

type NegotiationRow = {
  id: string;
  tenant_id: string;
  case_id: string | null;
  status: string;
  expires_at: string | null;
  agreed_value?: number | null;
};

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.error('CRON_SECRET não configurado. Bloqueando endpoint de cron.');
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
        logger.error('Erro ao expirar acordo', { tenantId: negotiation.tenant_id }, { negotiationId: negotiation.id, error: updateError.message });
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

      await createNotification(supabase, {
        tenantId: negotiation.tenant_id,
        userId: null,
        type: 'warning',
        title: 'Acordo expirado sem pagamento',
        body: `O acordo ${negotiation.id.slice(0, 8)} expirou em ${negotiation.expires_at ? new Date(negotiation.expires_at).toLocaleString('pt-BR') : 'prazo não informado'}. Retomar contato.`,
        relatedCaseId: negotiation.case_id,
      });

      defaulted.push(negotiation.id);
    }

    return NextResponse.json({ ok: true, expired: defaulted, count: defaulted.length });
  } catch (error: unknown) {
    logger.error('Cron negotiations-expiry error', undefined, { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}