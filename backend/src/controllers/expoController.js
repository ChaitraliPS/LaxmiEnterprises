import { Op } from "sequelize";
import { ExpoLead } from "../models/ExpoLead.js";
import cloudinary, { isCloudinaryConfigured } from "../config/cloudinary.js";
import { WHATSAPP_CLOUD_TEMPLATES } from "../config/whatsappTemplates.js";
import {
  isWhatsAppCloudConfigured,
  sendTemplateMessage,
  toWhatsAppNumber,
} from "../services/whatsappCloudService.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const cleanMobile = (m = "") => String(m).replace(/\D/g, "").slice(-10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Frontend field names -> database columns
const toColumns = (b) => {
  const c = {};
  if (b.name !== undefined) c.visitorName = String(b.name).trim();
  if (b.mobile !== undefined) c.contact = cleanMobile(b.mobile);
  if (b.remark !== undefined) c.notes = String(b.remark).trim();
  for (const f of ["village", "taluka", "district", "category", "expoName", "email", "status"]) {
    if (b[f] !== undefined) c[f] = typeof b[f] === "string" ? b[f].trim() : b[f];
  }
  return c;
};

// Extra fields kept inside the extraData JSON column (no migration needed)
const toExtra = (b) => {
  const e = {};
  if (b.date !== undefined) e.visitDate = b.date;
  if (b.whatsappConsent !== undefined) e.whatsappConsent = !!b.whatsappConsent;
  return e;
};

const validate = (c, partial = false) => {
  if (!partial || c.visitorName !== undefined) {
    if (!c.visitorName || c.visitorName.length < 2) throw ApiError.badRequest("Visitor name is required");
  }
  if (!partial || c.village !== undefined) {
    if (!c.village || c.village.length < 2) throw ApiError.badRequest("Village is required");
  }
  if (!partial || c.contact !== undefined) {
    if (!/^[6-9]\d{9}$/.test(c.contact || "")) throw ApiError.badRequest("Enter a valid 10-digit mobile number");
  }
};

const nextLeadId = async () => {
  const last = await ExpoLead.findOne({ order: [["id", "DESC"]] });
  const n = last ? parseInt(String(last.leadId).match(/\d+$/)?.[0] || "0", 10) + 1 : 1;
  return `EXP-${String(n).padStart(3, "0")}`;
};

/** Get all exhibition leads */
export const getLeads = asyncHandler(async (req, res) => {
  const leads = await ExpoLead.findAll({ order: [["createdAt", "DESC"]] });
  return ApiResponse.success(res, leads, "Expo leads retrieved successfully");
});

/** Create a new expo lead */
export const createLead = asyncHandler(async (req, res) => {
  const cols = toColumns(req.body);
  validate(cols);

  const dup = await ExpoLead.findOne({
    where: { contact: cols.contact, expoName: cols.expoName ?? null },
  });
  if (dup) {
    throw ApiError.badRequest(`${cols.contact} is already registered for this expo (${dup.leadId})`);
  }

  const lead = await ExpoLead.create({
    ...cols,
    leadId: await nextLeadId(),
    extraData: { whatsappConsent: true, ...toExtra(req.body) },
  });
  return ApiResponse.created(res, lead, "Expo lead registered successfully");
});

/** Update a lead (edit details or status). There is intentionally no delete. */
export const updateLead = asyncHandler(async (req, res) => {
  const lead = await ExpoLead.findOne({ where: { leadId: req.params.id } });
  if (!lead) throw ApiError.notFound(`Lead not found with id: ${req.params.id}`);

  const cols = toColumns(req.body);
  validate(cols, true);

  if (cols.contact && cols.contact !== lead.contact) {
    const dup = await ExpoLead.findOne({
      where: {
        contact: cols.contact,
        expoName: cols.expoName ?? lead.expoName,
        leadId: { [Op.ne]: lead.leadId },
      },
    });
    if (dup) throw ApiError.badRequest(`${cols.contact} already belongs to ${dup.leadId}`);
  }

  await lead.update({
    ...cols,
    extraData: { ...(lead.extraData || {}), ...toExtra(req.body) },
  });
  return ApiResponse.success(res, lead, "Lead updated successfully");
});

/** Manual mode: log that WhatsApp message(s) were opened for these leads */
export const markWhatsAppBroadcast = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) throw ApiError.badRequest("ids[] required");

  const leads = await ExpoLead.findAll({ where: { leadId: ids } });
  const now = new Date().toISOString();
  for (const l of leads) {
    await l.update({
      whatsappBroadcastSent: true,
      status: ["New", "New Lead"].includes(l.status) ? "Followed Up" : l.status,
      extraData: { ...(l.extraData || {}), whatsappSentAt: now },
    });
  }
  return ApiResponse.success(res, leads, "WhatsApp broadcast logged");
});

/** Tells the frontend whether automatic sending is set up, and which templates exist */
export const getBroadcastConfig = asyncHandler(async (req, res) => {
  return ApiResponse.success(
    res,
    {
      configured: isWhatsAppCloudConfigured(),
      dailyLimit: parseInt(process.env.WHATSAPP_DAILY_LIMIT || "250", 10),
      templates: WHATSAPP_CLOUD_TEMPLATES,
    },
    "Broadcast config"
  );
});

/** Automatic mode: send an approved template to a batch of leads via the WhatsApp Cloud API */
export const sendBroadcast = asyncHandler(async (req, res) => {
  if (!isWhatsAppCloudConfigured()) {
    throw ApiError.badRequest("WhatsApp Cloud API is not configured on the server");
  }

  const { ids, templateId, imageUrl, resend = false } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) throw ApiError.badRequest("ids[] required");
  if (ids.length > 50) throw ApiError.badRequest("Send in batches of up to 50 visitors");

  const template = WHATSAPP_CLOUD_TEMPLATES.find((t) => t.id === templateId);
  if (!template) throw ApiError.badRequest("Unknown template");
  if (template.imageHeader && !/^https:\/\//i.test(imageUrl || "")) {
    throw ApiError.badRequest("This template needs a public https image link");
  }

  // Approximate daily cap: count messages accepted by WhatsApp in the last 24 hours
  const dailyLimit = parseInt(process.env.WHATSAPP_DAILY_LIMIT || "250", 10);
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const all = await ExpoLead.findAll({ attributes: ["leadId", "extraData"] });
  const usedToday = all.filter((l) => {
    const x = l.extraData || {};
    return x.whatsappStatus === "sent" && x.whatsappSentAt && new Date(x.whatsappSentAt).getTime() > since;
  }).length;
  let remaining = Math.max(0, dailyLimit - usedToday);

  const leads = await ExpoLead.findAll({ where: { leadId: ids } });
  const results = [];
  const updated = [];

  for (const lead of leads) {
    const j = lead.toJSON();
    const base = { id: j.id, name: j.name };

    if (j.whatsappConsent === false) { results.push({ ...base, status: "skipped", reason: "No consent" }); continue; }
    const to = toWhatsAppNumber(j.mobile);
    if (!to) { results.push({ ...base, status: "skipped", reason: "Invalid number" }); continue; }
    if (lead.whatsappBroadcastSent && !resend) { results.push({ ...base, status: "skipped", reason: "Already sent" }); continue; }
    if (remaining <= 0) { results.push({ ...base, status: "skipped", reason: "Daily limit reached" }); continue; }

    const extra = lead.extraData || {};
    try {
      const messageId = await sendTemplateMessage({
        to,
        template,
        imageUrl,
        values: { name: j.name, expoName: j.expoName, village: j.village, remark: j.remark },
      });
      remaining -= 1;
      await lead.update({
        whatsappBroadcastSent: true,
        status: ["New", "New Lead"].includes(lead.status) ? "Followed Up" : lead.status,
        extraData: {
          ...extra,
          whatsappSentAt: new Date().toISOString(),
          whatsappStatus: "sent", // accepted by WhatsApp (delivery receipts need a webhook)
          whatsappMessageId: messageId,
          whatsappError: null,
        },
      });
      results.push({ ...base, status: "sent" });
    } catch (err) {
      await lead.update({
        extraData: { ...extra, whatsappStatus: "failed", whatsappError: String(err.message).slice(0, 300) },
      });
      results.push({ ...base, status: "failed", reason: err.message });
    }

    updated.push(lead.toJSON());
    await sleep(120); // stay well below Meta's rate limits
  }

  return ApiResponse.success(res, { results, leads: updated }, "Broadcast processed");
});

/** Image upload for WhatsApp campaigns. Stores on Cloudinary and returns a public URL. */
export const uploadMedia = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest("Image file is required");
  if (!isCloudinaryConfigured()) {
    throw ApiError.badRequest("Image storage is not configured on the server (Cloudinary keys missing)");
  }

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "laxmi-expo-campaigns", resource_type: "image" },
      (err, uploaded) => (err ? reject(err) : resolve(uploaded))
    );
    stream.end(req.file.buffer);
  });

  return ApiResponse.created(res, { url: result.secure_url }, "Image uploaded");
});