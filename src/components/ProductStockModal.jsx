import React, { useState } from "react";
import {
  X, Calculator, ArrowRight, ShieldCheck, AlertTriangle, CheckCircle2,
  Package, IndianRupee, Layers, TrendingUp, TrendingDown, RefreshCw,
  Clock, MapPin, Tag, Sliders, Info
} from "lucide-react";
import { calculateProductStock, simulateStock } from "../services/stockService";

export default function ProductStockModal({
  isOpen,
  onClose,
  product,
  inventoryItem = null,
  onEditProduct
}) {
  const [simInward, setSimInward] = useState(0);
  const [simOutward, setSimOutward] = useState(0);
  const [showSimulator, setShowSimulator] = useState(false);

  if (!isOpen || !product) return null;

  const stockData = calculateProductStock(product, inventoryItem);

  const simulation = simulateStock(
    stockData.openingStock,
    stockData.inwardStock,
    stockData.outwardStock,
    stockData.reservedStock,
    simInward,
    simOutward
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 840, width: "95vw", maxHeight: "92vh", display: "flex", flexDirection: "column" }}
      >
        {/* MODAL HEAD */}
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
              <Calculator size={22} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontSize: "1.15rem" }}>
                  Stock Calculation & Inventory Audit
                </h3>
                <span className="badge muted" style={{ fontSize: "0.75rem" }}>
                  <code>{product.id}</code>
                </span>
                <span className={`badge ${stockData.statusBadge}`} style={{ fontSize: "0.75rem" }}>
                  <span
                    className={`badge-dot ${stockData.statusBadge === "success" ? "pulse" : ""}`}
                    style={{
                      background: stockData.statusColor,
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      display: "inline-block",
                      marginRight: 4
                    }}
                  />
                  {stockData.status}
                </span>
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                Item: <b style={{ color: "var(--text-main)" }}>{product.name}</b> • Category: <b>{product.category}</b>
                {stockData.isLinkedToInventory && ` • Warehouse: ${stockData.inventoryLocation}`}
              </p>
            </div>
          </div>

          <button className="icon-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="modal-body" style={{ flex: 1, overflowY: "auto", padding: "22px 24px" }}>

          {/* FORMULA HIGHLIGHT BANNER */}
          <div style={{
            background: "linear-gradient(135deg, rgba(0, 91, 181, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)",
            border: "1.5px solid rgba(0, 91, 181, 0.25)",
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 20
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div>
                <span style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "var(--primary)", letterSpacing: "0.5px" }}>
                  Specific Standard Stock Calculation Formula
                </span>
                <div style={{
                  fontFamily: "monospace",
                  fontSize: "1.05rem",
                  fontWeight: 800,
                  color: "var(--text-main)",
                  marginTop: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap"
                }}>
                  <span style={{ color: "#0284c7" }}>Opening Stock</span>
                  <span>+</span>
                  <span style={{ color: "#059669" }}>Inward Received</span>
                  <span>−</span>
                  <span style={{ color: "#d97706" }}>Outward Dispatched</span>
                  <span>−</span>
                  <span style={{ color: "#dc2626" }}>Reserved</span>
                  <span>=</span>
                  <span style={{
                    color: "var(--primary)",
                    background: "var(--card-bg)",
                    padding: "3px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                  }}>
                    Current Available Stock
                  </span>
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                  CURRENT AVAILABLE BALANCE
                </span>
                <div style={{ fontSize: "1.8rem", fontWeight: 900, color: stockData.statusColor, lineHeight: 1.1 }}>
                  {stockData.currentAvailableStock.toLocaleString("en-IN")} <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>units</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4 VARIABLE PILL METRICS */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 12,
            marginBottom: 22
          }}>
            {/* Opening Stock */}
            <div style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 14,
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Opening Stock
                </span>
                <span style={{ fontSize: "0.75rem", background: "rgba(2, 132, 199, 0.1)", color: "#0284c7", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
                  Base
                </span>
              </div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, marginTop: 4, color: "#0284c7" }}>
                {stockData.openingStock} <small style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-muted)" }}>units</small>
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>
                Initial baseline balance
              </div>
            </div>

            {/* Inward Procured */}
            <div style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 14,
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Total Inward
                </span>
                <span style={{ fontSize: "0.75rem", background: "rgba(16, 185, 129, 0.1)", color: "#059669", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
                  + Received
                </span>
              </div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, marginTop: 4, color: "#059669" }}>
                +{stockData.inwardStock} <small style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-muted)" }}>units</small>
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>
                Purchases & warehouse inward
              </div>
            </div>

            {/* Outward Dispatched */}
            <div style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 14,
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Total Outward
                </span>
                <span style={{ fontSize: "0.75rem", background: "rgba(217, 119, 6, 0.1)", color: "#d97706", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
                  − Dispatched
                </span>
              </div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, marginTop: 4, color: "#d97706" }}>
                −{stockData.outwardStock} <small style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-muted)" }}>units</small>
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>
                Billed sales & client fulfillments
              </div>
            </div>

            {/* Reserved / Hold */}
            <div style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 14,
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Reserved / Hold
                </span>
                <span style={{ fontSize: "0.75rem", background: "rgba(239, 68, 68, 0.1)", color: "#dc2626", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
                  − Quarantine
                </span>
              </div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, marginTop: 4, color: "#dc2626" }}>
                −{stockData.reservedStock} <small style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-muted)" }}>units</small>
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>
                Pending QA / allocated orders
              </div>
            </div>
          </div>

          {/* STEP-BY-STEP CALCULATION AUDIT TABLE */}
          <div style={{
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            overflow: "hidden",
            marginBottom: 20
          }}>
            <div style={{
              padding: "12px 18px",
              background: "var(--table-hover)",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldCheck size={16} style={{ color: "var(--primary)" }} />
                <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                  Audit Breakdown & Mathematical Ledger
                </span>
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Equation: <code>{stockData.formulaText}</code>
              </span>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ background: "rgba(0,0,0,0.02)", textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "8px 14px", width: 60 }}>Step</th>
                  <th style={{ padding: "8px 14px" }}>Stock Factor / Operation</th>
                  <th style={{ padding: "8px 14px" }}>Operational Rationale</th>
                  <th style={{ padding: "8px 14px", textAlign: "right" }}>Unit Quantity</th>
                </tr>
              </thead>
              <tbody>
                {stockData.auditSteps.map((step, idx) => {
                  const isFinal = step.step === 6;
                  const isGross = step.step === 3;
                  return (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        background: isFinal ? "rgba(0, 91, 181, 0.05)" : isGross ? "rgba(0,0,0,0.015)" : "transparent",
                        fontWeight: isFinal || isGross ? 700 : 400
                      }}
                    >
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{
                          display: "inline-block",
                          width: 22,
                          height: 22,
                          lineHeight: "22px",
                          textAlign: "center",
                          borderRadius: 4,
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          background: isFinal ? "var(--primary)" : "var(--border)",
                          color: isFinal ? "#fff" : "var(--text-muted)"
                        }}>
                          {step.step}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{
                          display: "inline-block",
                          width: 20,
                          fontWeight: 800,
                          color: step.sign === "+" ? "#059669" : step.sign === "-" ? "#dc2626" : "var(--primary)"
                        }}>
                          {step.sign !== "base" ? step.sign : "•"}
                        </span>
                        <span style={{ color: isFinal ? "var(--primary)" : "inherit" }}>
                          {step.label}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                        {step.description}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "monospace", fontSize: isFinal ? "1rem" : "0.9rem" }}>
                        <b style={{
                          color: isFinal ? stockData.statusColor :
                                 step.sign === "+" ? "#059669" :
                                 step.sign === "-" ? "#dc2626" : "inherit"
                        }}>
                          {step.sign === "+" ? "+" : step.sign === "-" ? "−" : ""}
                          {step.quantity.toLocaleString("en-IN")} units
                        </b>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* TWO-COLUMN LOWER SECTION: SAFETY BUFFER & COMMERCIAL VALUATION */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            
            {/* SAFETY REORDER BUFFER ANALYSIS */}
            <div style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 16
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <AlertTriangle size={16} style={{ color: stockData.bufferMargin >= 0 ? "var(--primary)" : "var(--danger)" }} />
                <h4 style={{ margin: 0, fontSize: "0.9rem" }}>Safety Threshold & Buffer Analysis</h4>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: 6 }}>
                <span style={{ color: "var(--text-muted)" }}>Safety Threshold Limit (Min Stock):</span>
                <b>{stockData.minStock !== null ? `${stockData.minStock} units` : "Not set"}</b>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: 10 }}>
                <span style={{ color: "var(--text-muted)" }}>Free Buffer Margin:</span>
                <b style={{ color: stockData.bufferMargin >= 0 ? "var(--success)" : "var(--danger)" }}>
                  {stockData.minStock === null ? "— (Not set)" : stockData.bufferMargin >= 0 ? `+${stockData.bufferMargin} units above limit` : `${stockData.bufferMargin} units below limit!`}
                </b>
              </div>

              {/* Progress visual */}
              <div style={{ width: "100%", height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  width: `${Math.min(100, Math.max(5, (stockData.currentAvailableStock / Math.max(1, stockData.minStock * 2)) * 100))}%`,
                  height: "100%",
                  background: stockData.statusColor,
                  borderRadius: 4
                }} />
              </div>

              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 8 }}>
                {stockData.bufferMargin >= 0 ? (
                  <span>✓ Stock is safe. Reorder is not immediately triggered.</span>
                ) : (
                  <span style={{ color: "var(--danger)", fontWeight: 600 }}>
                    ⚠️ Urgent: Current stock has fallen below the safety threshold of {stockData.minStock} units. Issue procurement order.
                  </span>
                )}
              </div>
            </div>

            {/* COMMERCIAL VALUATION */}
            <div style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 16
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <IndianRupee size={16} style={{ color: "var(--primary)" }} />
                <h4 style={{ margin: 0, fontSize: "0.9rem" }}>Inventory Asset Valuation (at Cost)</h4>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: 6 }}>
                <span style={{ color: "var(--text-muted)" }}>Unit Cost Price:</span>
                <b>₹{Number(stockData.costPrice || 0).toLocaleString("en-IN")} / unit</b>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: 6 }}>
                <span style={{ color: "var(--text-muted)" }}>Calculation Formula:</span>
                <code>{stockData.currentAvailableStock} units × ₹{Number(stockData.costPrice || 0).toLocaleString("en-IN")}</code>
              </div>

              <div style={{
                marginTop: 10,
                padding: "8px 12px",
                borderRadius: 8,
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.2)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#059669" }}>Total Valuation (at Cost):</span>
                <span style={{ fontSize: "1.2rem", fontWeight: 800, color: "#059669" }}>
                  ₹{stockData.valuation.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

          </div>

          {/* INTERACTIVE STOCK MOVEMENT SIMULATOR TOGGLE */}
          <div style={{
            background: "var(--table-hover)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "14px 18px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setShowSimulator(!showSimulator)}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Sliders size={16} style={{ color: "var(--primary)" }} />
                <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                  Stock Movement Simulator & Forecasting Tool
                </span>
                <span className="badge muted" style={{ fontSize: "0.7rem" }}>
                  What-if Analysis
                </span>
              </div>
              <button
                type="button"
                className="outline"
                style={{ padding: "4px 10px", fontSize: "0.78rem" }}
              >
                {showSimulator ? "Hide Simulator" : "Try What-If Simulator"}
              </button>
            </div>

            {showSimulator && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                <p style={{ margin: "0 0 12px 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Simulate receiving new supplier deliveries or dispatching upcoming customer orders to project future available stock.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, alignItems: "center" }}>
                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Simulate Inward (+Units)</label>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      style={{ marginTop: 4 }}
                      value={simInward}
                      onChange={(e) => setSimInward(Number(e.target.value) || 0)}
                      placeholder="e.g. 50"
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Simulate Outward (−Units)</label>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      style={{ marginTop: 4 }}
                      value={simOutward}
                      onChange={(e) => setSimOutward(Number(e.target.value) || 0)}
                      placeholder="e.g. 20"
                    />
                  </div>

                  <div style={{
                    background: "var(--card-bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    textAlign: "center"
                  }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>
                      Projected Available
                    </span>
                    <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--primary)" }}>
                      {simulation.newAvailable} <small style={{ fontSize: "0.75rem" }}>units</small>
                    </div>
                    <span style={{ fontSize: "0.72rem", color: simulation.diff >= 0 ? "var(--success)" : "var(--danger)" }}>
                      ({simulation.diff >= 0 ? `+${simulation.diff}` : simulation.diff} net change)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* MODAL FOOTER */}
        <div className="modal-footer" style={{ padding: "14px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button type="button" className="outline" onClick={onClose}>
            Close
          </button>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {onEditProduct && (
              <button
                type="button"
                className="primary"
                onClick={() => {
                  onClose();
                  onEditProduct(product);
                }}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <Sliders size={15} />
                Edit Product & Stock Parameters
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
