import "server-only";

/**
 * WhatsApp OTP delivery. Not wired to a provider yet.
 *
 * To integrate (e.g. WhatsApp Cloud API), implement the fetch() below. Only call a FIXED provider URL
 * (never a URL derived from user input) to avoid SSRF. Set WHATSAPP_TOKEN / WHATSAPP_PHONE_ID in env.
 *
 * Until then:
 *  - dev: the code is printed to the server console
 *  - set DEV_SHOW_OTP=true to also show the code on screen (for demos/testing ONLY; never in real production)
 */
export async function sendWhatsAppOtp(phone: string, code: string, salonName: string): Promise<{ ok: boolean; devCode?: string }> {
  if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID) {
    // TODO: POST https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages with a template message
    // containing `code` and `salonName`. Return { ok: res.ok }.
    return { ok: false };
  }
  if (process.env.NODE_ENV !== "production") console.log(`[OTP] ${salonName} ${phone}: ${code}`);
  if (process.env.DEV_SHOW_OTP === "true") return { ok: true, devCode: code };
  return { ok: process.env.NODE_ENV !== "production" };
}
