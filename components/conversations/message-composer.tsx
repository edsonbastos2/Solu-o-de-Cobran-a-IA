'use client';

import { useRef, useState } from 'react';
import { AlertCircle, RefreshCw, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAX_LENGTH = 4000;
const WARN_THRESHOLD = 3500;

export interface MessageComposerProps {
  disabled?: boolean;
  disabledReason?: string;
  sending?: boolean;
  error?: string | null;
  onSend: (message: string) => Promise<boolean> | boolean | void;
}

export function MessageComposer({ disabled = false, disabledReason, sending = false, error, onSend }: MessageComposerProps) {
  const [value, setValue] = useState('');
  const [lastAttempt, setLastAttempt] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || disabled || sending) return;
    setLastAttempt(trimmed);
    const ok = await onSend(trimmed);
    if (ok !== false) {
      setValue('');
      requestAnimationFrame(() => {
        if (textareaRef.current) resize(textareaRef.current);
      });
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit(value);
    }
  };

  const isOverLimit = value.length > MAX_LENGTH;
  const canSend = !disabled && !sending && value.trim().length > 0 && !isOverLimit;

  return (
    <div className="border-t border-gray-100 bg-white p-3">
      {disabled && disabledReason && (
        <p data-testid="composer-disabled-reason" className="mb-2 px-1 text-xs font-medium text-gray-400">
          {disabledReason}
        </p>
      )}

      {error && (
        <div
          role="alert"
          data-testid="composer-error"
          className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
        >
          <span className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {error}
          </span>
          <button
            type="button"
            data-testid="composer-retry"
            onClick={() => void submit(lastAttempt)}
            className="shrink-0 font-semibold underline underline-offset-2"
          >
            Tentar novamente
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <label htmlFor="conversation-message-input" className="sr-only">
          Mensagem
        </label>
        <textarea
          id="conversation-message-input"
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={disabled || sending}
          placeholder="Escreva uma mensagem..."
          onChange={(event) => {
            setValue(event.target.value);
            resize(event.target);
          }}
          onKeyDown={handleKeyDown}
          className="max-h-40 flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="button"
          data-testid="composer-send"
          disabled={!canSend}
          onClick={() => void submit(value)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Enviar mensagem"
        >
          {sending ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      {value.length > WARN_THRESHOLD && (
        <p
          data-testid="composer-char-count"
          className={cn('mt-1 px-1 text-right text-[11px] font-medium', isOverLimit ? 'text-red-600' : 'text-amber-600')}
        >
          {value.length}/{MAX_LENGTH}
        </p>
      )}
    </div>
  );
}
