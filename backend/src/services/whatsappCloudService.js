const API_VERSION = () => process.env.WHATSAPP_API_VERSION || "v23.0";

export const isWhatsAppCloudConfigured = () =>
  !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

// Indian mobile -> 91XXXXXXXXXX (empty string if invalid)
export const toWhatsAppNumber = (mobile) => {
  const digits = String(mobile || "").replace(/\D/g, "");
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `91${digits}`;
  if (digits.length === 12 && /^91[6-9]/.test(digits)) return digits;
  return "";
};

// Template variables cannot contain new lines, tabs or long runs of spaces
const cleanParam = (v, max = 200) =>
  String(v ?? "").replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim().slice(0, max) || "-";

export async function sendTemplateMessage({ to, template, values, imageUrl }) {
  const components = [];

  if (template.imageHeader) {
    if (!imageUrl) throw new Error("This template needs an image");
    components.push({
      type: "header",
      parameters: [{ type: "image", image: { link: imageUrl } }],
    });
  }
  if (template.bodyVars.length) {
    components.push({
      type: "body",
      parameters: template.bodyVars.map((key) => ({ type: "text", text: cleanParam(values[key]) })),
    });
  }

  const res = await fetch(
    `https://graph.facebook.com/${API_VERSION()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: { name: template.name, language: { code: template.language }, components },
      }),
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `WhatsApp API error (${res.status})`);
  return data?.messages?.[0]?.id || null;
}