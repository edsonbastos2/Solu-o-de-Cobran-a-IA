import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { calculatePropensityScore } from '@/lib/propensity';
import { recordAuditAction } from '@/lib/audit';
import { logger } from '@/lib/logger';

// Recalcula o propensity_score de todos os casos ativos.
// Esperado ser executado semanalmente (ex.: 03:00 todo domingo via cron/Vercel).
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
    const { data: caseRows, error: casesError } = await supabase
      .from('cases')
      .select('id, tenant_id')
      .in('status', ['not_started', 'in_negotiation', 'needs_attention'])
      .not('tenant_id', 'is', null);

    if (casesError) throw casesError;

    const processed: { caseId: string; score: number | null }[] = [];
    for (const c of caseRows || []) {
      try {
        const result = await calculatePropensityScore(c.id, { client: supabase });
        processed.push({ caseId: c.id, score: result.score });
        await recordAuditAction(supabase, {
          tenantId: c.tenant_id,
          entityType: 'case',
          entityId: c.id,
          actorUserId: null,
          action: 'PROPENSITY_SCORE_RECALCULATED',
          metadata: { source: 'cron', score: result.score, components: result.factors },
        }).catch((e) => logger.error('Audit score-propensity failed', undefined, { caseId: c.id, error: e instanceof Error ? e.message : String(e) }));
      } catch (err) {
        logger.error('Erro ao calcular propensão de caso', undefined, {
          caseId: c.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({ ok: true, recalculated: processed.length, cases: processed });
  } catch (error: unknown) {
    logger.error('Cron score-propensity error', undefined, { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}