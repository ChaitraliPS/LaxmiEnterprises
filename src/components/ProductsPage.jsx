import React, { useState, useMemo, useEffect } from "react";
import {
  Package, Plus, Search, Filter, Pencil, Download, AlertTriangle, Eye, X,
  Calculator, IndianRupee, Tag, CheckCircle2, RefreshCw
} from "lucide-react";
import ProductModal from "./ProductModal";
import ProductStockModal from "./ProductStockModal";
import ExportMenu from "./ExportMenu";
import { downloadCSV } from "../utils/exportUtils";
import { calculateProductStock } from "../services/stockService";
import { erpApi } from "../services/api";

export default function ProductsPage({ products, onSaveProducts, inventory = [], onRefresh }) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (onRefresh) onRefresh();
  }, [onRefresh]);

  const handleManualRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      await onRefresh();
      setTimeout(() => setIsRefreshing(false), 500);
      showToast("✓ Products synchronized with database");
    }
  };
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [calculatingProduct, setCalculatingProduct] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const nextId = useMemo(() => {
    const ids = products
      .map(p => {
        const match = (p.id || p.productId || "").match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter(n => !isNaN(n));
    const maxNum = ids.length ? Math.max(...ids) : 0;
    return `PR-${String(maxNum + 1).padStart(3, "0")}`;
  }, [products]);

  const categories = useMemo(() => {
    const set = new Set(products.map(p => p.category).filter(Boolean));
    return ["All", ...Array.from(set)];
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchesCategory = categoryFilter === "All" || p.category === categoryFilter;
      const q = search.toLowerCase().trim();
      const matchesSearch = !q || (
        (p.name || "").toLowerCase().includes(q) ||
        (p.id || p.productId || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q)
      );
      return matchesCategory && matchesSearch;
    });
  }, [products, search, categoryFilter]);

  // Per-unit breakdown: Do not add quantities of different units into one mixed total
  const unitBreakdown = useMemo(() => {
    const map = {};
    products.forEach(p => {
      const inv = (inventory || []).find(i => 
        (i.product && i.product.toLowerCase() === (p.name || "").toLowerCase()) || 
        (i.sku && i.sku.toLowerCase() === (p.id || p.productId || "").toLowerCase())
      );
      const m = calculateProductStock(p, inv);
      const u = p.unitOfMeasure || p.unit || "Units";
      map[u] = (map[u] || 0) + m.currentAvailableStock;
    });
    const parts = Object.entries(map).map(([unit, qty]) => `${qty.toLocaleString("en-IN")} ${unit}`);
    return parts.length > 0 ? parts.join(", ") : "0 Units";
  }, [products, inventory]);

  const inOutBreakdown = useMemo(() => {
    const inMap = {};
    const outMap = {};
    products.forEach(p => {
      const inv = (inventory || []).find(i => 
        (i.product && i.product.toLowerCase() === (p.name || "").toLowerCase()) || 
        (i.sku && i.sku.toLowerCase() === (p.id || p.productId || "").toLowerCase())
      );
      const m = calculateProductStock(p, inv);
      const u = p.unitOfMeasure || p.unit || "Units";
      inMap[u] = (inMap[u] || 0) + m.inwardStock;
      outMap[u] = (outMap[u] || 0) + m.outwardStock;
    });
    const inParts = Object.entries(inMap).map(([u, q]) => `+${q} ${u}`).join(", ");
    const outParts = Object.entries(outMap).map(([u, q]) => `−${q} ${u}`).join(", ");
    return `(${inParts || "+0"} in / ${outParts || "−0"} out)`;
  }, [products, inventory]);

  // Total inventory valuation at COST: sum(stock balance x product costPrice)
  const totalValuation = useMemo(() => products.reduce((sum, p) => {
    const inv = (inventory || []).find(i => 
      (i.product && i.product.toLowerCase() === (p.name || "").toLowerCase()) || 
      (i.sku && i.sku.toLowerCase() === (p.id || p.productId || "").toLowerCase())
    );
    return sum + calculateProductStock(p, inv).valuation;
  }, 0), [products, inventory]);

  // Low stock count: Only products where reorderLevel is set and stock <= reorderLevel
  const lowCount = useMemo(() => products.filter(p => {
    const inv = (inventory || []).find(i => 
      (i.product && i.product.toLowerCase() === (p.name || "").toLowerCase()) || 
      (i.sku && i.sku.toLowerCase() === (p.id || p.productId || "").toLowerCase())
    );
    const m = calculateProductStock(p, inv);
    return m.minStock !== null && m.status === "Low Stock";
  }).length, [products, inventory]);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (p) => {
    setEditingProduct(p);
    setModalOpen(true);
  };

  const handleSaveProduct = (prodData) => {
    if (editingProduct) {
      const updated = products.map(p => (p.id === editingProduct.id || p.productId === editingProduct.id) ? prodData : p);
      onSaveProducts(updated);
      showToast(`✓ Updated ${prodData.name} and synchronized stock ledger`);
    } else {
      const exists = products.some(p => (p.id || p.productId || "").toLowerCase() === prodData.id.toLowerCase());
      if (exists) {
        showToast(`⚠️ A product with ID ${prodData.id} already exists.`);
        return;
      }
      const updated = [prodData, ...products];
      onSaveProducts(updated);
      showToast(`✓ Added ${prodData.name} to catalogue`);
    }
    setModalOpen(false);
    setEditingProduct(null);
  };

  const handleExportCSV = () => {
    const headers = [
      "Product_ID",
      "Product_Name",
      "Category",
      "Unit_of_Measure",
      "Unit_Cost_Price_INR",
      "Unit_Selling_Price_INR",
      "Opening_Stock",
      "Inward_Received",
      "Outward_Dispatched",
      "Current_Available_Stock",
      "Reorder_Level",
      "Status",
      "Inventory_Valuation_At_Cost_INR"
    ];
    const rows = filtered.map(p => {
      const inv = (inventory || []).find(i => 
        (i.product && i.product.toLowerCase() === (p.name || "").toLowerCase()) || 
        (i.sku && i.sku.toLowerCase() === (p.id || p.productId || "").toLowerCase())
      );
      const m = calculateProductStock(p, inv);
      const uom = p.unitOfMeasure || p.unit || "Units";
      return [
        `"${p.id || p.productId}"`,
        `"${p.name}"`,
        `"${p.category}"`,
        `"${uom}"`,
        p.costPrice || p.purchasePrice || 0,
        p.price || p.sellingPrice || 0,
        m.openingStock,
        m.inwardStock,
        m.outwardStock,
        m.currentAvailableStock,
        m.minStock !== null ? m.minStock : "Not set",
        `"${m.status}"`,
        m.valuation
      ];
    });
    downloadCSV(`laxmi_enterprises_products_catalogue_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    showToast("✓ Exported products catalogue with ledger audit.");
  };

  return (
    <div className="page">
      {toast && (
        <div className="toast-notification">
          <CheckCircle2 size={18} style={{ color: "var(--success)" }} />
          <span>{toast}</span>
        </div>
      )}

      {/* Product Summary KPIs */}
      <div className="module-quick-stats">
        <div className="client-stat-pill">
          <div className="client-stat-pill-icon"><Package size={20} /></div>
          <div>
            <div style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: 600 }}>Catalogue Items</div>
            <div style={{ fontSize: "21px", fontWeight: 800 }}>{products.length} Products</div>
          </div>
        </div>

        <div className="client-stat-pill">
          <div className="client-stat-pill-icon" style={{ background: "var(--badge-brand-bg)", color: "var(--primary)" }}>
            <Calculator size={20} />
          </div>
          <div>
            <div style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: 600 }}>Current Available Stock</div>
            <div style={{ fontSize: "18px", fontWeight: 800 }}>{unitBreakdown}</div>
            <div style={{ fontSize: "10.5px", color: "var(--text-muted)", marginTop: 1 }}>
              {inOutBreakdown}
            </div>
          </div>
        </div>

        <div className="client-stat-pill">
          <div className="client-stat-pill-icon" style={{ background: "var(--success-light)", color: "var(--success)" }}>
            <IndianRupee size={20} />
          </div>
          <div>
            <div style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: 600 }}>Inventory Valuation (at Cost)</div>
            <div style={{ fontSize: "21px", fontWeight: 800, color: "var(--success)" }}>₹{totalValuation.toLocaleString("en-IN")}</div>
          </div>
        </div>

        <div className="client-stat-pill">
          <div className="client-stat-pill-icon" style={{ background: lowCount > 0 ? "var(--warning-light)" : "var(--primary-light)", color: lowCount > 0 ? "var(--warning)" : "var(--primary)" }}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <div style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: 600 }}>Low Stock Alerts</div>
            <div style={{ fontSize: "21px", fontWeight: 800, color: lowCount > 0 ? "var(--warning)" : "var(--text-main)" }}>{lowCount} Items</div>
          </div>
        </div>
      </div>

      {/* Action Header */}
      <div className="page-actions" style={{ alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div className="filter-pills-bar">
          {categories.map(cat => (
            <button
              key={cat}
              className={`filter-pill ${categoryFilter === cat ? "active" : ""}`}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat} ({cat === "All" ? products.length : products.filter(p => p.category === cat).length})
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <ExportMenu
            label="Export Catalogue"
            category="Products"
            onExportCSV={handleExportCSV}
            showToast={showToast}
          />
          <button className="primary" onClick={handleOpenAdd}>
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card table-card">
        <div className="table-toolbar">
          <div className="local-search">
            <Search size={16} />
            <input
              placeholder="Search by product name, SKU, category..."
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
            Showing {filtered.length} of {products.length} products • Ledger audit synchronized
          </span>
        </div>

        <div className="table-wrap">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Package size={26} /></div>
              <h4 style={{ fontSize: 16, color: "var(--text-main)", marginBottom: 6 }}>No Products Found</h4>
              <p style={{ fontSize: 13, marginBottom: 16 }}>No product entries match your search query or category filter.</p>
              <button className="primary" onClick={handleOpenAdd}><Plus size={15} /> Add New Product</button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Product ID</th>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>Pricing</th>
                  <th>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span>Available Stock</span>
                      <Calculator size={13} style={{ color: "var(--primary)" }} />
                    </div>
                  </th>
                  <th>Reorder Level</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const inv = (inventory || []).find(i => 
                    (i.product && i.product.toLowerCase() === (p.name || "").toLowerCase()) || 
                    (i.sku && i.sku.toLowerCase() === (p.id || p.productId || "").toLowerCase())
                  );
                  const metrics = calculateProductStock(p, inv);
                  const isOut = metrics.status === "Out of Stock";
                  const isLow = metrics.status === "Low Stock";
                  const isNotSet = metrics.status === "Not set";
                  const uom = p.unitOfMeasure || p.unit || "Units";
                  const sellingRate = Number(p.price || p.sellingPrice || 0);
                  const costRate = Number(p.costPrice || p.purchasePrice || 0);

                  return (
                    <tr key={p.id || p.productId}>
                      <td><code>{p.id || p.productId}</code></td>
                      <td>
                        <b>{p.name}</b>
                        {inv?.location && (
                          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            📍 {inv.location}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="badge muted">
                          <Tag size={11} style={{ marginRight: 4 }} /> {p.category}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <b>₹{sellingRate.toLocaleString("en-IN")}</b>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            Cost: ₹{costRate.toLocaleString("en-IN")}
                          </span>
                        </div>
                      </td>
                      
                      {/* SPECIFIC STOCK CALCULATION CELL WITH VIEW BUTTON */}
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <b style={{
                              fontSize: "0.95rem",
                              color: isOut ? "var(--danger)" : isLow ? "var(--warning)" : "var(--text-main)"
                            }}>
                              {metrics.currentAvailableStock.toLocaleString("en-IN")} {uom}
                            </b>
                            <button
                              type="button"
                              onClick={() => setCalculatingProduct(p)}
                              title="View detailed stock calculation breakdown & audit formula"
                              style={{
                                padding: "2px 6px",
                                background: "rgba(0, 91, 181, 0.08)",
                                color: "var(--primary)",
                                border: "1px solid rgba(0, 91, 181, 0.22)",
                                borderRadius: 4,
                                fontSize: "11px",
                                fontWeight: 700,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                cursor: "pointer"
                              }}
                            >
                              <Calculator size={12} />
                              <span>View Calc</span>
                            </button>
                          </div>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "monospace" }}>
                            In: +{metrics.inwardStock} | Out: −{metrics.outwardStock}
                          </span>
                        </div>
                      </td>

                      <td>{metrics.minStock !== null ? `${metrics.minStock} ${uom}` : <span style={{ color: "var(--text-muted)" }}>Not set</span>}</td>
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
                          {metrics.status}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            title="View Stock Calculation Breakdown & Audit"
                            onClick={() => setCalculatingProduct(p)}
                            style={{ color: "var(--primary)" }}
                          >
                            <Calculator size={14} />
                          </button>
                          <button title="Edit Product Details" onClick={() => handleOpenEdit(p)}>
                            <Pencil size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ProductModal
        key={editingProduct ? (editingProduct.id || editingProduct.productId) : "new-product"}
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingProduct(null); }}
        onSave={handleSaveProduct}
        productToEdit={editingProduct}
        nextId={nextId}
        existingIds={products.map(p => p.id || p.productId)}
      />

      {/* DEDICATED STOCK CALCULATION AUDIT MODAL */}
      <ProductStockModal
        isOpen={!!calculatingProduct}
        onClose={() => setCalculatingProduct(null)}
        product={calculatingProduct}
        inventoryItem={(inventory || []).find(i => 
          (i.product && i.product.toLowerCase() === (calculatingProduct?.name || "").toLowerCase()) || 
          (i.sku && i.sku.toLowerCase() === (calculatingProduct?.id || calculatingProduct?.productId || "").toLowerCase())
        )}
        onEditProduct={(p) => {
          setCalculatingProduct(null);
          handleOpenEdit(p);
        }}
      />

    </div>
  );
}
