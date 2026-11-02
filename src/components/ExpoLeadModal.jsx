import React, { useState } from "react";
import { X, Save, MessageCircle, User, Wheat, Milk, Tractor } from "lucide-react";
import { getWhatsAppUrl } from "../services/whatsappService";
import { FieldError, RequiredStar, ValidationSummary } from "./ValidationFeedback";
import {
  validateRequiredText,
  validateMobile,
  validateEmail,
  validateDate
} from "../utils/validators";

const todayLocal = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export default function ExpoLeadModal({
  onClose,
  onSave,
  leadToEdit = null,
  nextId = "EXP-001",
  company = {}
}) {
  const isEditing = !!leadToEdit;

  const [form, setForm] = useState(() => {
    if (leadToEdit) return { whatsappConsent: true, ...leadToEdit };
    return {
      id: nextId,
      name: "",
      village: "",
      mobile: "",
      remark: "",
      category: "Farmers", // "Animal Feed Shop" | "Dairy" | "Farmers" | "General"
      taluka: "",
      district: "Pune",
      expoName: "Kisan Agri Expo 2026 - Pune",
      date: todayLocal(),
      status: "New Lead", // "New Lead" | "Followed Up" | "Interested" | "Converted"
      email: "",
      whatsappConsent: true
    };
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const clearError = (field) => {
    if (errors[field]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  const validateForm = () => {
    const errs = {};

    const nameVal = validateRequiredText(form.name, "Visitor Full Name", 2);
    if (!nameVal.isValid) errs.name = nameVal.error;

    const villageVal = validateRequiredText(form.village, "Village (गाव)", 2);
    if (!villageVal.isValid) errs.village = villageVal.error;

    const mobileVal = validateMobile(form.mobile, true);
    if (!mobileVal.isValid) errs.mobile = mobileVal.error;

    const remarkVal = validateRequiredText(form.remark, "Note / Remark", 3);
    if (!remarkVal.isValid) errs.remark = remarkVal.error;

    const dateVal = validateDate(form.date, "Visit Date", { isRequired: true });
    if (!dateVal.isValid) errs.date = dateVal.error;

    if (form.email) {
      const emailVal = validateEmail(form.email, false);
      if (!emailVal.isValid) errs.email = emailVal.error;
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving || !validateForm()) return;

    setSaving(true);
    try {
      await onSave({
        ...form,
        name: form.name.trim(),
        village: form.village.trim(),
        mobile: form.mobile.trim(),
        remark: form.remark.trim(),
        taluka: form.taluka ? form.taluka.trim() : "",
        district: form.district ? form.district.trim() : "Pune"
      });
      onClose();
    } catch (err) {
      setErrors({ form: err.message || "Could not save visitor. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const handleTestWhatsApp = () => {
    const mobVal = validateMobile(form.mobile, true);
    if (!mobVal.isValid) {
      setErrors((prev) => ({ ...prev, mobile: mobVal.error }));
      return;
    }
    const sampleMsg = `Namaskar ${form.name || "Customer"} ji! Greetings from ${company.name || "Laxmi Enterprises"} regarding your visit at ${form.expoName}. Note: ${form.remark || "Thank you for connecting!"}.`;
    const url = getWhatsAppUrl(form.mobile, sampleMsg);
    window.open(url, "_blank");
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 640, width: "95%", maxHeight: "92vh", display: "flex", flexDirection: "column" }}
      >
        {/* MODAL HEADER */}
        <div className="modal-head" style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: form.category === "Dairy" ? "rgba(2, 132, 199, 0.15)" :
                          form.category === "Farmers" ? "rgba(217, 119, 6, 0.15)" : "rgba(16, 185, 129, 0.15)",
              color: form.category === "Dairy" ? "#0284c7" :
                     form.category === "Farmers" ? "#d97706" : "#059669",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              {form.category === "Dairy" ? <Milk size={19} /> :
               form.category === "Farmers" ? <Tractor size={19} /> : <Wheat size={19} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
                {isEditing ? `Edit Expo Visitor: ${form.name}` : "Record New Expo Visitor"}
              </h3>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Exhibition visitor entry with verified mobile & details
              </p>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* MODAL BODY */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <div className="modal-body" style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

            <ValidationSummary errors={errors} title="Please fix the following visitor details:" />

            {/* EVENT & CATEGORY */}
            <div className="form-grid" style={{ marginBottom: 16 }}>
              <div className="form-group">
                <label>Expo / Exhibition Event <RequiredStar /></label>
                <select
                  className="form-select"
                  value={form.expoName}
                  onChange={(e) => setForm({ ...form, expoName: e.target.value })}
                  required
                >
                  <option value="Kisan Agri Expo 2026 - Pune">Kisan Agri Expo 2026 - Pune</option>
                  <option value="Maha Dairy Mela 2026 - Kolhapur">Maha Dairy Mela 2026 - Kolhapur</option>
                  <option value="Krishi Mahotsav 2026 - Baramati">Krishi Mahotsav 2026 - Baramati</option>
                  <option value="AgriTech Agro Expo 2026 - Nashik">AgriTech Agro Expo 2026 - Nashik</option>
                  <option value="Pashu Palan Mela 2026 - Sangli">Pashu Palan Mela 2026 - Sangli</option>
                </select>
              </div>

              <div className="form-group">
                <label>Visitor Sector / Category <RequiredStar /></label>
                <select
                  className="form-select"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  required
                >
                  <option value="Animal Feed Shop">Animal Feed Shop / Distributor</option>
                  <option value="Dairy">Dairy / Milk Collection Center</option>
                  <option value="Farmers">Farmers / Livestock Owner</option>
                  <option value="General">General Agribusiness Dealer</option>
                </select>
              </div>
            </div>

            {/* MANDATORY EXPO DETAILS: NAME, VILLAGE, MOBILE, NOTE REMARK */}
            <div style={{ background: "var(--table-hover)", padding: "14px 16px", borderRadius: 10, border: "1px solid var(--border)", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                <User size={15} style={{ color: "var(--primary)" }} />
                <strong style={{ fontSize: "0.9rem", color: "var(--text-main)" }}>
                  Primary Visitor Information (Required)
                </strong>
              </div>

              <div className="form-grid">
                <div className="form-group full">
                  <label>Visitor Full Name <RequiredStar /></label>
                  <input
                    className={`form-input ${errors.name ? "is-invalid" : ""}`}
                    value={form.name}
                    onChange={(e) => {
                      setForm({ ...form, name: e.target.value });
                      clearError("name");
                    }}
                    placeholder="e.g. Ramesh Patil / Sandeep Shinde"
                    required
                  />
                  <FieldError error={errors.name} />
                </div>

                <div className="form-group">
                  <label>Village (गाव) <RequiredStar /></label>
                  <input
                    className={`form-input ${errors.village ? "is-invalid" : ""}`}
                    value={form.village}
                    onChange={(e) => {
                      setForm({ ...form, village: e.target.value });
                      clearError("village");
                    }}
                    placeholder="e.g. Baramati Rural / Malegaon"
                    required
                  />
                  <FieldError error={errors.village} />
                </div>

                <div className="form-group">
                  <label>Mobile Number (WhatsApp) <RequiredStar /></label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      className={`form-input ${errors.mobile ? "is-invalid" : ""}`}
                      value={form.mobile}
                      onChange={(e) => {
                        setForm({ ...form, mobile: e.target.value });
                        clearError("mobile");
                      }}
                      placeholder="10-digit mobile number"
                      inputMode="numeric"
                      required
                    />
                    <button
                      type="button"
                      className="icon-btn"
                      style={{ background: "#25D366", color: "#fff", width: 38, flexShrink: 0 }}
                      title="Test WhatsApp connection"
                      onClick={handleTestWhatsApp}
                    >
                      <MessageCircle size={16} />
                    </button>
                  </div>
                  <FieldError error={errors.mobile} />
                </div>

                <div className="form-group full">
                  <label>Note / Remark (Inquiry Details & Discussion) <RequiredStar /></label>
                  <textarea
                    className={`form-input ${errors.remark ? "is-invalid" : ""}`}
                    rows={3}
                    value={form.remark}
                    onChange={(e) => {
                      setForm({ ...form, remark: e.target.value });
                      clearError("remark");
                    }}
                    placeholder="e.g. Inquired about Godrej MilkMore 50kg feed bags, has 22 cattle, wants wholesale rate list and doorstep delivery"
                    required
                  />
                  <FieldError error={errors.remark} />
                </div>
              </div>
            </div>

            {/* ADDITIONAL META */}
            <div className="form-grid">
              <div className="form-group">
                <label>Taluka (तालुका)</label>
                <input
                  className="form-input"
                  value={form.taluka}
                  onChange={(e) => setForm({ ...form, taluka: e.target.value })}
                  placeholder="e.g. Baramati / Haveli / Karveer"
                />
              </div>

              <div className="form-group">
                <label>District (जिल्हा)</label>
                <input
                  className="form-input"
                  value={form.district}
                  onChange={(e) => setForm({ ...form, district: e.target.value })}
                  placeholder="e.g. Pune / Kolhapur / Satara"
                />
              </div>

              <div className="form-group">
                <label>Visit Date <RequiredStar /></label>
                <input
                  type="date"
                  className={`form-input ${errors.date ? "is-invalid" : ""}`}
                  value={form.date}
                  onChange={(e) => {
                    setForm({ ...form, date: e.target.value });
                    clearError("date");
                  }}
                  required
                />
                <FieldError error={errors.date} />
              </div>

              <div className="form-group">
                <label>Lead Follow-up Status</label>
                <select
                  className="form-select"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="New Lead">New Lead</option>
                  <option value="Followed Up">Followed Up via WhatsApp</option>
                  <option value="Interested">High Interest / Quote Sent</option>
                  <option value="Converted">Converted to Active Client</option>
                </select>
              </div>
            </div>

            {/* WHATSAPP CONSENT */}
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: "0.86rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.whatsappConsent !== false}
                onChange={(e) => setForm({ ...form, whatsappConsent: e.target.checked })}
              />
              Visitor agreed to receive WhatsApp updates from us
            </label>

          </div>

          {/* MODAL FOOTER */}
          <div className="modal-footer" style={{ padding: "14px 22px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <button type="button" className="outline" onClick={onClose}>
              Cancel
            </button>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: "1 1 auto", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="outline"
                style={{ borderColor: "#25D366", color: "#128C7E", display: "flex", alignItems: "center", gap: 6, flex: "1 1 auto", justifyContent: "center" }}
                onClick={handleTestWhatsApp}
              >
                <MessageCircle size={15} /> WhatsApp
              </button>
              <button
                type="submit"
                className="primary"
                disabled={saving}
                style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 auto", justifyContent: "center" }}
              >
                <Save size={15} /> {saving ? "Saving..." : isEditing ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}