import { supabase } from './supabase';
import { getSupabaseAdmin } from './supabase-admin';
import { logger } from './logger';

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
    logger.warn("Telegram bot token missing. Message not sent.", { userId });
    return false;
  }

  chatId = to.replace(/\D/g, '');
  if (!chatId) {
    logger.warn("Invalid Telegram chat ID, not sending.", { userId }, { to });
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
      logger.error("Failed to send Telegram message", { userId }, { status: response.status, body: errorData.slice(0, 300) });
      return false;
    }

    return true;
  } catch (error) {
    logger.error("Error sending Telegram message", { userId }, { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

export function generateTelegramDeepLink(botUsername: string, caseId: string) {
  const payload = Buffer.from(`case_${caseId}`).toString('base64');
  return `https://t.me/${botUsername}?start=${payload}`;
}
