'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { AlertCircle } from 'lucide-react';
import { useActiveTenant } from '@/hooks/use-active-tenant';
import { useConversations, useConversation } from '@/hooks/use-conversations';
import { fetcher } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Pagination } from '@/components/pagination';
import type { ConversationFilter } from '@/lib/types';
import { ConversationFilters } from './conversation-filters';
import { ConversationList } from './conversation-list';
import { ChatWindow } from './chat-window';
import { DebtContextPanel } from './debt-context-panel';

const ROLE_RANK: Record<string, number> = { owner: 4, admin: 3, gestor: 2, operador: 1 };

interface TenantMemberRow {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  role: string;
  status: string;
}

export function ConversationsPage() {
  const { user, role, tenantId, tenantPath, needsTenantSelection } = useActiveTenant();
  const searchParams = useSearchParams();

  const [filter, setFilter] = useState<ConversationFilter>('all');
  const [assignee, setAssignee] = useState('');
  const [page, setPage] = useState(1);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [deepLinkApplied, setDeepLinkApplied] = useState(false);

  useEffect(() => {
    if (deepLinkApplied) return;
    const caseParam = searchParams.get('case');
    if (caseParam) setSelectedCaseId(caseParam);
    setDeepLinkApplied(true);
  }, [searchParams, deepLinkApplied]);

  const showAssignee = Boolean(role && (ROLE_RANK[role] ?? 0) >= ROLE_RANK.gestor);

  const { data: membersData } = useSWR<{ members: TenantMemberRow[] }>(
    showAssignee && tenantId ? `/api/tenants/${tenantId}/members?tenant_id=${encodeURIComponent(tenantId)}` : null,
    fetcher
  );
  const operators = useMemo(
    () =>
      (membersData?.members ?? [])
        .filter((member) => member.status === 'active')
        .map((member) => ({ id: member.userId, name: member.name ?? member.email ?? 'Sem nome', role: member.role })),
    [membersData]
  );

  const {
    conversations,
    totalPages,
    isLoading: listLoading,
    error: listError,
    refetch: refetchList,
    searchInput,
    setSearchInput,
  } = useConversations({ tenantId, filter, assignee: assignee || undefined, page, limit: 20 });

  const {
    conversation,
    isLoading: detailLoading,
    error: detailError,
    refetch: refetchDetail,
    action: actionState,
    sending,
    sendError,
    sendMessage,
    takeOver,
    returnToAI,
    transfer,
  } = useConversation(selectedCaseId, tenantId);

  const handleSelect = (caseId: string) => {
    setSelectedCaseId(caseId);
    setInfoOpen(false);
  };

  const handleFilterChange = (next: ConversationFilter) => {
    setFilter(next);
    setPage(1);
  };

  if (needsTenantSelection) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-8">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-3 h-12 w-12 text-amber-500" aria-hidden="true" />
          <h1 className="text-lg font-bold text-gray-900">Selecione um tenant para continuar</h1>
          <p className="mt-2 text-sm text-gray-500">A Central de Conversas exige um tenant ativo para usuários super-admin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden p-2 sm:p-3">
      {/* O título fica só para leitores de tela: a sidebar já sinaliza a seção e
          a faixa visível roubava ~90px da altura útil do chat. */}
      <h1 className="sr-only">Central de Conversas</h1>

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div
          className={cn(
            'w-full flex-col lg:flex lg:w-[320px] lg:shrink-0 lg:border-r lg:border-gray-100 2xl:w-[360px]',
            selectedCaseId ? 'hidden lg:flex' : 'flex'
          )}
        >
          <ConversationFilters
            filter={filter}
            onFilterChange={handleFilterChange}
            search={searchInput}
            onSearchChange={setSearchInput}
            showAssignee={showAssignee}
            assignee={assignee}
            onAssigneeChange={(next) => {
              setAssignee(next);
              setPage(1);
            }}
            operators={operators}
          />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ConversationList
              items={conversations}
              selectedId={selectedCaseId}
              onSelect={handleSelect}
              isLoading={listLoading}
              error={listError ? 'Não foi possível carregar as conversas.' : null}
              onRetry={refetchList}
              currentUserId={user?.id}
            />
          </div>
          {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} theme="light" />}
        </div>

        <div className={cn('min-w-0 flex-col lg:flex lg:flex-1', selectedCaseId ? 'flex' : 'hidden lg:flex')}>
          <ChatWindow
            conversation={conversation}
            isLoading={Boolean(selectedCaseId) && detailLoading}
            error={detailError ? 'Não foi possível carregar a conversa.' : null}
            onRetry={refetchDetail}
            sending={sending}
            sendError={sendError}
            onSendMessage={sendMessage}
            actionState={actionState}
            onTakeOver={takeOver}
            onReturnToAI={returnToAI}
            onTransfer={transfer}
            currentUserId={user?.id}
            onBack={() => setSelectedCaseId(null)}
            onToggleInfo={conversation ? () => setInfoOpen(true) : undefined}
          />
        </div>

        {conversation && (
          <div className="hidden w-[300px] shrink-0 border-l border-gray-100 xl:block 2xl:w-[340px]">
            <DebtContextPanel conversation={conversation} tenantPath={tenantPath} />
          </div>
        )}
      </div>

      {infoOpen && conversation && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/30 xl:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Informações da dívida"
          onClick={() => setInfoOpen(false)}
        >
          <div className="h-full w-full max-w-sm bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
            <DebtContextPanel conversation={conversation} tenantPath={tenantPath} onClose={() => setInfoOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
