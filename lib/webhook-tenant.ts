import { SupabaseClient } from '@supabase/supabase-js';

interface WebhookTenantInput {
  instanceId?: string | null;
  botToken?: string | null;
  caseId?: string | null;
}

/** Resolve o tenant de uma integração sem escolher o primeiro tenant disponível. */
export async function resolveWebhookTenant(
  database: SupabaseClient,
  input: WebhookTenantInput
): Promise<string | null> {
  let caseTenant: string | null = null;
  if (input.caseId) {
    const { data: caseData, error } = await database
      .from('cases')
      .select('tenant_id')
      .eq('id', input.caseId)
      .maybeSingle();
    if (error || !caseData?.tenant_id) return null;
    caseTenant = caseData.tenant_id;
    if (!input.instanceId && !input.botToken) return caseTenant;
  }

  const profileQuery = database
    .from('profiles')
    .select('tenant_id')
    .not('tenant_id', 'is', null);
  const query = input.instanceId
    ? profileQuery.eq('zapi_instance', input.instanceId)
    : input.botToken
      ? profileQuery.eq('telegram_bot_token', input.botToken)
      : null;
  if (!query) return null;

  const { data, error } = await query.limit(2);
  if (error || !data || data.length !== 1) return null;
  const integrationTenant = data[0].tenant_id || null;
  return caseTenant && integrationTenant !== caseTenant ? null : integrationTenant;
}
