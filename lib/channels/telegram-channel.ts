import { logger } from '../logger';
import type { CommunicationChannel } from './channel';
import type {
  ChannelCapabilities,
  ChannelContext,
  ChannelRecipient,
  SendOutcome,
} from './types';

const TELEGRAM_TIMEOUT_MS = 10000;

/** Mapeamento de erros HTTP do Telegram Bot API para mensagens claras (requisito da task 3). */
function mapTelegramHttpError(status: number): { error: string; retryable: boolean } | null {
  switch (status) {
    case 400:
      return { error: 'Mensagem inválida ou muito grande', retryable: false };
    case 401:
      return { error: 'Token do bot inválido', retryable: false };
    case 403:
      return { error: 'Devedor bloqueou o bot', retryable: false };
    case 429:
      return { error: 'Limite de envios do Telegram atingido', retryable: true };
    default:
      return null;
  }
}

async function extractExternalMessageId(response: Response): Promise<string | undefined> {
  try {
    const data: unknown = await response.json();
    if (typeof data === 'object' && data !== null) {
      const result = (data as Record<string, unknown>).result;
      if (typeof result === 'object' && result !== null) {
        const messageId = (result as Record<string, unknown>).message_id;
        if (typeof messageId === 'number' || typeof messageId === 'string') return String(messageId);
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export class TelegramChannel implements CommunicationChannel {
  readonly id = 'telegram' as const;
  readonly capabilities: ChannelCapabilities = { maxMessageLength: 4096, deliveryReceipts: false };

  validateRecipient(externalId: string): boolean {
    return /^\d+$/.test(externalId.trim());
  }

  async sendMessage(ctx: ChannelContext, recipient: ChannelRecipient, content: string): Promise<SendOutcome> {
    if (!ctx.enabled) {
      return { status: 'failed', error: 'Canal Telegram desabilitado para o tenant', retryable: false };
    }
    if (!('botToken' in ctx.credentials) || !ctx.credentials.botToken) {
      return { status: 'failed', error: 'Token do bot Telegram não configurado', retryable: false };
    }
    const credentials = ctx.credentials;
    if (content.length > this.capabilities.maxMessageLength) {
      return {
        status: 'failed',
        error: `Mensagem excede o limite de ${this.capabilities.maxMessageLength} caracteres do Telegram`,
        retryable: false,
      };
    }
    const chatId = recipient.externalId.trim();
    if (!this.validateRecipient(chatId)) {
      return { status: 'failed', error: 'Chat ID do Telegram inválido', retryable: false };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);
      try {
        const response = await fetch(`https://api.telegram.org/bot${credentials.botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            chat_id: chatId,
            text: content,
            parse_mode: 'HTML',
          }),
        });

        if (!response.ok) {
          const errorData = await response.text();
          logger.error(
            'Falha no envio de mensagem via Telegram',
            { tenantId: ctx.tenantId },
            { status: response.status, body: errorData.slice(0, 300) }
          );
          const mapped = mapTelegramHttpError(response.status);
          if (mapped) return { status: 'failed', ...mapped };
          return {
            status: 'failed',
            error: `Falha no envio via Telegram (HTTP ${response.status})`,
            retryable: response.status >= 500,
          };
        }

        const externalMessageId = await extractExternalMessageId(response);
        return externalMessageId
          ? { status: 'sent', externalMessageId }
          : { status: 'sent' };
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      logger.error(
        'Erro no envio de mensagem via Telegram',
        { tenantId: ctx.tenantId },
        { error: error instanceof Error ? error.message : String(error) }
      );
      return {
        status: 'failed',
        error: isTimeout ? 'Tempo limite de envio via Telegram excedido' : 'Erro de rede ao enviar via Telegram',
        retryable: true,
      };
    }
  }
}

export const telegramChannel = new TelegramChannel();
