import { logger } from '../logger';
import type { CommunicationChannel } from './channel';
import type {
  ChannelCapabilities,
  ChannelContext,
  ChannelRecipient,
  SendOutcome,
} from './types';

const ZAPI_TIMEOUT_MS = 10000;
const PHONE_MIN_DIGITS = 10;
const PHONE_MAX_DIGITS = 13;
const BRAZIL_COUNTRY_CODE = '55';

/** Dígitos do telefone com prefixo 55, ou null quando o formato é inválido (10-13 dígitos). */
function normalizePhone(externalId: string): string | null {
  const digits = externalId.replace(/\D/g, '');
  if (digits.length < PHONE_MIN_DIGITS || digits.length > PHONE_MAX_DIGITS) return null;
  return digits.startsWith(BRAZIL_COUNTRY_CODE) ? digits : `${BRAZIL_COUNTRY_CODE}${digits}`;
}

async function extractExternalMessageId(response: Response): Promise<string | undefined> {
  try {
    const data: unknown = await response.json();
    if (typeof data === 'object' && data !== null) {
      const record = data as Record<string, unknown>;
      for (const key of ['zaapId', 'messageId', 'id']) {
        const value = record[key];
        if (typeof value === 'string' && value.length > 0) return value;
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export class WhatsAppChannel implements CommunicationChannel {
  readonly id = 'whatsapp' as const;
  readonly capabilities: ChannelCapabilities = { maxMessageLength: 4096, deliveryReceipts: false };

  validateRecipient(externalId: string): boolean {
    return normalizePhone(externalId) !== null;
  }

  async sendMessage(ctx: ChannelContext, recipient: ChannelRecipient, content: string): Promise<SendOutcome> {
    if (!ctx.enabled) {
      return { status: 'failed', error: 'Canal WhatsApp desabilitado para o tenant', retryable: false };
    }
    if (!('zapiInstanceId' in ctx.credentials) || !ctx.credentials.zapiInstanceId || !ctx.credentials.zapiKey) {
      return { status: 'failed', error: 'Credenciais Z-API não configuradas', retryable: false };
    }
    const credentials = ctx.credentials;
    if (content.length > this.capabilities.maxMessageLength) {
      return {
        status: 'failed',
        error: `Mensagem excede o limite de ${this.capabilities.maxMessageLength} caracteres do WhatsApp`,
        retryable: false,
      };
    }
    const phone = normalizePhone(recipient.externalId);
    if (!phone) {
      return { status: 'failed', error: 'Número de telefone inválido', retryable: false };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), ZAPI_TIMEOUT_MS);
      try {
        const response = await fetch(
          `https://api.z-api.io/instances/${credentials.zapiInstanceId}/token/${credentials.zapiKey}/send-text`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(credentials.zapiClientToken ? { 'Client-Token': credentials.zapiClientToken } : {}),
            },
            signal: controller.signal,
            body: JSON.stringify({ phone, message: content }),
          }
        );

        if (!response.ok) {
          const errorData = await response.text();
          logger.error(
            'Falha no envio de mensagem via Z-API',
            { tenantId: ctx.tenantId },
            { status: response.status, body: errorData.slice(0, 300) }
          );
          return {
            status: 'failed',
            error: `Falha no envio via WhatsApp (HTTP ${response.status})`,
            retryable: response.status === 429 || response.status >= 500,
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
        'Erro no envio de mensagem via Z-API',
        { tenantId: ctx.tenantId },
        { error: error instanceof Error ? error.message : String(error) }
      );
      return {
        status: 'failed',
        error: isTimeout ? 'Tempo limite de envio via WhatsApp excedido' : 'Erro de rede ao enviar via WhatsApp',
        retryable: true,
      };
    }
  }
}

export const whatsappChannel = new WhatsAppChannel();
