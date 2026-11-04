import React, { useState, useMemo } from "react";
import {
  Truck, Plus, Search, Pencil, Eye, Download,
  Phone, Mail, MapPin, Building2, CreditCard,
  CheckCircle2, AlertTriangle, X, ShieldCheck, Milk, Tractor, Wheat, Store
} from "lucide-react";
import VendorModal from "./VendorModal";
import VendorDetailsModal from "./VendorDetailsModal";
import ExportMenu from "./ExportMenu";
import MobileRecordCard from "./responsive/MobileRecordCard";
import ResponsiveKpiGrid from "./responsive/ResponsiveKpiGrid";
import ResponsiveDataTable from "./responsive/ResponsiveDataTable";
import { downloadCSV } from "../utils/exportUtils";
import { erpApi } from "../services/api";

export const normalizeVendorCategory = (cat) => {
  const c = String(cat || "").trim().toLowerCase();
  if (c.includes("raw") || c.includes("material")) return "Raw Materials Supplier";
  if (c.includes("dairy") || c.includes("milk") || c.includes("process")) return "Dairy Processor";
  if (c.includes("feed") || c.includes("animal") || c.includes("mfg") || c.includes("manufactur")) return "Feed Manufacturer";
  return "Feed Manufacturer";
};

export default function VendorsPage({ vendors = [], onSaveVendors }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [viewingVendor, setViewingVendor] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Auto-generate next vendor ID
  const nextId = useMemo(() => {
    const nums = (vendors || [])
      .map(v => {
        const idStr = String(v.vendorId || v.id || "");
        const match = idStr.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter(n => !isNaN(n));
    const maxNum = nums.length ? Math.max(...nums) : 0;
    return `VEN-${String(maxNum + 1).padStart(3, "0")}`;
  }, [vendors]);

  const categories = ["All", "Feed Manufacturer", "Dairy Processor", "Raw Materials Supplier"];

  const filtered = useMemo(() => {
    return (vendors || []).filter(v => {
      const vCat = normalizeVendorCategory(v.category);
      const matchesCat = categoryFilter === "All" || vCat === categoryFilter;
      const q = search.toLowerCase().trim();
      if (!q) return matchesCat;

      const name = (v.name || "").toLowerCase();
      const comp = (v.companyName || "").toLowerCase();
      const id = (v.vendorId || v.id || "").toLowerCase();
      const phone = (v.phone || v.contact || "").toLowerCase();
      const person = (v.contactPerson || "").toLowerCase();
      const gstin = (v.gstin || "").toLowerCase();
      const city = (v.city || v.village || "").toLowerCase();

      const matchesSearch =
        name.includes(q) ||
        comp.includes(q) ||
        id.includes(q) ||
        phone.includes(q) ||
        person.includes(q) ||
        gstin.includes(q) ||
        city.includes(q);

      return matchesCat && matchesSearch;
    });
  }, [vendors, categoryFilter, search]);

  const totalVendors = vendors.length;
  const feedSuppliers = vendors.filter(v => normalizeVendorCategory(v.category) === "Feed Manufacturer").length;
  const dairySuppliers = vendors.filter(v => normalizeVendorCategory(v.category) === "Dairy Processor").length;
  const rawSuppliers = vendors.filter(v => normalizeVendorCategory(v.category) === "Raw Materials Supplier").length;

  const handleOpenAdd = () => {
    setEditingVendor(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (vendor) => {
    setEditingVendor(vendor);
    setModalOpen(true);
  };

  const handleSaveVendor = async (vendorData) => {
    if (editingVendor) {
      const targetId = vendorData.vendorId || vendorData.id;
      const updated = vendors.map(v =>
        (v.id === editingVendor.id || v.vendorId === editingVendor.vendorId) ? vendorData : v
      );
      onSaveVendors(updated);
      try {
        await erpApi.updateVendor(targetId, vendorData);
      } catch (err) {
        console.warn("Direct vendor update notice:", err.message);
      }
      showToast(`✓ Updated vendor ${vendorData.name}!`);
    } else {
      const exists = vendors.some(v =>
        String(v.vendorId || v.id).toLowerCase() === String(vendorData.vendorId || vendorData.id).toLowerCase()
      );
      if (exists) {
        showToast(`⚠️ Vendor ID ${vendorData.vendorId} already exists.`);
        return;
      }
      const updated = [vendorData, ...vendors];
      onSaveVendors(updated);
      try {
        await erpApi.createVendor(vendorData);
      } catch (err) {
        console.warn("Direct vendor create notice:", err.message);
      }
      showToast(`✓ Registered new vendor ${vendorData.name}!`);
    }
    setModalOpen(false);
    setEditingVendor(null);
  };

  const handleExportCSV = () => {
    const headers = [
      "Vendor_ID", "Vendor_Name", "Category", "Contact_Person",
      "Phone", "Email", "GSTIN", "City", "Payment_Terms", "Status"
    ];
    const rows = filtered.map(v => [
      v.vendorId || v.id,
      v.name,
      v.category || "General",
      v.contactPerson || "",
      v.phone || v.contact || "",
      v.email || "",
      v.gstin || "",
      v.city || v.village || "",
      v.paymentTerms || "Net 15 Days",
      v.status || "Active"
    ]);
    downloadCSV("Vendors_Directory_Laxmi_Enterprises", headers, rows);
    showToast("✓ Exported Vendor Directory to CSV!");
  };

  return (
    <div className="page">
      {toast && (
        <div className="toast-notification">
          <CheckCircle2 size={18} style={{ color: "var(--success)" }} />
          <span>{toast}</span>
        </div>
      )}

      {/* QUICK STATS CARDS: 4-cols on Laptop, 2-cols on Mobile */}
      <ResponsiveKpiGrid cols={4}>
        <div className="stat-card">
          <div className="stat-top">
            <span>Total Suppliers</span>
            <div className="stat-icon" style={{ background: "rgba(0, 91, 181, 0.12)", color: "var(--primary)" }}>
              <Truck size={19} />
            </div>
          </div>
          <div className="stat-value">{totalVendors}</div>
          <div className="trend positive"><span>Active suppliers</span></div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Feed Manufacturers</span>
            <div className="stat-icon" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
              <Wheat size={19} />
            </div>
          </div>
          <div className="stat-value">{feedSuppliers}</div>
          <div className="trend positive"><span>Agri mills</span></div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Dairy Processors</span>
            <div className="stat-icon" style={{ background: "rgba(37,99,235,0.12)", color: "#2563eb" }}>
              <Milk size={19} />
            </div>
          </div>
          <div className="stat-value" style={{ color: "#2563eb" }}>{dairySuppliers}</div>
          <div className="trend positive"><span>Chilling plants</span></div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Raw Materials</span>
            <div className="stat-icon" style={{ background: "var(--success-light)", color: "var(--success)" }}>
              <Tractor size={19} />
            </div>
          </div>
          <div className="stat-value" style={{ color: "var(--success)" }}>{rawSuppliers}</div>
          <div className="trend positive"><span>Farm direct</span></div>
        </div>
      </ResponsiveKpiGrid>

      {/* ACTION BAR */}
      <div className="page-actions" style={{ alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div className="filter-pills-bar" style={{ overflowX: "auto", maxWidth: "100%" }}>
          {categories.map(cat => (
            <button
              key={cat}
              className={`filter-pill ${categoryFilter === cat ? "active" : ""}`}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginLeft: "auto" }}>
          <ExportMenu
            onExportCSV={handleExportCSV}
            onPrint={() => window.print()}
            label="Export Vendors"
          />
          <button className="primary" onClick={handleOpenAdd} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={16} /> Add Vendor
          </button>
        </div>
      </div>

      {/* TABLE CARD */}
      <div className="card table-card">
        <div className="table-toolbar" style={{ flexWrap: "wrap", gap: 10 }}>
          <div className="local-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search vendor name, ID, phone, GSTIN, location..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="search-clear" onClick={() => setSearch("")} aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </div>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>
            Showing {filtered.length} of {vendors.length} vendors
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Truck size={28} /></div>
            <h4 style={{ fontSize: 16, color: "var(--text-main)", marginBottom: 6 }}>No Vendors Found</h4>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
              {search ? "No vendors matched your search query." : "Register your raw material suppliers, dairy centers, and farm partners."}
            </p>
            <button className="primary" onClick={handleOpenAdd} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Plus size={15} /> Add First Vendor
            </button>
          </div>
        ) : (
          <ResponsiveDataTable
            hasRecords={filtered.length > 0}
            /* DESKTOP TABLE VIEW (Preserved all 9 columns) */
            desktopView={
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Vendor ID</th>
                      <th>Vendor / Trade Name</th>
                      <th>Procurement Category</th>
                      <th>Contact Person & Phone</th>
                      <th>GSTIN</th>
                      <th>City / District</th>
                      <th>Payment Terms</th>
                      <th>Status</th>
                      <th style={{ textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(v => {
                      const idStr = v.vendorId || v.id;
                      const isActive = (v.status || "Active") === "Active";

                      return (
                        <tr key={idStr}>
                          <td>
                            <span style={{
                              fontFamily: "monospace",
                              fontWeight: 700,
                              fontSize: "0.82rem",
                              background: "var(--bg)",
                              padding: "2px 8px",
                              borderRadius: 4,
                              border: "1px solid var(--border)",
                            }}>
                              {idStr}
                            </span>
                          </td>

                          <td>
                            <div style={{ fontWeight: 700, color: "var(--text-main)", fontSize: "0.88rem" }}>
                              {v.name}
                            </div>
                            {v.companyName && v.companyName !== v.name && (
                              <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                                {v.companyName}
                              </div>
                            )}
                          </td>

                          <td>
                            <span style={{
                              fontSize: "0.78rem",
                              padding: "2px 8px",
                              borderRadius: 6,
                              background: "rgba(0,91,181,0.08)",
                              color: "var(--primary)",
                              fontWeight: 600,
                              display: "inline-block",
                            }}>
                              {normalizeVendorCategory(v.category)}
                            </span>
                          </td>

                          <td>
                            <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>
                              {v.contactPerson || "Sales Desk"}
                            </div>
                            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                              <Phone size={11} /> {v.phone || v.contact || "—"}
                            </div>
                          </td>

                          <td>
                            <span style={{ fontFamily: "monospace", fontSize: "0.78rem", color: v.gstin ? "var(--text-main)" : "var(--text-muted)" }}>
                              {v.gstin || "Unregistered"}
                            </span>
                          </td>

                          <td>
                            <span style={{ fontSize: "0.82rem", display: "flex", alignItems: "center", gap: 4 }}>
                              <MapPin size={12} style={{ color: "var(--text-muted)" }} />
                              {v.city || v.village || "Maharashtra"}
                            </span>
                          </td>

                          <td>
                            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                              {v.paymentTerms || "Net 15 Days"}
                            </span>
                          </td>

                          <td>
                            <span className={`badge ${isActive ? "success" : "neutral"}`}>
                              <span className="badge-dot" />
                              {isActive ? "Active" : "Inactive"}
                            </span>
                          </td>

                          <td>
                            <div className="row-actions" style={{ justifyContent: "center" }}>
                              <button
                                title={`View full profile of ${v.name || v.companyName}`}
                                onClick={() => setViewingVendor(v)}
                                style={{ color: "var(--accent)" }}
                              >
                                <Eye size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            }
            /* MOBILE RECORD CARDS VIEW */
            mobileView={
              <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "8px 4px" }}>
                {filtered.map(v => {
                  const idStr = v.vendorId || v.id;
                  const isActive = (v.status || "Active") === "Active";

                  return (
                    <MobileRecordCard
                      key={idStr}
                      idBadge={idStr}
                      title={v.name}
                      subtitle={v.companyName && v.companyName !== v.name ? v.companyName : (v.city || "Maharashtra")}
                      categoryBadge={normalizeVendorCategory(v.category)}
                      statusBadge={
                        <span className={`badge ${isActive ? "success" : "neutral"}`} style={{ fontSize: 11 }}>
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      }
                      primaryMetrics={[
                        { label: "Contact", value: v.phone || v.contact ? <a href={`tel:${v.phone || v.contact}`} style={{ color: "var(--primary)", textDecoration: "none" }}>{v.phone || v.contact}</a> : "—" },
                        { label: "Person", value: v.contactPerson || "Sales Desk" },
                        { label: "Terms", value: v.paymentTerms || "Net 15" },
                      ]}
                      expandedDetails={
                        <div>
                          {v.gstin && (
                            <div className="mobile-record-detail-row">
                              <span className="mobile-record-detail-label">GSTIN</span>
                              <span className="mobile-record-detail-val" style={{ fontFamily: "monospace" }}>{v.gstin}</span>
                            </div>
                          )}
                          {v.email && (
                            <div className="mobile-record-detail-row">
                              <span className="mobile-record-detail-label">Email</span>
                              <span className="mobile-record-detail-val">{v.email}</span>
                            </div>
                          )}
                          <div className="mobile-record-detail-row">
                            <span className="mobile-record-detail-label">Location</span>
                            <span className="mobile-record-detail-val">{v.city || v.village || "Maharashtra"}</span>
                          </div>
                        </div>
                      }
                      actions={
                        <button
                          type="button"
                          className="outline btn-sm"
                          onClick={() => setViewingVendor(v)}
                          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                        >
                          <Eye size={14} /> View Details
                        </button>
                      }
                    />
                  );
                })}
              </div>
            }
          />
        )}
      </div>

      {/* VENDOR DETAILS VIEW MODAL */}
      <VendorDetailsModal
        isOpen={!!viewingVendor}
        onClose={() => setViewingVendor(null)}
        vendor={viewingVendor}
        onEdit={(v) => {
          setViewingVendor(null);
          handleOpenEdit(v);
        }}
      />

      {/* VENDOR MODAL */}
      <VendorModal
        key={editingVendor ? editingVendor.id : "new-vendor"}
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingVendor(null); }}
        onSave={handleSaveVendor}
        vendorToEdit={editingVendor}
        nextId={nextId}
        existingIds={vendors.map(v => v.vendorId || v.id)}
      />
    </div>
  );
}
