export async function sendWhatsAppMessage(to: string, message: string) {
  const instanceId = process.env.ZAPI_INSTANCE_ID;
  const token = process.env.ZAPI_TOKEN;

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

  // Prefer the specific token the user provided.
  const clientToken = "F6878a6908a754c0ea7b778bd45a51c10S";

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
