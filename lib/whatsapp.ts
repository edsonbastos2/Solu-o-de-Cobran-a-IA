import { supabase } from './supabase';
import { getSupabaseAdmin } from './supabase-admin';
import { logger } from './logger';

export async function sendWhatsAppMessage(to: string, message: string, userId?: string) {
  let instanceId = process.env.ZAPI_INSTANCE_ID;
  let token = process.env.ZAPI_TOKEN;
  let clientToken = process.env.ZAPI_CLIENT_TOKEN;

  if (userId) {
    const admin = getSupabaseAdmin();
    let profile: any = null;
    if (admin) {
      const { data: rpcData, error } = await admin.rpc('get_user_ai_keys', { p_user_id: userId });
      if (!error && rpcData && rpcData.length > 0) profile = rpcData[0];
    }
    if (!profile) {
      const client = admin || supabase;
      const { data } = await client!
        .from('profiles')
        .select('zapi_instance, zapi_key, zapi_client_token')
        .eq('id', userId)
        .single();
      profile = data;
    }
    if (profile) {
      if (profile.zapi_instance) instanceId = profile.zapi_instance;
      if (profile.zapi_key) token = profile.zapi_key;
      if (profile.zapi_client_token) clientToken = profile.zapi_client_token;
    }
  }

  if (!instanceId || !token) {
    logger.warn("Z-API credentials missing. Message not sent.", { userId });
    return false;
  }

  // Validação básica de telefone brasileiro (apenas dígitos, 10-13 chars)
  let formattedPhone = to.replace(/\D/g, '');
  if (formattedPhone.length < 10 || formattedPhone.length > 13) {
    logger.warn("Invalid phone number format, not sending.", { userId }, { to });
    return false;
  }
  if (!formattedPhone.startsWith('55')) {
    formattedPhone = `55${formattedPhone}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(clientToken ? { "Client-Token": clientToken } : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          phone: formattedPhone,
          message: message
        }),
      }
    );
    clearTimeout(timeout);

    if (!response.ok) {
      const errorData = await response.text();
      logger.error("Failed to send Z-API message", { userId }, { status: response.status, body: errorData.slice(0, 300) });
      return false;
    }

    return true;
  } catch (error) {
    logger.error("Error sending Z-API message", { userId }, { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}
