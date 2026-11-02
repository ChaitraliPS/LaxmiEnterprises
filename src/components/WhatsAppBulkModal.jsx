import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  X, Send, MessageCircle, Upload, Check, Smartphone, Copy,
  Image as ImageIcon, AlertTriangle
} from "lucide-react";
import {
  WHATSAPP_TEMPLATES,
  renderWhatsAppMessage,
  appendImageLink,
  getWhatsAppUrl,
  isValidWhatsAppNumber,
  downloadVCardFile
} from "../services/whatsappService";
import { uploadExpoImage, markBroadcastSent, getBroadcastConfig, sendBroadcast } from "../services/expoApi";

const CHUNK_SIZE = 20;

export default function WhatsAppBulkModal({
  isOpen,
  onClose,
  leads = [],
  company = {},
  showToast,
  onSent
}) {
  const [config, setConfig] = useState(null); // null = loading
  const [cloudTemplateId, setCloudTemplateId] = useState("");
  const [resend, setResend] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState(null);

  // Manual mode
  const [templateId, setTemplateId] = useState(WHATSAPP_TEMPLATES[0].id);
  const [text, setText] = useState(WHATSAPP_TEMPLATES[0].text);
  const [sentIds, setSentIds] = useState(new Set());
  const [copied, setCopied] = useState(false);

  // Shared
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setSentIds(new Set());
    setSummary(null);
    setConfig(null);
    getBroadcastConfig()
      .then((c) => {
        setConfig(c);
        if (c?.templates?.length) setCloudTemplateId((prev) => prev || c.templates[0].id);
      })
      .catch(() => setConfig({ configured: false, templates: [], dailyLimit: 0 }));
  }, [isOpen]);

  const eligible = useMemo(
    () => leads.filter((l) => l.whatsappConsent !== false && isValidWhatsAppNumber(l.mobile)),
    [leads]
  );
  const skipped = leads.length - eligible.length;

  const cloudTemplate = config?.templates?.find((t) => t.id === cloudTemplateId) || null;
  const autoTargets = useMemo(
    () => eligible.filter((l) => resend || !l.whatsappBroadcastSent),
    [eligible, resend]
  );
  const alreadySent = eligible.length - eligible.filter((l) => !l.whatsappBroadcastSent).length;

  const manualPending = eligible.filter((l) => !sentIds.has(l.id));

  if (!isOpen) return null;

  const isAuto = !!config?.configured;
  const sample = { name: "[Lead Name]", village: "[Village]", remark: "[Inquiry Details]", expoName: "[Agri Expo Event]" };
  const previewLead = (isAuto ? autoTargets[0] : manualPending[0]) || eligible[0] || sample;

  /* ---------- shared: image upload ---------- */
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      showToast?.("⚠ Only JPG, PNG or WEBP images are allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast?.("⚠ Image must be smaller than 5 MB");
      return;
    }
    setUploading(true);
    try {
      const res = await uploadExpoImage(file);
      setImageUrl(res.url);
      showToast?.("✓ Image uploaded");
    } catch (err) {
      showToast?.(`⚠ ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  /* ---------- automatic mode ---------- */
  const handleAutoSend = async () => {
    if (!cloudTemplate || sending) return;
    if (cloudTemplate.imageHeader && !imageUrl) {
      showToast?.("⚠ Upload an image first (this template needs one)");
      return;
    }
    if (autoTargets.length === 0) return;
    if (!window.confirm(
      `Send "${cloudTemplate.label}" to ${autoTargets.length} visitors now?\n\nWhatsApp charges for each delivered marketing message.`
    )) return;

    setSending(true);
    setSummary(null);
    setProgress({ done: 0, total: autoTargets.length });
    const all = [];
    try {
      for (let i = 0; i < autoTargets.length; i += CHUNK_SIZE) {
        const chunk = autoTargets.slice(i, i + CHUNK_SIZE);
        const data = await sendBroadcast({
          ids: chunk.map((l) => l.id),
          templateId: cloudTemplate.id,
          imageUrl: cloudTemplate.imageHeader ? imageUrl : undefined,
          resend
        });
        const results = data?.results || [];
        all.push(...results);
        onSent?.(data?.leads || []);
        setProgress({ done: Math.min(i + CHUNK_SIZE, autoTargets.length), total: autoTargets.length });
        if (results.some((r) => r.reason === "Daily limit reached")) break;
      }
    } catch (err) {
      showToast?.(`⚠ ${err.message}`);
    } finally {
      setSending(false);
      setSummary(all);
    }
  };

  /* ---------- manual mode ---------- */
  const buildManualMessage = (lead) => appendImageLink(renderWhatsAppMessage(text, lead, company), imageUrl);

  const handleTemplateChange = (e) => {
    const tpl = WHATSAPP_TEMPLATES.find((t) => t.id === e.target.value);
    setTemplateId(e.target.value);
    if (tpl) setText(tpl.text);
  };

  const openChat = (lead) => {
    window.open(getWhatsAppUrl(lead.mobile, buildManualMessage(lead)), "_blank", "noopener,noreferrer");
    setSentIds((prev) => new Set(prev).add(lead.id));
    markBroadcastSent([lead.id])
      .then((updated) => onSent?.(Array.isArray(updated) ? updated : []))
      .catch(() => showToast?.("⚠ Opened chat, but could not log it in the database"));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(buildManualMessage(previewLead));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sentCount = summary ? summary.filter((r) => r.status === "sent").length : 0;
  const failed = summary ? summary.filter((r) => r.status === "failed") : [];
  const skippedResults = summary ? summary.filter((r) => r.status === "skipped") : [];

  const previewText = isAuto
    ? renderWhatsAppMessage(cloudTemplate?.preview || "", previewLead, company)
    : buildManualMessage(previewLead);

  const showImageBox = isAuto ? !!cloudTemplate?.imageHeader : true;

  return (
    <div className="modal-backdrop" onClick={sending ? undefined : onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 760, width: "95%", maxHeight: "92vh", display: "flex", flexDirection: "column" }}
      >
        {/* HEAD */}
        <div className="modal-head" style={{ padding: "14px 22px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(37, 211, 102, 0.15)", color: "#128C7E", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Send size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
                WhatsApp Bulk Follow-up {isAuto ? "(Automatic)" : "(Manual)"}
              </h3>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
                {eligible.length} eligible{skipped > 0 ? ` • ${skipped} skipped (no valid number / no consent)` : ""}
                {isAuto ? ` • ${alreadySent} already messaged` : ` • ${sentIds.size} opened this session`}
              </p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} disabled={sending} aria-label="Close modal"><X size={18} /></button>
        </div>

        {/* BODY */}
        <div className="modal-body" style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
          {config === null && (
            <div style={{ padding: 12, fontSize: "0.85rem", color: "var(--text-muted)" }}>Checking WhatsApp setup...</div>
          )}

          {config && !isAuto && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.35)", borderRadius: 10, padding: 12, marginBottom: 14, fontSize: "0.82rem", lineHeight: 1.5 }}>
              <AlertTriangle size={16} style={{ color: "#d97706", flexShrink: 0, marginTop: 2 }} />
              <span>
                Automatic sending is not set up on the server yet, so this works in manual mode (one chat at a time).
                Add the WhatsApp Cloud API keys to the backend to send to everyone at once.
              </span>
            </div>
          )}

          {config && (
            <>
              {/* TEMPLATE */}
              {isAuto ? (
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label>Approved WhatsApp Template</label>
                  <select className="form-select" value={cloudTemplateId} onChange={(e) => setCloudTemplateId(e.target.value)} disabled={sending}>
                    {config.templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label>Message Template</label>
                    <select className="form-select" value={templateId} onChange={handleTemplateChange}>
                      {WHATSAPP_TEMPLATES.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label>Message (editable. Use {"{{name}}"}, {"{{village}}"}, {"{{remark}}"}, {"{{expoName}}"})</label>
                    <textarea className="form-input" rows={8} value={text} onChange={(e) => setText(e.target.value)} style={{ fontFamily: "inherit" }} />
                  </div>
                </>
              )}

              {/* IMAGE */}
              {showImageBox && (
                <div style={{ border: "1px dashed var(--border)", borderRadius: 10, padding: 14, marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <ImageIcon size={18} style={{ color: "var(--primary)" }} />
                    <strong style={{ fontSize: "0.9rem" }}>
                      {isAuto ? "Offer poster (attached as the message header)" : "Attach image (sent as a link)"}
                    </strong>
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} style={{ display: "none" }} />
                    <button type="button" className="outline" onClick={() => fileRef.current?.click()} disabled={uploading || sending}
                      style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem", padding: "5px 10px" }}>
                      <Upload size={14} /> {uploading ? "Uploading..." : imageUrl ? "Change image" : "Upload image"}
                    </button>
                    {imageUrl && !sending && (
                      <button type="button" onClick={() => setImageUrl("")}
                        style={{ border: "none", background: "none", color: "var(--danger)", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>
                        Remove
                      </button>
                    )}
                  </div>
                  {imageUrl && (
                    <img src={imageUrl} alt="Campaign" style={{ marginTop: 10, maxHeight: 120, borderRadius: 8, border: "1px solid var(--border)" }} />
                  )}
                  {!isAuto && (
                    <p style={{ margin: "10px 0 0", fontSize: "0.76rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                      In manual mode the image is added to each message as a link and WhatsApp usually shows a preview.
                    </p>
                  )}
                </div>
              )}

              {/* PREVIEW */}
              <div style={{ background: "rgba(37, 211, 102, 0.05)", border: "1px solid rgba(37, 211, 102, 0.3)", borderRadius: 10, padding: 14, marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <strong style={{ fontSize: "0.88rem", color: "#128C7E" }}>Preview for {previewLead.name}</strong>
                  {!isAuto && (
                    <button type="button" className="outline" onClick={handleCopy}
                      style={{ fontSize: "0.76rem", padding: "3px 8px", display: "flex", alignItems: "center", gap: 4 }}>
                      {copied ? <Check size={12} /> : <Copy size={12} />} Copy
                    </button>
                  )}
                </div>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit", fontSize: "0.82rem", lineHeight: 1.5, color: "var(--text-main)" }}>
                  {previewText}
                </pre>
              </div>

              {/* AUTOMATIC: options + result */}
              {isAuto && (
                <>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.84rem", marginBottom: 12, cursor: "pointer" }}>
                    <input type="checkbox" checked={resend} onChange={(e) => setResend(e.target.checked)} disabled={sending} />
                    Also message visitors who already received a message
                  </label>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.5 }}>
                    Ready to send: <b style={{ color: "var(--text-main)" }}>{autoTargets.length}</b> visitors.
                    Daily cap set on the server: <b style={{ color: "var(--text-main)" }}>{config.dailyLimit}</b> messages per 24 hours,
                    so a bigger list continues the next day.
                  </div>

                  {sending && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ height: 8, borderRadius: 6, background: "var(--border)", overflow: "hidden" }}>
                        <div style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`, height: "100%", background: "#25D366", transition: "width .3s" }} />
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
                        Sending {progress.done} / {progress.total}. Please keep this window open.
                      </div>
                    </div>
                  )}

                  {summary && (
                    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, fontSize: "0.84rem", lineHeight: 1.6 }}>
                      <div><b style={{ color: "#128C7E" }}>{sentCount}</b> sent • <b style={{ color: "var(--danger)" }}>{failed.length}</b> failed • <b>{skippedResults.length}</b> skipped</div>
                      {skippedResults.some((r) => r.reason === "Daily limit reached") && (
                        <div style={{ color: "#d97706" }}>Daily limit reached. Send the remaining visitors tomorrow.</div>
                      )}
                      {failed.length > 0 && (
                        <ul style={{ margin: "6px 0 0", paddingLeft: 18, maxHeight: 120, overflowY: "auto" }}>
                          {failed.map((r) => (
                            <li key={r.id}>{r.name}: {r.reason}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* MANUAL: recipient list */}
              {!isAuto && (
                <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ padding: "8px 12px", background: "var(--table-hover)", fontSize: "0.8rem", fontWeight: 700 }}>
                    Recipients ({eligible.length})
                  </div>
                  <div style={{ maxHeight: 220, overflowY: "auto" }}>
                    {eligible.length === 0 && (
                      <div style={{ padding: 14, fontSize: "0.84rem", color: "var(--text-muted)" }}>
                        No visitors with a valid mobile number and WhatsApp consent.
                      </div>
                    )}
                    {eligible.map((l) => {
                      const done = sentIds.has(l.id);
                      return (
                        <div key={l.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 12px", borderTop: "1px solid var(--border)", fontSize: "0.84rem" }}>
                          <div style={{ minWidth: 0 }}>
                            <b>{l.name}</b> <span style={{ color: "var(--text-muted)" }}>• {l.village} • {l.mobile}</span>
                          </div>
                          <button type="button" className={done ? "outline" : "primary"} onClick={() => openChat(l)}
                            style={done
                              ? { fontSize: "0.76rem", padding: "4px 10px", color: "#128C7E", borderColor: "#25D366", display: "flex", alignItems: "center", gap: 4 }
                              : { fontSize: "0.76rem", padding: "4px 10px", background: "#25D366", borderColor: "#25D366", color: "#fff", display: "flex", alignItems: "center", gap: 4 }}>
                            {done ? <><Check size={12} /> Opened</> : <><MessageCircle size={12} /> Open</>}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="modal-footer" style={{ padding: "14px 22px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="outline" onClick={onClose} disabled={sending}>Close</button>
            <button type="button" className="outline"
              onClick={() => {
                downloadVCardFile(eligible);
                showToast?.("✓ Downloaded contacts (.vcf)");
              }}
              style={{ display: "flex", alignItems: "center", gap: 6, color: "#128C7E", borderColor: "#25D366" }}>
              <Smartphone size={14} /> Contacts (.vcf)
            </button>
          </div>

          {config && isAuto && (
            <button type="button" className="primary" onClick={handleAutoSend}
              disabled={sending || autoTargets.length === 0}
              style={{ background: "#25D366", borderColor: "#25D366", color: "#fff", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
              <Send size={15} /> {sending ? "Sending..." : autoTargets.length === 0 ? "Nothing to send" : `Send to ${autoTargets.length} visitors`}
            </button>
          )}
          {config && !isAuto && (
            <button type="button" className="primary" onClick={() => manualPending[0] && openChat(manualPending[0])}
              disabled={manualPending.length === 0}
              style={{ background: "#25D366", borderColor: "#25D366", color: "#fff", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
              <Send size={15} /> {manualPending.length === 0 ? "All opened" : `Open next chat (${manualPending.length} left)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}