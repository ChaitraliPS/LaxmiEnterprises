import React, { useState, useEffect } from "react";
import {
  Truck, X, Save, AlertTriangle, Building2, Phone, Mail,
  CreditCard, MapPin, FileText, CheckCircle2
} from "lucide-react";
import {
  validateMobile,
  validateEmail,
  validateGSTIN,
  validatePAN,
  validateRequiredText,
  validateUniqueId,
} from "../utils/validators";
import { FieldError, RequiredStar, ValidationSummary } from "./ValidationFeedback";

const VENDOR_CATEGORIES = [
  "Feed Manufacturer",
  "Dairy Processor",
  "Raw Materials Supplier",
];

const normalizeVendorCategory = (cat) => {
  const c = String(cat || "").trim().toLowerCase();
  if (c.includes("raw") || c.includes("material")) return "Raw Materials Supplier";
  if (c.includes("dairy") || c.includes("milk") || c.includes("process")) return "Dairy Processor";
  if (c.includes("feed") || c.includes("animal") || c.includes("mfg") || c.includes("manufactur")) return "Feed Manufacturer";
  return "Feed Manufacturer";
};

const PAYMENT_TERMS_OPTIONS = [
  "Immediate / Cash on Delivery",
  "Net 7 Days",
  "Net 15 Days",
  "Net 30 Days",
  "50% Advance + 50% on Delivery",
  "Fortnightly Dairy Settlement",
];

export default function VendorModal({
  isOpen,
  onClose,
  onSave,
  vendorToEdit = null,
  nextId = "VEN-001",
  existingIds = [],
}) {
  if (!isOpen) return null;
  const isEditing = !!vendorToEdit;

  const [form, setForm] = useState(() => {
    if (vendorToEdit) {
      return {
        id: vendorToEdit.id || vendorToEdit.vendorId || nextId,
        vendorId: vendorToEdit.vendorId || vendorToEdit.id || nextId,
        name: vendorToEdit.name || "",
        companyName: vendorToEdit.companyName || vendorToEdit.name || "",
        category: normalizeVendorCategory(vendorToEdit.category || "Animal Feed Shop"),
        contactPerson: vendorToEdit.contactPerson || "",
        phone: vendorToEdit.phone || vendorToEdit.contact || "",
        email: vendorToEdit.email || "",
        gstin: vendorToEdit.gstin || "",
        pan: vendorToEdit.pan || "",
        village: vendorToEdit.village || "",
        taluka: vendorToEdit.taluka || "",
        district: vendorToEdit.district || "Pune",
        city: vendorToEdit.city || "Pune",
        state: vendorToEdit.state || "Maharashtra",
        pincode: vendorToEdit.pincode || "",
        address: vendorToEdit.address || "",
        bankName: vendorToEdit.bankName || "",
        accountNumber: vendorToEdit.accountNumber || "",
        ifscCode: vendorToEdit.ifscCode || "",
        paymentTerms: vendorToEdit.paymentTerms || "Net 15 Days",
        status: vendorToEdit.status || "Active",
        notes: vendorToEdit.notes || "",
      };
    }
    return {
      id: nextId,
      vendorId: nextId,
      name: "",
      companyName: "",
      category: "Animal Feed Shop",
      contactPerson: "",
      phone: "",
      email: "",
      gstin: "",
      pan: "",
      village: "",
      taluka: "",
      district: "Pune",
      city: "Pune",
      state: "Maharashtra",
      pincode: "",
      address: "",
      bankName: "",
      accountNumber: "",
      ifscCode: "",
      paymentTerms: "Net 15 Days",
      status: "Active",
      notes: "",
    };
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (vendorToEdit) {
      setForm({
        id: vendorToEdit.id || vendorToEdit.vendorId || nextId,
        vendorId: vendorToEdit.vendorId || vendorToEdit.id || nextId,
        name: vendorToEdit.name || "",
        companyName: vendorToEdit.companyName || vendorToEdit.name || "",
        category: normalizeVendorCategory(vendorToEdit.category || "Animal Feed Shop"),
        contactPerson: vendorToEdit.contactPerson || "",
        phone: vendorToEdit.phone || vendorToEdit.contact || "",
        email: vendorToEdit.email || "",
        gstin: vendorToEdit.gstin || "",
        pan: vendorToEdit.pan || "",
        village: vendorToEdit.village || "",
        taluka: vendorToEdit.taluka || "",
        district: vendorToEdit.district || "Pune",
        city: vendorToEdit.city || "Pune",
        state: vendorToEdit.state || "Maharashtra",
        pincode: vendorToEdit.pincode || "",
        address: vendorToEdit.address || "",
        bankName: vendorToEdit.bankName || "",
        accountNumber: vendorToEdit.accountNumber || "",
        ifscCode: vendorToEdit.ifscCode || "",
        paymentTerms: vendorToEdit.paymentTerms || "Net 15 Days",
        status: vendorToEdit.status || "Active",
        notes: vendorToEdit.notes || "",
      });
      setErrors({});
    }
  }, [vendorToEdit, nextId]);

  const handleChange = (field, val) => {
    setForm(prev => ({ ...prev, [field]: val }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validate = () => {
    const errs = {};

    // Vendor ID
    const idVal = validateUniqueId(
      form.vendorId || form.id,
      existingIds,
      isEditing ? (vendorToEdit.vendorId || vendorToEdit.id) : null,
      "Vendor ID"
    );
    if (!idVal.isValid) errs.vendorId = idVal.error;

    // Vendor Name
    const nameVal = validateRequiredText(form.name, "Vendor / Trade Name", 2);
    if (!nameVal.isValid) errs.name = nameVal.error;

    // Contact Person
    const personVal = validateRequiredText(form.contactPerson, "Contact Person", 2);
    if (!personVal.isValid) errs.contactPerson = personVal.error;

    // Phone / Mobile
    const phoneVal = validateMobile(form.phone, true);
    if (!phoneVal.isValid) errs.phone = phoneVal.error;

    // Email (optional)
    if (form.email && form.email.trim()) {
      const emailVal = validateEmail(form.email, false);
      if (!emailVal.isValid) errs.email = emailVal.error;
    }

    // GSTIN (optional but if provided, must be valid)
    if (form.gstin && form.gstin.trim()) {
      const gstinVal = validateGSTIN(form.gstin, false);
      if (!gstinVal.isValid) errs.gstin = gstinVal.error;
    }

    // PAN (optional but if provided, must be valid)
    if (form.pan && form.pan.trim()) {
      const panVal = validatePAN(form.pan, false);
      if (!panVal.isValid) errs.pan = panVal.error;
    }

    // City / Village
    const cityVal = validateRequiredText(form.city || form.village, "City or Village", 2);
    if (!cityVal.isValid) errs.city = cityVal.error;

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      ...form,
      id: form.vendorId || form.id,
      vendorId: form.vendorId || form.id,
      companyName: form.companyName || form.name,
      contact: form.phone,
      totalPurchases: Number(vendorToEdit?.totalPurchases || 0),
      totalOrders: Number(vendorToEdit?.totalOrders || 0),
      outstandingPayable: Number(vendorToEdit?.outstandingPayable || 0),
    };

    onSave(payload);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-card"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 780,
          width: "95vw",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div className="modal-header" style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: "rgba(16, 185, 129, 0.12)",
              color: "#059669",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Truck size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "var(--text-main)" }}>
                {isEditing ? `Edit Vendor: ${form.name}` : "Register New Vendor / Supplier"}
              </h3>
              <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)" }}>
                {isEditing
                  ? "Update vendor commercial profile, bank accounts, and procurement terms"
                  : "Add verified supplier or farm cooperative for inward raw goods procurement"}
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div className="modal-body" style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
            <ValidationSummary errors={errors} title="Please resolve the following fields:" />

            {/* Basic Identity & Category */}
            <div style={{
              background: "var(--card-bg, #ffffff)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "16px",
              marginBottom: 16,
            }}>
              <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <Building2 size={16} style={{ color: "var(--primary)" }} />
                Supplier Identity & Sector
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Vendor Identifier <RequiredStar /></label>
                  <input
                    className={`form-input ${errors.vendorId ? "is-invalid" : ""}`}
                    value={form.vendorId}
                    onChange={e => handleChange("vendorId", e.target.value.toUpperCase())}
                    placeholder="e.g. VEN-001"
                    disabled={isEditing}
                    style={{ fontFamily: "monospace", fontWeight: 700 }}
                    required
                  />
                  <FieldError error={errors.vendorId} />
                </div>

                <div className="form-group">
                  <label>Procurement Category <RequiredStar /></label>
                  <select
                    className="form-select"
                    value={form.category}
                    onChange={e => handleChange("category", e.target.value)}
                  >
                    {VENDOR_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group full">
                  <label>Vendor / Trade Name <RequiredStar /></label>
                  <input
                    className={`form-input ${errors.name ? "is-invalid" : ""}`}
                    value={form.name}
                    onChange={e => handleChange("name", e.target.value)}
                    placeholder="e.g. Baramati Agro Feeds Ltd or Tukaram Dairy Cooperative"
                    required
                  />
                  <FieldError error={errors.name} />
                </div>

                <div className="form-group">
                  <label>Contact Person <RequiredStar /></label>
                  <input
                    className={`form-input ${errors.contactPerson ? "is-invalid" : ""}`}
                    value={form.contactPerson}
                    onChange={e => handleChange("contactPerson", e.target.value)}
                    placeholder="e.g. Rajesh Patil"
                    required
                  />
                  <FieldError error={errors.contactPerson} />
                </div>

                <div className="form-group">
                  <label>Primary Phone <RequiredStar /></label>
                  <input
                    className={`form-input ${errors.phone ? "is-invalid" : ""}`}
                    value={form.phone}
                    onChange={e => handleChange("phone", e.target.value)}
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    required
                  />
                  <FieldError error={errors.phone} />
                </div>

                <div className="form-group">
                  <label>Email Address (optional)</label>
                  <input
                    type="email"
                    className={`form-input ${errors.email ? "is-invalid" : ""}`}
                    value={form.email}
                    onChange={e => handleChange("email", e.target.value)}
                    placeholder="e.g. sales@baramatiagro.com"
                  />
                  <FieldError error={errors.email} />
                </div>

                <div className="form-group">
                  <label>Vendor Status</label>
                  <select
                    className="form-select"
                    value={form.status}
                    onChange={e => handleChange("status", e.target.value)}
                  >
                    <option value="Active">Active Supplier</option>
                    <option value="Inactive">Inactive / Suspended</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tax & Commercial Compliance */}
            <div style={{
              background: "var(--card-bg, #ffffff)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "16px",
              marginBottom: 16,
            }}>
              <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <FileText size={16} style={{ color: "#d97706" }} />
                GSTIN, PAN & Payment Settlement Terms
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Vendor GSTIN <small style={{ color: "var(--text-muted)", fontWeight: "normal" }}>(Optional)</small></label>
                  <input
                    className={`form-input ${errors.gstin ? "is-invalid" : ""}`}
                    value={form.gstin}
                    onChange={e => handleChange("gstin", e.target.value.toUpperCase())}
                    placeholder="e.g. 27AAAAA0000A1Z5"
                    maxLength={15}
                    style={{ textTransform: "uppercase", fontFamily: "monospace" }}
                  />
                  <FieldError error={errors.gstin} />
                </div>

                <div className="form-group">
                  <label>PAN Number <small style={{ color: "var(--text-muted)", fontWeight: "normal" }}>(Optional)</small></label>
                  <input
                    className={`form-input ${errors.pan ? "is-invalid" : ""}`}
                    value={form.pan}
                    onChange={e => handleChange("pan", e.target.value.toUpperCase())}
                    placeholder="e.g. ABCDE1234F"
                    maxLength={10}
                    style={{ textTransform: "uppercase", fontFamily: "monospace" }}
                  />
                  <FieldError error={errors.pan} />
                </div>

                <div className="form-group full">
                  <label>Procurement Payment Terms</label>
                  <select
                    className="form-select"
                    value={form.paymentTerms}
                    onChange={e => handleChange("paymentTerms", e.target.value)}
                  >
                    {PAYMENT_TERMS_OPTIONS.map(term => (
                      <option key={term} value={term}>{term}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Address & Logistics Location */}
            <div style={{
              background: "var(--card-bg, #ffffff)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "16px",
              marginBottom: 16,
            }}>
              <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <MapPin size={16} style={{ color: "#2563eb" }} />
                Address & Dispatch Location
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>City / Town <RequiredStar /></label>
                  <input
                    className={`form-input ${errors.city ? "is-invalid" : ""}`}
                    value={form.city}
                    onChange={e => handleChange("city", e.target.value)}
                    placeholder="e.g. Pune / Baramati"
                    required
                  />
                  <FieldError error={errors.city} />
                </div>

                <div className="form-group">
                  <label>Village / Taluka (optional)</label>
                  <input
                    className="form-input"
                    value={form.village}
                    onChange={e => handleChange("village", e.target.value)}
                    placeholder="e.g. Indapur Taluka"
                  />
                </div>

                <div className="form-group">
                  <label>District</label>
                  <input
                    className="form-input"
                    value={form.district}
                    onChange={e => handleChange("district", e.target.value)}
                    placeholder="e.g. Pune"
                  />
                </div>

                <div className="form-group">
                  <label>Pincode</label>
                  <input
                    className="form-input"
                    value={form.pincode}
                    onChange={e => handleChange("pincode", e.target.value)}
                    placeholder="e.g. 411038"
                    maxLength={6}
                  />
                </div>

                <div className="form-group full">
                  <label>Full Address / Landmark</label>
                  <textarea
                    rows={2}
                    className="form-input"
                    value={form.address}
                    onChange={e => handleChange("address", e.target.value)}
                    placeholder="Street, Industrial Area or Chilling Plant Bay address"
                  />
                </div>
              </div>
            </div>

            {/* Bank Accounts for RTGS / NEFT */}
            <div style={{
              background: "var(--card-bg, #ffffff)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "16px",
            }}>
              <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <CreditCard size={16} style={{ color: "var(--primary)" }} />
                Bank Account for Vendor Remittances (RTGS / NEFT)
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Bank Name</label>
                  <input
                    className="form-input"
                    value={form.bankName}
                    onChange={e => handleChange("bankName", e.target.value)}
                    placeholder="e.g. State Bank of India"
                  />
                </div>

                <div className="form-group">
                  <label>Account Number</label>
                  <input
                    className="form-input"
                    value={form.accountNumber}
                    onChange={e => handleChange("accountNumber", e.target.value)}
                    placeholder="e.g. 30872619472"
                  />
                </div>

                <div className="form-group">
                  <label>IFSC Code</label>
                  <input
                    className="form-input"
                    value={form.ifscCode}
                    onChange={e => handleChange("ifscCode", e.target.value.toUpperCase())}
                    placeholder="e.g. SBIN0001234"
                    maxLength={11}
                    style={{ textTransform: "uppercase", fontFamily: "monospace" }}
                  />
                </div>

                <div className="form-group">
                  <label>Remarks / Notes</label>
                  <input
                    className="form-input"
                    value={form.notes}
                    onChange={e => handleChange("notes", e.target.value)}
                    placeholder="e.g. Primary cattle feed supplier"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer" style={{ padding: "14px 24px", borderTop: "1px solid var(--border)" }}>
            <button type="button" className="outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Save size={16} />
              {isEditing ? "Update Vendor Profile" : "Register Vendor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

