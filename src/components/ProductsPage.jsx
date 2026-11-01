import React, { useState, useMemo } from "react";
import {
  Package, Plus, Search, Filter, Pencil, Trash2, Download, AlertTriangle, Eye, X,
  Calculator, IndianRupee, Tag, CheckCircle2
} from "lucide-react";
import ProductModal from "./ProductModal";
import ProductStockModal from "./ProductStockModal";
import DeleteConfirmModal from "./DeleteConfirmModal";
import ExportMenu from "./ExportMenu";
import { downloadCSV } from "../utils/exportUtils";
import { calculateProductStock } from "../services/stockService";
import { erpApi } from "../services/api";

export default function ProductsPage({ products, onSaveProducts, onDeleteProduct, inventory = [] }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deletingProduct, setDeletingProduct] = useState(null);
  const [calculatingProduct, setCalculatingProduct] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const nextId = useMemo(() => {
    const ids = products
      .map(p => {
        const match = p.id.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter(n => !isNaN(n));
    const maxNum = ids.length ? Math.max(...ids) : 0;
    return `PR-${String(maxNum + 1).padStart(3, "0")}`;
  }, [products]);

  const categories = useMemo(() => {
    const set = new Set(products.map(p => p.category));
    return ["All", ...Array.from(set)];
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchesCategory = categoryFilter === "All" || p.category === categoryFilter;
      const q = search.toLowerCase().trim();
      const matchesSearch = !q || (
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
      return matchesCategory && matchesSearch;
    });
  }, [products, search, categoryFilter]);

  // Specific Stock Aggregations across products and linked inventory
  const totalUnits = useMemo(() => products.reduce((sum, p) => {
    const inv = (inventory || []).find(i => 
      (i.product && i.product.toLowerCase() === p.name.toLowerCase()) || 
      (i.sku && i.sku.toLowerCase() === p.id.toLowerCase())
    );
    return sum + calculateProductStock(p, inv).currentAvailableStock;
  }, 0), [products, inventory]);

  const totalInwardUnits = useMemo(() => products.reduce((sum, p) => {
    const inv = (inventory || []).find(i => 
      (i.product && i.product.toLowerCase() === p.name.toLowerCase()) || 
      (i.sku && i.sku.toLowerCase() === p.id.toLowerCase())
    );
    return sum + calculateProductStock(p, inv).inwardStock;
  }, 0), [products, inventory]);

  const totalOutwardUnits = useMemo(() => products.reduce((sum, p) => {
    const inv = (inventory || []).find(i => 
      (i.product && i.product.toLowerCase() === p.name.toLowerCase()) || 
      (i.sku && i.sku.toLowerCase() === p.id.toLowerCase())
    );
    return sum + calculateProductStock(p, inv).outwardStock;
  }, 0), [products, inventory]);

  const totalValuation = useMemo(() => products.reduce((sum, p) => {
    const inv = (inventory || []).find(i => 
      (i.product && i.product.toLowerCase() === p.name.toLowerCase()) || 
      (i.sku && i.sku.toLowerCase() === p.id.toLowerCase())
    );
    return sum + calculateProductStock(p, inv).valuation;
  }, 0), [products, inventory]);

  const lowCount = useMemo(() => products.filter(p => {
    const inv = (inventory || []).find(i => 
      (i.product && i.product.toLowerCase() === p.name.toLowerCase()) || 
      (i.sku && i.sku.toLowerCase() === p.id.toLowerCase())
    );
    const m = calculateProductStock(p, inv);
    return m.currentAvailableStock <= m.minStock;
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
      const updated = products.map(p => p.id === editingProduct.id ? prodData : p);
      onSaveProducts(updated);
      showToast(`✓ Updated ${prodData.name} and recalculated available stock!`);
    } else {
      const exists = products.some(p => p.id.toLowerCase() === prodData.id.toLowerCase());
      if (exists) {
        showToast(`⚠️ A product with ID ${prodData.id} already exists.`);
        return;
      }
      const updated = [prodData, ...products];
      onSaveProducts(updated);
      showToast(`✓ Added ${prodData.name} to catalogue with specific stock calculation!`);
    }
    setModalOpen(false);
    setEditingProduct(null);
  };

  const handleDeleteConfirm = () => {
    if (!deletingProduct) return;
    const prodId = deletingProduct.id || deletingProduct.productId;
    const prodName = deletingProduct.name || "Product";

    if (onDeleteProduct) {
      onDeleteProduct(deletingProduct);
    } else {
      const updated = products.filter(p => (p.id !== prodId && p.productId !== prodId));
      onSaveProducts(updated);
      erpApi.deleteProduct(prodId).catch(() => {});
    }

    showToast(`✓ Product ${prodName} deleted from catalogue and inventory.`);
    setDeletingProduct(null);
  };

  const handleExportCSV = () => {
    const headers = [
      "Product_ID",
      "Product_Name",
      "Category",
      "Unit_Price_INR",
      "Opening_Stock",
      "Inward_Received",
      "Outward_Dispatched",
      "Reserved_Hold",
      "Current_Available_Stock",
      "Min_Stock_Limit",
      "Buffer_Margin",
      "Status",
      "Stock_Valuation_INR"
    ];
    const rows = filtered.map(p => {
      const inv = (inventory || []).find(i => 
        (i.product && i.product.toLowerCase() === p.name.toLowerCase()) || 
        (i.sku && i.sku.toLowerCase() === p.id.toLowerCase())
      );
      const m = calculateProductStock(p, inv);
      return [
        `"${p.id}"`,
        `"${p.name}"`,
        `"${p.category}"`,
        p.price,
        m.openingStock,
        m.inwardStock,
        m.outwardStock,
        m.reservedStock,
        m.currentAvailableStock,
        m.minStock,
        m.bufferMargin,
        `"${m.status}"`,
        m.valuation
      ];
    });
    downloadCSV(`laxmi_enterprises_products_stock_audit_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    showToast("✓ Exported products catalogue with specific stock calculation audit.");
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
            <div style={{ fontSize: "21px", fontWeight: 800 }}>{totalUnits.toLocaleString("en-IN")} Units</div>
            <div style={{ fontSize: "10.5px", color: "var(--text-muted)", marginTop: 1 }}>
              (+{totalInwardUnits} in / −{totalOutwardUnits} out)
            </div>
          </div>
        </div>

        <div className="client-stat-pill">
          <div className="client-stat-pill-icon" style={{ background: "var(--success-light)", color: "var(--success)" }}>
            <IndianRupee size={20} />
          </div>
          <div>
            <div style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: 600 }}>Total Inventory Value</div>
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
            label="Export Stock Audit"
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
            Showing {filtered.length} of {products.length} products • Specific calculation enabled
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
                  <th>Unit Price</th>
                  <th>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span>Current Available Stock</span>
                      <Calculator size={13} style={{ color: "var(--primary)" }} />
                    </div>
                  </th>
                  <th>Min Limit</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const inv = (inventory || []).find(i => 
                    (i.product && i.product.toLowerCase() === p.name.toLowerCase()) || 
                    (i.sku && i.sku.toLowerCase() === p.id.toLowerCase())
                  );
                  const metrics = calculateProductStock(p, inv);
                  const isOut = metrics.status === "Out of Stock";
                  const isLow = metrics.status === "Low Stock";

                  return (
                    <tr key={p.id}>
                      <td><code>{p.id}</code></td>
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
                      <td className="money">
                        {metrics.unitPrice > 0 ? (
                          `₹${metrics.unitPrice.toLocaleString("en-IN")}`
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>₹0</span>
                        )}
                      </td>
                      
                      {/* SPECIFIC STOCK CALCULATION CELL WITH VIEW BUTTON */}
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <b style={{
                              fontSize: "0.95rem",
                              color: isOut ? "var(--danger)" : isLow ? "var(--warning)" : "var(--text-main)"
                            }}>
                              {metrics.currentAvailableStock.toLocaleString("en-IN")} units
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

                      <td>{metrics.minStock} units</td>
                      <td>
                        <span className={`badge ${isOut ? "danger" : isLow ? "warning" : "success"}`}>
                          <span
                            className={`badge-dot ${!isOut && !isLow ? "pulse" : ""}`}
                            style={{
                              background: isOut ? "#ef4444" : isLow ? "#f59e0b" : "#10b981",
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
                          <button title="Delete Product" onClick={() => setDeletingProduct(p)}>
                            <Trash2 size={14} style={{ color: "var(--danger)" }} />
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
        key={editingProduct ? editingProduct.id : "new-product"}
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingProduct(null); }}
        onSave={handleSaveProduct}
        productToEdit={editingProduct}
        nextId={nextId}
        existingIds={products.map(p => p.id)}
      />

      {/* DEDICATED STOCK CALCULATION AUDIT MODAL */}
      <ProductStockModal
        isOpen={!!calculatingProduct}
        onClose={() => setCalculatingProduct(null)}
        product={calculatingProduct}
        inventoryItem={(inventory || []).find(i => 
          (i.product && i.product.toLowerCase() === calculatingProduct?.name.toLowerCase()) || 
          (i.sku && i.sku.toLowerCase() === calculatingProduct?.id.toLowerCase())
        )}
        onEditProduct={(p) => {
          setCalculatingProduct(null);
          handleOpenEdit(p);
        }}
      />

      <DeleteConfirmModal
        isOpen={!!deletingProduct}
        onClose={() => setDeletingProduct(null)}
        onConfirm={handleDeleteConfirm}
        title="Confirm Product Deletion"
        message={deletingProduct ? `Are you sure you want to remove ${deletingProduct.name} (${deletingProduct.id}) from the catalogue?` : ""}
        details={deletingProduct ? `Current inventory has ${deletingProduct.stock} units priced at ₹${Number(deletingProduct.price).toLocaleString("en-IN")} each.` : ""}
      />

    </div>
  );
}

// ==========================================================================
// INVENTORY MODAL (ADD / EDIT)
// ==========================================================================
