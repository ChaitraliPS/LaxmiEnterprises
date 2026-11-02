// Must match the templates approved in WhatsApp Manager (same name, language and variable order).
export const WHATSAPP_CLOUD_TEMPLATES = [
  {
    id: "expo_thank_you_v1",
    name: "expo_thank_you_v1",
    language: "en",
    label: "Thank-you with offer poster (image)",
    imageHeader: true,
    bodyVars: ["name", "expoName", "village", "remark"], // = {{1}} {{2}} {{3}} {{4}}
    preview:
      "Namaskar {{name}} ji! 🙏\n\nThank you for visiting the Laxmi Enterprises stall at {{expoName}}. It was great connecting with you from {{village}}.\n\nYour inquiry: {{remark}}\n\nCall us for the latest catalog and wholesale rates. To stop updates, reply STOP.",
  },
  {
    id: "expo_thank_you_text_v1",
    name: "expo_thank_you_text_v1",
    language: "en",
    label: "Thank-you (text only)",
    imageHeader: false,
    bodyVars: ["name", "expoName", "village", "remark"],
    preview:
      "Namaskar {{name}} ji! 🙏\n\nThank you for visiting the Laxmi Enterprises stall at {{expoName}}. It was great connecting with you from {{village}}.\n\nYour inquiry: {{remark}}\n\nCall us for the latest catalog and wholesale rates. To stop updates, reply STOP.",
  },
];