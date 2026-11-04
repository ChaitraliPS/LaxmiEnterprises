import React from "react";
import {
  Boxes, Warehouse, X, Pencil, ArrowDownRight, ArrowUpRight,
  AlertTriangle, History, IndianRupee, Layers, CheckCircle2
} from "lucide-react";

export default function InventoryDetailsModal({
  isOpen,
  onClose,
  product,
  movements = [],
  onRecordMovement
}) {
  if (!isOpen || !product) return null;

  const productId = product.id || product.productId || "PR-001";
  const productName = product.name || "Product";
  const uom = product.unitOfMeasure || product.unit || (product.category === "Dairy" ? "Liters" : "Bags");
  const currentStock = Number(product.currentStock || 0);
  const costPrice = Number(product.costPrice || product.purchasePrice || product.price || 0);
  const totalValuation = currentStock * costPrice;

  const hasReorder = product.reorderLevel !== null && product.reorderLevel !== undefined && product.reorderLevel !== "";
  const reorderNum = hasReorder ? Number(product.reorderLevel) : null;
  const isOut = hasReorder && currentStock <= 0;
  const isLow = hasReorder && currentStock > 0 && currentStock <= reorderNum;
  const isNotSet = !hasReorder;
  const statusText = isNotSet ? "Not set" : isOut ? "Out of Stock" : isLow ? "Low Stock" : "In Stock";
  const warehouse = product.warehouseLocation || (product.category === "Dairy" ? "Cold Silo Tank 1" : "Godown Bay A-1");

  // Filter recent movements for this product
  const productMovements = (movements || []).filter(m =>
    m.productId === productId ||
    (m.productName && m.productName.toLowerCase() === productName.toLowerCase())
  ).slice(0, 5);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
        {/* MODAL HEADER */}
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              className="mini-avatar"
              style={{
                width: 44,
                height: 44,
                fontSize: 18,
                background: "rgba(14, 165, 233, 0.12)",
                color: "#0284c7",
                borderRadius: "50%",
                display: "grid",
                placeItems: "center"
              }}
            >
              <Boxes size={22} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{productName}</h3>
                <span className={`badge ${isNotSet ? "muted" : isOut ? "danger" : isLow ? "warning" : "success"}`} style={{ fontSize: 11 }}>
                  {statusText}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                Inventory Code: <code>{productId}</code> | Bay: <b>{warehouse}</b>
              </div>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={17} />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="modal-body" style={{ maxHeight: "75vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Card 1: Stock Telemetry */}
          <div className="client-detail-card">
            <div className="client-detail-card-title">
              <Boxes size={15} style={{ color: "var(--primary)" }} />
              Real-Time Stock Balance & Valuation
            </div>
            <div className="client-detail-row">
              <span className="client-detail-label">Current Available Units:</span>
              <span
                className="client-detail-val"
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  color: isOut ? "var(--danger)" : isLow ? "var(--warning)" : "var(--primary)"
                }}
              >
                {currentStock.toLocaleString("en-IN")} {uom}
              </span>
            </div>
            <div className="client-detail-row">
              <span className="client-detail-label">Designated Warehouse Bay:</span>
              <span className="client-detail-val">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Warehouse size={13} style={{ color: "var(--accent)" }} /> {warehouse}
                </span>
              </span>
            </div>
            <div className="client-detail-row">
              <span className="client-detail-label">Safety Reorder Threshold:</span>
              <span className="client-detail-val">
                {hasReorder ? `${reorderNum} ${uom}` : <span style={{ color: "var(--text-muted)" }}>Not configured</span>}
              </span>
            </div>
            {costPrice > 0 && (
              <div className="client-detail-row">
                <span className="client-detail-label">Estimated Holding Valuation:</span>
                <span className="client-detail-val" style={{ fontWeight: 700 }}>
                  ₹{totalValuation.toLocaleString("en-IN")} <span style={{ fontSize: 11, color: "var(--text-muted)" }}>(@ ₹{costPrice}/{uom})</span>
                </span>
              </div>
            )}
          </div>

          {/* Card 2: Recent Movements Ledger for this product */}
          <div className="client-detail-card">
            <div className="client-detail-card-title">
              <History size={15} style={{ color: "var(--primary)" }} />
              Recent Stock Inward / Outward Logs
            </div>
            {productMovements.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                {productMovements.map((m, idx) => (
                  <div
                    key={m.id || idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      background: "var(--table-hover)",
                      borderRadius: 8,
                      fontSize: 12.5
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {m.type === "Inward" ? (
                        <ArrowDownRight size={16} style={{ color: "#10b981" }} />
                      ) : (
                        <ArrowUpRight size={16} style={{ color: "#ef4444" }} />
                      )}
                      <div>
                        <b>{m.type || "Movement"}</b>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.date || "Recent"} • {m.reference || m.reason || "Manual Adjustment"}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <b style={{ color: m.type === "Inward" ? "#10b981" : "#ef4444" }}>
                        {m.type === "Inward" ? "+" : "-"}{m.quantity} {uom}
                      </b>
                      {m.balanceAfter !== undefined && (
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Balance: {m.balanceAfter} {uom}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "12px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 12.5 }}>
                No recent stock movement logs recorded for this item yet.
              </div>
            )}
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <button type="button" className="outline" onClick={onClose}>
            Close
          </button>
          {onRecordMovement && (
            <button
              type="button"
              className="primary"
              onClick={() => onRecordMovement(productId)}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Pencil size={15} /> Inward / Outward Stock
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
