import React from "react";
import {
  Truck, X, Pencil, Mail, Phone, Building2, MapPin,
  CreditCard, FileText, CheckCircle2, ShieldCheck
} from "lucide-react";

export default function VendorDetailsModal({
  isOpen,
  onClose,
  vendor,
  onEdit
}) {
  if (!isOpen || !vendor) return null;

  const vendorName = vendor.name || vendor.companyName || "Vendor";
  const vendorId = vendor.id || vendor.vendorId || "VEN-001";
  const category = vendor.category || "Feed Manufacturer";
  const status = vendor.status || "Active";
  const paymentTerms = vendor.paymentTerms || "Net 15 Days";

  const fullAddress = [
    vendor.address,
    vendor.village && `Village: ${vendor.village}`,
    vendor.taluka && `Taluka: ${vendor.taluka}`,
    vendor.city,
    vendor.district && `Dist: ${vendor.district}`,
    vendor.state,
    vendor.pincode && `PIN: ${vendor.pincode}`
  ].filter(Boolean).join(", ") || vendor.address || "Pune, Maharashtra";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
        {/* MODAL HEADER */}
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              className="mini-avatar"
              style={{
                width: 44,
                height: 44,
                fontSize: 18,
                background: "var(--primary-light)",
                color: "var(--primary)",
                fontWeight: 800,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center"
              }}
            >
              {vendorName ? vendorName[0].toUpperCase() : "V"}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{vendorName}</h3>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 12,
                    background: category.toLowerCase().includes("dairy")
                      ? "rgba(14, 165, 233, 0.12)"
                      : category.toLowerCase().includes("raw")
                      ? "rgba(16, 185, 129, 0.12)"
                      : "rgba(99, 102, 241, 0.12)",
                    color: category.toLowerCase().includes("dairy")
                      ? "#0284c7"
                      : category.toLowerCase().includes("raw")
                      ? "#059669"
                      : "#4f46e5"
                  }}
                >
                  <Truck size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                  {category}
                </span>
                <span className={`badge ${status === "Active" ? "success" : "muted"}`} style={{ fontSize: 11 }}>
                  {status}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                Vendor ID: <code>{vendorId}</code> | Terms: <b>{paymentTerms}</b>
              </div>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={17} />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="modal-body" style={{ maxHeight: "75vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Card 1: Contact & Location */}
          <div className="client-detail-card">
            <div className="client-detail-card-title">
              <Building2 size={15} style={{ color: "var(--primary)" }} />
              Vendor Contact & Business Identity
            </div>
            <div className="client-detail-row">
              <span className="client-detail-label">Contact Person:</span>
              <span className="client-detail-val">{vendor.contactPerson || "Proprietor / Representative"}</span>
            </div>
            <div className="client-detail-row">
              <span className="client-detail-label">Phone Number:</span>
              <span className="client-detail-val">{vendor.phone || vendor.contact || "—"}</span>
            </div>
            <div className="client-detail-row">
              <span className="client-detail-label">Email Address:</span>
              <span className="client-detail-val">{vendor.email || "—"}</span>
            </div>
            <div className="client-detail-row">
              <span className="client-detail-label">Full Address / Location:</span>
              <span className="client-detail-val" style={{ maxWidth: 360 }}>
                {fullAddress}
              </span>
            </div>
          </div>

          {/* Card 2: Trade & Tax Compliance */}
          <div className="client-detail-card">
            <div className="client-detail-card-title">
              <FileText size={15} style={{ color: "var(--primary)" }} />
              Trade & Tax Compliance
            </div>
            <div className="client-detail-row">
              <span className="client-detail-label">GSTIN:</span>
              <span className="client-detail-val">
                {vendor.gstin ? <code>{vendor.gstin}</code> : "Unregistered / Composition"}
              </span>
            </div>
            <div className="client-detail-row">
              <span className="client-detail-label">Permanent Account Number (PAN):</span>
              <span className="client-detail-val">{vendor.pan || "—"}</span>
            </div>
            <div className="client-detail-row">
              <span className="client-detail-label">Procurement Category:</span>
              <span className="client-detail-val"><b>{category}</b></span>
            </div>
            <div className="client-detail-row">
              <span className="client-detail-label">Standard Settlement Terms:</span>
              <span className="client-detail-val"><b>{paymentTerms}</b></span>
            </div>
            {vendor.notes && (
              <div className="client-detail-row">
                <span className="client-detail-label">Commercial Notes:</span>
                <span className="client-detail-val" style={{ fontStyle: "italic" }}>{vendor.notes}</span>
              </div>
            )}
          </div>

          {/* Card 3: Banking & Settlement */}
          <div className="client-detail-card">
            <div className="client-detail-card-title">
              <CreditCard size={15} style={{ color: "var(--primary)" }} />
              Bank Account & RTGS / NEFT Details
            </div>
            <div className="client-detail-row">
              <span className="client-detail-label">Bank Name:</span>
              <span className="client-detail-val">{vendor.bankName || "—"}</span>
            </div>
            <div className="client-detail-row">
              <span className="client-detail-label">Account Number:</span>
              <span className="client-detail-val">
                {vendor.accountNumber ? <code>{vendor.accountNumber}</code> : "—"}
              </span>
            </div>
            <div className="client-detail-row">
              <span className="client-detail-label">IFSC Code:</span>
              <span className="client-detail-val">
                {vendor.ifscCode ? <code>{vendor.ifscCode}</code> : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* MODAL FOOTER - VIEW & EDIT PATTERN */}
        <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button type="button" className="outline" onClick={onClose}>
              Close
            </button>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {onEdit && (
              <button
                type="button"
                className="primary"
                onClick={() => onEdit(vendor)}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <Pencil size={15} /> Edit Vendor
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
