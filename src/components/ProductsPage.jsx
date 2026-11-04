import React, { useState, useMemo, useEffect } from "react";
import {
  Package, Plus, Search, Pencil, Eye, AlertTriangle, X,
  Calculator, IndianRupee, Tag, CheckCircle2, RefreshCw
} from "lucide-react";
import ProductModal from "./ProductModal";
import ProductDetailsModal from "./ProductDetailsModal";
import ExportMenu from "./ExportMenu";
import MobileRecordCard from "./responsive/MobileRecordCard";
import ResponsiveKpiGrid from "./responsive/ResponsiveKpiGrid";
import ResponsiveDataTable from "./responsive/ResponsiveDataTable";
import { downloadCSV } from "../utils/exportUtils";
import { calculateProductStock } from "../services/stockService";

export default function ProductsPage({ products = [], onSaveProducts, inventory = [], onRefresh }) {
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
  const [viewingProduct, setViewingProduct] = useState(null);
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

  const totalValuation = useMemo(() => products.reduce((sum, p) => {
    const inv = (inventory || []).find(i => 
      (i.product && i.product.toLowerCase() === (p.name || "").toLowerCase()) || 
      (i.sku && i.sku.toLowerCase() === (p.id || p.productId || "").toLowerCase())
    );
    return sum + calculateProductStock(p, inv).valuation;
  }, 0), [products, inventory]);

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

  const handleOpenEdit = (product) => {
    setEditingProduct(product);
    setModalOpen(true);
  };

  const handleSaveProduct = (productData) => {
    if (editingProduct) {
      const updated = products.map(p => 
        (p.id === editingProduct.id || p.productId === editingProduct.productId) ? productData : p
      );
      onSaveProducts(updated);
      showToast(`✓ Updated ${productData.name} details successfully!`);
    } else {
      const exists = products.some(p => (p.id || p.productId).toLowerCase() === (productData.id || productData.productId).toLowerCase());
      if (exists) {
        showToast(`⚠️ A product with ID ${productData.id || productData.productId} already exists.`);
        return;
      }
      const updated = [productData, ...products];
      onSaveProducts(updated);
      showToast(`✓ Added ${productData.name} to catalogue!`);
    }
    setModalOpen(false);
    setEditingProduct(null);
  };

  const handleExportCSV = () => {
    const headers = [
      "SKU", "Product_Name", "Category", "Unit",
      "Available_Stock", "Cost_Price_INR", "Selling_Price_INR", "Safety_Threshold",
      "Warehouse_Location", "Valuation_at_Cost_INR", "Status"
    ];
    const rows = filtered.map(p => {
      const inv = (inventory || []).find(i => 
        (i.product && i.product.toLowerCase() === (p.name || "").toLowerCase()) || 
        (i.sku && i.sku.toLowerCase() === (p.id || p.productId || "").toLowerCase())
      );
      const metrics = calculateProductStock(p, inv);
      const uom = p.unitOfMeasure || p.unit || "Units";
      return [
        p.id || p.productId,
        p.name,
        p.category,
        uom,
        metrics.currentAvailableStock,
        p.costPrice || 0,
        p.price || p.sellingPrice || 0,
        metrics.minStock !== null ? metrics.minStock : "Not set",
        inv?.location || inv?.warehouseLocation || p.warehouseLocation || "Main Warehouse",
        metrics.valuation,
        metrics.status
      ];
    });
    downloadCSV("Product_Catalogue_Laxmi_Enterprises", headers, rows);
    showToast("✓ Exported Product Catalogue to CSV!");
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
            <span>Active Catalogue</span>
            <div className="stat-icon" style={{ background: "rgba(0, 91, 181, 0.12)", color: "var(--primary)" }}>
              <Package size={19} />
            </div>
          </div>
          <div className="stat-value">{products.length} Products</div>
          <div className="trend positive"><span>Registered SKUs</span></div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Unit Breakdown</span>
            <div className="stat-icon" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
              <Calculator size={19} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: "16px", lineHeight: "1.3" }}>{unitBreakdown}</div>
          <div className="trend neutral"><span>Inventory balance</span></div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Valuation (at Cost)</span>
            <div className="stat-icon" style={{ background: "var(--success-light)", color: "var(--success)" }}>
              <IndianRupee size={19} />
            </div>
          </div>
          <div className="stat-value" style={{ color: "var(--success)" }}>₹{totalValuation.toLocaleString("en-IN")}</div>
          <div className="trend positive"><span>Asset valuation</span></div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Low Stock Alerts</span>
            <div className="stat-icon" style={{ background: lowCount > 0 ? "var(--warning-light)" : "var(--primary-light)", color: lowCount > 0 ? "var(--warning)" : "var(--primary)" }}>
              <AlertTriangle size={19} />
            </div>
          </div>
          <div className="stat-value" style={{ color: lowCount > 0 ? "var(--warning)" : "var(--text-main)" }}>{lowCount} Items</div>
          <div className={`trend ${lowCount > 0 ? "negative" : "positive"}`}><span>{lowCount > 0 ? "Reorder required" : "Safe levels"}</span></div>
        </div>
      </ResponsiveKpiGrid>

      {/* Action Header */}
      <div className="page-actions" style={{ alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div className="filter-pills-bar" style={{ overflowX: "auto", maxWidth: "100%" }}>
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

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginLeft: "auto" }}>
          <ExportMenu
            label="Export Catalogue"
            category="Products"
            onExportCSV={handleExportCSV}
            showToast={showToast}
          />
          <button className="primary" onClick={handleOpenAdd} style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
            Showing {filtered.length} of {products.length} products • Inventory Single Source of Truth
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Package size={26} /></div>
            <h4 style={{ fontSize: 16, color: "var(--text-main)", marginBottom: 6 }}>No Products Found</h4>
            <p style={{ fontSize: 13, marginBottom: 16 }}>No product entries match your search query or category filter.</p>
            <button className="primary" onClick={handleOpenAdd}><Plus size={15} /> Add New Product</button>
          </div>
        ) : (
          <ResponsiveDataTable
            hasRecords={filtered.length > 0}
            desktopView={
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Product ID</th>
                      <th>Product Name</th>
                      <th>Category</th>
                      <th>Pricing</th>
                      <th>Current Stock</th>
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
                            {(inv?.location || inv?.warehouseLocation || p.warehouseLocation) && (
                              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                📍 {inv?.location || inv?.warehouseLocation || p.warehouseLocation}
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
                          
                          <td>
                            <b style={{
                              fontSize: "0.95rem",
                              color: isOut ? "var(--danger)" : isLow ? "var(--warning)" : "var(--text-main)"
                            }}>
                              {metrics.currentAvailableStock.toLocaleString("en-IN")} {uom}
                            </b>
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
                                title={`View full details of ${p.name}`}
                                onClick={() => setViewingProduct(p)}
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
                {filtered.map(p => {
                  const inv = (inventory || []).find(i => 
                    (i.product && i.product.toLowerCase() === (p.name || "").toLowerCase()) || 
                    (i.sku && i.sku.toLowerCase() === (p.id || p.productId || "").toLowerCase())
                  );
                  const metrics = calculateProductStock(p, inv);
                  const isOut = metrics.status === "Out of Stock";
                  const isLow = metrics.status === "Low Stock";
                  const uom = p.unitOfMeasure || p.unit || "Units";
                  const pId = p.id || p.productId;

                  return (
                    <MobileRecordCard
                      key={pId}
                      idBadge={pId}
                      title={p.name}
                      subtitle={inv?.location || inv?.warehouseLocation || p.warehouseLocation || "Main Warehouse"}
                      categoryBadge={p.category}
                      statusBadge={
                        <span className={`badge ${metrics.status === "Not set" ? "muted" : isOut ? "danger" : isLow ? "warning" : "success"}`} style={{ fontSize: 11 }}>
                          {metrics.status}
                        </span>
                      }
                      primaryMetrics={[
                        { label: "Current Stock", value: `${metrics.currentAvailableStock.toLocaleString("en-IN")} ${uom}`, color: isOut ? "var(--danger)" : isLow ? "var(--warning)" : "var(--primary)" },
                        { label: "Selling Rate", value: `₹${Number(p.price || p.sellingPrice || 0).toLocaleString("en-IN")}`, isMoney: true },
                        { label: "Cost Price", value: `₹${Number(p.costPrice || p.purchasePrice || 0).toLocaleString("en-IN")}`, isMoney: true },
                      ]}
                      expandedDetails={
                        <div>
                          <div className="mobile-record-detail-row">
                            <span className="mobile-record-detail-label">Safety Reorder Threshold</span>
                            <span className="mobile-record-detail-val">{metrics.minStock !== null ? `${metrics.minStock} ${uom}` : "Not set"}</span>
                          </div>
                          <div className="mobile-record-detail-row">
                            <span className="mobile-record-detail-label">Inventory Valuation</span>
                            <span className="mobile-record-detail-val">₹{metrics.valuation.toLocaleString("en-IN")}</span>
                          </div>
                        </div>
                      }
                      actions={
                        <button
                          type="button"
                          className="primary"
                          onClick={() => handleOpenEdit(p)}
                          style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                        >
                          <Pencil size={14} /> Edit
                        </button>
                      }
                    />
                  );
                })}
              </div>
            }
          />
        )}
      </div>

      <ProductDetailsModal
        isOpen={!!viewingProduct}
        onClose={() => setViewingProduct(null)}
        product={viewingProduct}
        onEdit={(p) => {
          setViewingProduct(null);
          handleOpenEdit(p);
        }}
      />

      <ProductModal
        key={editingProduct ? (editingProduct.id || editingProduct.productId) : "new-product"}
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingProduct(null); }}
        onSave={handleSaveProduct}
        productToEdit={editingProduct}
        nextId={nextId}
        existingIds={products.map(p => p.id || p.productId)}
      />
    </div>
  );
}
