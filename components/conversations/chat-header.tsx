'use client';

import { ArrowLeft, Info, MessageCircle, Send } from 'lucide-react';
import type { Case } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

export interface ChatHeaderProps {
  caseData: Case;
  channel?: 'whatsapp' | 'telegram' | null;
  /** Exibido em telas pequenas para voltar à lista (task 10). */
  onBack?: () => void;
  /** Abre o painel de contexto da dívida em telas médias/pequenas (task 10). */
  onToggleInfo?: () => void;
}

export function ChatHeader({ caseData, channel, onBack, onToggleInfo }: ChatHeaderProps) {
  return (
    <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-2.5">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar para a lista de conversas"
          data-testid="chat-header-back"
          className="shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 lg:hidden"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">{caseData.name}</p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
          {channel && (
            <span className="inline-flex items-center gap-1">
              {channel === 'whatsapp' ? (
                <MessageCircle className="h-3 w-3 text-emerald-600" aria-hidden="true" />
              ) : (
                <Send className="h-3 w-3 text-sky-600" aria-hidden="true" />
              )}
              {channel === 'whatsapp' ? 'WhatsApp' : 'Telegram'}
            </span>
          )}
          <span>{formatCurrency(caseData.updated_value)}</span>
        </div>
      </div>

      {onToggleInfo && (
        <button
          type="button"
          onClick={onToggleInfo}
          aria-label="Ver informações da dívida"
          data-testid="chat-header-info-toggle"
          className="shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 xl:hidden"
        >
          <Info className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
