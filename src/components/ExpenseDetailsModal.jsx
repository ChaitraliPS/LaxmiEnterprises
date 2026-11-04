import React from "react";
import {
  Receipt, X, Pencil, Calendar, Tag, CreditCard,
  User, IndianRupee, FileText, CheckCircle2
} from "lucide-react";

export default function ExpenseDetailsModal({
  isOpen,
  onClose,
  expense,
  onEdit
}) {
  if (!isOpen || !expense) return null;

  const formatCurrency = (val) => {
    const num = Number(val) || 0;
    return "₹" + num.toLocaleString("en-IN");
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        {/* MODAL HEADER */}
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              className="mini-avatar"
              style={{
                width: 44,
                height: 44,
                fontSize: 18,
                background: "rgba(239, 68, 68, 0.12)",
                color: "var(--danger)",
                borderRadius: "50%",
                display: "grid",
                placeItems: "center"
              }}
            >
              <Receipt size={22} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                  {expense.category || "Operational Expense"}
                </h3>
                <span className="badge" style={{ fontSize: 11, background: "var(--table-hover)" }}>
                  {expense.paymentMode || "Cash"}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                Voucher ID: <code>{expense.id || "EXP-001"}</code> | Date: <b>{expense.date || "—"}</b>
              </div>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={17} />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="modal-body" style={{ maxHeight: "75vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Card 1: Expense Amount & Classification */}
          <div className="client-detail-card">
            <div className="client-detail-card-title">
              <IndianRupee size={15} style={{ color: "var(--primary)" }} />
              Expense Details & Amount
            </div>
            <div className="client-detail-row">
              <span className="client-detail-label">Total Expense Amount:</span>
              <span className="client-detail-val" style={{ color: "var(--danger)", fontSize: "1.15rem", fontWeight: 800 }}>
                {formatCurrency(expense.amount)}
              </span>
            </div>
            <div className="client-detail-row">
              <span className="client-detail-label">Expense Category:</span>
              <span className="client-detail-val"><b>{expense.category || "General"}</b></span>
            </div>
            <div className="client-detail-row">
              <span className="client-detail-label">Transaction Date:</span>
              <span className="client-detail-val">{expense.date || "—"}</span>
            </div>
            <div className="client-detail-row">
              <span className="client-detail-label">Payment Mode:</span>
              <span className="client-detail-val"><b>{expense.paymentMode || "Cash"}</b></span>
            </div>
            {expense.referenceNo && (
              <div className="client-detail-row">
                <span className="client-detail-label">Reference / UTR / Check No:</span>
                <span className="client-detail-val"><code>{expense.referenceNo}</code></span>
              </div>
            )}
            <div className="client-detail-row">
              <span className="client-detail-label">Recorded By:</span>
              <span className="client-detail-val">{expense.paidBy || "Administrator"}</span>
            </div>
          </div>

          {/* Card 2: Description & Remarks */}
          {expense.description && (
            <div className="client-detail-card">
              <div className="client-detail-card-title">
                <FileText size={15} style={{ color: "var(--primary)" }} />
                Description & Purpose
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-main)", lineHeight: 1.6, padding: "4px 0" }}>
                {expense.description}
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <button type="button" className="outline" onClick={onClose}>
            Close
          </button>
          {onEdit && (
            <button
              type="button"
              className="primary"
              onClick={() => onEdit(expense)}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Pencil size={15} /> Edit Expense
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
