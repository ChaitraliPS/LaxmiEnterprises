import React, { useState, useEffect } from "react";
import {
  Wallet, X, Save, AlertTriangle, Calendar, IndianRupee, Tag,
  CreditCard, User, FileText, CheckCircle2
} from "lucide-react";
import { EXPENSE_CATEGORY_LIST, PAYMENT_MODE_LIST, getToday } from "../constants/erpConstants";
import { formatIndianCurrency } from "../utils/formatters";

export default function ExpenseModal({
  isOpen,
  onClose,
  onSave,
  expenseToEdit = null,
}) {
  if (!isOpen) return null;
  const isEditing = !!expenseToEdit;

  const [form, setForm] = useState(() => {
    if (expenseToEdit) {
      return {
        id: expenseToEdit.id,
        expenseNumber: expenseToEdit.expenseNumber || "",
        title: expenseToEdit.title || "",
        category: expenseToEdit.category || EXPENSE_CATEGORY_LIST[0],
        amount: expenseToEdit.amount !== undefined ? String(expenseToEdit.amount) : "",
        expenseDate: expenseToEdit.expenseDate || getToday(),
        paymentMode: expenseToEdit.paymentMode || "Cash",
        paidTo: expenseToEdit.paidTo || "",
        referenceNo: expenseToEdit.referenceNo || "",
        notes: expenseToEdit.notes || "",
      };
    }
    return {
      title: "",
      category: EXPENSE_CATEGORY_LIST[0],
      amount: "",
      expenseDate: getToday(),
      paymentMode: "Cash",
      paidTo: "",
      referenceNo: "",
      notes: "",
    };
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (expenseToEdit) {
      setForm({
        id: expenseToEdit.id,
        expenseNumber: expenseToEdit.expenseNumber || "",
        title: expenseToEdit.title || "",
        category: expenseToEdit.category || EXPENSE_CATEGORY_LIST[0],
        amount: expenseToEdit.amount !== undefined ? String(expenseToEdit.amount) : "",
        expenseDate: expenseToEdit.expenseDate || getToday(),
        paymentMode: expenseToEdit.paymentMode || "Cash",
        paidTo: expenseToEdit.paidTo || "",
        referenceNo: expenseToEdit.referenceNo || "",
        notes: expenseToEdit.notes || "",
      });
    } else {
      setForm({
        title: "",
        category: EXPENSE_CATEGORY_LIST[0],
        amount: "",
        expenseDate: getToday(),
        paymentMode: "Cash",
        paidTo: "",
        referenceNo: "",
        notes: "",
      });
    }
    setErrors({});
  }, [expenseToEdit, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validate = () => {
    const errs = {};
    if (!form.title || !form.title.trim()) {
      errs.title = "Expense title / description is required";
    }
    const amt = parseFloat(form.amount);
    if (!form.amount || isNaN(amt) || amt <= 0) {
      errs.amount = "Enter a valid positive amount in ₹";
    }
    if (!form.expenseDate) {
      errs.expenseDate = "Date is required";
    }
    if (!form.category) {
      errs.category = "Category is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        amount: parseFloat(form.amount),
        title: form.title.trim(),
        paidTo: form.paidTo?.trim() || null,
        referenceNo: form.referenceNo?.trim() || null,
        notes: form.notes?.trim() || null,
      };

      await onSave(payload);
      onClose();
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        submit: err.message || "Failed to save expense",
      }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 620,
          width: "95vw",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div className="modal-header" style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: "rgba(239, 68, 68, 0.12)",
                color: "#ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Wallet size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "var(--text-main)" }}>
                {isEditing ? `Edit Expense: ${form.expenseNumber || form.title}` : "Log Operating Expense"}
              </h3>
              <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)" }}>
                {isEditing
                  ? "Update expense voucher details, amount, or allocation category"
                  : "Track operational overheads, logistics, utility bills & workplace expenses"}
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div className="modal-body" style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
            {errors.submit && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                  color: "#dc2626",
                  fontSize: 13,
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <AlertTriangle size={16} />
                <span>{errors.submit}</span>
              </div>
            )}

            {/* Title / Description */}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--text-main)" }}>
                Expense Title / Description <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="e.g. Warehouse Electricity Bill, Diesel for delivery van, Bags packaging"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: errors.title ? "1px solid var(--danger)" : "1px solid var(--border)",
                  fontSize: 14,
                }}
                autoFocus
              />
              {errors.title && (
                <small style={{ color: "var(--danger)", display: "block", marginTop: 4 }}>
                  {errors.title}
                </small>
              )}
            </div>

            {/* Amount & Date Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
              <div className="form-group">
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--text-main)" }}>
                  Amount (₹) <span style={{ color: "var(--danger)" }}>*</span>
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
                      fontSize: 14,
                    }}
                  >
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    name="amount"
                    value={form.amount}
                    onChange={handleChange}
                    placeholder="0.00"
                    style={{
                      width: "100%",
                      padding: "8px 12px 8px 28px",
                      borderRadius: 8,
                      border: errors.amount ? "1px solid var(--danger)" : "1px solid var(--border)",
                      fontSize: 15,
                      fontWeight: 600,
                    }}
                  />
                </div>
                {errors.amount && (
                  <small style={{ color: "var(--danger)", display: "block", marginTop: 4 }}>
                    {errors.amount}
                  </small>
                )}
              </div>

              <div className="form-group">
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--text-main)" }}>
                  Expense Date <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input
                  type="date"
                  name="expenseDate"
                  value={form.expenseDate}
                  onChange={handleChange}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: errors.expenseDate ? "1px solid var(--danger)" : "1px solid var(--border)",
                    fontSize: 14,
                  }}
                />
                {errors.expenseDate && (
                  <small style={{ color: "var(--danger)", display: "block", marginTop: 4 }}>
                    {errors.expenseDate}
                  </small>
                )}
              </div>
            </div>

            {/* Category & Payment Mode Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
              <div className="form-group">
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--text-main)" }}>
                  Category <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <select
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    fontSize: 13.5,
                  }}
                >
                  {EXPENSE_CATEGORY_LIST.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--text-main)" }}>
                  Payment Mode
                </label>
                <select
                  name="paymentMode"
                  value={form.paymentMode}
                  onChange={handleChange}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    fontSize: 13.5,
                  }}
                >
                  {PAYMENT_MODE_LIST.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Paid To & Reference No Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
              <div className="form-group">
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--text-main)" }}>
                  Paid To / Payee (Optional)
                </label>
                <input
                  type="text"
                  name="paidTo"
                  value={form.paidTo}
                  onChange={handleChange}
                  placeholder="e.g. MSEDCL, BPCL Fuel Station, Landlord"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    fontSize: 13.5,
                  }}
                />
              </div>

              <div className="form-group">
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--text-main)" }}>
                  Ref / Bill No / UTR (Optional)
                </label>
                <input
                  type="text"
                  name="referenceNo"
                  value={form.referenceNo}
                  onChange={handleChange}
                  placeholder="e.g. BILL-9921 / UTR-49102"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    fontSize: 13.5,
                  }}
                />
              </div>
            </div>

            {/* Notes / Remarks */}
            <div className="form-group" style={{ marginBottom: 8 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--text-main)" }}>
                Notes / Remarks (Optional)
              </label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={2}
                placeholder="Additional details regarding this operational expense..."
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  fontSize: 13.5,
                  resize: "vertical",
                }}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div
            className="modal-footer"
            style={{
              padding: "14px 24px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              {form.amount && !isNaN(parseFloat(form.amount)) && (
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Total: <strong style={{ color: "var(--text-main)" }}>{formatIndianCurrency(parseFloat(form.amount))}</strong>
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="outline" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="primary" disabled={submitting} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Save size={16} />
                <span>{submitting ? "Saving..." : isEditing ? "Update Expense" : "Save Expense"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
