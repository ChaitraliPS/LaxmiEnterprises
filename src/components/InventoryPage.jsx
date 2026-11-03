import React, { useState, useMemo, useEffect } from "react";
import {
  Boxes, Plus, Search, AlertTriangle, Eye,
  ShoppingCart, Warehouse, Barcode, CheckCircle2, X, TrendingUp, TrendingDown, Pencil,
  ListFilter, History, Layers
} from "lucide-react";
import InventoryModal from "./InventoryModal";
import ProductModal from "./ProductModal";
import InventoryViewDrawer from "./InventoryViewDrawer";
import ExportMenu from "./ExportMenu";
import MobileRecordCard from "./responsive/MobileRecordCard";
import ResponsiveKpiGrid from "./responsive/ResponsiveKpiGrid";
import ResponsiveDataTable from "./responsive/ResponsiveDataTable";
import { downloadCSV } from "../utils/exportUtils";
import { erpApi } from "../services/api";
import { formatDate } from "../utils/formatters";
import { calculateCurrentStock } from "../constants/erpConstants";

export default function InventoryPage({ inventory = [], onSaveInventory, products = [], onSaveProducts, onRefresh }) {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("balances");
  const [directionFilter, setDirectionFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [viewingInventory, setViewingInventory] = useState(null);
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

  // Ensure products and inventory records are merged so every product is visible in inventory
  const combinedProducts = useMemo(() => {
    const list = [...products];
    const existingIds = new Set(products.map(p => String(p.id || p.productId)));
    for (const inv of (inventory || [])) {
      const invId = String(inv.productId || inv.id);
      if (!existingIds.has(invId)) {
        list.push({
          id: invId,
          productId: invId,
          name: inv.productName || inv.product || invId,
          category: inv.category || "General",
          unit: inv.unit || "Bags",
          unitOfMeasure: inv.unit || "Bags",
          stock: inv.stock ?? inv.currentStock ?? 0,
          currentStock: inv.currentStock ?? inv.stock ?? 0,
          inwardStock: inv.inwardStock ?? inv.in ?? 0,
          outwardStock: inv.outwardStock ?? inv.out ?? 0,
          reorderLevel: inv.reorderLevel ?? inv.minStockAlert,
          warehouseLocation: inv.warehouseLocation || inv.location || "Main Warehouse",
          stockStatus: inv.status || "In Stock",
        });
      }
    }
    return list;
  }, [products, inventory]);

  const unitSummaries = useMemo(() => {
    const inMap = {};
    const outMap = {};
    const balanceMap = {};

    combinedProducts.forEach(p => {
      const u = p.unitOfMeasure || p.unit || "Units";
      const openStock = Number(p.openingStock || 0);
      const stockIn = Number(p.inwardStock ?? p.in ?? 0);
      const stockOut = Number(p.outwardStock ?? p.out ?? 0);
      const balance = calculateCurrentStock({ opening: openStock, inward: stockIn, outward: stockOut });

      inMap[u] = (inMap[u] || 0) + stockIn;
      outMap[u] = (outMap[u] || 0) + stockOut;
      balanceMap[u] = (balanceMap[u] || 0) + balance;
    });

    const inStr = Object.entries(inMap).map(([u, q]) => `+${q.toLocaleString("en-IN")} ${u}`).join(", ") || "+0 Units";
    const outStr = Object.entries(outMap).map(([u, q]) => `−${q.toLocaleString("en-IN")} ${u}`).join(", ") || "−0 Units";
    const balanceStr = Object.entries(balanceMap).map(([u, q]) => `${q.toLocaleString("en-IN")} ${u}`).join(", ") || "0 Units";

    return { inStr, outStr, balanceStr };
  }, [combinedProducts]);

  const lowCount = useMemo(() => combinedProducts.filter(p => {
    const hasReorder = p.reorderLevel !== null && p.reorderLevel !== undefined && p.reorderLevel !== "";
    if (!hasReorder) return false;
    const balance = calculateCurrentStock({
      opening: p.openingStock,
      inward: p.inwardStock ?? p.in,
      outward: p.outwardStock ?? p.out,
    });
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
      const balance = calculateCurrentStock({
        opening: p.openingStock,
        inward: p.inwardStock ?? p.in,
        outward: p.outwardStock ?? p.out,
      });
      const status = p.stockStatus || (
        p.reorderLevel === null || p.reorderLevel === undefined
          ? "Not set"
          : (balance <= 0 ? "Out of Stock" : balance <= Number(p.reorderLevel) ? "Low Stock" : "In Stock")
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
    showToast(`✓ Added ${productData.name} to catalogue & inventory!`);
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
      showToast(`✓ Stock movement recorded & synchronized.`);
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
      const headers = ["Entry_ID", "Date", "Product_ID", "Product_Name", "Movement_Type", "Direction", "Quantity", "Unit", "Location", "Reference", "Created_By"];
      const rows = filteredMovements.map(m => [
        m.entryId || `MOV-${m.id}`,
        m.movementDate,
        m.productId,
        m.productName || m.product?.name,
        m.movementType,
        m.direction,
        m.quantity,
        m.unit || m.product?.unitOfMeasure,
        m.warehouseLocation || "Main Warehouse",
        m.referenceId || "",
        m.createdBy || "System"
      ]);
      downloadCSV("Inventory_Movements_Laxmi_Enterprises", headers, rows);
    } else {
      const headers = ["Product_ID", "Product_Name", "Category", "Opening_Stock", "Inward", "Outward", "Balance_Available", "Unit", "Reorder_Level", "Warehouse_Bay", "Status"];
      const rows = filteredProducts.map(p => {
        const uom = p.unitOfMeasure || p.unit || "Units";
        const openStock = Number(p.openingStock || 0);
        const stockIn = Number(p.inwardStock ?? p.in ?? 0);
        const stockOut = Number(p.outwardStock ?? p.out ?? 0);
        const balance = Number(p.currentStock ?? p.stock ?? (openStock + stockIn - stockOut));
        return [
          p.id || p.productId,
          p.name,
          p.category,
          openStock,
          stockIn,
          stockOut,
          balance,
          uom,
          p.reorderLevel || "Not set",
          p.warehouseLocation || "Bay 1",
          p.stockStatus || "In Stock"
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

      {/* QUICK STATS CARDS: 4-cols on Laptop, 2-cols on Mobile */}
      <ResponsiveKpiGrid cols={4}>
        <div className="stat-card">
          <div className="stat-top">
            <span>Inward Receipts</span>
            <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.12)", color: "#10b981" }}>
              <TrendingUp size={19} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: "16px", lineHeight: "1.3", color: "#10b981" }}>{unitSummaries.inStr}</div>
          <div className="trend positive"><span>Total received goods</span></div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Outward Dispatches</span>
            <div className="stat-icon" style={{ background: "rgba(239, 68, 68, 0.12)", color: "var(--danger)" }}>
              <TrendingDown size={19} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: "16px", lineHeight: "1.3", color: "var(--danger)" }}>{unitSummaries.outStr}</div>
          <div className="trend negative"><span>Fulfilled sales</span></div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Warehouse Net Balance</span>
            <div className="stat-icon" style={{ background: "rgba(0, 91, 181, 0.12)", color: "var(--primary)" }}>
              <Warehouse size={19} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: "16px", lineHeight: "1.3" }}>{unitSummaries.balanceStr}</div>
          <div className="trend positive"><span>In-stock available</span></div>
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
      </ResponsiveKpiGrid>

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
            label="Export Ledger"
            category="Inventory"
            onExportCSV={handleExportCSV}
            showToast={showToast}
          />
          <button className="secondary" onClick={handleOpenAdd} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <History size={16} /> Record Movement
          </button>
          <button className="primary" onClick={() => setProductModalOpen(true)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={16} /> Add Product
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
              ? `Showing ${filteredMovements.length} of ${movements.length} movement entries`
              : `Showing ${filteredProducts.length} of ${products.length} products`
            }
          </span>
        </div>

        {/* DUAL-RESPONSIVE: Desktop Table vs Mobile Cards */}
        {viewMode === "movements" ? (
          filteredMovements.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Boxes size={26} /></div>
              <h4 style={{ fontSize: 16, color: "var(--text-main)", marginBottom: 6 }}>No Movements Found</h4>
              <p style={{ fontSize: 13, marginBottom: 16 }}>No stock movements match your search query or filter.</p>
              <button className="primary" onClick={handleOpenAdd}><Plus size={15} /> Record Movement</button>
            </div>
          ) : (
            <ResponsiveDataTable
              hasRecords={filteredMovements.length > 0}
              /* DESKTOP MOVEMENTS TABLE */
              desktopView={
                <div className="table-wrap">
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
                </div>
              }
              /* MOBILE MOVEMENTS CARDS */
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
                          { label: "Location", value: m.warehouseLocation || "Bay A-1" },
                          { label: "Ref", value: m.referenceId || "Direct" },
                        ]}
                        expandedDetails={
                          <div>
                            <div className="mobile-record-detail-row">
                              <span className="mobile-record-detail-label">Product SKU</span>
                              <span className="mobile-record-detail-val" style={{ fontFamily: "monospace" }}>{m.productId}</span>
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
                <button className="primary" onClick={() => setProductModalOpen(true)}>
                  <Plus size={15} /> Add New Product
                </button>
                <button className="secondary" onClick={handleOpenAdd}>
                  <History size={15} /> Record Movement
                </button>
              </div>
            </div>
          ) : (
            <ResponsiveDataTable
              hasRecords={filteredProducts.length > 0}
              /* DESKTOP BALANCES TABLE */
              desktopView={
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Product ID</th>
                        <th>Product Item</th>
                        <th>Opening Base</th>
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
                        const openStock = Number(p.openingStock || 0);
                        const stockIn = Number(p.inwardStock ?? p.in ?? 0);
                        const stockOut = Number(p.outwardStock ?? p.out ?? 0);
                        const balance = Number(p.currentStock ?? p.stock ?? (openStock + stockIn - stockOut));
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
                            <td style={{ color: "#0284c7", fontWeight: 600 }}>{openStock} {uom}</td>
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
                </div>
              }
              /* MOBILE BALANCES CARDS */
              mobileView={
                <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "8px 4px" }}>
                  {filteredProducts.map(p => {
                    const uom = p.unitOfMeasure || p.unit || "Units";
                    const openStock = Number(p.openingStock || 0);
                    const stockIn = Number(p.inwardStock ?? p.in ?? 0);
                    const stockOut = Number(p.outwardStock ?? p.out ?? 0);
                    const balance = Number(p.currentStock ?? p.stock ?? (openStock + stockIn - stockOut));
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
                          { label: "Available Balance", value: `${balance} ${uom}`, color: isOut ? "var(--danger)" : isLow ? "var(--warning)" : "var(--primary)" },
                          { label: "Opening Base", value: `${openStock} ${uom}`, color: "#0284c7" },
                          { label: "Inward (+)", value: `+${stockIn} ${uom}`, color: "var(--success)" },
                          { label: "Outward (−)", value: `−${stockOut} ${uom}`, color: "var(--text-muted)" },
                        ]}
                        expandedDetails={
                          <div>
                            <div className="mobile-record-detail-row">
                              <span className="mobile-record-detail-label">Reorder Threshold</span>
                              <span className="mobile-record-detail-val">{hasReorder ? `${reorderNum} ${uom}` : "Not set"}</span>
                            </div>
                            <div className="mobile-record-detail-row">
                              <span className="mobile-record-detail-label">Location</span>
                              <span className="mobile-record-detail-val">{p.warehouseLocation || "Godown Bay A-1"}</span>
                            </div>
                          </div>
                        }
                        actions={
                          <button
                            type="button"
                            className="primary"
                            onClick={() => handleOpenMovement(pId)}
                            style={{ display: "inline-flex", alignItems: "center", gap: 6, width: "100%" }}
                          >
                            <Pencil size={14} /> Adjust / Move Stock
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
