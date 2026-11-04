import React, { useState, useMemo, useEffect } from "react";
import {
  Boxes, Plus, Search, AlertTriangle, Eye,
  Warehouse, CheckCircle2, X, TrendingUp, TrendingDown, Pencil,
  ListFilter, History, Layers, Package
} from "lucide-react";
import InventoryModal from "./InventoryModal";
import InventoryDetailsModal from "./InventoryDetailsModal";
import ProductModal from "./ProductModal";
import ExportMenu from "./ExportMenu";
import MobileRecordCard from "./responsive/MobileRecordCard";
import ResponsiveKpiGrid from "./responsive/ResponsiveKpiGrid";
import ResponsiveDataTable from "./responsive/ResponsiveDataTable";
import { downloadCSV } from "../utils/exportUtils";
import { erpApi } from "../services/api";
import { formatDate } from "../utils/formatters";

export default function InventoryPage({ inventory = [], onSaveInventory, products = [], onSaveProducts, onRefresh }) {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("balances");
  const [directionFilter, setDirectionFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [viewingInventoryProduct, setViewingInventoryProduct] = useState(null);
  const [selectedProductForModal, setSelectedProductForModal] = useState(null);
  const [toast, setToast] = useState(null);
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

  useEffect(() => {
    if (onRefresh) onRefresh();
    fetchMovements();
  }, []);

  // Merge products & inventory: Inventory.currentStock is the SINGLE source of truth
  const combinedProducts = useMemo(() => {
    const invMap = new Map((inventory || []).map(i => [String(i.productId || i.id), i]));
    const list = [];
    const seenIds = new Set();

    // 1. All products from catalog with their inventory stock
    for (const p of products) {
      const pId = String(p.id || p.productId);
      seenIds.add(pId);
      const inv = invMap.get(pId);
      const stockVal = Number(inv?.currentStock ?? inv?.stock ?? p.currentStock ?? p.stock ?? 0);
      list.push({
        ...p,
        id: pId,
        productId: pId,
        name: p.name || inv?.productName || pId,
        category: p.category || inv?.category || "General",
        unit: p.unitOfMeasure || p.unit || inv?.unit || "Bags",
        unitOfMeasure: p.unitOfMeasure || p.unit || inv?.unit || "Bags",
        stock: stockVal,
        currentStock: stockVal,
        reorderLevel: p.reorderLevel ?? inv?.minStockAlert,
        warehouseLocation: inv?.warehouseLocation || inv?.location || p.warehouseLocation || "Main Warehouse",
      });
    }

    // 2. Any orphan inventory rows
    for (const inv of (inventory || [])) {
      const invId = String(inv.productId || inv.id);
      if (!seenIds.has(invId)) {
        const stockVal = Number(inv.currentStock ?? inv.stock ?? 0);
        list.push({
          id: invId,
          productId: invId,
          name: inv.productName || inv.product || invId,
          category: inv.category || "General",
          unit: inv.unit || "Bags",
          unitOfMeasure: inv.unit || "Bags",
          stock: stockVal,
          currentStock: stockVal,
          reorderLevel: inv.reorderLevel ?? inv.minStockAlert,
          warehouseLocation: inv.warehouseLocation || inv.location || "Main Warehouse",
        });
      }
    }
    return list;
  }, [products, inventory]);

  const unitSummaries = useMemo(() => {
    const balanceMap = {};
    combinedProducts.forEach(p => {
      const u = p.unitOfMeasure || p.unit || "Units";
      const balance = Number(p.currentStock || 0);
      balanceMap[u] = (balanceMap[u] || 0) + balance;
    });

    const balanceStr = Object.entries(balanceMap).map(([u, q]) => `${q.toLocaleString("en-IN")} ${u}`).join(", ") || "0 Units";
    return { balanceStr };
  }, [combinedProducts]);

  const lowCount = useMemo(() => combinedProducts.filter(p => {
    const hasReorder = p.reorderLevel !== null && p.reorderLevel !== undefined && p.reorderLevel !== "";
    if (!hasReorder) return false;
    const balance = Number(p.currentStock || 0);
    return balance <= Number(p.reorderLevel);
  }).length, [combinedProducts]);

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

  const filteredProducts = useMemo(() => {
    return combinedProducts.filter(p => {
      const balance = Number(p.currentStock || 0);
      const status = p.reorderLevel === null || p.reorderLevel === undefined || p.reorderLevel === ""
        ? "Not set"
        : (balance <= 0 ? "Out of Stock" : balance <= Number(p.reorderLevel) ? "Low Stock" : "In Stock");

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
  }, [combinedProducts, statusFilter, search]);

  const handleOpenAdd = () => {
    setSelectedProductForModal(null);
    setModalOpen(true);
  };

  const handleOpenMovement = (productId) => {
    setSelectedProductForModal(productId);
    setModalOpen(true);
  };

  const handleSaveNewProduct = (productData) => {
    const exists = products.some(p => (p.id || p.productId || "").toLowerCase() === (productData.id || productData.productId || "").toLowerCase());
    if (exists) {
      showToast(`⚠️ A product with ID ${productData.id || productData.productId} already exists.`);
      return;
    }
    const updated = [productData, ...products];
    if (onSaveProducts) onSaveProducts(updated);
    showToast(`✓ Added ${productData.name} to catalogue!`);
    setProductModalOpen(false);
    if (onRefresh) onRefresh();
  };

  const handleStockMovement = async (movementData) => {
    try {
      if (typeof erpApi.createStockMovement === "function") {
        await erpApi.createStockMovement(movementData);
      } else {
        await erpApi.adjustStock(
          movementData.productId,
          movementData.adjustment,
          movementData.warehouseLocation,
          movementData.reason
        );
      }
      showToast(`✓ Stock movement recorded successfully.`);
      await fetchMovements();
      if (onRefresh) await onRefresh();
      setModalOpen(false);
      setSelectedProductForModal(null);
    } catch (err) {
      const errMsg = err?.response?.data?.message || err.message || "Failed to record movement";
      showToast(`⚠️ Movement error: ${errMsg}`);
      throw err;
    }
  };

  const handleExportCSV = () => {
    if (viewMode === "movements") {
      const headers = ["Entry_ID", "Date", "Product_ID", "Product_Name", "Movement_Type", "Direction", "Quantity", "Stock_Before", "Stock_After", "Unit", "Location", "Reference", "Created_By"];
      const rows = filteredMovements.map(m => [
        m.entryId || `MOV-${m.id}`,
        m.movementDate,
        m.productId,
        m.productName || m.product?.name,
        m.movementType,
        m.direction,
        m.quantity,
        m.stockBefore ?? "",
        m.stockAfter ?? "",
        m.unit || m.product?.unitOfMeasure,
        m.warehouseLocation || "Main Warehouse",
        m.referenceId || "",
        m.createdBy || "System"
      ]);
      downloadCSV("Inventory_Movements_Laxmi_Enterprises", headers, rows);
    } else {
      const headers = ["Product_ID", "Product_Name", "Category", "Current_Stock", "Unit", "Reorder_Level", "Warehouse_Bay", "Status"];
      const rows = filteredProducts.map(p => {
        const uom = p.unitOfMeasure || p.unit || "Units";
        const balance = Number(p.currentStock || 0);
        return [
          p.id || p.productId,
          p.name,
          p.category,
          balance,
          uom,
          p.reorderLevel || "Not set",
          p.warehouseLocation || "Bay 1",
          balance <= 0 ? "Out of Stock" : (p.reorderLevel && balance <= Number(p.reorderLevel) ? "Low Stock" : "In Stock")
        ];
      });
      downloadCSV("Inventory_Balances_Laxmi_Enterprises", headers, rows);
    }
    showToast("✓ Exported Inventory Data to CSV!");
  };

  return (
    <div className="page">
      {toast && (
        <div className="toast-notification">
          <CheckCircle2 size={18} style={{ color: "var(--success)" }} />
          <span>{toast}</span>
        </div>
      )}

      {/* QUICK STATS CARDS */}
      <ResponsiveKpiGrid cols={4}>
        <div className="stat-card">
          <div className="stat-top">
            <span>Warehouse Total Balance</span>
            <div className="stat-icon" style={{ background: "rgba(0, 91, 181, 0.12)", color: "var(--primary)" }}>
              <Warehouse size={19} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: "16px", lineHeight: "1.3" }}>{unitSummaries.balanceStr}</div>
          <div className="trend positive"><span>Stored inventory balance</span></div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Low Stock Alerts</span>
            <div className="stat-icon" style={{ background: lowCount > 0 ? "var(--warning-light)" : "var(--primary-light)", color: lowCount > 0 ? "var(--warning)" : "var(--primary)" }}>
              <AlertTriangle size={19} />
            </div>
          </div>
          <div className="stat-value" style={{ color: lowCount > 0 ? "var(--warning)" : "var(--text-main)" }}>{lowCount} SKUs</div>
          <div className={`trend ${lowCount > 0 ? "negative" : "positive"}`}><span>{lowCount > 0 ? "Restock required" : "Thresholds safe"}</span></div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Registered Products</span>
            <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.12)", color: "#10b981" }}>
              <Package size={19} />
            </div>
          </div>
          <div className="stat-value">{combinedProducts.length} Items</div>
          <div className="trend positive"><span>Tracked in Inventory</span></div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Audit Log Entries</span>
            <div className="stat-icon" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
              <History size={19} />
            </div>
          </div>
          <div className="stat-value">{movements.length} Movements</div>
          <div className="trend neutral"><span>Immutable history log</span></div>
        </div>
      </ResponsiveKpiGrid>

      {/* Action Header & Mode Toggle */}
      <div className="page-actions" style={{ alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 6, background: "var(--border-light)", padding: 3, borderRadius: 8 }}>
          <button
            className={`filter-pill ${viewMode === "balances" ? "active" : ""}`}
            onClick={() => setViewMode("balances")}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Layers size={14} /> Product Balances ({products.length})
          </button>
          <button
            className={`filter-pill ${viewMode === "movements" ? "active" : ""}`}
            onClick={() => setViewMode("movements")}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <History size={14} /> Movement Ledger ({movements.length})
          </button>
        </div>

        {viewMode === "movements" ? (
          <div className="filter-pills-bar" style={{ overflowX: "auto", maxWidth: "100%" }}>
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
          <div className="filter-pills-bar" style={{ overflowX: "auto", maxWidth: "100%" }}>
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
            label="Export Inventory"
            category="Inventory"
            onExportCSV={handleExportCSV}
            showToast={showToast}
          />
          <button className="primary" onClick={handleOpenAdd} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Boxes size={16} /> Inward / Outward Movement
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card table-card">
        <div className="table-toolbar" style={{ flexWrap: "wrap", gap: 10 }}>
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
              ? `Showing ${filteredMovements.length} of ${movements.length} logged stock transactions`
              : `Showing ${filteredProducts.length} of ${combinedProducts.length} inventory products • Single Source of Truth`}
          </span>
        </div>

        {/* View Mode Switching: Movements vs Balances */}
        {viewMode === "movements" ? (
          filteredMovements.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><History size={26} /></div>
              <h4 style={{ fontSize: 16, color: "var(--text-main)", marginBottom: 6 }}>No Movements Found</h4>
              <p style={{ fontSize: 13, marginBottom: 16 }}>No inward or outward stock records match your query.</p>
              <button className="primary" onClick={handleOpenAdd}>
                <Plus size={15} /> Record New Movement
              </button>
            </div>
          ) : (
            <ResponsiveDataTable
              hasRecords={filteredMovements.length > 0}
              desktopView={
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Entry ID</th>
                        <th>Timestamp</th>
                        <th>Product Item</th>
                        <th>Type</th>
                        <th>Direction</th>
                        <th>Quantity</th>
                        <th>Stock Before</th>
                        <th>Stock After</th>
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
                                fontSize: "12px",
                                fontWeight: 700,
                                color: "var(--primary)",
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
                            <td style={{ color: "var(--text-muted)" }}>
                              {m.stockBefore !== undefined ? `${m.stockBefore} ${uom}` : "—"}
                            </td>
                            <td style={{ fontWeight: 700, color: "var(--text-main)" }}>
                              {m.stockAfter !== undefined ? `${m.stockAfter} ${uom}` : "—"}
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
                </div>
              }
              mobileView={
                <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "8px 4px" }}>
                  {filteredMovements.map(m => {
                    const isDirIn = (m.direction || "IN").toUpperCase() === "IN";
                    const uom = m.unit || m.product?.unitOfMeasure || "Bags";
                    const entryId = m.entryId || `MOV-${String(m.id).padStart(5, "0")}`;

                    return (
                      <MobileRecordCard
                        key={m.id}
                        idBadge={entryId}
                        title={m.productName || m.product?.name || m.productId}
                        subtitle={`Date: ${formatDate(m.movementDate)}`}
                        categoryBadge={m.movementType}
                        statusBadge={
                          <span className={`badge ${isDirIn ? "success" : "danger"}`} style={{ fontSize: 11 }}>
                            {isDirIn ? "+ IN" : "− OUT"}
                          </span>
                        }
                        primaryMetrics={[
                          { label: "Quantity", value: `${isDirIn ? "+" : "−"}${m.quantity} ${uom}`, color: isDirIn ? "var(--success)" : "var(--danger)" },
                          { label: "Stock After", value: `${m.stockAfter ?? "—"} ${uom}` },
                          { label: "Location", value: m.warehouseLocation || "Bay A-1" },
                        ]}
                        expandedDetails={
                          <div>
                            <div className="mobile-record-detail-row">
                              <span className="mobile-record-detail-label">Stock Before</span>
                              <span className="mobile-record-detail-val">{m.stockBefore ?? "—"} {uom}</span>
                            </div>
                            <div className="mobile-record-detail-row">
                              <span className="mobile-record-detail-label">Reference</span>
                              <span className="mobile-record-detail-val">{m.referenceId || "Direct"}</span>
                            </div>
                            <div className="mobile-record-detail-row">
                              <span className="mobile-record-detail-label">Created By</span>
                              <span className="mobile-record-detail-val">{m.createdBy || "System"}</span>
                            </div>
                          </div>
                        }
                      />
                    );
                  })}
                </div>
              }
            />
          )
        ) : (
          filteredProducts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Boxes size={26} /></div>
              <h4 style={{ fontSize: 16, color: "var(--text-main)", marginBottom: 6 }}>No Products Found</h4>
              <p style={{ fontSize: 13, marginBottom: 16 }}>No product stock entries match your search query or filter.</p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <button className="primary" onClick={handleOpenAdd}>
                  <Boxes size={15} /> Inward / Outward Movement
                </button>
              </div>
            </div>
          ) : (
            <ResponsiveDataTable
              hasRecords={filteredProducts.length > 0}
              desktopView={
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Product ID</th>
                        <th>Product Item</th>
                        <th>Current Stock</th>
                        <th>Warehouse Bay</th>
                        <th>Reorder Level</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map(p => {
                        const uom = p.unitOfMeasure || p.unit || "Units";
                        const balance = Number(p.currentStock || 0);
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
                            <td>
                              <b style={{
                                fontSize: "1rem",
                                color: isOut ? "var(--danger)" : isLow ? "var(--warning)" : "var(--text-main)"
                              }}>
                                {balance.toLocaleString("en-IN")} {uom}
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
                                  title={`View inventory profile of ${p.name}`}
                                  onClick={() => setViewingInventoryProduct(p)}
                                  style={{ color: "var(--accent)" }}
                                >
                                  <Eye size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              }
              mobileView={
                <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "8px 4px" }}>
                  {filteredProducts.map(p => {
                    const uom = p.unitOfMeasure || p.unit || "Units";
                    const balance = Number(p.currentStock || 0);
                    const hasReorder = p.reorderLevel !== null && p.reorderLevel !== undefined && p.reorderLevel !== "";
                    const reorderNum = hasReorder ? Number(p.reorderLevel) : null;
                    const isOut = hasReorder && balance <= 0;
                    const isLow = hasReorder && balance > 0 && balance <= reorderNum;
                    const isNotSet = !hasReorder;
                    const statusText = isNotSet ? "Not set" : isOut ? "Out of Stock" : isLow ? "Low Stock" : "In Stock";
                    const pId = p.id || p.productId;

                    return (
                      <MobileRecordCard
                        key={pId}
                        idBadge={pId}
                        title={p.name}
                        subtitle={p.warehouseLocation || "Godown Bay A-1"}
                        categoryBadge={p.category || "General"}
                        statusBadge={
                          <span className={`badge ${isNotSet ? "muted" : isOut ? "danger" : isLow ? "warning" : "success"}`} style={{ fontSize: 11 }}>
                            {statusText}
                          </span>
                        }
                        primaryMetrics={[
                          { label: "Current Stock", value: `${balance.toLocaleString("en-IN")} ${uom}`, color: isOut ? "var(--danger)" : isLow ? "var(--warning)" : "var(--primary)" },
                          { label: "Reorder Alert", value: hasReorder ? `${reorderNum} ${uom}` : "Not set" },
                          { label: "Location", value: p.warehouseLocation || "Bay A-1" },
                        ]}
                        actions={
                          <button
                            type="button"
                            className="primary"
                            onClick={() => handleOpenMovement(pId)}
                            style={{ display: "inline-flex", alignItems: "center", gap: 6, width: "100%" }}
                          >
                            <Pencil size={14} /> Inward / Outward Stock
                          </button>
                        }
                      />
                    );
                  })}
                </div>
              }
            />
          )
        )}
      </div>

      <InventoryDetailsModal
        isOpen={!!viewingInventoryProduct}
        onClose={() => setViewingInventoryProduct(null)}
        product={viewingInventoryProduct}
        movements={movements}
        onRecordMovement={(pid) => {
          setViewingInventoryProduct(null);
          handleOpenMovement(pid);
        }}
      />

      <InventoryModal
        key={selectedProductForModal || "new-inventory"}
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedProductForModal(null); }}
        onSave={handleStockMovement}
        products={combinedProducts}
        initialProductId={selectedProductForModal}
        showToast={showToast}
        onOpenAddProduct={() => setProductModalOpen(true)}
      />

      <ProductModal
        isOpen={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        onSave={handleSaveNewProduct}
        productToEdit={null}
        nextId={`PR-${String(products.length + 1).padStart(3, "0")}`}
        existingIds={products.map(p => p.id || p.productId)}
      />
    </div>
  );
}
