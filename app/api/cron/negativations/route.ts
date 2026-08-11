import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getDaysOverdue } from '@/lib/finance';
import { sendMessage } from '@/lib/messaging';
import { mockRequestNegativation, getNegativationProvider } from '@/lib/negativation-provider';
import { recordAuditAction } from '@/lib/audit';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NOTIFICATION_WINDOW_DAYS = 5;
const PROVIDER_CONFIRM_DAYS = 1; // mock: confirmação do provedor em 1 dia

type EligibleTitle = {
  id: string;
  tenant_id: string;
  client_id: string | null;
  due_date: string;
  current_value: number | null;
  original_value: number | null;
  status: string;
  clients?: Array<{
    id: string;
    name: string | null;
    phone: string | null;
    document: string | null;
  }> | null;
  contracts?: Array<{
    override_days_to_negative: number | null;
    contract_number: string | null;
    collection_policies?: Array<{ days_to_negative: number | null }> | null;
  }> | null;
};

type ParentTenant = { id: string; owner_user_id: string | null };

function businessDaysDifference(fromIso: string): number {
  const from = new Date(fromIso);
  const now = new Date();
  let count = 0;
  const cursor = new Date(from);
  while (cursor < now) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.error('CRON_SECRET não configurado. Bloqueando cron de negativação.');
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
    const now = new Date().toISOString();
    const pendingCreated: string[] = [];
    const notified: string[] = [];
    const requested: string[] = [];
    const completed: string[] = [];

    // ------------------------------------------------------------------
    // 1) Cria negativações pendentes de notificação para títulos elegíveis
    // ------------------------------------------------------------------
    const { data: titles, error: titlesError } = await supabase
      .from('financial_titles')
      .select(`
        id, tenant_id, client_id, due_date, current_value, original_value, status,
        clients ( id, name, phone, document ),
        contracts (
          override_days_to_negative, contract_number,
          collection_policies ( days_to_negative )
        )
      `)
      .in('status', ['pending', 'partial', 'late'])
      .not('client_id', 'is', null);
    if (titlesError) throw titlesError;

    const activeRefs = new Map<string, { id: string; status: string }>();
    const { data: activeNegs, error: activeNegsError } = await supabase
      .from('negativations')
      .select('id, status, financial_title_id')
      .neq('status', 'removed');
    if (activeNegsError) throw activeNegsError;
    for (const n of (activeNegs || [])) {
      if (n.financial_title_id) activeRefs.set(n.financial_title_id, { id: n.id, status: n.status });
    }

    for (const title of (titles || []) as EligibleTitle[]) {
      const contract = title.contracts?.[0];
      const policy = contract?.collection_policies?.[0];
      const limitDays = Number.isInteger(contract?.override_days_to_negative)
        ? Number(contract?.override_days_to_negative)
        : Number.isInteger(policy?.days_to_negative)
          ? Number(policy?.days_to_negative)
          : (Number.parseInt(process.env.DEFAULT_DAYS_TO_NEGATIVE || '60', 10) || 60);

      const daysOverdue = getDaysOverdue(title.due_date);
      if (daysOverdue < limitDays) continue;
      if (activeRefs.has(title.id)) continue;

      const { data: created, error: createError } = await supabase
        .from('negativations')
        .insert({
          tenant_id: title.tenant_id,
          client_id: title.client_id,
          financial_title_id: title.id,
          provider: 'serasa',
          status: 'pending_notification',
        })
        .select('id')
        .single();
      if (createError) {
        logger.warn('[cron/negativations] insert failed', { titleId: title.id }, { error: createError.message });
        continue;
      }
      activeRefs.set(title.id, { id: created.id, status: 'pending_notification' });
      pendingCreated.push(title.id);
      await recordAuditAction(supabase, {
        tenantId: title.tenant_id,
        entityType: 'negativation',
        entityId: created.id,
        actorUserId: null,
        action: 'NEGATIVATION_AUTO_CREATED',
        metadata: { source: 'cron', financial_title_id: title.id, days_overdue: daysOverdue },
      }).catch((e) => logger.warn('[cron/negativations] audit insert failed', undefined, { error: e instanceof Error ? e.message : String(e) }));
    }

    // ------------------------------------------------------------------
    // 2) Processa negativações já existentes conforme estágio
    // ------------------------------------------------------------------
    const { data: queue, error: queueError } = await supabase
      .from('negativations')
      .select('*')
      .in('status', ['pending_notification', 'notified', 'requested']);
    if (queueError) throw queueError;

    // Parent tenants para campanhas/mensageria (owner_user_id define provider)
    const tenantIds = Array.from(new Set((queue || []).map((n) => n.tenant_id)));
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id, owner_user_id')
      .in('id', tenantIds);
    const ownerByTenant = new Map<string, string | null>((tenants || []).map((t: ParentTenant) => [t.id, t.owner_user_id]));

    for (const neg of queue || []) {
      const ownerUserId = ownerByTenant.get(neg.tenant_id) || undefined;

      if (neg.status === 'pending_notification' && !neg.notified_at) {
        // Envia a notificação prévia (CDC Art. 43) e marca notified.
        const { data: titleInfo } = await supabase
          .from('financial_titles')
          .select('client_id, due_date, current_value, original_value')
          .eq('id', neg.financial_title_id)
          .maybeSingle();
        let phone: string | null = null;
        if (titleInfo?.client_id) {
          const { data: client } = await supabase
            .from('clients')
            .select('phone, name')
            .eq('id', titleInfo.client_id)
            .maybeSingle();
          phone = client?.phone || null;
        }
        if (phone) {
          await sendMessage(
            phone,
            `Informamos que, na ausência de pagamento, seu nome poderá ser negativado nos órgãos de proteção ao crédito (Serasa/SPC/Boa Vista) em 5 dias, conforme o CDC.`,
            ownerUserId
          ).catch((e) => logger.warn('[cron/negativations] notification send failed', undefined, { error: String(e) }));
        }
        const { error: notifiedError } = await supabase
          .from('negativations')
          .update({ status: 'notified', notified_at: now })
          .eq('id', neg.id);
        if (notifiedError) {
          logger.warn('[cron/negativations] mark notified failed', undefined, { error: notifiedError.message });
        } else {
          notified.push(neg.id);
          await recordAuditAction(supabase, {
            tenantId: neg.tenant_id,
            entityType: 'negativation',
            entityId: neg.id,
            actorUserId: null,
            action: 'NEGATIVATION_NOTIFIED',
            metadata: { source: 'cron', cdc_article: '43', notice_days: NOTIFICATION_WINDOW_DAYS },
          }).catch((e) => logger.warn('[cron/negativations] audit notify failed', undefined, { error: e instanceof Error ? e.message : String(e) }));
        }
        continue;
      }

      if (neg.status === 'notified' && neg.notified_at && !neg.requested_at) {
        const elapsed = businessDaysDifference(neg.notified_at);
        if (elapsed >= NOTIFICATION_WINDOW_DAYS) {
          // 4) Solicita negativação ao provider mock.
          const provider = getNegativationProvider();
          const ref = await mockRequestNegativation(
            {
              tenantId: neg.tenant_id,
              clientId: neg.client_id,
              financialTitleId: neg.financial_title_id,
              document: null,
              clientName: null,
              contractNumber: null,
              amount: null,
              provider,
            },
            async (externalRef) => {
              await supabase
                .from('negativations')
                .update({ external_reference: externalRef })
                .eq('id', neg.id);
            }
          );
          const { error: requestError } = await supabase
            .from('negativations')
            .update({ status: 'requested', requested_at: now, provider, external_reference: ref })
            .eq('id', neg.id);
          if (requestError) {
            logger.warn('[cron/negativations] mark requested failed', undefined, { error: requestError.message });
          } else {
            requested.push(neg.id);
            await recordAuditAction(supabase, {
              tenantId: neg.tenant_id,
              entityType: 'negativation',
              entityId: neg.id,
              actorUserId: null,
              action: 'NEGATIVATION_REQUESTED',
              metadata: { source: 'cron', provider, external_reference: ref },
            }).catch((e) => logger.warn('[cron/negativations] audit request failed', undefined, { error: e instanceof Error ? e.message : String(e) }));
          }
        }
        continue;
      }

      if (neg.status === 'requested' && neg.requested_at && !neg.completed_at) {
        const elapsed = businessDaysDifference(neg.requested_at);
        if (elapsed >= PROVIDER_CONFIRM_DAYS) {
          // 5) Confirmação do provedor → completed
          const { error: completedError } = await supabase
            .from('negativations')
            .update({ status: 'completed', completed_at: now })
            .eq('id', neg.id);
          if (!completedError) {
          completed.push(neg.id);
          await recordAuditAction(supabase, {
            tenantId: neg.tenant_id,
            entityType: 'negativation',
            entityId: neg.id,
            actorUserId: null,
            action: 'NEGATIVATION_COMPLETED',
            metadata: { source: 'cron', provider: neg.provider },
          }).catch((e) => logger.warn('[cron/negativations] audit complete failed', undefined, { error: e instanceof Error ? e.message : String(e) }));
        }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      pending_created: pendingCreated.length,
      notified: notified.length,
      requested: requested.length,
      completed: completed.length,
    });
  } catch (error: unknown) {
    logger.error('[cron/negativations] exception', undefined, { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}