import React, { useState, useMemo, useEffect } from "react";
import {
  ShoppingCart, Plus, Search, Eye, Milk, Tractor, Wheat, MapPin, Phone,
  TrendingUp, IndianRupee, AlertCircle, CheckCircle2, X, Building2, RefreshCw, Calendar
} from "lucide-react";
import PurchaseModal from "./PurchaseModal";
import PurchaseViewModal from "./PurchaseViewModal";
import { erpApi } from "../services/api";
import { formatIndianCurrency, formatDate } from "../utils/formatters";
import { getToday, VENDOR_TYPES, VENDOR_TYPE_LIST } from "../constants/erpConstants";

export default function PurchasesPage({
  purchases = [],
  onCreatePurchase,
  vendors = [],
  clients = [],
  products = [],
  company = {},
  showToast,
  onRefresh
}) {
  const today = useMemo(() => getToday(), []);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedFY, setSelectedFY] = useState("FY 2026-27");

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [viewingPurchase, setViewingPurchase] = useState(null);

  useEffect(() => {
    if (onRefresh) onRefresh();
  }, [onRefresh]);

  const handleManualRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      await onRefresh();
      setTimeout(() => setIsRefreshing(false), 500);
      if (showToast) showToast("✓ Purchases synchronized with MySQL database");
    }
  };

  const notify = (msg) => {
    if (showToast) showToast(msg);
  };

  // Product master dictionary by ID
  const productMap = useMemo(() => {
    return new Map(products.map((p) => [p.productId, p]));
  }, [products]);

  // Vendor master dictionary by ID
  const vendorMap = useMemo(() => {
    return new Map(vendors.map((v) => [v.vendorId, v]));
  }, [vendors]);

  // Indian FY helper for date filtering
  const getPurchaseFY = (pur) => {
    const dStr = pur.purchaseDate || pur.date || (pur.createdAt ? String(pur.createdAt).slice(0, 10) : "");
    if (!dStr) return "FY 2026-27";
    const parts = dStr.split("-");
    if (parts.length < 2) return "FY 2026-27";
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const startY = m >= 4 ? y : y - 1;
    return `FY ${startY}-${String(startY + 1).slice(-2)}`;
  };

  // Period Purchases
  const periodPurchases = useMemo(() => {
    if (selectedFY === "All Time") return purchases;
    return purchases.filter((p) => getPurchaseFY(p) === selectedFY);
  }, [purchases, selectedFY]);

  // High-Level Procurement KPIs
  const kpis = useMemo(() => {
    let grandTotal = 0;
    let paidTotal = 0;
    let pendingDues = 0;
    let overdueCount = 0;

    for (const p of periodPurchases) {
      if (p.isCancelled) continue;
      const total = Number(p.grandTotal ?? p.totalAmount ?? p.total ?? 0);
      const paid = Number(p.paidAmount ?? 0);
      const due = Number(p.balanceDue ?? Math.max(0, total - paid));

      grandTotal += total;
      paidTotal += Math.min(total, paid);
      pendingDues += due;

      if (p.status === "Overdue") {
        overdueCount += 1;
      }
    }

    return {
      grandTotal,
      paidTotal,
      pendingDues,
      overdueCount,
      billCount: periodPurchases.length,
    };
  }, [periodPurchases]);

  // Category counts by Vendor Type Enum
  const categoryCounts = useMemo(() => {
    const counts = {
      all: periodPurchases.length,
      [VENDOR_TYPES.FEED_MANUFACTURER]: 0,
      [VENDOR_TYPES.DAIRY_PROCESSOR]: 0,
      [VENDOR_TYPES.RAW_MATERIALS]: 0,
    };
    for (const p of periodPurchases) {
      const cat = p.category || VENDOR_TYPES.FEED_MANUFACTURER;
      if (counts[cat] !== undefined) {
        counts[cat] += 1;
      } else {
        counts[VENDOR_TYPES.FEED_MANUFACTURER] += 1;
      }
    }
    return counts;
  }, [periodPurchases]);

  // Filtered purchases
  const filteredPurchases = useMemo(() => {
    return periodPurchases.filter((p) => {
      const cat = p.category || VENDOR_TYPES.FEED_MANUFACTURER;
      const matchesCategory = categoryFilter === "All" || cat === categoryFilter;

      const st = p.status || p.paymentStatus || "Unpaid";
      let matchesStatus = true;
      if (statusFilter === "Paid") matchesStatus = st === "Paid";
      else if (statusFilter === "Pending") matchesStatus = st === "Unpaid" || st === "Partial";
      else if (statusFilter === "Overdue") matchesStatus = st === "Overdue";

      const q = search.toLowerCase().trim();
      const pId = String(p.purchaseId || p.id || "").toLowerCase();
      const vName = String(p.vendorName || "").toLowerCase();
      const vId = String(p.vendorId || "").toLowerCase();

      const matchesSearch = !q || (pId.includes(q) || vName.includes(q) || vId.includes(q));

      return matchesCategory && matchesStatus && matchesSearch;
    });
  }, [periodPurchases, categoryFilter, statusFilter, search]);

  return (
    <div className="page purchases-page">
      {/* TOP HEADER */}
      <div className="page-actions" style={{ alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 800, margin: 0, color: "var(--text-main)", letterSpacing: "-0.02em" }}>
            Inward Procurement & Purchase Bills
          </h2>
          <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: "3px 0 0 0" }}>
            Server-calculated bill totals linked to verified product master and inventory movement ledger
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {/* FY Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Calendar size={15} style={{ color: "var(--text-muted)" }} />
            <select
              className="form-input"
              style={{ width: "auto", padding: "6px 12px", fontSize: "13px", fontWeight: 600 }}
              value={selectedFY}
              onChange={(e) => setSelectedFY(e.target.value)}
            >
              <option value="FY 2026-27">FY 2026-27</option>
              <option value="FY 2025-26">FY 2025-26</option>
              <option value="All Time">All Time</option>
            </select>
          </div>

          {onRefresh && (
            <button
              type="button"
              className="outline"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw size={15} className={isRefreshing ? "spin-animation" : ""} />
              {isRefreshing ? "Syncing..." : "Sync"}
            </button>
          )}

          <button
            type="button"
            className="primary"
            onClick={() => {
              setEditingPurchase(null);
              setModalOpen(true);
            }}
          >
            <Plus size={16} /> Record Purchase
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        {/* KPI 1 */}
        <div className="stat-card">
          <div className="stat-top">
            <span>Total Inward Purchases ({selectedFY})</span>
            <div className="stat-icon" style={{ background: "rgba(0, 91, 181, 0.12)", color: "var(--primary)" }}>
              <IndianRupee size={19} />
            </div>
          </div>
          <div className="stat-value">{formatIndianCurrency(kpis.grandTotal)}</div>
          <div className="trend positive">
            <TrendingUp size={14} />
            <span>{kpis.billCount} Procurement Bills Recorded</span>
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
            {formatIndianCurrency(kpis.paidTotal)}
          </div>
          <div className="trend positive">
            <span>{kpis.grandTotal > 0 ? `${((kpis.paidTotal / kpis.grandTotal) * 100).toFixed(1)}% Settled in Full` : "No billing"}</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="stat-card">
          <div className="stat-top">
            <span>Pending Vendor Dues</span>
            <div
              className="stat-icon"
              style={{
                background: kpis.pendingDues > 0 ? "rgba(239, 68, 68, 0.12)" : "rgba(148, 163, 184, 0.12)",
                color: kpis.pendingDues > 0 ? "var(--danger)" : "#64748b"
              }}
            >
              <AlertCircle size={19} />
            </div>
          </div>
          <div className="stat-value" style={{ color: kpis.pendingDues > 0 ? "var(--danger)" : "var(--text-main)" }}>
            {formatIndianCurrency(kpis.pendingDues)}
          </div>
          <div className="trend" style={{ color: kpis.pendingDues > 0 ? "var(--danger)" : "var(--text-muted)" }}>
            <span>{kpis.pendingDues > 0 ? `${kpis.overdueCount} bills overdue` : "All vendor dues settled"}</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="stat-card">
          <div className="stat-top">
            <span>Supplier Distribution</span>
            <div className="stat-icon" style={{ background: "rgba(245, 158, 11, 0.12)", color: "#d97706" }}>
              <Building2 size={19} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 4 }}>
            <div>
              <small style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block" }}>Feed Mills</small>
              <strong style={{ fontSize: "1.1rem", color: "var(--primary)" }}>{categoryCounts[VENDOR_TYPES.FEED_MANUFACTURER]}</strong>
            </div>
            <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: 14 }}>
              <small style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block" }}>Dairy Units</small>
              <strong style={{ fontSize: "1.1rem", color: "#10b981" }}>{categoryCounts[VENDOR_TYPES.DAIRY_PROCESSOR]}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN TABLE CARD */}
      <div className="card table-card">
        {/* CARD HEAD WITH CATEGORY TABS */}
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
          <div className="filter-pills-bar">
            <button
              className={`filter-pill ${categoryFilter === "All" ? "active" : ""}`}
              onClick={() => setCategoryFilter("All")}
            >
              All Suppliers ({periodPurchases.length})
            </button>
            <button
              className={`filter-pill ${categoryFilter === VENDOR_TYPES.FEED_MANUFACTURER ? "active" : ""}`}
              onClick={() => setCategoryFilter(VENDOR_TYPES.FEED_MANUFACTURER)}
            >
              Feed Manufacturers ({categoryCounts[VENDOR_TYPES.FEED_MANUFACTURER]})
            </button>
            <button
              className={`filter-pill ${categoryFilter === VENDOR_TYPES.DAIRY_PROCESSOR ? "active" : ""}`}
              onClick={() => setCategoryFilter(VENDOR_TYPES.DAIRY_PROCESSOR)}
            >
              Dairy Processors ({categoryCounts[VENDOR_TYPES.DAIRY_PROCESSOR]})
            </button>
          </div>

          {/* Status filter */}
          <div style={{ display: "flex", gap: 6 }}>
            {["All", "Paid", "Pending", "Overdue"].map((st) => (
              <button
                key={st}
                className={`filter-pill ${statusFilter === st ? "active" : ""}`}
                style={{ fontSize: "12px", padding: "4px 10px" }}
                onClick={() => setStatusFilter(st)}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="table-toolbar">
          <div className="local-search">
            <Search size={16} />
            <input
              placeholder="Search by Bill #, supplier name, vendor ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ border: "none", background: "none", cursor: "pointer" }}>
                <X size={14} />
              </button>
            )}
          </div>
          <div>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>
              Showing {filteredPurchases.length} of {periodPurchases.length} purchase bills
            </span>
          </div>
        </div>

        {/* TABLE BODY */}
        <div className="table-wrap">
          {filteredPurchases.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><ShoppingCart size={28} /></div>
              <h4>No Purchase Bills Found</h4>
              <p>No procurement records found for {selectedFY} matching criteria.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Bill / PO #</th>
                  <th>Vendor Master Details</th>
                  <th>Supplier Category</th>
                  <th>Inward Line Items</th>
                  <th>Bill Date</th>
                  <th style={{ textAlign: "right" }}>Inward Total (₹)</th>
                  <th style={{ textAlign: "right" }}>Settled (₹)</th>
                  <th style={{ textAlign: "right" }}>Pending (₹)</th>
                  <th style={{ textAlign: "center" }}>Status</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map((pur) => {
                  const pId = pur.purchaseId || pur.id;
                  const vendor = vendorMap.get(pur.vendorId);
                  const total = Number(pur.grandTotal ?? pur.totalAmount ?? pur.total ?? 0);
                  const paid = Number(pur.paidAmount ?? 0);
                  const balance = Number(pur.balanceDue ?? Math.max(0, total - paid));
                  const status = pur.status || pur.paymentStatus || "Unpaid";
                  const isSettled = paid >= total && total > 0;

                  // Line items with product name from product master
                  const lines = pur.lines || (Array.isArray(pur.items) ? pur.items : []);

                  return (
                    <tr key={pId}>
                      <td>
                        <button
                          type="button"
                          onClick={() => setViewingPurchase(pur)}
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
                        >
                          <code style={{
                            color: "var(--primary)",
                            fontWeight: 700,
                            background: "rgba(0, 91, 181, 0.08)",
                            padding: "3px 7px",
                            borderRadius: 4
                          }}>
                            {pId}
                          </code>
                        </button>
                      </td>

                      <td>
                        <div className="person">
                          <div className="mini-avatar" style={{ background: "rgba(0, 91, 181, 0.12)", color: "var(--primary)" }}>
                            {(pur.vendorName || "V")[0]}
                          </div>
                          <div>
                            <b>{pur.vendorName || vendor?.name || "Registered Vendor"}</b>
                            {pur.vendorId && (
                              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                ID: {pur.vendorId}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td>
                        <span style={{ fontSize: "12px", fontWeight: 600 }}>
                          {pur.category || vendor?.category || VENDOR_TYPES.FEED_MANUFACTURER}
                        </span>
                      </td>

                      <td>
                        <div style={{ fontSize: "12.5px" }}>
                          {lines.length > 0 ? (
                            lines.map((l, i) => {
                              const prod = productMap.get(l.productId);
                              const pName = l.productName || prod?.name || l.description || l.productId;
                              const unit = l.unitOfMeasure || prod?.unitOfMeasure || l.unit || "Bags";
                              const qty = Number(l.quantity ?? l.qty ?? 0);
                              return (
                                <div key={i} style={{ color: "var(--text-main)", fontWeight: 500 }}>
                                  {pName}: <strong>{qty > 0 ? `${qty} ${unit}` : "—"}</strong>
                                </div>
                              );
                            })
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>—</span>
                          )}
                        </div>
                      </td>

                      <td style={{ fontSize: "12.5px" }}>{formatDate(pur.purchaseDate || pur.date)}</td>

                      <td className="money" style={{ textAlign: "right" }}>
                        <b style={{ color: "var(--primary)" }}>{formatIndianCurrency(total)}</b>
                      </td>

                      <td className="money" style={{ textAlign: "right", color: "#10b981", fontWeight: 600 }}>
                        {formatIndianCurrency(paid)}
                      </td>

                      <td className="money" style={{ textAlign: "right", color: balance > 0 ? "var(--danger)" : "var(--text-muted)" }}>
                        {formatIndianCurrency(balance)}
                      </td>

                      <td style={{ textAlign: "center" }}>
                        <span className={`badge ${
                          isSettled ? "paid" : (status === "Overdue" ? "overdue" : "pending-payment")
                        }`}>
                          {isSettled ? "Settled in Full" : status}
                        </span>
                      </td>

                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => setViewingPurchase(pur)}
                          title="View Bill Voucher"
                          style={{ color: "var(--primary)", background: "none", border: "none", cursor: "pointer" }}
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* VIEW MODAL */}
      <PurchaseViewModal
        isOpen={!!viewingPurchase}
        onClose={() => setViewingPurchase(null)}
        purchase={viewingPurchase}
        company={company}
        vendor={vendorMap.get(viewingPurchase?.vendorId)}
        showToast={notify}
        onRefresh={onRefresh}
      />

      {/* CREATE MODAL */}
      <PurchaseModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingPurchase(null);
        }}
        onSave={async (newPur) => {
          try {
            if (editingPurchase) {
              await erpApi.updatePurchase(editingPurchase.purchaseId || editingPurchase.id, {
                notes: newPur.notes || newPur.remarks,
                dueDate: newPur.dueDate,
                vendorInvoiceNo: newPur.vendorInvoiceNo || newPur.billNumber,
              });
              notify(`✓ Purchase Bill ${editingPurchase.purchaseId || editingPurchase.id} metadata updated`);
            } else if (onCreatePurchase) {
              await onCreatePurchase(newPur);
            } else {
              await erpApi.createPurchase(newPur);
            }
            setModalOpen(false);
            setEditingPurchase(null);
            if (onRefresh) await onRefresh();
          } catch (err) {
            const msg = err?.response?.data?.message || err.message;
            notify(`⚠️ ${msg}`);
            throw err;
          }
        }}
        vendors={vendors}
        products={products}
        company={company}
        showToast={notify}
      />
    </div>
  );
}
