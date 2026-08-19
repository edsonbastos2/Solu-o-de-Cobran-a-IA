export type ChannelId = 'whatsapp' | 'telegram';

export interface ChannelRecipient {
  /** Telegram: chat_id numérico; WhatsApp: dígitos do telefone (sem prefixo 55). */
  externalId: string;
  /** Metadado descritivo — ex.: username do Telegram (nunca identificador). */
  metadata?: Record<string, unknown>;
}

export type SendOutcome =
  | { status: 'sent'; externalMessageId?: string }
  | {
      status: 'failed';
      /** Motivo em linguagem clara (ex.: "Devedor bloqueou o bot") — nunca payload bruto do provedor. */
      error: string;
      retryable: boolean;
    };

export interface ChannelCapabilities {
  maxMessageLength: number;
  deliveryReceipts: false;
}

export interface TelegramChannelCredentials {
  botToken: string;
}

export interface WhatsAppChannelCredentials {
  zapiInstanceId: string;
  zapiKey: string;
  zapiClientToken?: string;
}

export type ChannelCredentials = TelegramChannelCredentials | WhatsAppChannelCredentials;

/** Credenciais já resolvidas (decriptadas) do tenant — o adapter não acessa o banco. */
export interface ChannelContext {
  tenantId: string;
  enabled: boolean;
  credentials: ChannelCredentials;
}

/** Evento de entrada normalizado, produzido pelos webhooks para lib/channels/inbound. */
export interface InboundEvent {
  tenantId: string;
  channel: ChannelId;
  externalId: string;
  content: string;
  externalMessageId?: string;
  eventId: string;
  metadata: Record<string, unknown>;
}
