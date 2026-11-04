import React, { useRef, useState } from "react";
import {
  X, Download, ShoppingCart, Milk, Tractor, Wheat, Trash2,
  MapPin, Phone, Mail, Calendar, ShieldCheck, Edit3,
  CreditCard, Ban, CheckCircle2
} from "lucide-react";
import { generatePurchaseInvoicePDF } from "../services/pdfService";
import { getPurchaseWhatsAppUrl } from "../services/whatsappService";
import { erpApi } from "../services/api";
import { getToday } from "../constants/erpConstants";

export default function PurchaseViewModal({
  isOpen,
  onClose,
  purchase,
  company = {},
  vendor = {},
  onEdit,
  onRecordPayment,
  showToast,
  onRefresh
}) {
  const printRef = useRef(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("RTGS / Bank Transfer");
  const [payDate, setPayDate] = useState(() => getToday());
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  if (!isOpen || !purchase) return null;

  const isFeed = purchase.category === "Animal Feed Shop";
  const isDairy = purchase.category === "Dairy";
  const isFarmer = purchase.category === "Farmers";
  const isPartial = purchase.paymentStatus === "Partial";

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    try {
      const { fileName } = generatePurchaseInvoicePDF(purchase, company);
      if (showToast) {
        showToast(`✓ Downloaded ${fileName} to your PC`);
      }
    } catch (err) {
      console.error("PDF generation failed:", err);
      if (showToast) {
        showToast("⚠️ Failed to generate Receipt PDF: " + err.message);
      }
    }
  };



  const parseList = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(s => String(s).trim()).filter(Boolean);
    if (typeof val === "string") return val.split(",").map(s => s.trim()).filter(Boolean);
    return [String(val)];
  };

  const purchaseTotal = Number(purchase.totalAmount || purchase.total || purchase.grandTotal || 0);
  const purchasePaid = Number(purchase.paidAmount !== undefined && purchase.paidAmount !== null && purchase.paidAmount !== "" ? purchase.paidAmount : (purchase.paymentStatus === "Paid" ? purchaseTotal : 0));
  const balanceDue = Math.max(0, purchaseTotal - purchasePaid);
  const isCancelled = Boolean(purchase.isCancelled);
  const day1Amount = Number(purchase.day1Amount) || (isPartial ? purchasePaid : purchaseTotal);

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    const parsedAmount = Number(payAmount);
    if (!parsedAmount || parsedAmount <= 0) {
      if (showToast) showToast("⚠️ Please enter a valid payment amount");
      return;
    }
    setIsSubmitting(true);
    try {
      const targetId = purchase.purchaseId || purchase.id;
      await erpApi.recordVendorPayment(targetId, {
        paymentAmount: parsedAmount,
        paymentMode: payMode,
        paymentDate: payDate,
        referenceNo: payRef,
        notes: payNotes,
      });
      if (showToast) showToast(`✓ Vendor payment of ₹${parsedAmount.toLocaleString("en-IN")} recorded for ${targetId}`);
      setShowPaymentForm(false);
      if (onRefresh) await onRefresh();
      onClose();
    } catch (err) {
      console.error("Failed to record vendor payment:", err);
      if (showToast) showToast(`⚠️ Failed to record vendor payment: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Compute vendor payment history with running balance
  const paymentList = (purchase.vendorPayments || purchase.payments || []).filter(p => p.status !== "Cancelled");
  let cumulativePaid = 0;
  const paymentHistoryWithRunningBalance = paymentList.map((p) => {
    const pAmt = Number(p.amount || 0);
    cumulativePaid += pAmt;
    const runBal = Math.max(0, purchaseTotal - cumulativePaid);
    return {
      ...p,
      amount: pAmt,
      cumulativePaid,
      runningBalance: runBal,
    };
  });

  const handleDeletePayment = async (paymentId, paymentAmount) => {
    const targetId = purchase.purchaseId || purchase.id;
    const confirmed = window.confirm(
      `Are you sure you want to delete Payment #${paymentId} (₹${Number(paymentAmount).toLocaleString("en-IN")})? This will update the purchase balance due and revert the vendor outstanding payable.`
    );
    if (!confirmed) return;
    setIsSubmitting(true);
    try {
      await erpApi.deleteVendorPayment(targetId, paymentId);
      if (showToast) showToast(`✓ Payment #${paymentId} deleted and balance updated.`);
      if (onRefresh) await onRefresh();
      onClose();
    } catch (err) {
      console.error("Failed to delete vendor payment:", err);
      if (showToast) showToast(`⚠️ Failed to delete payment: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelPurchase = async () => {
    const targetId = purchase.purchaseId || purchase.id;
    const confirmed = window.confirm(
      `Are you sure you want to cancel Purchase Bill ${targetId}? This will reverse inventory stock additions and clear remaining vendor payables.`
    );
    if (!confirmed) return;
    setIsSubmitting(true);
    try {
      await erpApi.deletePurchase(targetId);
      if (showToast) showToast(`✓ Purchase Bill ${targetId} cancelled successfully.`);
      if (onRefresh) await onRefresh();
      onClose();
    } catch (err) {
      console.error("Failed to cancel purchase bill:", err);
      if (showToast) showToast(`⚠️ Failed to cancel purchase: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 860, width: "95%", maxHeight: "92vh", display: "flex", flexDirection: "column" }}
      >
        {/* MODAL HEAD */}
       <div
  className="modal-head"
  style={{
    padding: "14px 22px",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  }}
>
  {/* LEFT: icon + title + PO ref */}
  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
    <div style={{
      width: 36,
      height: 36,
      borderRadius: 8,
      flexShrink: 0,
      background: isDairy ? "rgba(2, 132, 199, 0.15)" :
                  isFarmer ? "rgba(217, 119, 6, 0.15)" : "rgba(16, 185, 129, 0.15)",
      color: isDairy ? "#0284c7" :
             isFarmer ? "#d97706" : "#059669",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <ShoppingCart size={20} />
    </div>
    <div style={{ minWidth: 0 }}>
      <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
        Inward Procurement Voucher
      </h3>
      <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
        PO Reference: <b>{purchase.id}</b> • Bill No: <b>{purchase.billNumber || "-"}</b>
      </p>
    </div>
  </div>

  {/* RIGHT: badges + close */}
  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
    <span
      className={`client-type-badge ${
        isDairy ? "dairy" : isFarmer ? "farmers" : "feed-shop"
      }`}
      style={{ whiteSpace: "nowrap" }}
    >
      {isDairy ? <Milk size={12} /> : isFarmer ? <Tractor size={12} /> : <Wheat size={12} />}
      {purchase.category}
    </span>
    {isPartial && (
      <span className="badge warning" style={{ fontSize: "0.72rem", whiteSpace: "nowrap" }}>
        Day 1 Partial
      </span>
    )}
    <button className="icon-btn" onClick={onClose} aria-label="Close modal">
      <X size={18} />
    </button>
  </div>
</div>

        {/* MODAL BODY (PRINTABLE VOUCHER AREA) */}
        <div className="modal-body" ref={printRef} style={{ flex: 1, overflowY: "auto", padding: "24px" }}>

          {/* Inline Vendor Payment Form Panel if active */}
          {showPaymentForm && (
            <div style={{
              background: "#ffffff",
              border: "1px solid #059669",
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
              boxShadow: "0 4px 12px rgba(5, 150, 105, 0.12)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: "#059669", fontSize: 14 }}>
                  <CreditCard size={18} />
                  <span>Record Vendor Payment Outflow for {purchase.purchaseId || purchase.id}</span>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShowPaymentForm(false)}
                  style={{ background: "transparent", border: "none", cursor: "pointer" }}
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleRecordPayment} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", display: "block", marginBottom: 4 }}>
                    Payment Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={balanceDue > 0 ? balanceDue : purchaseTotal}
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder={`Max ₹${balanceDue.toLocaleString("en-IN")}`}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #cbd5e1" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", display: "block", marginBottom: 4 }}>
                    Payment Mode *
                  </label>
                  <select
                    value={payMode}
                    onChange={(e) => setPayMode(e.target.value)}
                    required
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #cbd5e1" }}
                  >
                    <option value="RTGS / Bank Transfer">RTGS / Bank Transfer</option>
                    <option value="NEFT">NEFT</option>
                    <option value="IMPS">IMPS</option>
                    <option value="Cheque">Cheque</option>
                    <option value="UPI">UPI / Digital</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", display: "block", marginBottom: 4 }}>
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #cbd5e1" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", display: "block", marginBottom: 4 }}>
                    UTR / Reference No
                  </label>
                  <input
                    type="text"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    placeholder="e.g. UTR9483726"
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #cbd5e1" }}
                  />
                </div>

                <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    className="outline"
                    onClick={() => setShowPaymentForm(false)}
                    disabled={isSubmitting}
                    style={{ padding: "6px 14px", fontSize: 12 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="primary"
                    disabled={isSubmitting}
                    style={{ padding: "6px 16px", fontSize: 12, display: "flex", alignItems: "center", gap: 6, background: "#059669", borderColor: "#059669" }}
                  >
                    <CheckCircle2 size={14} />
                    <span>{isSubmitting ? "Submitting..." : "Submit Payment"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* VOUCHER HEADER WITH ENTERPRISE & SUPPLIER INFO */}
          <div className="responsive-two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20, background: "var(--table-hover)", padding: 18, borderRadius: 10, border: "1px solid var(--border)" }}>
            <div>
              <span style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.5px" }}>
                Buyer / Receiving Enterprise:
              </span>
              <h4 style={{ margin: "4px 0", fontSize: "1.05rem", color: "var(--primary)" }}>
                {company.name || "Laxmi Enterprises"}
              </h4>
              <p style={{ margin: "2px 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                {company.tagline || "Agribusiness & Industrial Supplies"}
              </p>
              <div style={{ fontSize: "0.8rem", marginTop: 6, lineHeight: 1.4 }}>
                <div>GSTIN: <b>{company.gstin || "27AAACL1234F1Z5"}</b></div>
                <div>{company.address || "Pune, Maharashtra, India"}</div>
                <div>Phone: {company.phone || "+91 98765 43210"}</div>
              </div>
            </div>

            <div>
              <span style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.5px" }}>
                Supplier / Seller Entity:
              </span>
              <h4 style={{ margin: "4px 0", fontSize: "1.05rem", color: "var(--text-main)" }}>
                {purchase.vendorName || purchase.name}
              </h4>
              {purchase.contactPerson && (
                <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  Proprietor / Rep: <b>{purchase.contactPerson}</b>
                </div>
              )}

              <div style={{ fontSize: "0.82rem", marginTop: 6, lineHeight: 1.5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-main)" }}>
                  <MapPin size={13} style={{ color: "var(--primary)" }} />
                  <span>Village: <b>{purchase.village || "-"}</b>, Taluka: <b>{purchase.taluka || "-"}</b>, Dist: <b>{purchase.district || "-"}</b></span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                  <Phone size={13} style={{ color: "var(--primary)" }} />
                  <span>Phone: <b>{purchase.contact || "-"}</b></span>
                  {purchase.email && (
                    <>
                      <span style={{ margin: "0 4px", color: "var(--border)" }}>•</span>
                      <Mail size={13} style={{ color: "var(--primary)" }} />
                      <span>{purchase.email}</span>
                    </>
                  )}
                </div>
                {purchase.dob && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                    <Calendar size={13} style={{ color: "var(--primary)" }} />
                    <span>Date of Birth / Inception: <b>{purchase.dob}</b></span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CATEGORY-SPECIFIC AGRIBUSINESS INTELLIGENCE CARD */}
          <div style={{
            marginBottom: 20,
            padding: 18,
            borderRadius: 10,
            background: isDairy ? "rgba(2, 132, 199, 0.05)" :
                        isFarmer ? "rgba(217, 119, 6, 0.05)" : "rgba(16, 185, 129, 0.05)",
            border: isDairy ? "1px solid rgba(2, 132, 199, 0.25)" :
                    isFarmer ? "1px solid rgba(217, 119, 6, 0.25)" : "1px solid rgba(16, 185, 129, 0.25)"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {isDairy ? <Milk size={18} style={{ color: "#0284c7" }} /> :
                 isFarmer ? <Tractor size={18} style={{ color: "#d97706" }} /> :
                 <Wheat size={18} style={{ color: "#059669" }} />}
                <h4 style={{
                  margin: 0,
                  fontSize: "0.95rem",
                  color: isDairy ? "#0284c7" : isFarmer ? "#d97706" : "#059669"
                }}>
                  {isDairy ? "Dairy Milk Procurement Intelligence" :
                   isFarmer ? "Farmer Direct Procurement Details" :
                   "Animal Feed Shop Inventory & Brand Information"}
                </h4>
              </div>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
                Sector Specification
              </span>
            </div>

            {/* FEED SHOP DETAILS */}
            {isFeed && (
              <div className="responsive-two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ gridColumn: "span 2" }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                    Types of Products Procured / Sold:
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {parseList(purchase.productTypes).map((p, i) => (
                      <span key={i} className="client-tag" style={{ background: "rgba(16, 185, 129, 0.12)", color: "#047857" }}>
                        ✓ {p}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                    Companies Selling Products:
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {parseList(purchase.companies).map((c, i) => (
                      <span key={i} className="client-tag">
                        🏢 {c}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                    Brands Sold & Procured:
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {parseList(purchase.brands).map((b, i) => (
                      <span key={i} className="client-tag" style={{ background: "rgba(99, 102, 241, 0.1)", color: "#4f46e5" }}>
                        ⭐ {b}
                      </span>
                    ))}
                  </div>
                </div>

                {purchase.numberOfAnimals && (
                  <div style={{ background: "rgba(255,255,255,0.7)", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>
                      Animals Network / Serviced:
                    </span>
                    <strong style={{ fontSize: "1rem", color: "#059669" }}>
                      🐾 {purchase.numberOfAnimals}
                    </strong>
                  </div>
                )}

                {purchase.feedQuantity && (
                  <div style={{ background: "rgba(255,255,255,0.7)", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>
                      Inward Feed Batch Volume:
                    </span>
                    <strong style={{ fontSize: "1rem", color: "var(--text-main)" }}>
                      📦 {purchase.feedQuantity}
                    </strong>
                  </div>
                )}
              </div>
            )}

            {/* DAIRY DETAILS */}
            {isDairy && (
              <div className="responsive-split-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
                <div style={{ background: "rgba(255,255,255,0.7)", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>
                    Number of Suppliers:
                  </span>
                  <strong style={{ fontSize: "1.2rem", color: "#0284c7" }}>
                    🥛 {purchase.numberOfSuppliers || 0}
                  </strong>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Registered Dairy Members</div>
                </div>

                <div style={{ background: "rgba(255,255,255,0.7)", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>
                    Quantity of Milk:
                  </span>
                  <strong style={{ fontSize: "1.2rem", color: "#0284c7" }}>
                    {purchase.milkQuantity || "-"}
                  </strong>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Procurement Inward</div>
                </div>

                <div style={{ background: "rgba(255,255,255,0.7)", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>
                    Fat & SNF Quality:
                  </span>
                  <strong style={{ fontSize: "1.1rem", color: "var(--text-main)" }}>
                    {purchase.fatPercent ? `${purchase.fatPercent}% Fat` : "-"} / {purchase.snfPercent ? `${purchase.snfPercent}% SNF` : "-"}
                  </strong>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Standard Dairy Grade</div>
                </div>

                <div style={{ background: "rgba(255,255,255,0.7)", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>
                    Rate per Liter:
                  </span>
                  <strong style={{ fontSize: "1.2rem", color: "var(--text-main)" }}>
                    ₹{purchase.ratePerLiter || 38} / Ltr
                  </strong>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Collection Base Price</div>
                </div>
              </div>
            )}

            {/* FARMERS DETAILS */}
            {isFarmer && (
              <div className="responsive-two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ background: "rgba(255,255,255,0.7)", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>
                    No. Of Animals Owned:
                  </span>
                  <strong style={{ fontSize: "1.25rem", color: "#d97706" }}>
                    🚜 {purchase.numberOfAnimals || 0} Livestock
                  </strong>
                  <div style={{ fontSize: "0.82rem", color: "var(--text-main)", marginTop: 4 }}>
                    {purchase.animalDetails || "General Cattle & Livestock"}
                  </div>
                </div>

                <div style={{ background: "rgba(255,255,255,0.7)", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>
                    Produce / Fodder Consignment:
                  </span>
                  <strong style={{ fontSize: "1.15rem", color: "var(--text-main)" }}>
                    🌱 {purchase.farmItemsSupplied || "Green Fodder & Silage"}
                  </strong>
                  <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: 4 }}>
                    Procured Volume: <b>{purchase.farmQuantity || "-"}</b>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* TRANSACTION TABLE & FINANCIAL SUMMARY */}
          <div className="table-wrap" style={{ marginBottom: 20 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", minWidth: 620 }}>
              <thead>
                <tr style={{ background: "var(--table-head)", borderBottom: "2px solid var(--border)" }}>
                  <th style={{ padding: "10px 14px", textAlign: "left" }}>Item & Consignment Details</th>
                  <th style={{ padding: "10px 14px", textAlign: "center" }}>Sector Category</th>
                  <th style={{ padding: "10px 14px", textAlign: "right" }}>Taxable Inward (₹)</th>
                  <th style={{ padding: "10px 14px", textAlign: "right" }}>GST Rate</th>
                  <th style={{ padding: "10px 14px", textAlign: "right" }}>Total Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 14px" }}>
                    <strong>{purchase.itemDescription}</strong>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 3 }}>
                      PO Date: {purchase.date} • Due: {purchase.dueDate || purchase.date}
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "center" }}>
                    <span className="client-tag">{purchase.category}</span>
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 600 }}>
                    ₹{(Number(purchase.taxableAmount) || 0).toLocaleString("en-IN")}
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "right" }}>
                    {purchase.gstRate || 0}% (₹{(Number(purchase.gstAmount) || 0).toLocaleString("en-IN")})
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, fontSize: "0.95rem" }}>
                    ₹{(Number(purchase.totalAmount) || 0).toLocaleString("en-IN")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* DAY 1 PARTIAL PAYMENT & SETTLEMENT SCHEDULE CARD */}
          {(isPartial || purchase.day1Amount || (purchase.installments && purchase.installments.length > 0)) && (
            <div style={{
              background: "rgba(245, 158, 11, 0.05)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              borderRadius: 10,
              padding: 16,
              marginBottom: 20
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Calendar size={18} style={{ color: "#d97706" }} />
                  <h4 style={{ margin: 0, fontSize: "0.95rem", color: "var(--text-main)" }}>
                    Day 1 Advance Payment & Settlement Schedule
                  </h4>
                </div>
                <span className="badge warning">
                  Partial Clearance Plan
                </span>
              </div>

              <div className="responsive-two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: "0.83rem" }}>
                <div style={{ background: "var(--card-bg)", padding: 12, borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700 }}>
                    Day 1 Initial Payment
                  </div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#10b981", marginTop: 2 }}>
                    ₹{day1Amount.toLocaleString("en-IN")}
                  </div>
                  <div style={{ marginTop: 6, fontSize: "0.8rem", color: "var(--text-main)", lineHeight: 1.5 }}>
                    <div>Date: <b>{purchase.day1Date || purchase.date}</b></div>
                    <div>Mode: <b>{purchase.day1Method || purchase.paymentMethod || "RTGS / Bank Transfer"}</b></div>
                    {purchase.day1Ref && <div>Ref / UTR: <b>{purchase.day1Ref}</b></div>}
                    {purchase.day1Notes && <div style={{ color: "var(--text-muted)", marginTop: 2 }}>Note: {purchase.day1Notes}</div>}
                  </div>
                </div>

                <div style={{ background: "var(--card-bg)", padding: 12, borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700 }}>
                    Remaining Clearance Schedule
                  </div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 800, color: balanceDue > 0 ? "var(--danger)" : "#10b981", marginTop: 2 }}>
                    ₹{balanceDue.toLocaleString("en-IN")}
                  </div>
                  <div style={{ marginTop: 6, fontSize: "0.8rem", color: "var(--text-main)", lineHeight: 1.5 }}>
                    <div>Target Due Date: <b>{purchase.dueDate || "Agreed terms"}</b></div>
                    <div>Total Procurement: <b>₹{(Number(purchase.totalAmount) || 0).toLocaleString("en-IN")}</b></div>
                    <div>Total Realized Outflow: <b style={{ color: "#10b981" }}>₹{(Number(purchase.paidAmount) || day1Amount).toLocaleString("en-IN")}</b></div>
                  </div>
                </div>
              </div>

              {/* Installments Table if extra installments exist */}
              {Array.isArray(purchase.installments) && purchase.installments.length > 0 && (
                <div style={{ marginTop: 12, borderTop: "1px dashed var(--border)", paddingTop: 10 }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: 6, color: "var(--text-main)" }}>
                    Subsequent Installment Logs:
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {purchase.installments.map((inst, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--card-bg)", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", fontSize: "0.8rem" }}>
                        <span><b>{inst.title || `Day ${idx + 2} Payment`}:</b> {inst.date} ({inst.method || "Transfer"})</span>
                        <span style={{ fontWeight: 700, color: "#10b981" }}>₹{(Number(inst.amount) || 0).toLocaleString("en-IN")} {inst.ref ? `[${inst.ref}]` : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

                    {/* Vendor Payment Settlement History & Outflow Ledger */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 6 }}>
                <CreditCard size={15} color="#059669" />
                <span>Vendor Payment Settlement History & Outflow Ledger</span>
              </div>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {paymentHistoryWithRunningBalance.length} payment{paymentHistoryWithRunningBalance.length === 1 ? "" : "s"} recorded
              </span>
            </div>

            {paymentHistoryWithRunningBalance.length > 0 ? (
              <div className="table-wrap">
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, background: "var(--table-hover)", borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)" }}>
                  <thead>
                    <tr style={{ background: "var(--table-head)", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                      <th style={{ padding: "8px 10px", textAlign: "left" }}>Date</th>
                      <th style={{ padding: "8px 10px", textAlign: "left" }}>Payment #</th>
                      <th style={{ padding: "8px 10px", textAlign: "left" }}>Method / Mode</th>
                      <th style={{ padding: "8px 10px", textAlign: "left" }}>Reference / UTR</th>
                      <th style={{ padding: "8px 10px", textAlign: "right" }}>Amount Settled (₹)</th>
                      <th style={{ padding: "8px 10px", textAlign: "right" }}>Running Balance (₹)</th>
                      <th style={{ padding: "8px 10px", textAlign: "center", width: 50 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentHistoryWithRunningBalance.map((pay, pIdx) => {
                      const dateStr = pay.paymentDate ? String(pay.paymentDate).slice(0, 10) : "-";
                      return (
                        <tr key={pay.id || pIdx} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "8px 10px", fontWeight: 600 }}>{dateStr}</td>
                          <td style={{ padding: "8px 10px", color: "var(--primary)", fontFamily: "monospace", fontWeight: 600 }}>
                            {pay.paymentNumber || `#${pay.id}`}
                          </td>
                          <td style={{ padding: "8px 10px" }}>{pay.paymentMode || "RTGS / Bank Transfer"}</td>
                          <td style={{ padding: "8px 10px", color: "var(--text-muted)" }}>{pay.reference || "-"}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: "#059669", fontWeight: 700 }}>
                            -₹{pay.amount.toLocaleString("en-IN")}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: pay.runningBalance > 0 ? "#dc2626" : "#059669", fontWeight: 700 }}>
                            ₹{pay.runningBalance.toLocaleString("en-IN")}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => handleDeletePayment(pay.id, pay.amount)}
                              disabled={isSubmitting}
                              title="Delete payment"
                              style={{
                                background: "none",
                                border: "none",
                                color: "#ef4444",
                                cursor: "pointer",
                                padding: 2,
                                opacity: isSubmitting ? 0.5 : 1,
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: "12px 14px", background: "var(--card-bg)", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
                No verified payments recorded yet. Remaining Balance Due: <strong style={{ color: "#dc2626" }}>₹{balanceDue.toLocaleString("en-IN")}</strong>
              </div>
            )}
          </div>

          {/* SETTLEMENT BREAKDOWN */}
          <div className="responsive-two-col" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20, alignItems: "start" }}>
            <div style={{ background: "var(--table-hover)", padding: "14px 18px", borderRadius: 8, border: "1px solid var(--border)", fontSize: "0.83rem" }}>
              <div style={{ fontWeight: 700, marginBottom: 6, color: "var(--text-main)" }}>
                Settlement & Payment Remarks:
              </div>
              <div>Mode of Payment: <b>{purchase.paymentMethod || "RTGS / Bank Transfer"}</b></div>
              <div>Delivery Warehouse / Bay: <b>{purchase.remarks || "Central Silo Receiving Bay"}</b></div>
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <span className={`badge ${purchase.paymentStatus === "Paid" ? "success" : purchase.paymentStatus === "Partial" ? "warning" : "muted"}`}>
                  {purchase.paymentStatus}
                </span>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  {purchase.paymentStatus === "Paid" ? "✓ Fully Realized to Vendor" : "Partial clearance active"}
                </span>
              </div>
            </div>

            <div style={{ background: "var(--card-bg)", padding: "14px 18px", borderRadius: 8, border: "1px solid var(--border)", fontSize: "0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "var(--text-muted)" }}>Taxable Inward:</span>
                <span>₹{(Number(purchase.taxableAmount) || 0).toLocaleString("en-IN")}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "var(--text-muted)" }}>GST ({purchase.gstRate || 0}%):</span>
                <span>₹{(Number(purchase.gstAmount) || 0).toLocaleString("en-IN")}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, borderTop: "1px solid var(--border)", paddingTop: 6, fontWeight: 700 }}>
                <span>Gross Purchase Value:</span>
                <span style={{ color: "var(--primary)", fontSize: "1.05rem" }}>₹{(Number(purchase.totalAmount) || 0).toLocaleString("en-IN")}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, color: "#10b981", fontWeight: 600 }}>
                <span>Paid Outflow:</span>
                <span>₹{(Number(purchase.paidAmount) || 0).toLocaleString("en-IN")}</span>
              </div>
              {balanceDue > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--danger)", fontWeight: 700 }}>
                  <span>Outstanding Balance Due:</span>
                  <span>₹{balanceDue.toLocaleString("en-IN")}</span>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* MODAL FOOTER */}
        {/* MODAL FOOTER */}
        <div className="modal-footer" style={{ padding: "14px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "12px", color: "var(--text-muted)" }}>
              <ShieldCheck size={16} color="#10b981" />
              <span>Verified Inward Voucher</span>
            </div>

            {!isCancelled && (
              <button
                type="button"
                className="outline"
                onClick={handleCancelPurchase}
                disabled={isSubmitting}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  color: "#dc2626",
                  borderColor: "rgba(220, 38, 38, 0.4)",
                  padding: "5px 12px",
                  fontSize: 12,
                  cursor: isSubmitting ? "not-allowed" : "pointer"
                }}
                title="Cancel / Delete this purchase bill and reverse stock"
              >
                <Trash2 size={13} />
                <span>Delete / Cancel Bill</span>
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        {!isCancelled && balanceDue > 0 && (
              <button
                type="button"
                className="primary"
                onClick={() => {
                  if (onRecordPayment) {
                    onRecordPayment(purchase);
                  } else {
                    setPayAmount(balanceDue > 0 ? balanceDue : purchaseTotal);
                    setShowPaymentForm(true);
                    setTimeout(() => printRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 50);
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#059669",
                  borderColor: "#059669"
                }}
                title="Record payment made to vendor for this purchase bill"
              >
                <CreditCard size={15} />
                <span>Record Payment</span>
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                className="outline"
                disabled={isCancelled}
                onClick={() => {
                  if (!isCancelled) {
                    onClose();
                    onEdit(purchase);
                  }
                }}
                title={isCancelled ? "Cancelled purchases cannot be edited" : "Edit Voucher"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  opacity: isCancelled ? 0.4 : 1,
                  cursor: isCancelled ? "not-allowed" : "pointer"
                }}
              >
                <Edit3 size={14} />
                <span>Edit Purchase</span>
              </button>
            )}
            <button
              type="button"
              className="primary"
              onClick={handleDownloadPDF}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Download size={15} />
              <span>Download Receipt PDF</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}