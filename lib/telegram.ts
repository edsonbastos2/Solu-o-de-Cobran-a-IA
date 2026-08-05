import { supabase } from './supabase';
import { getSupabaseAdmin } from './supabase-admin';

interface TelegramProfile {
  telegram_bot_token?: string;
  telegram_chat_id?: string;
}

export async function sendTelegramMessage(to: string, message: string, userId?: string) {
  let botToken = process.env.TELEGRAM_BOT_TOKEN;
  let chatId = '';

  if (userId) {
    const admin = getSupabaseAdmin();
    let profile: TelegramProfile | null = null;
    if (admin) {
      const { data: rpcData, error } = await admin.rpc('get_user_ai_keys', { p_user_id: userId });
      if (!error && rpcData && rpcData.length > 0) profile = rpcData[0];
    }
    if (!profile) {
      const client = admin || supabase;
      const { data } = await client!
        .from('profiles')
        .select('telegram_bot_token')
        .eq('id', userId)
        .single();
      profile = data;
    }
    if (profile?.telegram_bot_token) botToken = profile.telegram_bot_token;
  }

  if (!botToken) {
    console.warn("Telegram bot token missing. Message not sent.");
    return false;
  }

  chatId = to.replace(/\D/g, '');
  if (!chatId) {
    console.warn("Invalid Telegram chat ID, not sending:", to);
    return false;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
        }),
      }
    );
    clearTimeout(timeout);

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Failed to send Telegram message:", errorData);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error sending Telegram message:", error);
    return false;
  }
}

export function generateTelegramDeepLink(botUsername: string, caseId: string) {
  const payload = Buffer.from(`case_${caseId}`).toString('base64');
  return `https://t.me/${botUsername}?start=${payload}`;
}
