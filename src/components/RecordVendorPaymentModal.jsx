import React, { useState, useEffect } from "react";
import { X, CreditCard, CheckCircle2, AlertCircle, Calendar, Receipt, IndianRupee } from "lucide-react";
import { erpApi } from "../services/api";
import { getToday } from "../constants/erpConstants";
import { formatIndianCurrency } from "../utils/formatters";

export default function RecordVendorPaymentModal({
  isOpen,
  onClose,
  purchase,
  onSuccess,
  showToast,
}) {
  if (!isOpen || !purchase) return null;

  const purchaseNumber = purchase.purchaseId || purchase.id;
  const grandTotal = Number(purchase.totalAmount ?? purchase.grandTotal ?? purchase.total ?? 0);
  const paidAmount = Number(purchase.paidAmount || 0);
  const balanceDue = Math.max(0, Number(purchase.balanceDue !== undefined && purchase.balanceDue !== null ? purchase.balanceDue : grandTotal - paidAmount));

  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => getToday());
  const [paymentMode, setPaymentMode] = useState("RTGS / Bank Transfer");
  const [referenceNo, setReferenceNo] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Pre-fill amount with remaining balance whenever purchase changes or modal opens
  useEffect(() => {
    if (isOpen && purchase) {
      setAmount(balanceDue > 0 ? String(balanceDue) : "");
      setPaymentDate(getToday());
      setPaymentMode(purchase.paymentMode || purchase.paymentMethod || "RTGS / Bank Transfer");
      setReferenceNo("");
      setNotes("");
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, purchase, balanceDue]);

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
      const response = await erpApi.recordVendorPayment(purchaseNumber, {
        paymentAmount: parsedAmount,
        paymentMode,
        paymentDate,
        referenceNo,
        notes,
      });

      const message = `✓ Successfully recorded vendor payment of ${formatIndianCurrency(parsedAmount)} for ${purchaseNumber}`;
      if (showToast) showToast(message);

      if (onSuccess) {
        await onSuccess(response?.data);
      }
      onClose();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Failed to record vendor payment";
      setError(msg);
      if (showToast) showToast(`⚠️ ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const enteredAmount = Number(amount || 0);
  const remainingBalanceAfter = Math.max(0, balanceDue - enteredAmount);

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
                Record Vendor Payment
              </h3>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Purchase: <strong style={{ color: "var(--primary)" }}>{purchaseNumber}</strong> • {purchase.vendorName || purchase.vendor}
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
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Total Inward Bill</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginTop: 2 }}>
                {formatIndianCurrency(grandTotal)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}>Already Settled</div>
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
                <span>Remaining after payment: <strong style={{ color: remainingBalanceAfter > 0 ? "#dc2626" : "#059669" }}>{formatIndianCurrency(remainingBalanceAfter)}</strong></span>
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
                  }}
                >
                  Pay Full Balance
                </button>
              </div>
            </div>

            {/* Payment Mode */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main)", display: "block", marginBottom: 5 }}>
                Payment Method / Mode <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                disabled={isSubmitting}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <option value="RTGS / Bank Transfer">RTGS / Bank Transfer</option>
                <option value="NEFT">NEFT</option>
                <option value="IMPS">IMPS</option>
                <option value="Cheque">Cheque</option>
                <option value="UPI">UPI / Digital</option>
                <option value="Cash">Cash</option>
              </select>
            </div>

            {/* Payment Date */}
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
                  padding: "9px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  fontSize: 13,
                }}
              />
            </div>

            {/* UTR / Reference */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main)", display: "block", marginBottom: 5 }}>
                Bank UTR / Transaction Reference No.
              </label>
              <input
                type="text"
                disabled={isSubmitting}
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="e.g. UTR983274619 or Cheque #000142"
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
                Settlement Notes / Remarks
              </label>
              <textarea
                rows={2}
                disabled={isSubmitting}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Part payment transferred from HDFC current account"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  fontSize: 13,
                  resize: "vertical",
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
              <span>{isSubmitting ? "Recording..." : `Confirm Payment (${formatIndianCurrency(enteredAmount)})`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

