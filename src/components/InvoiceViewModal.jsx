import React, { useState } from "react";
import {
  X, Download, Receipt, ShieldCheck, Edit3, CreditCard, Ban, CheckCircle2, AlertCircle, Trash2
} from "lucide-react";
import { generateInvoicePDF, numberToWordsINR } from "../services/pdfService";
import { erpApi } from "../services/api";
import { getToday } from "../constants/erpConstants";

export default function InvoiceViewModal({
  isOpen,
  onClose,
  invoice,
  company = {},
  client = null,
  onEdit,
  showToast,
  onRefresh
}) {
  if (!isOpen || !invoice) return null;

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("NEFT");
  const [payDate, setPayDate] = useState(() => getToday());
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const companyInfo = {
    name: company.name || "Laxmi Enterprises",
    tagline: company.tagline || "Industrial Supplies, Hardware & Trading",
    gstin: company.gstin || "27AAACL1234F1Z5",
    pan: company.pan || "AAACL1234F",
    phone: company.phone || "+91 98765 43210",
    email: company.email || "contact@laxmienterprises.com",
    address: company.address || "Shop No. 12, Commercial Complex, Near Industrial Estate, Pune - 411038, Maharashtra, India"
  };

  const amount = Number(invoice.amount ?? invoice.taxableTotal ?? invoice.subtotal ?? 0);
  const tax = Number(invoice.tax ?? invoice.gstTotal ?? ((Number(invoice.cgstTotal || 0) + Number(invoice.sgstTotal || 0) + Number(invoice.igstTotal || 0)) || (invoice.gstRate ? amount * (Number(invoice.gstRate) / 100) : 0)));
  const total = Number(invoice.total ?? invoice.grandTotal ?? (amount + tax));
  const effectiveGstRate = invoice.gstRate !== undefined && invoice.gstRate !== null
    ? Number(invoice.gstRate)
    : (amount > 0 ? Math.round((tax / amount) * 100) : 0);
  const halfRate = (effectiveGstRate / 2).toFixed(1).replace(/\.0$/, "");
  const cgst = Number(invoice.cgstTotal) || Math.round(tax / 2);
  const sgst = Number(invoice.sgstTotal) || (tax - cgst);
  const paid = Number(invoice.paidAmount || 0);
  const balanceDue = Number(invoice.balanceDue !== undefined && invoice.balanceDue !== null ? invoice.balanceDue : Math.max(0, total - paid));
  const isCancelled = Boolean(invoice.isCancelled);

  const handleDownloadPDF = () => {
    try {
      const { fileName } = generateInvoicePDF(invoice, companyInfo, client || {});
      if (showToast) showToast(`✓ Downloaded ${fileName} to your PC`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      if (showToast) showToast("⚠️ Failed to generate PDF: " + err.message);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    const parsedAmount = Number(payAmount);
    if (!parsedAmount || parsedAmount <= 0) {
      if (showToast) showToast("⚠️ Please enter a valid payment amount");
      return;
    }
    setIsSubmitting(true);
    try {
      const targetId = invoice.invoiceNumber || invoice.id;
      await erpApi.recordPayment(targetId, {
        paymentAmount: parsedAmount,
        paymentMode: payMode,
        paymentDate: payDate,
        referenceNo: payRef,
        notes: payNotes,
      });
      if (showToast) showToast(`✓ Payment of ₹${parsedAmount.toLocaleString("en-IN")} recorded for ${targetId}`);
      setShowPaymentForm(false);
      if (onRefresh) await onRefresh();
      onClose();
    } catch (err) {
      console.error("Failed to record payment:", err);
      if (showToast) showToast(`⚠️ Failed to record payment: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelInvoice = async () => {
    const targetId = invoice.invoiceNumber || invoice.id;
    const confirmed = window.confirm(
      `Are you sure you want to cancel Invoice ${targetId}? This will reverse inventory stock deductions and remove any remaining balance due.`
    );
    if (!confirmed) return;
    setIsSubmitting(true);
    try {
      await erpApi.deleteInvoice(targetId);
      if (showToast) showToast(`✓ Invoice ${targetId} cancelled successfully.`);
      if (onRefresh) await onRefresh();
      onClose();
    } catch (err) {
      console.error("Failed to cancel invoice:", err);
      if (showToast) showToast(`⚠️ Failed to cancel invoice: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePayment = async (paymentId, paymentAmount) => {
    const targetId = invoice.invoiceNumber || invoice.id;
    const confirmed = window.confirm(
      `Are you sure you want to delete Payment #${paymentId} (₹${Number(paymentAmount).toLocaleString("en-IN")})? This will update the invoice balance due and remove the linked Collection entry.`
    );
    if (!confirmed) return;
    setIsSubmitting(true);
    try {
      await erpApi.deletePayment(targetId, paymentId);
      if (showToast) showToast(`✓ Payment #${paymentId} and linked Collection deleted.`);
      if (onRefresh) await onRefresh();
      onClose();
    } catch (err) {
      console.error("Failed to delete payment:", err);
      if (showToast) showToast(`⚠️ Failed to delete payment: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sort payments chronologically and compute running balance
  const paymentList = (invoice.payments || []).filter(p => p.status !== "Cancelled");
  let cumulativePaid = 0;
  const paymentHistoryWithRunningBalance = paymentList.map((p) => {
    const pAmt = Number(p.amount || 0);
    cumulativePaid += pAmt;
    const runBal = Math.max(0, total - cumulativePaid);
    return {
      ...p,
      amount: pAmt,
      cumulativePaid,
      runningBalance: runBal,
    };
  });

  const statusClass = (invoice.status || "Paid").toLowerCase();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card invoice-preview-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 840, width: "95vw", maxHeight: "92vh", display: "flex", flexDirection: "column" }}
      >
        {/* ── MODAL HEADER ── */}
        <div className="modal-header" style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="mini-avatar" style={{ background: "rgba(0, 91, 181, 0.12)", color: "var(--primary)" }}>
              <Receipt size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, margin: 0, color: "var(--text-main)" }}>
                Tax Invoice: <span style={{ color: "var(--primary)" }}>{invoice.id || invoice.invoiceNumber}</span>
              </h3>
              <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                GST Tax Invoice Preview • Real-Time Database Record
              </span>
            </div>
          </div>

          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close invoice viewer"
          >
            <X size={17} />
          </button>
        </div>

        {/* ── PRINTABLE INVOICE PAPER BODY ── */}
        <div className="modal-body" style={{ overflowY: "auto", padding: 24, background: "#f8fafc" }}>
          
          {/* Inline Payment Form Panel if active */}
          {showPaymentForm && (
            <div style={{
              background: "#ffffff",
              border: "1px solid #005bb5",
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
              boxShadow: "0 4px 12px rgba(0, 91, 181, 0.12)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: "#005bb5", fontSize: 14 }}>
                  <CreditCard size={18} />
                  <span>Record Client Payment for {invoice.invoiceNumber || invoice.id}</span>
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
                    max={balanceDue > 0 ? balanceDue : total}
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
                    <option value="NEFT">NEFT / Commercial Transfer</option>
                    <option value="RTGS">RTGS</option>
                    <option value="IMPS">IMPS</option>
                    <option value="UPI">UPI / Digital</option>
                    <option value="Cheque">Cheque</option>
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
                    placeholder="e.g. UTR10293848"
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
                    style={{ padding: "6px 16px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <CheckCircle2 size={14} />
                    <span>{isSubmitting ? "Submitting..." : "Submit Payment"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          <div
            className="invoice-paper"
            id="printable-invoice"
            style={{
              background: "#ffffff",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
              padding: 32,
              color: "#0f172a",
              fontFamily: "Inter, -apple-system, sans-serif"
            }}
          >
            {/* Top Brand Stripe */}
            <div
              style={{
                height: 6,
                background: isCancelled ? "#ef4444" : "linear-gradient(90deg, #005bb5 0%, #00b4d8 100%)",
                borderRadius: "4px 4px 0 0",
                margin: "-32px -32px 24px -32px"
              }}
            />

            {/* Header: Company & Invoice Info */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, borderBottom: "1px solid #e2e8f0", paddingBottom: 20 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <img
                    src="/logo.png"
                    alt="Laxmi Enterprises"
                    style={{ height: 42, width: "auto", objectFit: "contain" }}
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                  <div>
                    <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "#002b5c", letterSpacing: "-0.02em" }}>
                      {companyInfo.name}
                    </h2>
                    <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {companyInfo.tagline}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 10, lineHeight: 1.5, maxWidth: 380 }}>
                  {companyInfo.address}
                </div>
                <div style={{ fontSize: 12, color: "#1e293b", marginTop: 6, display: "flex", gap: 16, flexWrap: "wrap", fontWeight: 600 }}>
                  <span>GSTIN: <strong style={{ color: "#005bb5" }}>{companyInfo.gstin}</strong></span>
                  <span>PAN: <strong>{companyInfo.pan}</strong></span>
                </div>
                <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 4 }}>
                  <span>Tel: {companyInfo.phone}</span> • <span>Email: {companyInfo.email}</span>
                </div>
              </div>

              {/* Right Side: Tax Invoice badge */}
              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    display: "inline-block",
                    background: isCancelled ? "rgba(239, 68, 68, 0.1)" : "rgba(0, 91, 181, 0.08)",
                    color: isCancelled ? "#dc2626" : "#005bb5",
                    padding: "4px 14px",
                    borderRadius: 6,
                    fontWeight: 800,
                    fontSize: 16,
                    letterSpacing: "0.04em",
                    border: isCancelled ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid rgba(0, 91, 181, 0.2)"
                  }}
                >
                  {isCancelled ? "CANCELLED INVOICE" : "TAX INVOICE"}
                </span>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                  Original for Recipient
                </div>

                <div
                  style={{
                    marginTop: 14,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    padding: "10px 14px",
                    textAlign: "right",
                    minWidth: 200
                  }}
                >
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    Invoice #: <strong style={{ color: "#005bb5", fontSize: 13 }}>{invoice.id || invoice.invoiceNumber}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                    Date: <strong>{invoice.date || invoice.invoiceDate}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                    Due Date: <strong>{invoice.dueDate || "-"}</strong>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <span
                      className={`badge ${statusClass === "paid" ? "paid" : statusClass === "partial" ? "pending-payment" : statusClass === "overdue" ? "overdue" : statusClass === "cancelled" ? "danger" : "muted"}`}
                      style={{ fontSize: 11, padding: "3px 10px" }}
                    >
                      {invoice.status || "Paid"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Billed By & Billed To Split Cards */}
            <div className="responsive-two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, margin: "20px 0" }}>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: 14 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#005bb5", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                  Billed By (Supplier)
                </div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{companyInfo.name}</div>
                <div style={{ fontSize: 11.5, color: "#475569", marginTop: 4 }}>Industrial Estate, Pune - 411038</div>
                <div style={{ fontSize: 11.5, color: "#475569", marginTop: 2 }}>State: Maharashtra (State Code: 27)</div>
                <div style={{ fontSize: 11.5, color: "#475569", marginTop: 2 }}>Place of Supply: Maharashtra (27)</div>
              </div>

              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: 14 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#002b5c", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                  Billed To (Customer / Recipient)
                </div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{invoice.clientName}</div>
                <div style={{ fontSize: 11.5, color: "#475569", marginTop: 4 }}>
                  Account ID: <strong>{invoice.clientId || "—"}</strong>
                </div>
                <div style={{ fontSize: 11.5, color: "#475569", marginTop: 2 }}>
                  GSTIN: {client?.gstin || invoice.clientGstin || "—"}
                </div>
                <div style={{ fontSize: 11.5, color: "#475569", marginTop: 2 }}>
                  Payment Mode: <strong>{invoice.paymentMode || invoice.paymentMethod || "—"}</strong>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10, minWidth: 620 }}>
                <thead>
                  <tr style={{ background: "#005bb5", color: "#ffffff", fontSize: 12 }}>
                    <th style={{ padding: "10px 12px", textAlign: "center", width: 40 }}>#</th>
                    <th style={{ padding: "10px 12px", textAlign: "left" }}>Item Description & Particulars</th>
                    <th style={{ padding: "10px 12px", textAlign: "center", width: 110 }}>HSN / SAC</th>
                    <th style={{ padding: "10px 12px", textAlign: "center", width: 90 }}>Qty & Unit</th>
                    <th style={{ padding: "10px 12px", textAlign: "right", width: 100 }}>Rate (₹)</th>
                    <th style={{ padding: "10px 12px", textAlign: "center", width: 70 }}>GST %</th>
                    <th style={{ padding: "10px 12px", textAlign: "right", width: 110 }}>Taxable (₹)</th>
                    <th style={{ padding: "10px 12px", textAlign: "right", width: 110 }}>Total (₹)</th>
                  </tr>
                </thead>
                <tbody style={{ fontSize: 12 }}>
                  {Array.isArray(invoice.items) && invoice.items.length > 0 ? (
                    invoice.items.map((it, idx) => {
                      const itemTaxable = Number(it.taxable) || (Number(it.qty || it.quantity || 1) * Number(it.rate || it.unitPrice || 0));
                      const itemGst = it.gstRate !== undefined && it.gstRate !== null ? Number(it.gstRate) : effectiveGstRate;
                      const itemTax = Math.round(itemTaxable * (itemGst / 100));
                      const itemTotal = Number(it.total || it.lineTotal) || (itemTaxable + itemTax);
                      return (
                        <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "10px 12px", textAlign: "center", color: "#64748b" }}>{idx + 1}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <div style={{ fontWeight: 700, color: "#0f172a" }}>
                              {it.description || it.name || it.productName || "Commercial Product Item"}
                            </div>
                            {it.productId && (
                              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                                Catalog Code: {it.productId}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "center", fontFamily: "monospace", color: "#475569" }}>
                            {it.hsn || it.hsnCode || "—"}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600 }}>
                            {it.qty || it.quantity || 1} {it.unit || it.unitOfMeasure || "Nos"}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right" }}>
                            ₹{Number(it.rate || it.unitPrice || 0).toLocaleString("en-IN")}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "center", color: "#64748b" }}>{itemGst}%</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>
                            ₹{itemTaxable.toLocaleString("en-IN")}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#005bb5" }}>
                            ₹{itemTotal.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "12px", textAlign: "center", color: "#64748b" }}>1</td>
                      <td style={{ padding: "12px" }}>
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>
                          {invoice.category || "Commercial Supplies"} Order Consignment
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                          Commercial supply order as per agreed technical specification & delivery challan
                        </div>
                      </td>
                      <td style={{ padding: "12px", textAlign: "center", fontFamily: "monospace", color: "#475569" }}>8481 / 7318</td>
                      <td style={{ padding: "12px", textAlign: "center" }}>1 Lot</td>
                      <td style={{ padding: "12px", textAlign: "right" }}>₹{amount.toLocaleString("en-IN")}</td>
                      <td style={{ padding: "12px", textAlign: "center", color: "#64748b" }}>
                        {effectiveGstRate > 0 ? `${effectiveGstRate}% GST` : "GST"}
                      </td>
                      <td style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>₹{amount.toLocaleString("en-IN")}</td>
                      <td style={{ padding: "12px", textAlign: "right", fontWeight: 800, color: "#005bb5" }}>₹{total.toLocaleString("en-IN")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Calculations & Bank Details Split */}
            <div className="responsive-two-col" style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 20, marginTop: 20 }}>
              <div>
                <div style={{ background: "#f1f5f9", padding: "10px 14px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "#005bb5", textTransform: "uppercase" }}>
                    Invoice Amount in Words:
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", marginTop: 3, fontStyle: "italic" }}>
                    {numberToWordsINR(total)}
                  </div>
                </div>

                <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 6, border: "1px solid #e2e8f0", marginTop: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#002b5c", marginBottom: 6 }}>
                    Bank Remittance Account Details (NEFT / RTGS / IMPS)
                  </div>
                  <div style={{ fontSize: 11.5, color: "#334155", lineHeight: 1.6 }}>
                    <div>Bank Name: <strong>State Bank of India (SBI)</strong></div>
                    <div>Account Name: <strong>Laxmi Enterprises Commercial</strong></div>
                    <div>Account Number: <strong style={{ fontFamily: "monospace" }}>398201554902</strong></div>
                    <div>IFSC Code: <strong style={{ fontFamily: "monospace" }}>SBIN0001245</strong> • Branch: Pune Industrial</div>
                  </div>
                </div>
              </div>

              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#475569", marginBottom: 6 }}>
                  <span>Taxable Subtotal:</span>
                  <span style={{ fontWeight: 600 }}>₹{amount.toLocaleString("en-IN")}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#475569", marginBottom: 6 }}>
                  <span>CGST {halfRate > 0 ? `@ ${halfRate}%` : ""}:</span>
                  <span>₹{cgst.toLocaleString("en-IN")}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#475569", marginBottom: 6 }}>
                  <span>SGST {halfRate > 0 ? `@ ${halfRate}%` : ""}:</span>
                  <span>₹{sgst.toLocaleString("en-IN")}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#475569", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #cbd5e1" }}>
                  <span>Total Tax (GST{effectiveGstRate > 0 ? ` ${effectiveGstRate}%` : ""}):</span>
                  <span style={{ fontWeight: 700 }}>₹{tax.toLocaleString("en-IN")}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 14,
                    color: "#ffffff",
                    background: isCancelled ? "#ef4444" : "#005bb5",
                    padding: "8px 12px",
                    borderRadius: 6,
                    fontWeight: 800
                  }}
                >
                  <span>Grand Total (INR):</span>
                  <span>₹{total.toLocaleString("en-IN")}</span>
                </div>

                <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#059669", marginBottom: 4 }}>
                    <span>Amount Received / Paid:</span>
                    <span style={{ fontWeight: 700 }}>₹{paid.toLocaleString("en-IN")}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: balanceDue > 0 ? "#dc2626" : "#059669" }}>
                    <span>Remaining Balance Due:</span>
                    <span style={{ fontWeight: 800 }}>₹{balanceDue.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment History & Realized Collections Ledger */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#002b5c", display: "flex", alignItems: "center", gap: 6 }}>
                  <CreditCard size={15} color="#005bb5" />
                  <span>Payment History & Realized Collections Ledger</span>
                </div>
                <span style={{ fontSize: 11, color: "#64748b" }}>
                  {paymentHistoryWithRunningBalance.length} payment{paymentHistoryWithRunningBalance.length === 1 ? "" : "s"} recorded
                </span>
              </div>

              {paymentHistoryWithRunningBalance.length > 0 ? (
                <div className="table-wrap">
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, background: "#f8fafc", borderRadius: 6, overflow: "hidden", border: "1px solid #e2e8f0" }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9", color: "#475569", borderBottom: "1px solid #e2e8f0" }}>
                        <th style={{ padding: "8px 10px", textAlign: "left" }}>Date</th>
                        <th style={{ padding: "8px 10px", textAlign: "left" }}>Payment #</th>
                        <th style={{ padding: "8px 10px", textAlign: "left" }}>Method / Mode</th>
                        <th style={{ padding: "8px 10px", textAlign: "left" }}>Reference / UTR</th>
                        <th style={{ padding: "8px 10px", textAlign: "right" }}>Amount Paid (₹)</th>
                        <th style={{ padding: "8px 10px", textAlign: "right" }}>Running Balance (₹)</th>
                        <th style={{ padding: "8px 10px", textAlign: "center", width: 50 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentHistoryWithRunningBalance.map((pay, pIdx) => {
                        const dateStr = pay.paymentDate ? String(pay.paymentDate).slice(0, 10) : "-";
                        return (
                          <tr key={pay.id || pIdx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ padding: "8px 10px", color: "#334155", fontWeight: 600 }}>{dateStr}</td>
                            <td style={{ padding: "8px 10px", color: "#005bb5", fontFamily: "monospace", fontWeight: 600 }}>
                              {pay.paymentNumber || `#${pay.id}`}
                            </td>
                            <td style={{ padding: "8px 10px", color: "#334155" }}>{pay.paymentMode || "UPI"}</td>
                            <td style={{ padding: "8px 10px", color: "#64748b" }}>{pay.reference || "-"}</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", color: "#059669", fontWeight: 700 }}>
                              +₹{pay.amount.toLocaleString("en-IN")}
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
                <div style={{ padding: "12px 14px", background: "#f8fafc", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, color: "#64748b", textAlign: "center" }}>
                  No verified payments recorded yet. Remaining Balance Due: <strong style={{ color: "#dc2626" }}>₹{balanceDue.toLocaleString("en-IN")}</strong>
                </div>
              )}
            </div>

            {/* Terms and Signatory */}
            <div className="responsive-two-col" style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 20, marginTop: 24, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 10.5, color: "#64748b", lineHeight: 1.5 }}>
                <strong style={{ color: "#334155" }}>Terms & Conditions:</strong>
                <div>1. Goods once inspected cannot be returned without prior authorization.</div>
                <div>2. Payment is due within agreed terms. Delayed payments attract interest @ 18% p.a.</div>
                <div>3. All disputes subject to Pune, Maharashtra jurisdiction.</div>
              </div>

              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#002b5c" }}>
                  For {companyInfo.name}
                </div>
                <div
                  style={{
                    height: 48,
                    border: "1px dashed #cbd5e1",
                    borderRadius: 4,
                    margin: "8px auto",
                    maxWidth: 200,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    color: "#94a3b8",
                    fontStyle: "italic"
                  }}
                >
                  [ Digitally Verified Seal ]
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#0f172a" }}>
                  Authorized Signatory
                </div>
              </div>
            </div>

            <div style={{ textAlign: "center", fontSize: 10, color: "#94a3b8", marginTop: 20, paddingTop: 10, borderTop: "1px solid #f1f5f9" }}>
              Computer generated Tax Invoice issued by Laxmi Enterprises ERP Portal • Valid for Input Tax Credit (ITC)
            </div>
          </div>
        </div>

        {/* ── MODAL FOOTER ── */}
        <div
          className="modal-footer"
          style={{
            padding: "12px 20px",
            background: "var(--card-bg)",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10
          }}
        >
          {/* Left: cancel button & verified badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "12px", color: "var(--text-muted)" }}>
              <ShieldCheck size={16} color="#10b981" />
              <span>Verified Tax Invoice</span>
            </div>

            {!isCancelled && (
              <button
                type="button"
                className="outline"
                onClick={handleCancelInvoice}
                disabled={isSubmitting}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  color: "#dc2626",
                  borderColor: "rgba(220, 38, 38, 0.4)",
                  padding: "5px 10px",
                  fontSize: 12
                }}
                title="Cancel this invoice and reverse stock"
              >
                <Ban size={13} />
                <span>Cancel Invoice</span>
              </button>
            )}
          </div>

          {/* Right: Record Payment | Edit Invoice | Download PDF */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {!isCancelled && balanceDue > 0 && !showPaymentForm && (
              <button
                type="button"
                className="primary"
                onClick={() => {
                  setPayAmount(balanceDue);
                  setShowPaymentForm(true);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#059669",
                  borderColor: "#059669"
                }}
                title="Record payment received for this invoice"
              >
                <CreditCard size={15} />
                <span>Record Payment</span>
              </button>
            )}

            <button
              type="button"
              className="outline"
              onClick={() => {
                if (onEdit) onEdit(invoice);
                onClose();
              }}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
              title="Edit this invoice"
            >
              <Edit3 size={14} />
              <span>Edit Invoice</span>
            </button>

            <button
              type="button"
              className="primary"
              onClick={handleDownloadPDF}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Download size={15} />
              <span>Download PDF</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
