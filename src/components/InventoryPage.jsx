import React, { useState, useMemo, useEffect } from "react";
import {
  Boxes, Plus, Search, AlertTriangle, Eye,
  ShoppingCart, Warehouse, Barcode, CheckCircle2, X, TrendingUp, TrendingDown, Pencil,
  ListFilter, History, Layers
} from "lucide-react";
import InventoryModal from "./InventoryModal";
import InventoryViewDrawer from "./InventoryViewDrawer";
import ExportMenu from "./ExportMenu";
import { downloadCSV } from "../utils/exportUtils";
import { erpApi } from "../services/api";
import { formatDate } from "../utils/formatters";

export default function InventoryPage({ inventory = [], onSaveInventory, products = [], onSaveProducts, onRefresh }) {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("movements"); // "movements" (default) or "balances"
  const [directionFilter, setDirectionFilter] = useState("All"); // All, IN, OUT
  const [statusFilter, setStatusFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [viewingInventory, setViewingInventory] = useState(null);
  const [selectedProductForModal, setSelectedProductForModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [movements, setMovements] = useState([]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchMovements = async () => {
    try {
      const res = await erpApi.getStockMovements();
      if (res?.data && Array.isArray(res.data)) {
        setMovements(res.data);
      }
    } catch (e) {
      console.warn("Failed to load stock movements:", e.message);
    }
  };

  // Automatically sync fresh stock telemetry on page mount
  useEffect(() => {
    if (onRefresh) onRefresh();
    fetchMovements();
  }, []);

  // Per-unit stock aggregations: Do not add quantities of different units into one mixed total
  const unitSummaries = useMemo(() => {
    const inMap = {};
    const outMap = {};
    const balanceMap = {};

    // Base from products
    products.forEach(p => {
      const u = p.unitOfMeasure || p.unit || "Units";
      const stockIn = Number(p.inwardStock ?? p.in ?? 0);
      const stockOut = Number(p.outwardStock ?? p.out ?? 0);
      const balance = Number(p.currentStock ?? p.stock ?? (stockIn - stockOut));

      inMap[u] = (inMap[u] || 0) + stockIn;
      outMap[u] = (outMap[u] || 0) + stockOut;
      balanceMap[u] = (balanceMap[u] || 0) + balance;
    });

    const inStr = Object.entries(inMap).map(([u, q]) => `+${q.toLocaleString("en-IN")} ${u}`).join(", ") || "+0 Units";
    const outStr = Object.entries(outMap).map(([u, q]) => `−${q.toLocaleString("en-IN")} ${u}`).join(", ") || "−0 Units";
    const balanceStr = Object.entries(balanceMap).map(([u, q]) => `${q.toLocaleString("en-IN")} ${u}`).join(", ") || "0 Units";

    return { inStr, outStr, balanceStr };
  }, [products]);

  // Low stock count: Only products where reorderLevel is set and balance <= reorderLevel
  const lowCount = useMemo(() => products.filter(p => {
    const hasReorder = p.reorderLevel !== null && p.reorderLevel !== undefined && p.reorderLevel !== "";
    if (!hasReorder) return false;
    const balance = Number(p.currentStock ?? p.stock ?? 0);
    return balance <= Number(p.reorderLevel);
  }).length, [products]);

  // Filtered movements for the ledger table
  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      const dir = (m.direction || "IN").toUpperCase();
      if (directionFilter !== "All" && dir !== directionFilter) {
        return false;
      }
      const q = search.toLowerCase().trim();
      if (!q) return true;
      const entryId = (m.entryId || `MOV-${m.id}` || "").toLowerCase();
      const pName = (m.productName || m.product?.name || "").toLowerCase();
      const pId = (m.productId || "").toLowerCase();
      const loc = (m.warehouseLocation || "").toLowerCase();
      const ref = (m.referenceId || m.referenceType || "").toLowerCase();
      return entryId.includes(q) || pName.includes(q) || pId.includes(q) || loc.includes(q) || ref.includes(q);
    });
  }, [movements, directionFilter, search]);

  // Filtered product balances for the balances view
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const status = p.stockStatus || (
        p.reorderLevel === null || p.reorderLevel === undefined
          ? "Not set"
          : (Number(p.currentStock ?? p.stock ?? 0) <= 0 ? "Out of Stock" : Number(p.currentStock ?? p.stock ?? 0) <= Number(p.reorderLevel) ? "Low Stock" : "In Stock")
      );
      if (statusFilter !== "All" && status !== statusFilter) {
        return false;
      }
      const q = search.toLowerCase().trim();
      if (!q) return true;
      const pName = (p.name || "").toLowerCase();
      const pId = (p.id || p.productId || "").toLowerCase();
      const loc = (p.warehouseLocation || "").toLowerCase();
      return pName.includes(q) || pId.includes(q) || loc.includes(q);
    });
  }, [products, statusFilter, search]);

  const handleOpenAdd = () => {
    setSelectedProductForModal(null);
    setModalOpen(true);
  };

  const handleOpenMovement = (prodId) => {
    setSelectedProductForModal(prodId);
    setModalOpen(true);
  };

  const handleStockMovement = async (movementData) => {
    const { productId, productName, adjustment, movementType, quantity, warehouseLocation, reason } = movementData;
    setLoading(true);
    try {
      await erpApi.adjustStock(productId, adjustment, warehouseLocation, reason);
      if (onRefresh) await onRefresh();
      await fetchMovements();
      showToast(`✓ Stock ${movementType === "inward" ? "increased" : "decreased"} by ${quantity} for ${productName}`);
      setModalOpen(false);
    } catch (err) {
      console.warn("Stock adjust failed:", err.message);
      showToast(`⚠️ Stock update failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (viewMode === "movements") {
      const headers = ["Entry_ID", "Movement_Date", "Product_ID", "Product_Name", "Movement_Type", "Direction", "Quantity", "Unit", "Warehouse_Bay", "Reference_ID", "Created_By"];
      const rows = filteredMovements.map(m => [
        `"${m.entryId || `MOV-${m.id}`}"`,
        `"${formatDate(m.movementDate)}"`,
        `"${m.productId}"`,
        `"${m.productName || m.product?.name || ''}"`,
        `"${m.movementType || ''}"`,
        `"${m.direction || 'IN'}"`,
        m.quantity,
        `"${m.unit || 'Bags'}"`,
        `"${m.warehouseLocation || ''}"`,
        `"${m.referenceId || ''}"`,
        `"${m.createdBy || 'System'}"`
      ]);
      downloadCSV(`laxmi_enterprises_stock_movements_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    } else {
      const headers = ["Product_ID", "Product_Name", "Unit", "Inward_Received", "Outward_Dispatched", "Current_Balance", "Warehouse_Bay", "Reorder_Level", "Status"];
      const rows = filteredProducts.map(p => {
        const uom = p.unitOfMeasure || p.unit || "Units";
        return [
          `"${p.id || p.productId}"`,
          `"${p.name}"`,
          `"${uom}"`,
          p.inwardStock ?? p.in ?? 0,
          p.outwardStock ?? p.out ?? 0,
          p.currentStock ?? p.stock ?? 0,
          `"${p.warehouseLocation || 'Godown Bay A-1'}"`,
          p.reorderLevel !== null && p.reorderLevel !== undefined ? p.reorderLevel : "Not set",
          `"${p.stockStatus || 'In Stock'}"`
        ];
      });
      downloadCSV(`laxmi_enterprises_stock_balances_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    }
    showToast("✓ Exported stock ledger report.");
  };

  return (
    <div className="page">
      {toast && (
        <div className="toast-notification">
          <CheckCircle2 size={18} style={{ color: "var(--success)" }} />
          <span>{toast}</span>
        </div>
      )}

      {/* Summary KPI Cards: Per-unit totals, never mixed units into one number */}
      <div className="module-quick-stats">
        <div className="client-stat-pill">
          <div className="client-stat-pill-icon"><Boxes size={20} /></div>
          <div>
            <div style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: 600 }}>Total Inward (Received)</div>
            <div style={{ fontSize: "17px", fontWeight: 800 }}>{unitSummaries.inStr}</div>
          </div>
        </div>

        <div className="client-stat-pill">
          <div className="client-stat-pill-icon" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
            <ShoppingCart size={20} />
          </div>
          <div>
            <div style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: 600 }}>Total Outward (Dispatched)</div>
            <div style={{ fontSize: "17px", fontWeight: 800 }}>{unitSummaries.outStr}</div>
          </div>
        </div>

        <div className="client-stat-pill">
          <div className="client-stat-pill-icon" style={{ background: "var(--success-light)", color: "var(--success)" }}>
            <Warehouse size={20} />
          </div>
          <div>
            <div style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: 600 }}>Active Storage Balance</div>
            <div style={{ fontSize: "17px", fontWeight: 800, color: "var(--success)" }}>{unitSummaries.balanceStr}</div>
          </div>
        </div>

        <div className="client-stat-pill">
          <div className="client-stat-pill-icon" style={{ background: lowCount > 0 ? "var(--warning-light)" : "var(--primary-light)", color: lowCount > 0 ? "var(--warning)" : "var(--primary)" }}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <div style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: 600 }}>Low / Critical Stock</div>
            <div style={{ fontSize: "21px", fontWeight: 800, color: lowCount > 0 ? "var(--warning)" : "var(--text-main)" }}>{lowCount} SKUs</div>
          </div>
        </div>
      </div>

      {/* Action Header & Mode Toggle */}
      <div className="page-actions" style={{ alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 6, background: "var(--border-light)", padding: 3, borderRadius: 8 }}>
          <button
            className={`filter-pill ${viewMode === "movements" ? "active" : ""}`}
            onClick={() => setViewMode("movements")}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <History size={14} /> Movement Ledger ({movements.length})
          </button>
          <button
            className={`filter-pill ${viewMode === "balances" ? "active" : ""}`}
            onClick={() => setViewMode("balances")}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Layers size={14} /> Product Balances ({products.length})
          </button>
        </div>

        {viewMode === "movements" ? (
          <div className="filter-pills-bar">
            {["All", "IN", "OUT"].map(dir => (
              <button
                key={dir}
                className={`filter-pill ${directionFilter === dir ? "active" : ""}`}
                onClick={() => setDirectionFilter(dir)}
              >
                {dir === "All" ? "All Directions" : dir === "IN" ? "Inward (+)" : "Outward (−)"}
              </button>
            ))}
          </div>
        ) : (
          <div className="filter-pills-bar">
            {["All", "In Stock", "Low Stock", "Out of Stock", "Not set"].map(st => (
              <button
                key={st}
                className={`filter-pill ${statusFilter === st ? "active" : ""}`}
                onClick={() => setStatusFilter(st)}
              >
                {st}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginLeft: "auto" }}>
          <ExportMenu
            label="Export Ledger"
            category="Inventory"
            onExportCSV={handleExportCSV}
            showToast={showToast}
          />
          <button className="primary" onClick={handleOpenAdd}>
            <Plus size={16} /> Record Movement
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card table-card">
        <div className="table-toolbar">
          <div className="local-search">
            <Search size={16} />
            <input
              placeholder={viewMode === "movements" ? "Search by Entry ID, product, location, ref..." : "Search by product name, SKU, location..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{ border: "none", background: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2 }}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>
            {viewMode === "movements" 
              ? `Showing ${filteredMovements.length} of ${movements.length} movement ledger entries`
              : `Showing ${filteredProducts.length} of ${products.length} products`
            }
          </span>
        </div>

        <div className="table-wrap">
          {viewMode === "movements" ? (
            filteredMovements.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><Boxes size={26} /></div>
                <h4 style={{ fontSize: 16, color: "var(--text-main)", marginBottom: 6 }}>No Movements Found</h4>
                <p style={{ fontSize: 13, marginBottom: 16 }}>No stock movements match your search query or filter.</p>
                <button className="primary" onClick={handleOpenAdd}><Plus size={15} /> Record Movement</button>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Entry ID</th>
                    <th>Date</th>
                    <th>Product Item</th>
                    <th>Movement Type</th>
                    <th>Direction</th>
                    <th>Quantity</th>
                    <th>Warehouse Bay</th>
                    <th>Reference</th>
                    <th>Created By</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.map(m => {
                    const isDirIn = (m.direction || "IN").toUpperCase() === "IN";
                    const uom = m.unit || m.product?.unitOfMeasure || "Bags";
                    return (
                      <tr key={m.id}>
                        <td>
                          <code style={{
                            color: "var(--primary)",
                            fontWeight: 700,
                            background: "rgba(0, 91, 181, 0.08)",
                            padding: "3px 7px",
                            borderRadius: 4
                          }}>
                            {m.entryId || `MOV-${String(m.id).padStart(5, "0")}`}
                          </code>
                        </td>
                        <td>{formatDate(m.movementDate)}</td>
                        <td>
                          <b>{m.productName || m.product?.name || m.productId}</b>
                          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            <code>{m.productId}</code>
                          </div>
                        </td>
                        <td>
                          <span className="badge muted" style={{ fontSize: "11px" }}>
                            {m.movementType}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${isDirIn ? "success" : "danger"}`}>
                            {isDirIn ? "+ IN" : "− OUT"}
                          </span>
                        </td>
                        <td style={{ fontWeight: 800, color: isDirIn ? "var(--success)" : "var(--danger)" }}>
                          {isDirIn ? "+" : "−"}{m.quantity} {uom}
                        </td>
                        <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Warehouse size={12} style={{ color: "var(--accent)" }} /> {m.warehouseLocation || "Godown Bay A-1"}
                          </span>
                        </td>
                        <td>
                          <code style={{ fontSize: "11px" }}>{m.referenceId || m.referenceType || "—"}</code>
                        </td>
                        <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                          {m.createdBy || "System"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : (
            filteredProducts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><Boxes size={26} /></div>
                <h4 style={{ fontSize: 16, color: "var(--text-main)", marginBottom: 6 }}>No Products Found</h4>
                <p style={{ fontSize: 13, marginBottom: 16 }}>No product stock entries match your search query or filter.</p>
                <button className="primary" onClick={handleOpenAdd}><Plus size={15} /> Record Movement</button>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Product ID</th>
                    <th>Product Item</th>
                    <th>Inward (+)</th>
                    <th>Outward (−)</th>
                    <th>Balance Units</th>
                    <th>Warehouse Bay</th>
                    <th>Reorder Level</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(p => {
                    const uom = p.unitOfMeasure || p.unit || "Units";
                    const stockIn = Number(p.inwardStock ?? p.in ?? 0);
                    const stockOut = Number(p.outwardStock ?? p.out ?? 0);
                    const balance = Number(p.currentStock ?? p.stock ?? (stockIn - stockOut));
                    const hasReorder = p.reorderLevel !== null && p.reorderLevel !== undefined && p.reorderLevel !== "";
                    const reorderNum = hasReorder ? Number(p.reorderLevel) : null;
                    const isOut = hasReorder && balance <= 0;
                    const isLow = hasReorder && balance > 0 && balance <= reorderNum;
                    const isNotSet = !hasReorder;
                    const statusText = isNotSet ? "Not set" : isOut ? "Out of Stock" : isLow ? "Low Stock" : "In Stock";

                    return (
                      <tr key={p.id || p.productId}>
                        <td><code>{p.id || p.productId}</code></td>
                        <td><b>{p.name}</b></td>
                        <td style={{ color: "var(--success)", fontWeight: 700 }}>+{stockIn} {uom}</td>
                        <td style={{ color: "var(--text-muted)", fontWeight: 600 }}>−{stockOut} {uom}</td>
                        <td>
                          <b style={{ color: isOut ? "var(--danger)" : isLow ? "var(--warning)" : "var(--text-main)" }}>
                            {balance} {uom}
                          </b>
                        </td>
                        <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Warehouse size={12} style={{ color: "var(--accent)" }} /> {p.warehouseLocation || (p.category === "Dairy" ? "Cold Silo Tank 1" : "Godown Bay A-1")}
                          </span>
                        </td>
                        <td>{hasReorder ? `${reorderNum} ${uom}` : <span style={{ color: "var(--text-muted)" }}>Not set</span>}</td>
                        <td>
                          <span className={`badge ${isNotSet ? "muted" : isOut ? "danger" : isLow ? "warning" : "success"}`}>
                            <span
                              className={`badge-dot ${!isNotSet && !isOut && !isLow ? "pulse" : ""}`}
                              style={{
                                background: isNotSet ? "#94a3b8" : isOut ? "#ef4444" : isLow ? "#f59e0b" : "#10b981",
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                display: "inline-block",
                                marginRight: 6
                              }}
                            />
                            {statusText}
                          </span>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              title="Record Stock Movement"
                              onClick={() => handleOpenMovement(p.id || p.productId)}
                              style={{ color: "var(--primary)" }}
                            >
                              <Pencil size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>

      <InventoryModal
        key={selectedProductForModal || "new-inventory"}
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedProductForModal(null); }}
        onSave={handleStockMovement}
        products={products}
        initialProductId={selectedProductForModal}
        showToast={showToast}
      />

    </div>
  );
}
