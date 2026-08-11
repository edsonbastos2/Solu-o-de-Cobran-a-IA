import { logger } from '@/lib/logger';

export type ProtestProviderId = 'cartorio' | 'central' | 'protesto_online';

/**
 * Provider mock de protesto em cartório (Lei 9.492/97).
 * Em produção, substituir por chamadas ao cartório/central (e.x. https://www.protestosp.com.br)
 * mantendo a mesma interface. Retorna uma referência externa que identifica o
 * registro do protesto na central.
 */
export interface ProtestProviderRequest {
  tenantId: string;
  clientId: string | null;
  financialTitleId: string;
  document: string | null;
  clientName: string | null;
  contractNumber: string | null;
  amount: number | null;
  provider: ProtestProviderId;
}

export const PROTEST_PROVIDERS: ProtestProviderId[] = ['cartorio', 'central', 'protesto_online'];

export function getProtestProvider(enabled: 'cartorio' | 'central' | 'protesto_online' | 'auto' = 'auto'): ProtestProviderId {
  const configured = (process.env.PROTEST_PROVIDER || 'auto') as ProtestProviderId | 'auto';
  if (configured !== 'auto' && PROTEST_PROVIDERS.includes(configured)) return configured;
  const idx = new Date().getTime() % PROTEST_PROVIDERS.length;
  return PROTEST_PROVIDERS[idx];
}

/**
 * Registra o protesto na central de cartórios (mock). Persiste a referência
 * externa via callback para não acoplar o provider ao cliente Supabase.
 */
export async function mockRequestProtest(
  request: ProtestProviderRequest,
  persistExternalRef: (externalRef: string) => Promise<void>
): Promise<string> {
  const ref = `${request.provider.toUpperCase()}-${request.tenantId.slice(0, 8)}-${request.financialTitleId.slice(0, 8)}-${Date.now().toString(36)}`;
  logger.info('[protest-provider] mock request', { tenantId: request.tenantId, provider: request.provider }, { financialTitleId: request.financialTitleId });
  await persistExternalRef(ref);
  return ref;
}