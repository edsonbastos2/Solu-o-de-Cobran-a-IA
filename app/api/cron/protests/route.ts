import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getDaysOverdue } from '@/lib/finance';
import { sendClientMessage } from '@/lib/channels/message-service';
import { mockRequestProtest, getProtestProvider } from '@/lib/protest-provider';
import { recordAuditAction } from '@/lib/audit';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NOTIFICATION_WINDOW_DAYS = 3; // Lei 9.492/97, art. 12 — intimação prévia de 3 dias úteis
const PROVIDER_CONFIRM_DAYS = 1; // mock: confirmação do cartório em 1 dia

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
    override_days_to_protest: number | null;
    contract_number: string | null;
    override_days_to_negative: number | null;
    collection_policies?: Array<{ days_to_protest: number | null; days_to_negative: number | null }> | null;
  }> | null;
};

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
    logger.error('CRON_SECRET não configurado. Bloqueando cron de protesto.');
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
    // 1) Cria protestos pendentes de intimação para títulos elegíveis
    // ------------------------------------------------------------------
    const { data: titles, error: titlesError } = await supabase
      .from('financial_titles')
      .select(`
        id, tenant_id, client_id, due_date, current_value, original_value, status,
        clients ( id, name, phone, document ),
        contracts (
          override_days_to_protest, override_days_to_negative, contract_number,
          collection_policies ( days_to_protest, days_to_negative )
        )
      `)
      .in('status', ['pending', 'partial', 'late'])
      .not('client_id', 'is', null);
    if (titlesError) throw titlesError;

    // Encadeamento legal: apenas títulos com negativação completada ou tentada.
    const negativationByTitle = new Map<string, string>();
    const { data: negativations, error: negsError } = await supabase
      .from('negativations')
      .select('financial_title_id, status');
    if (negsError) throw negsError;
    for (const n of (negativations || [])) {
      if (n.financial_title_id && !negativationByTitle.has(n.financial_title_id)) {
        negativationByTitle.set(n.financial_title_id, n.status || '');
      }
    }

    const activeProtestByTitle = new Map<string, { id: string; status: string }>();
    const { data: activeProtests, error: activeProtestsError } = await supabase
      .from('protests')
      .select('id, status, financial_title_id')
      .neq('status', 'cancelled');
    if (activeProtestsError) throw activeProtestsError;
    for (const p of (activeProtests || [])) {
      if (p.financial_title_id) activeProtestByTitle.set(p.financial_title_id, { id: p.id, status: p.status });
    }

    for (const title of (titles || []) as EligibleTitle[]) {
      const contract = title.contracts?.[0];
      const policy = contract?.collection_policies?.[0];
      const limitDays = Number.isInteger(contract?.override_days_to_protest)
        ? Number(contract?.override_days_to_protest)
        : Number.isInteger(policy?.days_to_protest)
          ? Number(policy?.days_to_protest)
          : (Number.parseInt(process.env.DEFAULT_DAYS_TO_PROTEST || '90', 10) || 90);

      const daysOverdue = getDaysOverdue(title.due_date);
      if (daysOverdue < limitDays) continue;
      if (activeProtestByTitle.has(title.id)) continue;
      if (!negativationByTitle.has(title.id)) continue;

      const { data: created, error: createError } = await supabase
        .from('protests')
        .insert({
          tenant_id: title.tenant_id,
          client_id: title.client_id,
          financial_title_id: title.id,
          provider: 'cartorio',
          status: 'pending_notification',
        })
        .select('id')
        .single();
      if (createError) {
        logger.warn('[cron/protests] insert failed', { titleId: title.id }, { error: createError.message });
        continue;
      }
      activeProtestByTitle.set(title.id, { id: created.id, status: 'pending_notification' });
      pendingCreated.push(title.id);
      await recordAuditAction(supabase, {
        tenantId: title.tenant_id,
        entityType: 'protest',
        entityId: created.id,
        actorUserId: null,
        action: 'PROTEST_AUTO_CREATED',
        metadata: { source: 'cron', financial_title_id: title.id, days_overdue: daysOverdue, lei: '9.492/97' },
      }).catch((e) => logger.warn('[cron/protests] audit insert failed', undefined, { error: e instanceof Error ? e.message : String(e) }));
    }

    // ------------------------------------------------------------------
    // 2) Processa protestos já existentes conforme estágio
    // ------------------------------------------------------------------
    const { data: queue, error: queueError } = await supabase
      .from('protests')
      .select('*')
      .in('status', ['pending_notification', 'notified', 'requested']);
    if (queueError) throw queueError;

    for (const protest of queue || []) {
      if (protest.status === 'pending_notification' && !protest.notified_at) {
        // Envia a intimação de intenção de protesto e marca notified.
        const { data: titleInfo } = await supabase
          .from('financial_titles')
          .select('client_id')
          .eq('id', protest.financial_title_id)
          .maybeSingle();
        if (titleInfo?.client_id) {
          await sendClientMessage({
            clientId: titleInfo.client_id,
            content: `Comunicamos a INTENÇÃO de protesto em cartório do seu título em aberto, conforme disposto na Lei 9.492/97. Você tem 3 dias úteis para regularização e evitar o protesto.`,
            database: supabase,
            tenantId: protest.tenant_id,
          }).catch((e) => logger.warn('[cron/protests] intimation send failed', undefined, { error: String(e) }));
        }
        const { error: notifiedError } = await supabase
          .from('protests')
          .update({ status: 'notified', notified_at: now })
          .eq('id', protest.id);
        if (notifiedError) {
          logger.warn('[cron/protests] mark notified failed', undefined, { error: notifiedError.message });
        } else {
          notified.push(protest.id);
          await recordAuditAction(supabase, {
            tenantId: protest.tenant_id,
            entityType: 'protest',
            entityId: protest.id,
            actorUserId: null,
            action: 'PROTEST_INTIMATED',
            metadata: { source: 'cron', lei_9492_97_art_12: true, notice_days: NOTIFICATION_WINDOW_DAYS },
          }).catch((e) => logger.warn('[cron/protests] audit notify failed', undefined, { error: e instanceof Error ? e.message : String(e) }));
        }
        continue;
      }

      if (protest.status === 'notified' && protest.notified_at && !protest.requested_at) {
        const elapsed = businessDaysDifference(protest.notified_at);
        if (elapsed >= NOTIFICATION_WINDOW_DAYS) {
          // 4) Requisita o protesto na central de cartórios (mock).
          const provider = getProtestProvider();
          const ref = await mockRequestProtest(
            {
              tenantId: protest.tenant_id,
              clientId: protest.client_id,
              financialTitleId: protest.financial_title_id,
              document: null,
              clientName: null,
              contractNumber: null,
              amount: null,
              provider,
            },
            async (externalRef) => {
              await supabase
                .from('protests')
                .update({ external_reference: externalRef })
                .eq('id', protest.id);
            }
          );
          const { error: requestError } = await supabase
            .from('protests')
            .update({ status: 'requested', requested_at: now, provider, external_reference: ref })
            .eq('id', protest.id);
          if (requestError) {
            logger.warn('[cron/protests] mark requested failed', undefined, { error: requestError.message });
          } else {
            requested.push(protest.id);
            await recordAuditAction(supabase, {
              tenantId: protest.tenant_id,
              entityType: 'protest',
              entityId: protest.id,
              actorUserId: null,
              action: 'PROTEST_REQUESTED',
              metadata: { source: 'cron', provider, external_reference: ref },
            }).catch((e) => logger.warn('[cron/protests] audit request failed', undefined, { error: e instanceof Error ? e.message : String(e) }));
          }
        }
        continue;
      }

      if (protest.status === 'requested' && protest.requested_at && !protest.completed_at) {
        const elapsed = businessDaysDifference(protest.requested_at);
        if (elapsed >= PROVIDER_CONFIRM_DAYS) {
          // 5) Retorno do cartório → completed
          const { error: completedError } = await supabase
            .from('protests')
            .update({ status: 'completed', completed_at: now })
            .eq('id', protest.id);
          if (!completedError) {
          completed.push(protest.id);
          await recordAuditAction(supabase, {
            tenantId: protest.tenant_id,
            entityType: 'protest',
            entityId: protest.id,
            actorUserId: null,
            action: 'PROTEST_COMPLETED',
            metadata: { source: 'cron', provider: protest.provider },
          }).catch((e) => logger.warn('[cron/protests] audit complete failed', undefined, { error: e instanceof Error ? e.message : String(e) }));
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
    logger.error('[cron/protests] exception', undefined, { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}