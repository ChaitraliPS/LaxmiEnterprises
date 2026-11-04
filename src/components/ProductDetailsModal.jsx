import React from "react";
import {
  Package, Milk, X, Pencil, Tag, Warehouse,
  IndianRupee, Percent, AlertTriangle, Layers, Info
} from "lucide-react";

export default function ProductDetailsModal({
  isOpen,
  onClose,
  product,
  onEdit
}) {
  if (!isOpen || !product) return null;

  const isDairy = product.category === "Dairy" || (product.name && product.name.toLowerCase().includes("milk"));
  const productId = product.id || product.productId || "PR-001";
  const productName = product.name || "Product";
  const uom = product.unitOfMeasure || product.unit || (isDairy ? "Liters" : "Bags");
  const sellingPrice = Number(product.sellingPrice || product.price || 0);
  const costPrice = Number(product.costPrice || product.purchasePrice || 0);
  const marginAmt = Math.max(0, sellingPrice - costPrice);
  const marginPct = sellingPrice > 0 ? Math.round((marginAmt / sellingPrice) * 100) : 0;
  const gstRate = product.gstRate !== undefined && product.gstRate !== null ? product.gstRate : (isDairy ? 0 : 5);

  const currentStock = Number(product.currentStock || 0);
  const hasReorder = product.reorderLevel !== null && product.reorderLevel !== undefined && product.reorderLevel !== "";
  const reorderNum = hasReorder ? Number(product.reorderLevel) : null;
  const isOut = hasReorder && currentStock <= 0;
  const isLow = hasReorder && currentStock > 0 && currentStock <= reorderNum;
  const isNotSet = !hasReorder;
  const statusText = isNotSet ? "Not set" : isOut ? "Out of Stock" : isLow ? "Low Stock" : "In Stock";
  const warehouse = product.warehouseLocation || (isDairy ? "Cold Silo Tank 1" : "Godown Bay A-1");

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680 }}>
        {/* MODAL HEADER */}
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              className="mini-avatar"
              style={{
                width: 44,
                height: 44,
                fontSize: 18,
                background: isDairy ? "rgba(14, 165, 233, 0.12)" : "rgba(16, 185, 129, 0.12)",
                color: isDairy ? "#0284c7" : "#059669",
                borderRadius: "50%",
                display: "grid",
                placeItems: "center"
              }}
            >
              {isDairy ? <Milk size={22} /> : <Package size={22} />}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{productName}</h3>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 12,
                    background: isDairy ? "rgba(14, 165, 233, 0.12)" : "rgba(245, 158, 11, 0.12)",
                    color: isDairy ? "#0284c7" : "#d97706"
                  }}
                >
                  {product.category || (isDairy ? "Dairy" : "Animal Feed")}
                </span>
                <span className={`badge ${isNotSet ? "muted" : isOut ? "danger" : isLow ? "warning" : "success"}`} style={{ fontSize: 11 }}>
                  {statusText}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                Product SKU: <code>{productId}</code> | Unit of Measure: <b>{uom}</b>
              </div>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={17} />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="modal-body" style={{ maxHeight: "75vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Card 1: Pricing & Unit Economics */}
          <div className="client-detail-card">
            <div className="client-detail-card-title">
              <IndianRupee size={15} style={{ color: "var(--primary)" }} />
              Pricing & Commercial Margins
            </div>
            <div className="client-detail-row">
              <span className="client-detail-label">Selling Price (per {uom}):</span>
              <span className="client-detail-val" style={{ color: "var(--primary)", fontSize: "1.05rem", fontWeight: 800 }}>
                ₹{sellingPrice.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="client-detail-row">
              <span className="client-detail-label">Cost / Purchase Rate:</span>
              <span className="client-detail-val">
                {costPrice > 0 ? `₹${costPrice.toLocaleString("en-IN")}` : "—"}
              </span>
            </div>
            <div className="client-detail-row">
              <span className="client-detail-label">Unit Profit Margin:</span>
              <span className="client-detail-val" style={{ color: "#10b981", fontWeight: 700 }}>
                {costPrice > 0 ? `+₹${marginAmt.toLocaleString("en-IN")} (${marginPct}%)` : "—"}
              </span>
            </div>
            <div className="client-detail-row">
              <span className="client-detail-label">Applicable GST Rate:</span>
              <span className="client-detail-val"><b>{gstRate}%</b></span>
            </div>
          </div>

          {/* Card 2: Inventory & Warehousing */}
          <div className="client-detail-card">
            <div className="client-detail-card-title">
              <Warehouse size={15} style={{ color: "var(--primary)" }} />
              Warehouse Logistics & Stock Thresholds
            </div>
            <div className="client-detail-row">
              <span className="client-detail-label">Current Stock Balance:</span>
              <span
                className="client-detail-val"
                style={{
                  fontSize: "1.05rem",
                  fontWeight: 800,
                  color: isOut ? "var(--danger)" : isLow ? "var(--warning)" : "var(--text-main)"
                }}
              >
                {currentStock.toLocaleString("en-IN")} {uom}
              </span>
            </div>
            <div className="client-detail-row">
              <span className="client-detail-label">Reorder Level Threshold:</span>
              <span className="client-detail-val">
                {hasReorder ? `${reorderNum} ${uom}` : <span style={{ color: "var(--text-muted)" }}>Not configured</span>}
              </span>
            </div>
            <div className="client-detail-row">
              <span className="client-detail-label">Designated Bay / Location:</span>
              <span className="client-detail-val">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Warehouse size={13} style={{ color: "var(--accent)" }} /> {warehouse}
                </span>
              </span>
            </div>
          </div>

          {/* Card 3: Description & Additional Information */}
          {product.description && (
            <div className="client-detail-card">
              <div className="client-detail-card-title">
                <Info size={15} style={{ color: "var(--primary)" }} />
                Product Description & Notes
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-main)", lineHeight: 1.6, padding: "4px 0" }}>
                {product.description}
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
              onClick={() => onEdit(product)}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Pencil size={15} /> Edit Product
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
