import { sendWhatsAppMessage } from './whatsapp';
import { sendTelegramMessage } from './telegram';
import { supabase } from './supabase';
import { getSupabaseAdmin } from './supabase-admin';

export type MessagingProvider = 'whatsapp' | 'telegram';

export async function getMessagingProvider(userId?: string): Promise<MessagingProvider> {
  const globalProvider = (process.env.MESSAGING_PROVIDER || 'whatsapp') as MessagingProvider;

  if (!userId) return globalProvider;

  let profile: any = null;
  const admin = getSupabaseAdmin();
  if (admin) {
    const { data, error } = await admin
      .from('profiles')
      .select('messaging_provider')
      .eq('id', userId)
      .maybeSingle();
    if (!error && data) profile = data;
  }

  if (!profile) {
    const client = admin || supabase;
    const { data } = await client!
      .from('profiles')
      .select('messaging_provider')
      .eq('id', userId)
      .maybeSingle();
    profile = data;
  }

  return (profile?.messaging_provider || globalProvider) as MessagingProvider;
}

export async function sendMessage(to: string, message: string, userId?: string) {
  const provider = await getMessagingProvider(userId);

  if (provider === 'telegram') {
    return sendTelegramMessage(to, message, userId);
  }

  return sendWhatsAppMessage(to, message, userId);
}
