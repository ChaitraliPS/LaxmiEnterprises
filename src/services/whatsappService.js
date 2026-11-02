/**
 * WhatsApp Integration Service for Laxmi Enterprises
 * Handles phone number normalization, template rendering, and bulk message dispatching.
 */

// Pre-defined Agribusiness follow-up templates
export const WHATSAPP_TEMPLATES = [
  {
    id: "stall_thank_you",
    name: "1. Expo Stall Visit - Thank You & Welcome",
    category: "General",
    description: "Personalized thank you message for visiting the stall with village & discussion remarks.",
    text: "Namaskar {{name}} ji! 🙏\n\nThank you for visiting the *Laxmi Enterprises* stall at *{{expoName}}*. It was wonderful connecting with you regarding your agribusiness requirements from *{{village}}*.\n\n📝 *Discussion Note:* {{remark}}\n\nPlease let us know if you need our latest product catalog and wholesale rate sheet. We are happy to assist!\n\nWarm regards,\n*Laxmi Enterprises - Agribusiness & Cattle Feed Supplies*\n📞 Contact: {{companyPhone}}\n📍 Pune, Maharashtra"
  },
  {
    id: "feed_shop_offer",
    name: "2. Animal Feed Shop - Special Expo Wholesale Offer",
    category: "Animal Feed Shop",
    description: "Promotional message for Feed Shop owners with brands, company rates, and freight discount.",
    text: "Namaskar {{name}} ji (*{{village}}*)! 🌾\n\nFollowing our meeting at *{{expoName}}*, Laxmi Enterprises is pleased to offer exclusive exhibition pricing on all major cattle feed brands:\n\n⭐ *Brands Available:* Godrej MilkMore, Samruddhi Supreme, Kapila Gold, Amul Dan\n📦 *Stock:* Cattle Feed, Calf Starter, Mineral Mixture, Calcium Supplement, Maize Silage\n\n📝 *Your Inquiry Remark:* {{remark}}\n\nBook your consignment this week to avail *Special Freight Subsidy* for {{village}} deliveries!\n\nReply *YES* to get the current wholesale price list.\n\n*Laxmi Enterprises* | 📞 {{companyPhone}}"
  },
  {
    id: "dairy_procurement",
    name: "3. Dairy & Milk Center - Procurement Follow-up",
    category: "Dairy",
    description: "Follow-up for Dairy cooperatives & chilling centers on bulk milk collection & testing supplies.",
    text: "Namaskar {{name}} ji (*{{village}}*)! 🥛\n\nThank you for visiting us at *{{expoName}}*. We had a fruitful discussion regarding milk procurement and dairy supplies.\n\n📝 *Meeting Note:* {{remark}}\n\nLaxmi Enterprises provides dedicated support for dairy cooperatives, BMC centers, and bulk milk testing equipment with flexible payment terms.\n\nPlease let us know when our field representative can visit your center in {{village}}.\n\n*Laxmi Enterprises Dairy Division* | 📞 {{companyPhone}}"
  },
  {
    id: "farmer_direct",
    name: "4. Farmer Direct - Silage & High-Yield Fodder Offer",
    category: "Farmers",
    description: "Direct message for farmers offering green silage bales, mineral feed, and livestock nutrition.",
    text: "Namaskar {{name}} shetkari bandhu (Farmer Friend)! 🚜\n\nIt was great meeting you at *{{expoName}}*! As discussed regarding your farm in *{{village}}*:\n\n📝 *Note / Remark:* {{remark}}\n\nWe have fresh stocks of *Sweet Corn Silage Bales, Lucerne Hay, and Premium Mineral Mixtures* ready for direct dispatch to {{village}} at direct manufacturer rates.\n\nIncrease your daily milk yield with balanced animal nutrition! Reply or call us directly to book your batch.\n\n*Laxmi Enterprises* | 📞 {{companyPhone}}"
  },
  {
    id: "custom_message",
    name: "5. Custom Message Composer",
    category: "Custom",
    description: "Write your own custom broadcast message using live personalization variables.",
    text: "Namaskar {{name}} ji from {{village}}! Regarding {{expoName}}: {{remark}}. Best regards, Laxmi Enterprises ({{companyPhone}})."
  }
];

/**
 * Normalizes Indian mobile number to WhatsApp compatible E.164 format without '+'
 * e.g. "9822456789" -> "919822456789"
 * e.g. "+91 98224-56789" -> "919822456789"
 */
export function normalizeWhatsAppNumber(mobile) {
  if (!mobile) return "";
  let cleaned = String(mobile).replace(/[^0-9]/g, "");

  // If 10 digits (standard Indian mobile), prepend 91
  if (cleaned.length === 10) {
    cleaned = "91" + cleaned;
  } else if (cleaned.length === 12 && cleaned.startsWith("91")) {
    // Already has 91 prefix
    return cleaned;
  } else if (cleaned.length === 11 && cleaned.startsWith("0")) {
    cleaned = "91" + cleaned.substring(1);
  }
  return cleaned;
}

/** True when the number is a valid Indian mobile (91 + 10 digits starting 6-9) */
export function isValidWhatsAppNumber(mobile) {
  return /^91[6-9]\d{9}$/.test(normalizeWhatsAppNumber(mobile));
}

/**
 * Interpolates variables inside a template string
 * Variables supported: {{name}}, {{village}}, {{mobile}}, {{remark}}, {{expoName}}, {{companyName}}, {{companyPhone}}, {{date}}
 */
export function renderWhatsAppMessage(templateText, lead = {}, company = {}) {
  if (!templateText) return "";

  const name = lead.name || "Customer";
  const village = lead.village || "Maharashtra";
  const mobile = lead.mobile || lead.contact || "";
  const remark = lead.remark || lead.note || "General Inquiry";
  const expoName = lead.expoName || "Agri Expo 2026";
  const companyName = company.name || "Laxmi Enterprises";
  const companyPhone = company.phone || "+91 98765 43210";
  const date = lead.date || new Date().toISOString().slice(0, 10);

  return templateText
    .replace(/\{\{name\}\}/gi, name)
    .replace(/\{\{village\}\}/gi, village)
    .replace(/\{\{mobile\}\}/gi, mobile)
    .replace(/\{\{remark\}\}/gi, remark)
    .replace(/\{\{note\}\}/gi, remark)
    .replace(/\{\{expoName\}\}/gi, expoName)
    .replace(/\{\{companyName\}\}/gi, companyName)
    .replace(/\{\{companyPhone\}\}/gi, companyPhone)
    .replace(/\{\{date\}\}/gi, date);
}

/**
 * Adds an image link at the end of a message. WhatsApp usually shows
 * a preview of a direct image link inside the chat.
 */
export function appendImageLink(message, imageUrl) {
  if (!imageUrl) return message;
  return `${message}\n\n🖼️ ${imageUrl}`;
}

/**
 * Generates an instant WhatsApp Web / App direct click-to-chat URL
 * Works on Mobile (opens WhatsApp directly) and Desktop (opens WhatsApp Web or App)
 */
export function getWhatsAppUrl(mobile, messageText) {
  const normalizedNumber = normalizeWhatsAppNumber(mobile);
  const encodedText = encodeURIComponent(messageText || "");
  if (!normalizedNumber) {
    return `https://api.whatsapp.com/send?text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?phone=${normalizedNumber}&text=${encodedText}`;
}

/**
 * Generates a vCard (.vcf) string from leads for 1-click phone address book import,
 * allowing instant creation of a WhatsApp Broadcast List on Android/iPhone.
 */
export function generateVCardString(leads = []) {
  let vcf = "";
  leads.forEach((lead) => {
    const cleanNum = normalizeWhatsAppNumber(lead.mobile || lead.contact);
    if (!cleanNum) return;
    const displayName = `${lead.name || "Expo Lead"} (${lead.village || "Agri"})`;
    vcf += "BEGIN:VCARD\n";
    vcf += "VERSION:3.0\n";
    vcf += `FN:${displayName}\n`;
    vcf += `ORG:Laxmi Enterprises Expo Leads;${lead.expoName || "Expo 2026"}\n`;
    vcf += `TEL;TYPE=CELL:+${cleanNum}\n`;
    if (lead.email) vcf += `EMAIL:${lead.email}\n`;
    if (lead.village) vcf += `ADR;TYPE=HOME:;;${lead.village};;;;\n`;
    if (lead.remark) vcf += `NOTE:${lead.remark.replace(/\n/g, " ")}\n`;
    vcf += "END:VCARD\n";
  });
  return vcf;
}

/**
 * Downloads a .vcf contact file for bulk importing to phone
 */
export function downloadVCardFile(leads = [], fileName = "Laxmi_Enterprises_Expo_Contacts.vcf") {
  const vcfContent = generateVCardString(leads);
  const blob = new Blob([vcfContent], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Purchase-specific WhatsApp Message Templates
export const PURCHASE_WHATSAPP_TEMPLATES = [
  {
    id: "purchase_partial",
    name: "1. Day 1 Partial Payment & Advance Receipt",
    description: "Receipt notification with Day 1 advance paid, mode, and outstanding balance schedule.",
    text: "Namaskar {{vendorName}} ji! 🙏\n\nThis is an official payment confirmation and receipt from *{{companyName}}* regarding inward procurement order *{{id}}*.\n\n📋 *Voucher Ref:* {{id}}\n📄 *Bill / Inv No:* {{billNumber}}\n📅 *Date:* {{date}}\n🌾 *Sector:* {{category}}\n📦 *Item:* {{itemDescription}}\n\n💰 *Total Inward Value:* ₹{{totalAmount}}\n✅ *Day 1 Paid Amount:* ₹{{paidAmount}} (Settlement: {{paymentMethod}})\n{{#if day1Ref}}📝 *UTR / Ref No:* {{day1Ref}}\n{{/if}}⚠️ *Outstanding Balance Due:* ₹{{balanceDue}}\n⏳ *Payment Due Date:* {{dueDate}}\n\n🏢 *Delivery Note:* {{remarks}}\n\nThank you for your valuable partnership. You can download the full PDF receipt on our portal.\n\nWarm regards,\n*{{companyName}} - Accounts & Procurement*\n📞 Contact: {{companyPhone}}\n📍 Pune, Maharashtra"
  },
  {
    id: "purchase_receipt",
    name: "2. Full Inward Purchase Receipt (Settled)",
    description: "Complete procurement invoice and full payment realization voucher.",
    text: "Namaskar {{vendorName}} ji! 🙏\n\nPayment has been successfully realized for inward purchase *{{id}}* from *{{companyName}}*.\n\n📋 *Purchase Order Ref:* {{id}}\n📄 *Bill No:* {{billNumber}}\n📅 *Issue Date:* {{date}}\n📦 *Item Procured:* {{itemDescription}}\n\n💰 *Gross Inward Value:* ₹{{totalAmount}}\n✅ *Amount Paid (Realized):* ₹{{paidAmount}}\n💳 *Payment Mode:* {{paymentMethod}}\n📝 *Status:* Fully Paid & Settled\n\nThank you for supplying quality agricultural / dairy inventory!\n\n*{{companyName}}*\n📞 Contact: {{companyPhone}}"
  },
  {
    id: "purchase_due_reminder",
    name: "3. Outstanding Balance Schedule & Update",
    description: "Update on pending procurement payables and next installment schedule.",
    text: "Namaskar {{vendorName}} ji! 🙏\n\nRegarding purchase order *{{id}}* (Bill: *{{billNumber}}*):\n\n💰 *Total Procurement Value:* ₹{{totalAmount}}\n✅ *Paid So Far:* ₹{{paidAmount}}\n⚠️ *Pending Balance:* ₹{{balanceDue}}\n📅 *Scheduled Clearance Date:* {{dueDate}}\n\nOur accounts department has scheduled the balance clearance as per agreed terms.\n\n*{{companyName}}*\n📞 Contact: {{companyPhone}}"
  }
];

/**
 * Renders a personalized WhatsApp message for a Purchase Order / Inward Procurement
 */
export function renderPurchaseWhatsAppMessage(purchase = {}, company = {}, customTemplate = null) {
  let templateText = customTemplate;
  if (!templateText) {
    const isPartial = purchase.paymentStatus === "Partial";
    const tpl = PURCHASE_WHATSAPP_TEMPLATES.find(t => isPartial ? t.id === "purchase_partial" : t.id === "purchase_receipt");
    templateText = tpl ? tpl.text : PURCHASE_WHATSAPP_TEMPLATES[0].text;
  }

  const vendorName = purchase.vendorName || purchase.name || "Vendor";
  const companyName = company.name || "Laxmi Enterprises";
  const companyPhone = company.phone || "+91 98765 43210";
  const id = purchase.id || "-";
  const billNumber = purchase.billNumber || "-";
  const date = purchase.date || new Date().toISOString().slice(0, 10);
  const dueDate = purchase.dueDate || "-";
  const category = purchase.category || "Procurement";
  const itemDescription = purchase.itemDescription || "Agribusiness Supplies";
  const totalAmount = (Number(purchase.totalAmount) || 0).toLocaleString("en-IN");
  const paidAmount = (Number(purchase.paidAmount || purchase.day1Amount) || 0).toLocaleString("en-IN");
  const balanceDue = (Number(purchase.balanceDue) || 0).toLocaleString("en-IN");
  const paymentMethod = purchase.day1Method || purchase.paymentMethod || "Bank Transfer";
  const remarks = purchase.remarks || "Direct delivery to warehouse";
  const day1Ref = purchase.day1Ref || "";

  let msg = templateText
    .replace(/\{\{vendorName\}\}/gi, vendorName)
    .replace(/\{\{companyName\}\}/gi, companyName)
    .replace(/\{\{companyPhone\}\}/gi, companyPhone)
    .replace(/\{\{id\}\}/gi, id)
    .replace(/\{\{billNumber\}\}/gi, billNumber)
    .replace(/\{\{date\}\}/gi, date)
    .replace(/\{\{dueDate\}\}/gi, dueDate)
    .replace(/\{\{category\}\}/gi, category)
    .replace(/\{\{itemDescription\}\}/gi, itemDescription)
    .replace(/\{\{totalAmount\}\}/gi, totalAmount)
    .replace(/\{\{paidAmount\}\}/gi, paidAmount)
    .replace(/\{\{balanceDue\}\}/gi, balanceDue)
    .replace(/\{\{paymentMethod\}\}/gi, paymentMethod)
    .replace(/\{\{remarks\}\}/gi, remarks)
    .replace(/\{\{day1Ref\}\}/gi, day1Ref);

  // Handle conditional block for day1Ref
  if (day1Ref) {
    msg = msg.replace(/\{\{#if day1Ref\}\}([\s\S]*?)\{\{\/if\}\}/gi, "$1");
  } else {
    msg = msg.replace(/\{\{#if day1Ref\}\}[\s\S]*?\{\{\/if\}\}/gi, "");
  }

  return msg;
}

/**
 * Generates instant WhatsApp click-to-chat URL for a Purchase Order
 */
export function getPurchaseWhatsAppUrl(purchase = {}, company = {}, customMessage = null) {
  const phone = purchase.contact || purchase.mobile || "";
  const msg = customMessage || renderPurchaseWhatsAppMessage(purchase, company);
  return getWhatsAppUrl(phone, msg);
}