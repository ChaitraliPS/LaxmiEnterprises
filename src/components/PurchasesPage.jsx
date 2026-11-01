import React, { useState, useMemo } from "react";
import {
  ShoppingCart, Plus, Search, Eye, Milk, Tractor, Wheat, MapPin, Phone,
  TrendingUp, IndianRupee, AlertCircle, CheckCircle2, X, Building2
} from "lucide-react";
import PurchaseModal from "./PurchaseModal";
import PurchaseViewModal from "./PurchaseViewModal";
import { erpApi } from "../services/api";

export const getPurchaseAmounts = (p) => {
  const taxable = Number(p.taxableAmount ?? p.amount ?? p.subtotal ?? 0);
  const gst = Number(p.gstAmount ?? p.tax ?? p.cgst ?? 0);
  const total = Number(p.totalAmount ?? p.total ?? p.grandTotal ?? (taxable + gst) ?? 0);
  const status = p.paymentStatus || p.status || "Pending";

  let paid = 0;
  if (status === "Paid") {
    paid = Number(p.paidAmount !== undefined && p.paidAmount !== null && p.paidAmount !== "" ? p.paidAmount : total);
    if (paid <= 0 && total > 0) paid = total;
  } else if (status === "Pending") {
    paid = 0;
  } else if (status === "Partial") {
    const rawPaid = Number(p.paidAmount);
    if (rawPaid > 0 && rawPaid < total) {
      paid = rawPaid;
    } else {
      paid = total > 0 ? Math.round(total / 2) : 0;
    }
  }

  const balance = Math.max(0, total - paid);
  return { taxable, gst, total, paid, balance, status };
};

export default function PurchasesPage({
  purchases = [],
  onSavePurchases,
  onCreatePurchase,
  vendors = [],
  clients = [],
  products = [],
  company = {},
  showToast
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [viewingPurchase, setViewingPurchase] = useState(null);

  // Next PO ID
  const nextPOId = useMemo(() => {
    let maxNum = 0;
    (purchases || []).forEach(p => {
      const match = p.id && p.id.match(/\d+$/);
      if (match) {
        const n = parseInt(match[0], 10);
        if (n > maxNum) maxNum = n;
      }
    });
    return `LE-PUR-2026-${String(maxNum + 1).padStart(3, "0")}`;
  }, [purchases]);

  // KPIs
  const totalPurchasesAmount = useMemo(
    () => purchases.reduce((sum, p) => sum + getPurchaseAmounts(p).total, 0),
    [purchases]
  );
  const totalPaidAmount = useMemo(
    () => purchases.reduce((sum, p) => sum + getPurchaseAmounts(p).paid, 0),
    [purchases]
  );
  const totalBalanceDue = useMemo(
    () => purchases.reduce((sum, p) => sum + getPurchaseAmounts(p).balance, 0),
    [purchases]
  );
  const feedPurchasesCount = useMemo(
    () => purchases.filter(p => p.category === "Animal Feed Shop").length,
    [purchases]
  );
  const dairyPurchasesCount = useMemo(
    () => purchases.filter(p => p.category === "Dairy").length,
    [purchases]
  );
  const farmerPurchasesCount = useMemo(
    () => purchases.filter(p => p.category === "Farmers").length,
    [purchases]
  );

  // Filtered dataset
  const filteredPurchases = useMemo(() => {
    return (purchases || []).filter(p => {
      if (categoryFilter !== "All" && p.category !== categoryFilter) return false;
      if (statusFilter !== "All" && p.paymentStatus !== statusFilter) return false;

      const q = search.toLowerCase().trim();
      if (!q) return true;

      return (
        (p.id && p.id.toLowerCase().includes(q)) ||
        (p.billNumber && p.billNumber.toLowerCase().includes(q)) ||
        (p.vendorName && p.vendorName.toLowerCase().includes(q)) ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.contactPerson && p.contactPerson.toLowerCase().includes(q)) ||
        (p.village && p.village.toLowerCase().includes(q)) ||
        (p.taluka && p.taluka.toLowerCase().includes(q)) ||
        (p.district && p.district.toLowerCase().includes(q)) ||
        (p.contact && p.contact.toLowerCase().includes(q)) ||
        (p.productTypes && p.productTypes.toLowerCase().includes(q)) ||
        (p.companies && p.companies.toLowerCase().includes(q)) ||
        (p.brands && p.brands.toLowerCase().includes(q)) ||
        (p.itemDescription && p.itemDescription.toLowerCase().includes(q)) ||
        (p.animalDetails && p.animalDetails.toLowerCase().includes(q)) ||
        (p.farmItemsSupplied && p.farmItemsSupplied.toLowerCase().includes(q))
      );
    });
  }, [purchases, categoryFilter, statusFilter, search]);

  // Actions
  const handleOpenAdd = () => {
    setEditingPurchase(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (p) => {
    setEditingPurchase(p);
    setModalOpen(true);
  };

  const handleSavePurchase = (saved) => {
    if (editingPurchase) {
      const updated = purchases.map(p => (p.id === saved.id ? saved : p));
      if (onSavePurchases) onSavePurchases(updated);
      if (showToast) showToast(`✓ Updated Purchase Voucher ${saved.id}`);
    } else {
      if (onCreatePurchase) {
        onCreatePurchase(saved);
      } else if (onSavePurchases) {
        onSavePurchases([saved, ...purchases]);
      }
      if (showToast) showToast(`✓ Recorded new Inward Purchase ${saved.id} for ${saved.vendorName}`);
    }
    setModalOpen(false);
    setEditingPurchase(null);
  };

  const handleDeletePurchase = (purchaseToDelete) => {
    if (!purchaseToDelete) return;
    const pId = purchaseToDelete.id || purchaseToDelete.purchaseId;
    const confirmMsg = `Are you sure you want to delete purchase voucher "${pId}" from ${purchaseToDelete.vendorName || purchaseToDelete.name}?`;
    if (window.confirm(confirmMsg)) {
      const updated = purchases.filter(
        p =>
          p.id !== pId &&
          p.purchaseId !== pId &&
          p.id !== purchaseToDelete.id &&
          p.purchaseId !== purchaseToDelete.purchaseId
      );
      if (onSavePurchases) onSavePurchases(updated);
      erpApi.deletePurchase(pId).catch(() => {});
      setViewingPurchase(null);
      if (showToast) showToast(`✓ Deleted Purchase Voucher ${pId}`);
    }
  };

  return (
    <div
      className="page-content"
      style={{
        padding: "20px 24px",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        overflowX: "hidden"
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 18,
          flexWrap: "wrap"
        }}
      >
        <div style={{ minWidth: 0, flex: "1 1 280px" }}>
          <h2
            style={{
              margin: "0 0 2px 0",
              fontSize: "1.25rem",
              display: "flex",
              alignItems: "center",
              gap: 8
            }}
          >
            <ShoppingCart size={22} style={{ color: "var(--primary)" }} />
            Purchases
          </h2>
          <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--text-muted)" }}>
            Animal feed stock, dairy milk procurement & farmer direct supplies
          </p>
        </div>

        <button
          type="button"
          className="primary"
          onClick={handleOpenAdd}
          style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", flexShrink: 0 }}
        >
          <Plus size={16} />
          Record New Purchase
        </button>
      </div>

      {/* KPI CARDS */}
      <div
        className="stats-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 20
        }}
      >
        {/* KPI 1 */}
        <div className="stat-card">
          <div className="stat-top">
            <span>Total Inward Purchases</span>
            <div className="stat-icon" style={{ background: "rgba(0, 91, 181, 0.12)", color: "var(--primary)" }}>
              <IndianRupee size={19} />
            </div>
          </div>
          <div className="stat-value">₹{totalPurchasesAmount.toLocaleString("en-IN")}</div>
          <div className="trend positive">
            <TrendingUp size={14} />
            <span>{purchases.length} Procurement Inward Orders</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="stat-card">
          <div className="stat-top">
            <span>Settled / Paid to Vendors</span>
            <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.12)", color: "#10b981" }}>
              <CheckCircle2 size={19} />
            </div>
          </div>
          <div className="stat-value" style={{ color: "#10b981" }}>
            ₹{totalPaidAmount.toLocaleString("en-IN")}
          </div>
          <div className="trend positive">
            <span>Realized vendor settlements</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="stat-card">
          <div className="stat-top">
            <span>Pending Vendor Dues</span>
            <div
              className="stat-icon"
              style={{
                background: totalBalanceDue > 0 ? "rgba(239, 68, 68, 0.12)" : "rgba(148, 163, 184, 0.12)",
                color: totalBalanceDue > 0 ? "var(--danger)" : "#64748b"
              }}
            >
              <AlertCircle size={19} />
            </div>
          </div>
          <div className="stat-value" style={{ color: totalBalanceDue > 0 ? "var(--danger)" : "var(--text-main)" }}>
            ₹{totalBalanceDue.toLocaleString("en-IN")}
          </div>
          <div className="trend" style={{ color: totalBalanceDue > 0 ? "var(--danger)" : "var(--text-muted)" }}>
            <span>{totalBalanceDue > 0 ? "Payables pending clearance" : "All payables cleared"}</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="stat-card">
          <div className="stat-top">
            <span>Procurement Distribution</span>
            <div className="stat-icon" style={{ background: "rgba(245, 158, 11, 0.12)", color: "#d97706" }}>
              <Building2 size={19} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <div>
              <small style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block" }}>Feed Shop</small>
              <strong style={{ fontSize: "1.1rem", color: "#059669" }}>{feedPurchasesCount}</strong>
            </div>
            <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: 10 }}>
              <small style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block" }}>Dairy</small>
              <strong style={{ fontSize: "1.1rem", color: "#0284c7" }}>{dairyPurchasesCount}</strong>
            </div>
            <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: 10 }}>
              <small style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block" }}>Farmers</small>
              <strong style={{ fontSize: "1.1rem", color: "#d97706" }}>{farmerPurchasesCount}</strong>
            </div>
          </div>
          <div className="trend positive" style={{ marginTop: 6 }}>
            <span>3 Agribusiness Sectors Active</span>
          </div>
        </div>
      </div>

      {/* MAIN TABLE CARD */}
      <div className="card table-card" style={{ maxWidth: "100%", overflow: "hidden" }}>
        {/* CARD HEAD */}
        <div
          className="card-head"
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap"
          }}
        >
          {/* CATEGORY TABS */}
          <div className="filter-pills-bar" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className={`filter-pill ${categoryFilter === "All" ? "active" : ""}`}
              onClick={() => setCategoryFilter("All")}
            >
              All Purchases ({purchases.length})
            </button>

            <button
              className={`filter-pill ${categoryFilter === "Animal Feed Shop" ? "active" : ""}`}
              onClick={() => setCategoryFilter("Animal Feed Shop")}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Wheat size={14} style={{ color: "#059669" }} />
              Animal Feed ({feedPurchasesCount})
            </button>

            <button
              className={`filter-pill ${categoryFilter === "Dairy" ? "active" : ""}`}
              onClick={() => setCategoryFilter("Dairy")}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Milk size={14} style={{ color: "#0284c7" }} />
              Dairy Milk ({dairyPurchasesCount})
            </button>

            <button
              className={`filter-pill ${categoryFilter === "Farmers" ? "active" : ""}`}
              onClick={() => setCategoryFilter("Farmers")}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Tractor size={14} style={{ color: "#d97706" }} />
              Farmer Direct ({farmerPurchasesCount})
            </button>
          </div>

          {/* SEARCH & STATUS */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div className="search-bar" style={{ width: "100%", maxWidth: 260, minWidth: 180 }}>
              <Search size={15} />
              <input
                type="text"
                placeholder="Search PO, vendor, village, brand..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <select
              className="form-select"
              style={{ width: 140, fontSize: "0.82rem", padding: "6px 10px" }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Paid">Fully Paid</option>
              <option value="Partial">Partially Paid</option>
              <option value="Pending">Payment Pending</option>
            </select>
          </div>
        </div>

        {/* TABLE */}
        <div className="table-wrapper" style={{ width: "100%", overflowX: "auto" }}>
          {filteredPurchases.length === 0 ? (
            <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)" }}>
              <ShoppingCart size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <h4 style={{ margin: 0, fontSize: "1rem", color: "var(--text-main)" }}>No Purchases Found</h4>
              <p style={{ margin: "4px 0 16px 0", fontSize: "0.84rem" }}>
                {search
                  ? `No purchase records match "${search}". Try resetting the search.`
                  : "No purchases recorded under this filter."}
              </p>
              <button type="button" className="primary" onClick={handleOpenAdd} style={{ fontSize: "0.84rem" }}>
                <Plus size={14} style={{ marginRight: 6 }} /> Record Inward Purchase
              </button>
            </div>
          ) : (
            <table style={{ width: "100%", tableLayout: "auto" }}>
              <thead>
                <tr>
                  <th>PO & Bill ID</th>
                  <th>Supplier</th>
                  <th>Procured Goods</th>
                  <th>Bill Date</th>
                  <th style={{ textAlign: "right" }}>Inward Total (₹)</th>
                  <th style={{ textAlign: "center" }}>Status</th>
                  <th style={{ textAlign: "center", width: 70 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map((p) => {
                  const isDairy = p.category === "Dairy";
                  const isFarmer = p.category === "Farmers";

                  const {
                    taxable: pTaxable,
                    total: pTotal,
                    paid: pPaid,
                    balance: pBalance
                  } = getPurchaseAmounts(p);

                  const qty = Number(
                    p.inwardQty ||
                      p.quantity ||
                      (isDairy ? p.milkQuantity : isFarmer ? p.farmQuantity : p.feedQuantity) ||
                      1
                  );
                  const unit = p.unit || (isDairy ? "Liters" : isFarmer ? "Tonnes" : "Bags");
                  const unitRate = Number(
                    p.unitRate ||
                      p.rate ||
                      (isDairy ? p.ratePerLiter : null) ||
                      (qty > 0 && pTaxable > 0 ? Math.round(pTaxable / qty) : 0)
                  );
                  const itemTitle =
                    p.itemDescription ||
                    p.productName ||
                    (isDairy
                      ? "Daily Raw Milk Batch"
                      : isFarmer
                      ? p.farmItemsSupplied || "Direct Farm Harvest"
                      : "Cattle Feed Stock");
                  const location = [p.village, p.taluka, p.district].filter(Boolean).join(", ");

                  return (
                    <tr key={p.id}>
                      {/* PO ID */}
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          onClick={() => setViewingPurchase(p)}
                          title="View voucher"
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                        >
                          <code
                            style={{
                              color: "var(--primary)",
                              fontWeight: 700,
                              background: "rgba(0,91,181,0.08)",
                              padding: "3px 7px",
                              borderRadius: 4,
                              fontSize: 12
                            }}
                          >
                            {p.id}
                          </code>
                        </button>
                        <div style={{ marginTop: 4 }}>
                          <span
                            className={`client-type-badge ${
                              isDairy ? "dairy" : isFarmer ? "farmers" : "feed-shop"
                            }`}
                            style={{ whiteSpace: "nowrap" }}
                          >
                            {isDairy ? <Milk size={11} /> : isFarmer ? <Tractor size={11} /> : <Wheat size={11} />}
                            {isDairy ? "Dairy" : isFarmer ? "Farmer" : "Feed Shop"}
                          </span>
                        </div>
                        {p.billNumber && (
                          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                            Ref: {p.billNumber}
                          </div>
                        )}
                      </td>

                      {/* Supplier + Location + Contact */}
                      <td>
                        <div className="person">
                          <div
                            className="mini-avatar"
                            style={{
                              background: isDairy
                                ? "rgba(2,132,199,0.12)"
                                : isFarmer
                                ? "rgba(217,119,6,0.12)"
                                : "rgba(16,185,129,0.12)",
                              color: isDairy ? "#0284c7" : isFarmer ? "#d97706" : "#059669"
                            }}
                          >
                            {(p.vendorName || p.name || "S")[0].toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <b
                              style={{ cursor: "pointer", fontSize: 13 }}
                              onClick={() => setViewingPurchase(p)}
                            >
                              {p.vendorName || p.name || "Registered Vendor"}
                            </b>
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                marginTop: 1
                              }}
                            >
                              <MapPin size={11} style={{ flexShrink: 0 }} />
                              <span>{location || "Location not added"}</span>
                            </div>
                            {p.contact && (
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "var(--text-muted)",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4
                                }}
                              >
                                <Phone size={11} /> {p.contact}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Goods */}
                      <td>
                        <div style={{ fontSize: 12, lineHeight: 1.45 }}>
                          <div style={{ fontWeight: 600 }}>{itemTitle}</div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              marginTop: 3,
                              flexWrap: "wrap"
                            }}
                          >
                            <span
                              style={{
                                background: "rgba(0,91,181,0.08)",
                                color: "var(--primary)",
                                padding: "2px 7px",
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 600,
                                whiteSpace: "nowrap"
                              }}
                            >
                              {qty} {unit}
                            </span>
                            {unitRate > 0 && (
                              <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                                @ ₹{unitRate.toLocaleString("en-IN")}/{unit.replace(/s$/, "")}
                              </span>
                            )}
                          </div>
                          {isDairy && (p.fatPercent || p.snfPercent) && (
                            <div style={{ color: "#0284c7", fontSize: 10.5, marginTop: 3 }}>
                              🥛 {p.fatPercent ? `${p.fatPercent}% Fat` : ""}{" "}
                              {p.snfPercent ? `• ${p.snfPercent}% SNF` : ""}
                            </div>
                          )}
                          {isFarmer && p.numberOfAnimals && (
                            <div style={{ color: "#d97706", fontSize: 10.5, marginTop: 2 }}>
                              🚜 {p.numberOfAnimals} Animals
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                        <div>{p.date}</div>
                        {p.dueDate && p.dueDate !== p.date && (
                          <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Due: {p.dueDate}</div>
                        )}
                      </td>

                      {/* Total */}
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                          ₹{pTotal.toLocaleString("en-IN")}
                        </div>
                        <div style={{ fontSize: 11, color: "#10b981", fontWeight: 500 }}>
                          Paid: ₹{pPaid.toLocaleString("en-IN")}
                        </div>
                        {pBalance > 0 ? (
                          <div style={{ fontSize: 11, color: "var(--danger)", fontWeight: 600 }}>
                            Due: ₹{pBalance.toLocaleString("en-IN")}
                          </div>
                        ) : (
                          <div style={{ fontSize: 10, color: "#10b981" }}>✓ Settled in Full</div>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                        <span
                          className={`badge ${
                            p.paymentStatus === "Paid"
                              ? "success"
                              : p.paymentStatus === "Partial"
                              ? "warning"
                              : "muted"
                          }`}
                        >
                          <span
                            style={{
                              background:
                                p.paymentStatus === "Paid"
                                  ? "#10b981"
                                  : p.paymentStatus === "Partial"
                                  ? "#f59e0b"
                                  : "#94a3b8",
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              display: "inline-block",
                              marginRight: 5
                            }}
                          />
                          {p.paymentStatus}
                        </span>
                      </td>

                      {/* Action: sirf View */}
                      <td style={{ textAlign: "center" }}>
                        <div className="row-actions" style={{ justifyContent: "center" }}>
                          <button
                            title={`View ${p.id}`}
                            onClick={() => setViewingPurchase(p)}
                            style={{ color: "var(--accent)" }}
                          >
                            <Eye size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL 1: ADD / EDIT */}
      <PurchaseModal
        key={editingPurchase ? editingPurchase.id : "new-purchase"}
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingPurchase(null);
        }}
        onSave={handleSavePurchase}
        purchaseToEdit={editingPurchase}
        nextId={nextPOId}
        vendors={vendors}
        products={products}
      />

      {/* MODAL 2: VIEW VOUCHER */}
      <PurchaseViewModal
        isOpen={!!viewingPurchase}
        onClose={() => setViewingPurchase(null)}
        purchase={viewingPurchase}
        company={company}
        onEdit={(p) => {
          setViewingPurchase(null);
          handleOpenEdit(p);
        }}
        onDelete={handleDeletePurchase}
        showToast={showToast}
      />
    </div>
  );
}