import React, { useState, useRef } from "react";
import {
  X, Warehouse, Barcode, Printer, Pencil, ChevronLeft, ChevronRight,
  IndianRupee, Layers, TrendingUp, Plus, Minus, Check, MapPin
} from "lucide-react";

export default function InventoryViewDrawer({
  isOpen,
  onClose,
  inventoryItem,
  inventoryList = [],
  onNavigateItem,
  products = [],
  onEdit,
  onQuickAdjust,
  showToast
}) {
  const [activeTab, setActiveTab] = useState("telemetry"); // "telemetry" | "logistics" | "barcode"
  const [adjustAmount, setAdjustAmount] = useState("");
  const [copiedSku, setCopiedSku] = useState(false);
  const printRef = useRef(null);

  if (!isOpen || !inventoryItem) return null;

  // Find linked product from products catalog
  const linkedProduct = (products || []).find(p => 
    (p.name && inventoryItem.product && p.name.toLowerCase() === inventoryItem.product.toLowerCase()) ||
    (p.id && inventoryItem.id && p.id.toLowerCase() === inventoryItem.id.toLowerCase())
  ) || {};

  const unitPrice = Number(linkedProduct.price) || 850; // Fallback estimated standard unit rate
  const minStock = Number(linkedProduct.minStock) || 25;
  const inUnits = Number(inventoryItem.in) || 0;
  const outUnits = Number(inventoryItem.out) || 0;
  const currentStock = Number(inventoryItem.stock) || 0;
  const totalThroughput = inUnits + outUnits;

  // Stock valuation
  const currentValuation = currentStock * unitPrice;
  const dispatchedValuation = outUnits * unitPrice;
  const turnoverRatio = inUnits > 0 ? Math.min(100, Math.round((outUnits / inUnits) * 100)) : 0;

  // Stock health status
  const isOutOfStock = inventoryItem.status === "Out of Stock" || currentStock <= 0;
  const isLowStock = inventoryItem.status === "Low Stock" || (currentStock > 0 && currentStock <= minStock);

  // Navigation across inventory items
  const currentIndex = inventoryList.findIndex(i => i.id === inventoryItem.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < inventoryList.length - 1;

  const handlePrev = () => {
    if (hasPrev && onNavigateItem) {
      onNavigateItem(inventoryList[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext && onNavigateItem) {
      onNavigateItem(inventoryList[currentIndex + 1]);
    }
  };

  const handleCopySku = () => {
    navigator.clipboard.writeText(inventoryItem.sku);
    setCopiedSku(true);
    setTimeout(() => setCopiedSku(false), 2000);
    if (showToast) showToast(`✓ Copied SKU ${inventoryItem.sku}`);
  };

  const handlePrintBarcode = () => {
    window.print();
  };

  const handleQuickIn = (qty) => {
    if (!onQuickAdjust) return;
    const amount = Number(qty);
    if (isNaN(amount) || amount <= 0) return;
    onQuickAdjust(inventoryItem, { in: inUnits + amount, stock: currentStock + amount });
    if (showToast) showToast(`✓ Added +${amount} inward units to ${inventoryItem.product}`);
  };

  const handleQuickOut = (qty) => {
    if (!onQuickAdjust) return;
    const amount = Number(qty);
    if (isNaN(amount) || amount <= 0) return;
    if (currentStock - amount < 0) {
      if (showToast) showToast(`⚠️ Cannot dispatch ${amount} units. Only ${currentStock} in stock.`);
      return;
    }
    const newStock = currentStock - amount;
    const newStatus = newStock === 0 ? "Out of Stock" : newStock <= minStock ? "Low Stock" : "In Stock";
    onQuickAdjust(inventoryItem, { out: outUnits + amount, stock: newStock, status: newStatus });
    if (showToast) showToast(`✓ Dispatched -${amount} outward units from ${inventoryItem.product}`);
  };

  // Generate deterministic barcode bar heights based on SKU string
  const renderBarcodeBars = (code = "") => {
    const bars = [];
    const fullCode = (code || "LE-INV-001").toUpperCase();
    for (let i = 0; i < fullCode.length; i++) {
      const charCode = fullCode.charCodeAt(i);
      const w1 = (charCode % 3) + 1.5;
      const w2 = ((charCode * 2) % 3) + 1;
      const w3 = ((charCode * 3) % 2) + 1.2;
      bars.push(<rect key={`b1-${i}`} x={i * 12} y={0} width={w1} height={46} fill="var(--text-main)" />);
      bars.push(<rect key={`b2-${i}`} x={i * 12 + 4} y={0} width={w2} height={46} fill="var(--text-main)" />);
      bars.push(<rect key={`b3-${i}`} x={i * 12 + 8} y={0} width={w3} height={46} fill="var(--text-main)" />);
    }
    return bars;
  };

  return (
    <div className="inventory-drawer-backdrop" onClick={onClose}>
      <div
        className="inventory-drawer-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP ACCENT STRIP */}
        <div style={{
          height: 5,
          background: isOutOfStock ? "linear-gradient(90deg, #ef4444, #dc2626)" :
                      isLowStock ? "linear-gradient(90deg, #f59e0b, #d97706)" :
                      "linear-gradient(90deg, #005bb5, #00b4d8)"
        }} />

        {/* DRAWER HEADER */}
        <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", background: "var(--table-head)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            {/* Sequential Navigator */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Item {currentIndex >= 0 ? currentIndex + 1 : 1} of {inventoryList.length || 1}
              </span>
              <div style={{ display: "flex", gap: 4, marginLeft: 6 }}>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={handlePrev}
                  disabled={!hasPrev}
                  title="Previous inventory item"
                  style={{ width: 26, height: 26, padding: 0, opacity: hasPrev ? 1 : 0.4, cursor: hasPrev ? "pointer" : "default" }}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={handleNext}
                  disabled={!hasNext}
                  title="Next inventory item"
                  style={{ width: 26, height: 26, padding: 0, opacity: hasNext ? 1 : 0.4, cursor: hasNext ? "pointer" : "default" }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Close only */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button className="icon-btn" onClick={onClose} aria-label="Close inspector drawer">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Product Title & Identity */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <code style={{
                  color: "var(--primary)",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  background: "rgba(0, 91, 181, 0.08)",
                  padding: "2px 6px",
                  borderRadius: 4
                }}>
                  {inventoryItem.id}
                </code>
                <span className={`badge ${isOutOfStock ? "danger" : isLowStock ? "warning" : "success"}`} style={{ fontSize: "0.72rem" }}>
                  <span
                    className={`badge-dot ${!isOutOfStock && !isLowStock ? "pulse" : ""}`}
                    style={{
                      background: isOutOfStock ? "#ef4444" : isLowStock ? "#f59e0b" : "#10b981",
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      display: "inline-block",
                      marginRight: 4
                    }}
                  />
                  {inventoryItem.status}
                </span>
              </div>
              <h3 style={{ margin: 0, fontSize: "1.25rem", color: "var(--text-main)", letterSpacing: "-0.01em" }}>
                {inventoryItem.product}
              </h3>
            </div>

            {/* SKU Badge */}
            <div
              onClick={handleCopySku}
              title="Click to copy SKU"
              style={{
                cursor: "pointer",
                background: "var(--card-bg)",
                border: "1px dashed var(--border)",
                borderRadius: 8,
                padding: "6px 10px",
                textAlign: "right"
              }}
            >
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                SKU / Barcode
              </div>
              <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.85rem", color: "var(--primary)", display: "flex", alignItems: "center", gap: 4 }}>
                <Barcode size={13} />
                <span>{inventoryItem.sku}</span>
                {copiedSku && <Check size={12} style={{ color: "#10b981" }} />}
              </div>
            </div>
          </div>
        </div>

        {/* TAB NAVIGATION STRIP */}
        <div style={{
          display: "flex",
          borderBottom: "1px solid var(--border)",
          background: "var(--card-bg)",
          padding: "0 12px"
        }}>
          <button
            type="button"
            className={`drawer-tab-btn ${activeTab === "telemetry" ? "active" : ""}`}
            onClick={() => setActiveTab("telemetry")}
          >
            <TrendingUp size={15} /> Stock Telemetry
          </button>
          <button
            type="button"
            className={`drawer-tab-btn ${activeTab === "logistics" ? "active" : ""}`}
            onClick={() => setActiveTab("logistics")}
          >
            <Warehouse size={15} /> Warehouse Bay
          </button>
          <button
            type="button"
            className={`drawer-tab-btn ${activeTab === "barcode" ? "active" : ""}`}
            onClick={() => setActiveTab("barcode")}
          >
            <Barcode size={15} /> SKU Barcode
          </button>
        </div>

        {/* DRAWER SCROLLABLE BODY */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }} ref={printRef}>
          
          {/* TAB 1: STOCK TELEMETRY & VALUATION */}
          {activeTab === "telemetry" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              
              {/* PRIMARY 3-COLUMN METRIC TILES */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                
                {/* 1. Inward */}
                <div style={{
                  background: "rgba(16, 185, 129, 0.06)",
                  border: "1px solid rgba(16, 185, 129, 0.25)",
                  borderRadius: 10,
                  padding: "14px 12px",
                  textAlign: "center"
                }}>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, display: "block" }}>
                    Inward Received
                  </span>
                  <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "#10b981", marginTop: 2 }}>
                    +{inUnits}
                  </div>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Total Sourced</span>
                </div>

                {/* 2. Outward */}
                <div style={{
                  background: "rgba(0, 91, 181, 0.06)",
                  border: "1px solid rgba(0, 91, 181, 0.25)",
                  borderRadius: 10,
                  padding: "14px 12px",
                  textAlign: "center"
                }}>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, display: "block" }}>
                    Outward Dispatched
                  </span>
                  <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--primary)", marginTop: 2 }}>
                    -{outUnits}
                  </div>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Fulfilled Orders</span>
                </div>

                {/* 3. Balance */}
                <div style={{
                  background: isOutOfStock ? "rgba(239, 68, 68, 0.08)" :
                              isLowStock ? "rgba(245, 158, 11, 0.08)" : "rgba(16, 185, 129, 0.08)",
                  border: isOutOfStock ? "1px solid rgba(239, 68, 68, 0.3)" :
                          isLowStock ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: 10,
                  padding: "14px 12px",
                  textAlign: "center"
                }}>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, display: "block" }}>
                    Active Balance
                  </span>
                  <div style={{
                    fontSize: "1.45rem",
                    fontWeight: 800,
                    color: isOutOfStock ? "var(--danger)" : isLowStock ? "var(--warning)" : "var(--success)",
                    marginTop: 2
                  }}>
                    {currentStock}
                  </div>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Units In Hand</span>
                </div>

              </div>

              {/* DYNAMIC PROGRESS CAPACITY GAUGE */}
              <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Layers size={15} style={{ color: "var(--primary)" }} />
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)" }}>
                      Inventory Fulfillment & Storage Ratio
                    </span>
                  </div>
                  <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--primary)" }}>
                    {turnoverRatio}% Dispatched
                  </span>
                </div>

                {/* Multi-tier bar */}
                <div className="stock-meter-track" style={{ height: 12, marginBottom: 8 }}>
                  <div
                    className="stock-meter-fill"
                    style={{
                      width: `${turnoverRatio}%`,
                      background: "linear-gradient(90deg, #005bb5, #00b4d8)"
                    }}
                    title={`Dispatched: ${outUnits} units (${turnoverRatio}%)`}
                  />
                  <div
                    className="stock-meter-fill"
                    style={{
                      width: `${100 - turnoverRatio}%`,
                      background: isOutOfStock ? "#ef4444" : isLowStock ? "#f59e0b" : "#10b981"
                    }}
                    title={`Current Stock: ${currentStock} units`}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#005bb5", display: "inline-block" }} />
                    Dispatched Outflow ({outUnits})
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: isOutOfStock ? "#ef4444" : isLowStock ? "#f59e0b" : "#10b981", display: "inline-block" }} />
                    Available In-Stock ({currentStock})
                  </span>
                </div>
              </div>

              {/* COMMERCIAL VALUATION CARD */}
              <div style={{
                background: "linear-gradient(135deg, rgba(0, 91, 181, 0.05) 0%, rgba(0, 180, 216, 0.05) 100%)",
                border: "1px solid rgba(0, 91, 181, 0.2)",
                borderRadius: 10,
                padding: 16
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(0, 91, 181, 0.12)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IndianRupee size={16} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: "0.92rem", color: "var(--text-main)" }}>
                      Live Commercial Inventory Valuation
                    </h4>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Based on Unit Catalog Price: ₹{unitPrice.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: "0.83rem" }}>
                  <div style={{ background: "var(--card-bg)", padding: 12, borderRadius: 8, border: "1px solid var(--border)" }}>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", display: "block" }}>
                      Active Holding Valuation:
                    </span>
                    <strong style={{ fontSize: "1.2rem", color: "#10b981", display: "block", marginTop: 2 }}>
                      ₹{currentValuation.toLocaleString("en-IN")}
                    </strong>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      {currentStock} units in warehouse
                    </span>
                  </div>

                  <div style={{ background: "var(--card-bg)", padding: 12, borderRadius: 8, border: "1px solid var(--border)" }}>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", display: "block" }}>
                      Realized Dispatched Value:
                    </span>
                    <strong style={{ fontSize: "1.2rem", color: "var(--primary)", display: "block", marginTop: 2 }}>
                      ₹{dispatchedValuation.toLocaleString("en-IN")}
                    </strong>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      {outUnits} units dispatched
                    </span>
                  </div>
                </div>
              </div>

              {/* QUICK INWARD / OUTWARD MOVEMENT MODIFIER */}
              {onQuickAdjust && (
                <div style={{ background: "var(--table-hover)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)" }}>
                      ⚡ Fast Inventory Quick-Adjust
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      1-Click stock adjustments
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="outline"
                      onClick={() => handleQuickIn(10)}
                      style={{ fontSize: "0.8rem", padding: "6px 12px", color: "#059669", borderColor: "rgba(16, 185, 129, 0.4)" }}
                    >
                      <Plus size={13} style={{ marginRight: 4 }} /> Inward +10
                    </button>
                    <button
                      type="button"
                      className="outline"
                      onClick={() => handleQuickIn(50)}
                      style={{ fontSize: "0.8rem", padding: "6px 12px", color: "#059669", borderColor: "rgba(16, 185, 129, 0.4)" }}
                    >
                      <Plus size={13} style={{ marginRight: 4 }} /> Inward +50
                    </button>
                    <button
                      type="button"
                      className="outline"
                      onClick={() => handleQuickOut(5)}
                      disabled={currentStock < 5}
                      style={{ fontSize: "0.8rem", padding: "6px 12px", color: "var(--danger)", borderColor: "rgba(239, 68, 68, 0.4)" }}
                    >
                      <Minus size={13} style={{ marginRight: 4 }} /> Outward -5
                    </button>
                    <button
                      type="button"
                      className="outline"
                      onClick={() => handleQuickOut(20)}
                      disabled={currentStock < 20}
                      style={{ fontSize: "0.8rem", padding: "6px 12px", color: "var(--danger)", borderColor: "rgba(239, 68, 68, 0.4)" }}
                    >
                      <Minus size={13} style={{ marginRight: 4 }} /> Outward -20
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: WAREHOUSE LOGISTICS & STORAGE BAY */}
          {activeTab === "logistics" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              
              {/* WAREHOUSE LOCATION HERO CARD */}
              <div style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: 18
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(0, 91, 181, 0.1)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Warehouse size={20} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: "1.05rem", color: "var(--text-main)" }}>
                      {inventoryItem.location || "Warehouse A - General Bay"}
                    </h4>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      Central Agribusiness Distribution Center • Pune Facility
                    </span>
                  </div>
                </div>

                {/* Storage Blueprint Map Visualization */}
                <div style={{
                  background: "var(--table-hover)",
                  border: "1px dashed var(--border)",
                  borderRadius: 8,
                  padding: 16,
                  marginTop: 10
                }}>
                  <div style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "var(--text-muted)", marginBottom: 10 }}>
                    Warehouse Bay Locator Grid:
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, textAlign: "center" }}>
                    {["Bay 01-04", "Bay 05-08", "Bay 09-12", "Bay 13-16"].map((bayName, idx) => {
                      const isTargetBay = (inventoryItem.location || "").toLowerCase().includes(bayName.slice(4, 6).toLowerCase()) ||
                                          (idx === 2 && (inventoryItem.location || "").includes("12")) ||
                                          (idx === 3 && (inventoryItem.location || "").includes("14")) ||
                                          (idx === 1 && (inventoryItem.location || "").includes("08")) ||
                                          (idx === 0 && (inventoryItem.location || "").includes("03"));
                      return (
                        <div
                          key={bayName}
                          style={{
                            padding: "12px 6px",
                            borderRadius: 6,
                            background: isTargetBay ? "rgba(0, 91, 181, 0.15)" : "var(--card-bg)",
                            border: isTargetBay ? "2px solid var(--primary)" : "1px solid var(--border)",
                            color: isTargetBay ? "var(--primary)" : "var(--text-muted)"
                          }}
                        >
                          <MapPin size={14} style={{ margin: "0 auto 4px", display: "block" }} />
                          <div style={{ fontSize: "0.75rem", fontWeight: 700 }}>{bayName}</div>
                          {isTargetBay && (
                            <span style={{ fontSize: "0.68rem", fontWeight: 800, color: "var(--primary)" }}>
                              ● Stored Here
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* STORAGE ENVIRONMENT & SAFETY THRESHOLDS */}
              <div style={{ background: "var(--table-hover)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 10 }}>
                  Safety Buffer & Environment Specs
                </span>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: "0.84rem" }}>
                  <div>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Minimum Safe Threshold:</span>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-main)", marginTop: 2 }}>
                      {minStock} Buffer Units
                    </div>
                  </div>

                  <div>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Storage Condition:</span>
                    <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text-main)", marginTop: 2 }}>
                      Ambient Dry / Pallet Racked
                    </div>
                  </div>

                  <div>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Supervising Team:</span>
                    <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text-main)", marginTop: 2 }}>
                      Rahul Deshmukh (Logistics)
                    </div>
                  </div>

                  <div>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Replenishment Trigger:</span>
                    <div style={{ fontWeight: 700, fontSize: "0.88rem", color: isLowStock ? "var(--danger)" : "var(--success)", marginTop: 2 }}>
                      {currentStock <= minStock ? "⚠️ Order Trigger Active" : "✓ Adequate Stock"}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: SKU BARCODE & DIGITAL ASSET LABEL */}
          {activeTab === "barcode" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              
              {/* PRINTABLE BARCODE STICKER CARD */}
              <div style={{
                background: "#ffffff",
                color: "#0f172a",
                border: "2px solid #0f172a",
                borderRadius: 10,
                padding: 20,
                textAlign: "center",
                boxShadow: "0 4px 12px rgba(0,0,0,0.06)"
              }}>
                <div style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 800, letterSpacing: "1px", color: "#64748b", marginBottom: 4 }}>
                  LAXMI ENTERPRISES • WAREHOUSE ASSET LABEL
                </div>

                <h4 style={{ margin: "2px 0 8px", fontSize: "1.1rem", color: "#0f172a" }}>
                  {inventoryItem.product}
                </h4>

                {/* SVG BARCODE */}
                <div style={{ margin: "14px auto", maxWidth: 320, background: "#f8fafc", padding: 10, borderRadius: 6, border: "1px solid #e2e8f0" }}>
                  <svg width="100%" height="46" viewBox="0 0 280 46" preserveAspectRatio="none">
                    {renderBarcodeBars(inventoryItem.sku)}
                  </svg>
                  <div style={{ fontFamily: "monospace", fontWeight: 800, fontSize: "0.95rem", letterSpacing: "3px", color: "#0f172a", marginTop: 4 }}>
                    *{inventoryItem.sku}*
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "#475569", borderTop: "1px dashed #cbd5e1", paddingTop: 8, marginTop: 10 }}>
                  <span>ID: <b>{inventoryItem.id}</b></span>
                  <span>Bay: <b>{inventoryItem.location || "WH-A"}</b></span>
                  <span>Balance: <b>{currentStock} Units</b></span>
                </div>
              </div>

              {/* ACTION BUTTONS FOR BARCODE */}
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button
                  type="button"
                  className="primary"
                  onClick={handlePrintBarcode}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", padding: "8px 16px" }}
                >
                  <Printer size={15} /> Print Barcode Label
                </button>
                <button
                  type="button"
                  className="outline"
                  onClick={handleCopySku}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", padding: "8px 16px" }}
                >
                  {copiedSku ? <Check size={15} style={{ color: "#10b981" }} /> : <Barcode size={15} />}
                  {copiedSku ? "Copied SKU" : "Copy SKU"}
                </button>
              </div>

              {/* TECHNICAL ASSET METADATA */}
              <div style={{ background: "var(--table-hover)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
                  Catalog Specifications
                </span>

                <div style={{ fontSize: "0.83rem", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div>Category: <b>{linkedProduct.category || "General Supplies"}</b></div>
                  <div>Inventory Tracking Code: <b>{inventoryItem.id}</b></div>
                  <div>Standard Packaging: <b>Industrial Units</b></div>
                  <div>GST Harmonized Code (HSN): <b>8481.80.90</b></div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* DRAWER FOOTER */}
        <div style={{
          padding: "14px 22px",
          borderTop: "1px solid var(--border)",
          background: "var(--table-head)",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center"
        }}>
          <div style={{ display: "flex", gap: 8 }}>
            {onEdit && (
              <button
                type="button"
                className="outline"
                onClick={() => { onClose(); onEdit(inventoryItem); }}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <Pencil size={14} /> Edit Stock
              </button>
            )}

            <button
              type="button"
              className="primary"
              onClick={handlePrintBarcode}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Printer size={14} /> Print Label
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}