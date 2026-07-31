import { supabase } from './supabase';

export async function sendWhatsAppMessage(to: string, message: string, userId?: string) {
  let instanceId = process.env.ZAPI_INSTANCE_ID;
  let token = process.env.ZAPI_TOKEN;
  let clientToken = "F6878a6908a754c0ea7b778bd45a51c10S";

  if (userId && supabase) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('zapi_instance, zapi_key, zapi_client_token')
      .eq('id', userId)
      .single();
    
    if (profile) {
      if (profile.zapi_instance) instanceId = profile.zapi_instance;
      if (profile.zapi_key) token = profile.zapi_key;
      if (profile.zapi_client_token) clientToken = profile.zapi_client_token;
    }
  }

  if (!instanceId || !token) {
    console.warn("Z-API credentials missing. Simulating sending message to:", to);
    console.log("Message:", message);
    return true; // Simulate success if no keys are provided
  }

  // Format phone number to numbers only, usually starting with 55 for Brazil in Z-API
  let formattedPhone = to.replace(/\D/g, '');
  if (formattedPhone.length >= 10 && !formattedPhone.startsWith('55')) {
    formattedPhone = `55${formattedPhone}`;
  }

  try {
    const response = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Client-Token": clientToken,
        },
        body: JSON.stringify({
          phone: formattedPhone,
          message: message
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Failed to send Z-API message:", errorData);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error sending Z-API message:", error);
    return false;
  }
}
