import React, { useState, useEffect } from "react";
import { X, CreditCard, CheckCircle2, AlertCircle, Calendar, Receipt, IndianRupee } from "lucide-react";
import { erpApi } from "../services/api";
import { getToday } from "../constants/erpConstants";
import { formatIndianCurrency } from "../utils/formatters";

export default function RecordPaymentModal({
  isOpen,
  onClose,
  invoice,
  onSuccess,
  showToast,
}) {
  if (!isOpen || !invoice) return null;

  const invoiceNumber = invoice.invoiceNumber || invoice.id;
  const grandTotal = Number(invoice.grandTotal ?? invoice.total ?? 0);
  const paidAmount = Number(invoice.paidAmount || 0);
  const balanceDue = Math.max(0, Number(invoice.balanceDue !== undefined && invoice.balanceDue !== null ? invoice.balanceDue : grandTotal - paidAmount));

  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => getToday());
  const [paymentMode, setPaymentMode] = useState("UPI");
  const [referenceNo, setReferenceNo] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Pre-fill amount with remaining balance whenever invoice changes or modal opens
  useEffect(() => {
    if (isOpen && invoice) {
      setAmount(balanceDue > 0 ? String(balanceDue) : "");
      setPaymentDate(getToday());
      setPaymentMode(invoice.paymentMode || "UPI");
      setReferenceNo("");
      setNotes("");
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, invoice, balanceDue]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Payment amount must be a valid number greater than ₹0.");
      return;
    }

    if (parsedAmount > balanceDue + 0.005) {
      setError(`Payment amount (₹${parsedAmount.toLocaleString("en-IN")}) exceeds remaining balance due (₹${balanceDue.toLocaleString("en-IN")}).`);
      return;
    }

    if (!paymentDate) {
      setError("Please select a payment date.");
      return;
    }

    if (!paymentMode) {
      setError("Please select a valid payment mode.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await erpApi.recordPayment(invoiceNumber, {
        paymentAmount: parsedAmount,
        paymentMode,
        paymentDate,
        referenceNo,
        notes,
      });

      const message = `✓ Successfully recorded payment of ${formatIndianCurrency(parsedAmount)} for ${invoiceNumber}`;
      if (showToast) showToast(message);

      if (onSuccess) {
        await onSuccess(response?.data);
      }
      onClose();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Failed to record payment";
      setError(msg);
      if (showToast) showToast(`⚠️ ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 99999 }}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 520,
          width: "92vw",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 20px 40px rgba(0,0,0,0.22)",
        }}
      >
        {/* Modal Header */}
        <div
          className="modal-header"
          style={{
            padding: "16px 20px",
            background: "var(--card-bg, #ffffff)",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: "rgba(16, 185, 129, 0.12)",
                color: "#10b981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CreditCard size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-main)" }}>
                Record Client Payment
              </h3>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Invoice: <strong style={{ color: "var(--primary)" }}>{invoiceNumber}</strong> • {invoice.clientName}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} style={{ padding: 20 }}>
          {/* Summary Banner */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
              padding: 12,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Total Invoiced</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginTop: 2 }}>
                {formatIndianCurrency(grandTotal)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}>Already Paid</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#059669", marginTop: 2 }}>
                {formatIndianCurrency(paidAmount)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#dc2626", fontWeight: 600 }}>Balance Due</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#dc2626", marginTop: 2 }}>
                {formatIndianCurrency(balanceDue)}
              </div>
            </div>
          </div>

          {error && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                borderRadius: 6,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
                fontSize: 12.5,
                marginBottom: 14,
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Amount Input */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main)", display: "block", marginBottom: 5 }}>
                Payment Amount (₹) <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div style={{ position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    left: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                    fontWeight: 700,
                  }}
                >
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={balanceDue}
                  required
                  disabled={isSubmitting}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={`Enter amount (max ₹${balanceDue.toLocaleString("en-IN")})`}
                  style={{
                    width: "100%",
                    padding: "9px 12px 9px 28px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: "var(--text-muted)" }}>
                <span>Pre-filled with full balance. Partial payments allowed.</span>
                {balanceDue > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(balanceDue))}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--primary)",
                      cursor: "pointer",
                      padding: 0,
                      fontWeight: 600,
                      textDecoration: "underline",
                    }}
                  >
                    Pay Full Balance
                  </button>
                )}
              </div>
            </div>

            {/* Date & Mode Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main)", display: "block", marginBottom: 5 }}>
                  Payment Date <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="date"
                  required
                  disabled={isSubmitting}
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    fontSize: 13,
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main)", display: "block", marginBottom: 5 }}>
                  Payment Method <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  disabled={isSubmitting}
                  required
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    fontSize: 13,
                  }}
                >
                  <option value="UPI">UPI / QR Code</option>
                  <option value="NEFT">Bank Transfer (NEFT/RTGS)</option>
                  <option value="IMPS">IMPS Immediate</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Commercial Transfer">Commercial Transfer</option>
                </select>
              </div>
            </div>

            {/* Reference Number */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main)", display: "block", marginBottom: 5 }}>
                UTR / Cheque / Reference Number <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>(Optional)</span>
              </label>
              <input
                type="text"
                disabled={isSubmitting}
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="e.g. UTR-982341908 or Cheque # 049281"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  fontSize: 13,
                }}
              />
            </div>

            {/* Notes */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main)", display: "block", marginBottom: 5 }}>
                Payment Note <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>(Optional)</span>
              </label>
              <input
                type="text"
                disabled={isSubmitting}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Received via GPay or deposited at Pune branch"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  fontSize: 13,
                }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 10,
              marginTop: 22,
              paddingTop: 16,
              borderTop: "1px solid var(--border)",
            }}
          >
            <button
              type="button"
              className="outline"
              onClick={onClose}
              disabled={isSubmitting}
              style={{ padding: "8px 16px", fontSize: 13 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary"
              disabled={isSubmitting || balanceDue <= 0}
              style={{
                padding: "8px 20px",
                fontSize: 13,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "#059669",
                borderColor: "#059669",
              }}
            >
              <CheckCircle2 size={16} />
              <span>{isSubmitting ? "Recording..." : `Confirm Payment (₹${Number(amount || 0).toLocaleString("en-IN")})`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

