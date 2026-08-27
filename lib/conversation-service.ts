import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { recordAuditAction } from '@/lib/audit';
import { calculateUpdatedValue, getCollectionStage } from '@/lib/finance';
import {
  Case,
  CaseWithRelations,
  Client,
  ContractWithClient,
  ConversationActionResult,
  ConversationController,
  ConversationDetailResponse,
  ConversationEvent,
  ConversationEventType,
  ConversationFilter,
  ConversationListItem,
  ConversationListParams,
  ConversationPermissions,
  ConversationsListResponse,
  FinancialTitle,
  Message,
  Negotiation,
} from '@/lib/types';

const ROLE_RANK: Record<string, number> = { owner: 4, admin: 3, gestor: 2, operador: 1 };

/** Janela máxima de casos avaliados por listagem — filtros derivados (unread,
 * waiting_*) são computados em memória sobre a atividade mais recente. */
const LIST_WINDOW = 500;

const CASE_LIST_SELECT = `
  id, created_at, tenant_id, user_id, name, phone,
  original_value, updated_value, due_date, max_discount_margin, status,
  financial_title_id, assigned_user_id, controller, conversation_version,
  debtor_id, debtor_email, debtor_document, debtor_address,
  telegram_chat_id, active_channel, propensity_score, propensity_updated_at
`;

const CASE_DETAIL_SELECT = `
  *,
  financial_titles (
    id, tenant_id, contract_id, client_id, installment_number,
    external_reference, description, original_value, current_value,
    due_date, status, paid_at, legacy_installment_id, metadata,
    created_at, updated_at,
    contracts (
      id, tenant_id, client_id, contract_number, type,
      clients (id, tenant_id, name, document, phone, email, address,
        client_channels (id, channel, username, verified_at))
    )
  )
`;

/** Condutor efetivo da conversa — casos legados (controller NULL) derivam do status. */
export function resolveController(c: { controller?: ConversationController | null; status: string }): ConversationController {
  if (c.controller === 'ai' || c.controller === 'human') return c.controller;
  return c.status === 'needs_attention' ? 'human' : 'ai';
}

/** IA pausada quando humano conduz explicitamente ou, em casos legados, quando o caso pede atenção. */
export function isAIPaused(c: { controller?: ConversationController | null; status: string }): boolean {
  if (c.controller === 'human') return true;
  if (c.controller === 'ai') return false;
  return c.status === 'needs_attention';
}

export function deriveConversationPermissions(
  role: string,
  opts: { isAssignedToMe: boolean; controller: ConversationController }
): ConversationPermissions {
  const rank = ROLE_RANK[role] ?? 1;
  const canSend = opts.controller === 'human' && (opts.isAssignedToMe || rank >= ROLE_RANK.gestor);
  return {
    canView: true,
    canSend,
    canTakeOver: true,
    canReturnToAI: canSend,
    canTransfer: rank >= ROLE_RANK.gestor || opts.isAssignedToMe,
    canComplete: rank >= ROLE_RANK.admin,
  };
}

interface OperatorInfo {
  id: string;
  name: string;
  role: string;
}

async function fetchOperatorNames(
  db: SupabaseClient,
  tenantId: string,
  userIds: string[]
): Promise<Map<string, OperatorInfo>> {
  const map = new Map<string, OperatorInfo>();
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return map;

  const { data: members, error } = await db
    .from('tenant_members')
    .select('user_id, role')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .in('user_id', unique);
  if (error) {
    logger.warn('[conversation-service] tenant_members query error', undefined, { error: error.message });
    return map;
  }

  const memberIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
  if (memberIds.length === 0) return map;

  const { data: profiles, error: profilesError } = await db
    .from('profiles')
    .select('id, name')
    .in('id', memberIds);
  if (profilesError) {
    logger.warn('[conversation-service] profiles query error', undefined, { error: profilesError.message });
  }

  const names = new Map<string, string>((profiles ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));
  for (const m of members ?? []) {
    map.set(m.user_id, { id: m.user_id, name: names.get(m.user_id) ?? 'Operador', role: String(m.role ?? 'operador') });
  }
  return map;
}

function sanitizeSearch(term: string): string {
  return term.replace(/[%_,()]/g, ' ').trim();
}

export async function listConversations(
  db: SupabaseClient,
  tenantId: string,
  userId: string,
  params: ConversationListParams
): Promise<ConversationsListResponse> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const filter: ConversationFilter = params.filter ?? 'all';
  const search = sanitizeSearch(params.search ?? '');
  const assignee = params.assignee;

  // Busca auxiliar: casos casados por número de contrato ou conteúdo de mensagem.
  let searchCaseIds: string[] | null = null;
  if (search) {
    const [contractsRes, messagesRes] = await Promise.all([
      db.from('contracts').select('id').eq('tenant_id', tenantId).ilike('contract_number', `%${search}%`),
      db.from('messages').select('case_id').eq('tenant_id', tenantId).ilike('content', `%${search}%`),
    ]);
    if (contractsRes.error || messagesRes.error) {
      logger.warn('[conversation-service] search lookup error', undefined, {
        error: contractsRes.error?.message ?? messagesRes.error?.message,
      });
      return { conversations: [], total: 0, page, totalPages: 0 };
    }
    const contractIds = (contractsRes.data ?? []).map((r: { id: string }) => r.id);
    const ids = new Set<string>((messagesRes.data ?? []).map((r: { case_id: string }) => r.case_id));
    if (contractIds.length > 0) {
      const { data: titles } = await db
        .from('financial_titles')
        .select('id')
        .eq('tenant_id', tenantId)
        .in('contract_id', contractIds);
      const titleIds = (titles ?? []).map((r: { id: string }) => r.id);
      if (titleIds.length > 0) {
        const { data: titleCases } = await db
          .from('cases')
          .select('id')
          .eq('tenant_id', tenantId)
          .in('financial_title_id', titleIds);
        for (const r of titleCases ?? []) ids.add(r.id);
      }
    }
    searchCaseIds = [...ids];
  }

  let query = db.from('cases').select(CASE_LIST_SELECT).eq('tenant_id', tenantId);
  const applyFilters = (q: typeof query) => {
    let filtered = q;
    if (filter === 'closed') filtered = filtered.eq('status', 'closed');
    else if (filter === 'negotiating') filtered = filtered.eq('status', 'in_negotiation');
    else filtered = filtered.neq('status', 'closed');

    if (filter === 'ai') filtered = filtered.eq('controller', 'ai');
    if (filter === 'human') filtered = filtered.eq('controller', 'human');

    if (filter === 'mine') filtered = filtered.eq('assigned_user_id', userId);
    else if (assignee === 'unassigned') filtered = filtered.eq('controller', 'human').is('assigned_user_id', null);
    else if (assignee === 'ai') filtered = filtered.eq('controller', 'ai');
    else if (assignee) filtered = filtered.eq('assigned_user_id', assignee);
    return filtered;
  };
  query = applyFilters(query);

  let caseRows: Record<string, unknown>[] = [];
  if (search) {
    const ownFields = await applyFilters(
      db.from('cases').select(CASE_LIST_SELECT).eq('tenant_id', tenantId)
    )
      .or(`name.ilike.%${search}%,debtor_document.ilike.%${search}%,phone.ilike.%${search}%`)
      .order('created_at', { ascending: false })
      .limit(LIST_WINDOW);
    const searchCases =
      searchCaseIds && searchCaseIds.length > 0
        ? await applyFilters(db.from('cases').select(CASE_LIST_SELECT).eq('tenant_id', tenantId))
            .in('id', searchCaseIds)
            .order('created_at', { ascending: false })
            .limit(LIST_WINDOW)
        : { data: [], error: null };
    if (ownFields.error || searchCases.error) {
      logger.warn('[conversation-service] cases search query error', undefined, {
        error: ownFields.error?.message ?? searchCases.error?.message,
      });
      return { conversations: [], total: 0, page, totalPages: 0 };
    }
    const merged = new Map<string, Record<string, unknown>>();
    for (const row of [...(searchCases.data ?? []), ...(ownFields.data ?? [])]) merged.set(String(row.id), row);
    caseRows = [...merged.values()].slice(0, LIST_WINDOW);
  } else {
    const { data, error } = await query.order('created_at', { ascending: false }).limit(LIST_WINDOW);
    if (error) {
      logger.warn('[conversation-service] cases query error', undefined, { error: error.message });
      return { conversations: [], total: 0, page, totalPages: 0 };
    }
    caseRows = (data ?? []) as Record<string, unknown>[];
  }

  const caseIds = caseRows.map((r) => String(r.id));
  if (caseIds.length === 0) return { conversations: [], total: 0, page, totalPages: 0 };

  const [messagesRes, readsRes, eventsRes] = await Promise.all([
    db.from('messages').select('case_id, role, content, created_at, send_status').eq('tenant_id', tenantId).in('case_id', caseIds),
    db.from('conversation_reads').select('case_id, last_read_at').eq('tenant_id', tenantId).eq('user_id', userId).in('case_id', caseIds),
    db
      .from('conversation_events')
      .select('case_id, type, created_at')
      .eq('tenant_id', tenantId)
      .in('case_id', caseIds)
      .order('created_at', { ascending: false }),
  ]);
  if (messagesRes.error || readsRes.error || eventsRes.error) {
    logger.warn('[conversation-service] aggregation query error', undefined, {
      error: messagesRes.error?.message ?? readsRes.error?.message ?? eventsRes.error?.message,
    });
    return { conversations: [], total: 0, page, totalPages: 0 };
  }

  // Ordenado desc por created_at — a primeira ocorrência de cada case_id é o evento mais recente.
  const lastEventByCase = new Map<string, ConversationEventType>();
  for (const e of (eventsRes.data ?? []) as { case_id: string; type: ConversationEventType }[]) {
    if (!lastEventByCase.has(e.case_id)) lastEventByCase.set(e.case_id, e.type);
  }

  const lastByCase = new Map<string, Message>();
  const userMsgsByCase = new Map<string, { created_at: string }[]>();
  for (const m of (messagesRes.data ?? []) as Message[]) {
    const last = lastByCase.get(m.case_id);
    if (!last || new Date(m.created_at) >= new Date(last.created_at)) lastByCase.set(m.case_id, m);
    if (m.role === 'user') {
      const list = userMsgsByCase.get(m.case_id) ?? [];
      list.push({ created_at: m.created_at });
      userMsgsByCase.set(m.case_id, list);
    }
  }
  const readByCase = new Map<string, string>(
    ((readsRes.data ?? []) as { case_id: string; last_read_at: string }[]).map((r) => [r.case_id, r.last_read_at])
  );

  const operators = await fetchOperatorNames(
    db,
    tenantId,
    caseRows.map((r) => String(r.assigned_user_id ?? '')).filter(Boolean)
  );

  const items: ConversationListItem[] = caseRows.map((row) => {
    const caseData = row as unknown as Case;
    const caseId = String(row.id);
    const last = lastByCase.get(caseId) ?? null;
    const lastRead = readByCase.get(caseId);
    const unreadCount = (userMsgsByCase.get(caseId) ?? []).filter(
      (m) => !lastRead || new Date(m.created_at) > new Date(lastRead)
    ).length;
    let waitingFor: 'debtor' | 'operator' | null = null;
    if (last) {
      if (last.role === 'user') waitingFor = 'operator';
      else if (last.role === 'ai' || last.role === 'human') waitingFor = 'debtor';
    }
    const controller = resolveController(caseData);
    const assigned = row.assigned_user_id ? String(row.assigned_user_id) : null;
    return {
      case: caseData,
      lastMessage: last ? { role: last.role, content: last.content, created_at: last.created_at, send_status: last.send_status ?? null } : null,
      controller,
      currentOperator: assigned ? { id: assigned, name: operators.get(assigned)?.name ?? 'Operador' } : null,
      channel: (row.active_channel as 'whatsapp' | 'telegram' | null) ?? null,
      unreadCount,
      waitingFor,
      lastEventType: lastEventByCase.get(caseId) ?? null,
    };
  });

  const filtered = items.filter((item) => {
    switch (filter) {
      case 'unread':
        return item.unreadCount > 0;
      case 'waiting_debtor':
        return item.waitingFor === 'debtor';
      case 'waiting_operator':
        return item.waitingFor === 'operator';
      default:
        return true;
    }
  });

  filtered.sort((a, b) => {
    const updatedOf = (c: Case) => new Date((c as Case & { updated_at?: string }).updated_at ?? c.created_at).getTime();
    const aTime = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : updatedOf(a.case);
    const bTime = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : updatedOf(b.case);
    return bTime - aTime;
  });

  const total = filtered.length;
  const start = (page - 1) * limit;
  return {
    conversations: filtered.slice(start, start + limit),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getConversation(
  db: SupabaseClient,
  tenantId: string,
  userId: string,
  role: string,
  caseId: string
): Promise<ConversationDetailResponse | null> {
  const { data: caseData, error } = await db
    .from('cases')
    .select(CASE_DETAIL_SELECT)
    .eq('id', caseId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) {
    logger.warn('[conversation-service] conversation detail query error', undefined, { error: error.message });
    return null;
  }
  if (!caseData) return null;

  const [negotiationRes, messagesRes, eventsRes, readsRes] = await Promise.all([
    db.from('negotiations').select('*').eq('tenant_id', tenantId).eq('case_id', caseId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('messages').select('*').eq('tenant_id', tenantId).eq('case_id', caseId).order('created_at', { ascending: true }),
    db.from('conversation_events').select('*').eq('tenant_id', tenantId).eq('case_id', caseId).order('created_at', { ascending: true }),
    db.from('conversation_reads').select('last_read_at').eq('tenant_id', tenantId).eq('case_id', caseId).eq('user_id', userId).maybeSingle(),
  ]);

  const members = await db
    .from('tenant_members')
    .select('user_id, role')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });
  if (members.error) {
    logger.warn('[conversation-service] members query error', undefined, { error: members.error.message });
  }

  const memberRows = (members.data ?? []) as { user_id: string; role: string }[];
  const operatorsMap = await fetchOperatorNames(
    db,
    tenantId,
    [...memberRows.map((m) => m.user_id), caseData.assigned_user_id ?? ''].filter(Boolean)
  );
  const operators: OperatorInfo[] = memberRows
    .map((m) => operatorsMap.get(m.user_id))
    .filter((o): o is OperatorInfo => Boolean(o));

  const relatedCase = caseData as CaseWithRelations;
  const title = (Array.isArray(relatedCase.financial_titles) ? relatedCase.financial_titles[0] : relatedCase.financial_titles) as FinancialTitle | null;
  const contract = ((title as (FinancialTitle & { contracts?: ContractWithClient | null }) | null)?.contracts ?? null);
  const client = (contract?.clients ?? null) as Client | null;

  const recalculated = calculateUpdatedValue(Number(caseData.original_value) || 0, new Date(caseData.due_date));
  const currentCase: Case = {
    ...caseData,
    financial_titles: undefined,
    updated_value: recalculated > Number(caseData.original_value) ? recalculated : Number(caseData.updated_value || caseData.original_value),
    legacy_context: (caseData as { legacy_context?: boolean }).legacy_context ?? !title,
  };

  const controller = resolveController(currentCase);
  const messages = (messagesRes.data ?? []) as Message[];
  const lastRead = readsRes.data ? (readsRes.data as { last_read_at: string }).last_read_at : null;
  const unreadCount = messages.filter((m) => m.role === 'user' && (!lastRead || new Date(m.created_at) > new Date(lastRead))).length;
  const assigned = caseData.assigned_user_id ? String(caseData.assigned_user_id) : null;

  return {
    case: currentCase,
    client,
    contract,
    financial_title: title,
    negotiation: (negotiationRes.data ?? null) as Negotiation | null,
    messages,
    events: (eventsRes.data ?? []) as ConversationEvent[],
    conversationVersion: Number(caseData.conversation_version ?? 1),
    unreadCount,
    permissions: deriveConversationPermissions(role, {
      isAssignedToMe: assigned === userId,
      controller,
    }),
    currentOperator: assigned ? { id: assigned, name: operatorsMap.get(assigned)?.name ?? 'Operador' } : null,
    operators,
    stage: getCollectionStage(currentCase.due_date, currentCase.max_discount_margin, currentCase.status),
  };
}

async function insertConversationEvent(
  db: SupabaseClient,
  tenantId: string,
  caseId: string,
  type: ConversationEvent['type'],
  performedBy: string | null,
  payload?: Record<string, unknown>
): Promise<void> {
  const { error } = await db.from('conversation_events').insert({
    tenant_id: tenantId,
    case_id: caseId,
    type,
    performed_by: performedBy,
    payload: payload ?? null,
  });
  if (error) {
    logger.warn('[conversation-service] conversation_events insert error', undefined, { error: error.message, type });
  }
}

async function auditQuietly(
  db: SupabaseClient,
  params: Parameters<typeof recordAuditAction>[1]
): Promise<void> {
  try {
    await recordAuditAction(db, params);
  } catch (err) {
    logger.warn('[conversation-service] audit write failed', undefined, { error: err instanceof Error ? err.message : String(err) });
  }
}

interface CaseActionSnapshot {
  id: string;
  controller: import('@/lib/types').ConversationController | null;
  assigned_user_id: string | null;
  conversation_version: number | null;
  status: string;
}

async function loadCaseForAction(
  db: SupabaseClient,
  tenantId: string,
  caseId: string
): Promise<CaseActionSnapshot | { internal: true } | null> {
  const { data, error } = await db
    .from('cases')
    .select('id, controller, assigned_user_id, conversation_version, status')
    .eq('id', caseId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) {
    logger.warn('[conversation-service] action lookup error', undefined, { error: error.message });
    return { internal: true };
  }
  return (data ?? null) as CaseActionSnapshot | null;
}

async function applyControllerTransition(
  db: SupabaseClient,
  tenantId: string,
  caseId: string,
  expectedVersion: number,
  update: Record<string, unknown>
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; code: 'VERSION_CONFLICT' | 'INTERNAL_ERROR' }> {
  const { data, error } = await db
    .from('cases')
    .update(update)
    .eq('id', caseId)
    .eq('tenant_id', tenantId)
    .eq('conversation_version', expectedVersion)
    .select('*')
    .maybeSingle();
  if (error) {
    logger.warn('[conversation-service] action update error', undefined, { error: error.message });
    return { ok: false, code: 'INTERNAL_ERROR' };
  }
  if (!data) return { ok: false, code: 'VERSION_CONFLICT' };
  return { ok: true, data };
}

export async function takeOverConversation(
  db: SupabaseClient,
  tenantId: string,
  userId: string,
  role: string,
  caseId: string,
  expectedVersion: number
): Promise<ConversationActionResult> {
  const snapshot = await loadCaseForAction(db, tenantId, caseId);
  if (snapshot && 'internal' in snapshot) return { ok: false, error_code: 'INTERNAL_ERROR' };
  if (!snapshot) return { ok: false, error_code: 'NOT_FOUND' };

  const result = await applyControllerTransition(db, tenantId, caseId, expectedVersion, {
    controller: 'human',
    assigned_user_id: userId,
    conversation_version: Number(snapshot.conversation_version ?? 1) + 1,
  });
  if (!result.ok) return { ok: false, error_code: result.code };

  await insertConversationEvent(db, tenantId, caseId, 'HUMAN_TAKEOVER', userId, {
    previousController: snapshot.controller ?? resolveController(snapshot),
    previousOperatorId: snapshot.assigned_user_id ?? null,
  });
  await auditQuietly(db, {
    tenantId,
    entityType: 'case',
    entityId: caseId,
    caseId,
    actorUserId: userId,
    action: 'HUMAN_TAKEOVER',
    before: snapshot as unknown as Record<string, unknown>,
    after: result.data,
  });

  const conversation = await getConversation(db, tenantId, userId, role, caseId);
  if (!conversation) return { ok: false, error_code: 'INTERNAL_ERROR' };
  return { ok: true, conversation };
}

/**
 * Transição automática IA→humano disparada pela própria IA (tag [HANDOFF] ou
 * estágio "especializada" em `lib/agent.ts`). Sem `expectedVersion`: é a IA
 * reagindo à própria resposta, não uma ação de usuário concorrente a
 * resolver — ainda assim incrementa `conversation_version` para refletir a
 * mudança na Central. Mantém a garantia de que `cases.controller` só é
 * escrito por este service (ADR-003).
 */
export async function recordAIHandoff(db: SupabaseClient, tenantId: string, caseId: string): Promise<void> {
  const snapshot = await loadCaseForAction(db, tenantId, caseId);
  if (!snapshot || 'internal' in snapshot) return;
  if (snapshot.controller === 'human') return;

  const { data, error } = await db
    .from('cases')
    .update({ controller: 'human', conversation_version: Number(snapshot.conversation_version ?? 1) + 1 })
    .eq('id', caseId)
    .eq('tenant_id', tenantId)
    .select('*')
    .maybeSingle();
  if (error || !data) {
    logger.warn('[conversation-service] recordAIHandoff update error', undefined, { error: error?.message });
    return;
  }

  await insertConversationEvent(db, tenantId, caseId, 'HUMAN_TAKEOVER', null, {
    automatic: true,
    reason: 'ai_handoff',
  });
  await auditQuietly(db, {
    tenantId,
    entityType: 'case',
    entityId: caseId,
    caseId,
    actorUserId: null,
    action: 'HUMAN_TAKEOVER',
    before: snapshot as unknown as Record<string, unknown>,
    after: data,
    metadata: { source: 'ai_pipeline', automatic: true },
  });
}

export async function returnConversationToAI(
  db: SupabaseClient,
  tenantId: string,
  userId: string,
  role: string,
  caseId: string,
  expectedVersion: number
): Promise<ConversationActionResult> {
  const snapshot = await loadCaseForAction(db, tenantId, caseId);
  if (snapshot && 'internal' in snapshot) return { ok: false, error_code: 'INTERNAL_ERROR' };
  if (!snapshot) return { ok: false, error_code: 'NOT_FOUND' };

  const permissions = deriveConversationPermissions(role, {
    isAssignedToMe: snapshot.assigned_user_id === userId,
    controller: resolveController(snapshot),
  });
  if (!permissions.canReturnToAI) return { ok: false, error_code: 'FORBIDDEN' };

  const result = await applyControllerTransition(db, tenantId, caseId, expectedVersion, {
    controller: 'ai',
    assigned_user_id: null,
    conversation_version: Number(snapshot.conversation_version ?? 1) + 1,
  });
  if (!result.ok) return { ok: false, error_code: result.code };

  await insertConversationEvent(db, tenantId, caseId, 'RETURNED_TO_AI', userId, {
    previousOperatorId: snapshot.assigned_user_id ?? null,
  });
  await auditQuietly(db, {
    tenantId,
    entityType: 'case',
    entityId: caseId,
    caseId,
    actorUserId: userId,
    action: 'RETURNED_TO_AI',
    before: snapshot as unknown as Record<string, unknown>,
    after: result.data,
  });

  const conversation = await getConversation(db, tenantId, userId, role, caseId);
  if (!conversation) return { ok: false, error_code: 'INTERNAL_ERROR' };
  return { ok: true, conversation };
}

export async function transferConversation(
  db: SupabaseClient,
  tenantId: string,
  userId: string,
  role: string,
  caseId: string,
  input: { toOperatorId: string; reason?: string; expectedVersion: number }
): Promise<ConversationActionResult> {
  const snapshot = await loadCaseForAction(db, tenantId, caseId);
  if (snapshot && 'internal' in snapshot) return { ok: false, error_code: 'INTERNAL_ERROR' };
  if (!snapshot) return { ok: false, error_code: 'NOT_FOUND' };

  const permissions = deriveConversationPermissions(role, {
    isAssignedToMe: snapshot.assigned_user_id === userId,
    controller: resolveController(snapshot),
  });
  if (!permissions.canTransfer) return { ok: false, error_code: 'FORBIDDEN' };

  const { data: member, error: memberError } = await db
    .from('tenant_members')
    .select('user_id, role, status')
    .eq('tenant_id', tenantId)
    .eq('user_id', input.toOperatorId)
    .eq('status', 'active')
    .maybeSingle();
  if (memberError) {
    logger.warn('[conversation-service] transfer target lookup error', undefined, { error: memberError.message });
    return { ok: false, error_code: 'INTERNAL_ERROR' };
  }
  if (!member) return { ok: false, error_code: 'INVALID_OPERATOR' };

  const result = await applyControllerTransition(db, tenantId, caseId, input.expectedVersion, {
    controller: 'human',
    assigned_user_id: input.toOperatorId,
    conversation_version: Number(snapshot.conversation_version ?? 1) + 1,
  });
  if (!result.ok) return { ok: false, error_code: result.code };

  await insertConversationEvent(db, tenantId, caseId, 'TRANSFERRED', userId, {
    fromOperatorId: snapshot.assigned_user_id ?? null,
    toOperatorId: input.toOperatorId,
    reason: input.reason ?? null,
  });
  await auditQuietly(db, {
    tenantId,
    entityType: 'case',
    entityId: caseId,
    caseId,
    actorUserId: userId,
    action: 'CONVERSATION_TRANSFERRED',
    targetUserId: input.toOperatorId,
    before: snapshot as unknown as Record<string, unknown>,
    after: result.data,
    metadata: { reason: input.reason ?? null },
  });

  const conversation = await getConversation(db, tenantId, userId, role, caseId);
  if (!conversation) return { ok: false, error_code: 'INTERNAL_ERROR' };
  return { ok: true, conversation };
}

export async function markConversationRead(
  db: SupabaseClient,
  tenantId: string,
  userId: string,
  caseId: string
): Promise<boolean> {
  const { error } = await db.from('conversation_reads').upsert(
    {
      tenant_id: tenantId,
      case_id: caseId,
      user_id: userId,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id,case_id,user_id' }
  );
  if (error) {
    logger.warn('[conversation-service] conversation_reads upsert error', undefined, { error: error.message });
    return false;
  }
  return true;
}
