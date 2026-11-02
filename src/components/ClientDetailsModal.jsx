import React from "react";
import {
  Milk, Tractor, Wheat, X, Receipt, Pencil, Mail, Phone,
  Building2, Calendar, Building, Tag, IndianRupee, Award
} from "lucide-react";

export default function ClientDetailsModal({ isOpen, onClose, client, onEdit, onCreateInvoice }) {
  if (!isOpen || !client) return null;

  const getAge = (dobString) => {
    if (!dobString) return null;
    const birthDate = new Date(dobString);
    if (isNaN(birthDate.getTime())) return null;
    const diff = Date.now() - birthDate.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };
  const age = getAge(client.dob);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="mini-avatar" style={{ width: 44, height: 44, fontSize: 18, background: "var(--primary-light)", color: "var(--primary)", fontWeight: 800 }}>
              {client.name ? client.name[0] : "C"}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontSize: 17 }}>{client.name}</h3>
                <span className={`client-type-badge ${
                  client.clientType === "Dairy" ? "dairy" :
                  client.clientType === "Farmers" ? "farmers" : "feed-shop"
                }`}>
                  {client.clientType === "Dairy" ? <Milk size={13} /> :
                   client.clientType === "Farmers" ? <Tractor size={13} /> :
                   <Wheat size={13} />}
                  {client.clientType || "Feed Shop"}
                </span>
                <span className={`badge ${client.status === "Active" ? "success" : "muted"}`} style={{ fontSize: 11 }}>
                  {client.status}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                Client ID: <code>{client.id}</code> | Tier: <b>{client.tier || "Gold"}</b> | Terms: <b>{client.paymentTerms || "Net 30"}</b>
              </div>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={17} />
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: "75vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Card 1: Common Information */}
          <div className="client-detail-card">
            <div className="client-detail-card-title">
              <Building2 size={15} style={{ color: "var(--primary)" }} />
              Common Client Information
            </div>
            <div className="client-details-grid">
              <div className="client-detail-row">
                <span className="client-detail-label">Client / Firm Name:</span>
                <span className="client-detail-val">{client.name}</span>
              </div>
              <div className="client-detail-row">
                <span className="client-detail-label">Contact Person / Proprietor:</span>
                <span className="client-detail-val">{client.contactPerson || "-"}</span>
              </div>
              <div className="client-detail-row">
                <span className="client-detail-label">Village (गाव):</span>
                <span className="client-detail-val" style={{ color: "var(--primary)", fontWeight: 700 }}>{client.village || "-"}</span>
              </div>
              <div className="client-detail-row">
                <span className="client-detail-label">Taluka (तालुका):</span>
                <span className="client-detail-val">{client.taluka || "-"}</span>
              </div>
              <div className="client-detail-row">
                <span className="client-detail-label">District (जिल्हा):</span>
                <span className="client-detail-val">{client.district || client.city || "-"}</span>
              </div>
              <div className="client-detail-row">
                <span className="client-detail-label">Contact Phone No.:</span>
                <span className="client-detail-val">
                  <a href={`tel:${client.contact}`} style={{ color: "var(--primary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Phone size={12} /> {client.contact}
                  </a>
                </span>
              </div>
              <div className="client-detail-row">
                <span className="client-detail-label">Email Address:</span>
                <span className="client-detail-val">
                  {client.email ? (
                    <a href={`mailto:${client.email}`} style={{ color: "var(--primary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Mail size={12} /> {client.email}
                    </a>
                  ) : "-"}
                </span>
              </div>
              <div className="client-detail-row">
                <span className="client-detail-label">Date of Birth (DOB):</span>
                <span className="client-detail-val">
                  {client.dob ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Calendar size={12} /> {client.dob} {age !== null ? `(${age} years)` : ""}
                    </span>
                  ) : "-"}
                </span>
              </div>
              {client.gstin && (
                <div className="client-detail-row">
                  <span className="client-detail-label">GSTIN / Tax ID:</span>
                  <span className="client-detail-val" style={{ fontFamily: "monospace" }}>{client.gstin}</span>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Category-Specific Information */}
          <div className="client-detail-card" style={{
            borderColor: client.clientType === "Dairy" ? "rgba(2, 132, 199, 0.35)" :
                         client.clientType === "Farmers" ? "rgba(217, 119, 6, 0.35)" :
                         "rgba(16, 185, 129, 0.35)"
          }}>
            <div className="client-detail-card-title">
              {client.clientType === "Dairy" ? <Milk size={15} style={{ color: "#0284c7" }} /> :
               client.clientType === "Farmers" ? <Tractor size={15} style={{ color: "#d97706" }} /> :
               <Wheat size={15} style={{ color: "#059669" }} />}
              {client.clientType === "Dairy" ? "Dairy & Milk Collection Specific Information" :
               client.clientType === "Farmers" ? "Farmer & Livestock Specific Information" :
               "Animal Feed Shop Specific Information"}
            </div>

            {client.clientType === "Animal Feed Shop" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                    <Tag size={12} /> TYPES OF PRODUCTS SOLD:
                  </div>
                  <div>
                    {client.productTypes ? client.productTypes.split(",").map((p, i) => (
                      <span key={i} className="client-tag">{p.trim()}</span>
                    )) : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>-</span>}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                    <Building size={12} /> COMPANIES SELLING PRODUCTS:
                  </div>
                  <div>
                    {client.companies ? client.companies.split(",").map((c, i) => (
                      <span key={i} className="client-tag company">{c.trim()}</span>
                    )) : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>-</span>}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                    <Award size={12} /> SELLING BRANDS:
                  </div>
                  <div>
                    {client.brands ? client.brands.split(",").map((b, i) => (
                      <span key={i} className="client-tag brand">{b.trim()}</span>
                    )) : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>-</span>}
                  </div>
                </div>

                {client.numberOfAnimals && (
                  <div className="client-detail-row" style={{ marginTop: 4, background: "rgba(16, 185, 129, 0.06)", padding: "10px 12px", borderRadius: 8 }}>
                    <span className="client-detail-label" style={{ color: "#059669", fontWeight: 700 }}>No. Of Animals Covered / Serviced:</span>
                    <span className="client-detail-val" style={{ color: "#059669", fontWeight: 800 }}>
                      {client.numberOfAnimals}
                    </span>
                  </div>
                )}
              </div>
            )}

            {client.clientType === "Dairy" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
                <div style={{ background: "rgba(2, 132, 199, 0.08)", border: "1.5px solid rgba(2, 132, 199, 0.25)", borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>NUMBER OF SUPPLIERS</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: "#0284c7", marginTop: 4 }}>
                    {client.numberOfSuppliers || "—"}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>Registered Dairy Milk Suppliers</div>
                </div>

                <div style={{ background: "rgba(2, 132, 199, 0.08)", border: "1.5px solid rgba(2, 132, 199, 0.25)", borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>QUANTITY OF MILK</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#0284c7", marginTop: 4 }}>
                    {client.milkQuantity || "—"}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>Daily / Monthly Milk Intake</div>
                </div>
              </div>
            )}

            {client.clientType === "Farmers" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ background: "rgba(217, 119, 6, 0.08)", border: "1.5px solid rgba(217, 119, 6, 0.25)", borderRadius: 12, padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>NUMBER OF ANIMALS (LIVESTOCK COUNT)</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: "#d97706", marginTop: 2 }}>
                      {client.numberOfAnimals ? `${client.numberOfAnimals} Animals` : "—"}
                    </div>
                  </div>
                  <Tractor size={38} style={{ color: "#d97706", opacity: 0.7 }} />
                </div>

                {client.animalDetails && (
                  <div className="client-detail-row" style={{ background: "var(--bg)", padding: "10px 12px", borderRadius: 8 }}>
                    <span className="client-detail-label">Livestock Breakdown & Details:</span>
                    <span className="client-detail-val" style={{ fontWeight: 700 }}>{client.animalDetails}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card 3: Commercial & Billing Ledger */}
          <div className="client-detail-card">
            <div className="client-detail-card-title">
              <IndianRupee size={15} style={{ color: "var(--primary)" }} />
              Commercial & Billing Ledger
            </div>
            <div className="client-details-grid">
              <div className="client-detail-row">
                <span className="client-detail-label">Commercial Tier:</span>
                <span className="client-detail-val">
                  <span className={`tier-badge ${(client.tier || 'Gold').toLowerCase()}`}>
                    {client.tier || 'Gold'}
                  </span>
                </span>
              </div>
              <div className="client-detail-row">
                <span className="client-detail-label">Payment Terms Agreement:</span>
                <span className="client-detail-val">{client.paymentTerms || "Net 30"}</span>
              </div>
              <div className="client-detail-row">
                <span className="client-detail-label">Completed Orders:</span>
                <span className="client-detail-val"><b>{client.orders || 0}</b> orders</span>
              </div>
              <div className="client-detail-row">
                <span className="client-detail-label">Gross Billed Revenue:</span>
                <span className="client-detail-val" style={{ color: "var(--primary)", fontWeight: 800 }}>
                  ₹{Number(client.revenue || 0).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="client-detail-row">
                <span className="client-detail-label">Outstanding Balance:</span>
                <span className="client-detail-val" style={{ color: Number(client.outstanding) > 0 ? "var(--danger)" : "var(--success)", fontWeight: 800 }}>
                  ₹{Number(client.outstanding || 0).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button type="button" className="outline" onClick={onClose}>
              Close
            </button>

          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {onCreateInvoice && (
              <button type="button" className="outline" onClick={() => onCreateInvoice(client)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Receipt size={15} /> Create Tax Invoice
              </button>
            )}
            {onEdit && (
              <button type="button" className="primary" onClick={() => onEdit(client)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Pencil size={15} /> Edit Account
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================================================
// CLIENT MODAL (ADD / EDIT) WITH 3 CATEGORIES
// ==========================================================================
