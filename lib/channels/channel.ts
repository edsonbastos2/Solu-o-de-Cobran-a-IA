import type {
  ChannelCapabilities,
  ChannelContext,
  ChannelId,
  ChannelRecipient,
  SendOutcome,
} from './types';

/**
 * Contrato mínimo de um canal de comunicação (ADR-004).
 * Recebimento é push de webhook e status faz parte do SendOutcome —
 * por isso não existem receiveMessage/getStatus aqui.
 */
export interface CommunicationChannel {
  readonly id: ChannelId;
  readonly capabilities: ChannelCapabilities;
  validateRecipient(externalId: string): boolean;
  sendMessage(ctx: ChannelContext, recipient: ChannelRecipient, content: string): Promise<SendOutcome>;
}
