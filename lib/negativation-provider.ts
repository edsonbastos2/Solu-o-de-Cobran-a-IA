import { logger } from '@/lib/logger';

export type NegativationProviderId = 'serasa' | 'spc' | 'boavista';

/**
 * Provider mock de negativação (Serasa/SPC/Boa Vista).
 * Em produção, substituir por chamadas HTTP reais mantendo a mesma interface.
 * Retorna uma referência externa e simula a confirmação do provedor com
 * delay determinístico baseado no 'notified_at' (5 dias úteis por padrão).
 */
export interface NegativationProviderRequest {
  tenantId: string;
  clientId: string | null;
  financialTitleId: string;
  document: string | null;
  clientName: string | null;
  contractNumber: string | null;
  amount: number | null;
  provider: NegativationProviderId;
}

export const NEGATIVATION_PROVIDERS: NegativationProviderId[] = ['serasa', 'spc', 'boavista'];

export function getNegativationProvider(enabled: 'serasa' | 'spc' | 'boavista' | 'auto' = 'auto'): NegativationProviderId {
  const configured = (process.env.NEGATIVATION_PROVIDER || 'auto') as NegativationProviderId | 'auto';
  if (configured !== 'auto' && NEGATIVATION_PROVIDERS.includes(configured)) return configured;
  const idx = new Date().getTime() % NEGATIVATION_PROVIDERS.length;
  return NEGATIVATION_PROVIDERS[idx];
}

/**
 * Registra a negativação junto ao provedor (mock). Persiste a referência
 * externa via callback para não acoplar o provider ao cliente Supabase.
 */
export async function mockRequestNegativation(
  request: NegativationProviderRequest,
  persistExternalRef: (externalRef: string) => Promise<void>
): Promise<string> {
  const ref = `${request.provider.toUpperCase()}-${request.tenantId.slice(0, 8)}-${request.financialTitleId.slice(0, 8)}-${Date.now().toString(36)}`;
  logger.info('[negativation-provider] mock request', { tenantId: request.tenantId, provider: request.provider }, { financialTitleId: request.financialTitleId });
  await persistExternalRef(ref);
  return ref;
}