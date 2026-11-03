import React from "react";
import { X, Calculator, Package, IndianRupee, Warehouse } from "lucide-react";
import { calculateProductStock } from "../services/stockService";

export default function ProductStockModal({
  isOpen,
  onClose,
  product,
  inventoryItem = null,
  onEditProduct
}) {
  if (!isOpen || !product) return null;

  const stockData = calculateProductStock(product, inventoryItem);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 600, width: "95vw", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
      >
        <div className="modal-head" style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "rgba(0, 91, 181, 0.12)",
              color: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <Package size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.15rem" }}>
                Current Inventory Stock
              </h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                Item: <b>{product.name}</b> • SKU: <code>{product.id || product.productId}</code>
              </p>
            </div>
          </div>

          <button className="icon-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          <div style={{
            background: "linear-gradient(135deg, rgba(0, 91, 181, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)",
            border: "1.5px solid rgba(0, 91, 181, 0.25)",
            borderRadius: 12,
            padding: "20px",
            textAlign: "center",
            marginBottom: 16
          }}>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "var(--primary)", letterSpacing: "0.5px" }}>
              CURRENT STORED INVENTORY STOCK
            </span>
            <div style={{ fontSize: "2.4rem", fontWeight: 900, color: stockData.statusColor, marginTop: 4 }}>
              {stockData.currentAvailableStock.toLocaleString("en-IN")}{" "}
              <span style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-muted)" }}>
                {product.unitOfMeasure || product.unit || "units"}
              </span>
            </div>
            <div style={{ marginTop: 8 }}>
              <span className={`badge ${stockData.statusBadge}`}>
                {stockData.status}
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="stat-card">
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Warehouse Location</span>
              <div style={{ fontSize: "1rem", fontWeight: 700, marginTop: 4 }}>
                {stockData.inventoryLocation}
              </div>
            </div>
            <div className="stat-card">
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Reorder Threshold</span>
              <div style={{ fontSize: "1rem", fontWeight: 700, marginTop: 4 }}>
                {stockData.minStock !== null ? `${stockData.minStock} units` : "Not set"}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-foot" style={{ padding: "14px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
          <button className="primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
