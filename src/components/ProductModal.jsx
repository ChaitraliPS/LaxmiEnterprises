import React, { useState, useEffect } from "react";
import {
  X, Save, AlertTriangle, Package, Barcode, Warehouse, Tag, Calculator, Coins
} from "lucide-react";
import {
  validateRequiredText,
  validatePositiveNumber,
  validateNonNegativeNumber,
  validateUniqueId
} from "../utils/validators";
import { FieldError, RequiredStar, ValidationSummary } from "./ValidationFeedback";

export default function ProductModal(props) {
  if (!props.isOpen) return null;
  return <ProductModalInner {...props} />;
}

function ProductModalInner({ isOpen, onClose, onSave, productToEdit, nextId, existingIds = [] }) {
  const isEditing = !!productToEdit;

  const [form, setForm] = useState(() => {
    if (productToEdit) {
      const open = Number(productToEdit.openingStock) || 0;
      const inW = Number(productToEdit.inwardStock) !== undefined && !isNaN(Number(productToEdit.inwardStock))
        ? Number(productToEdit.inwardStock)
        : Number(productToEdit.stock) || 50;
      const outW = Number(productToEdit.outwardStock) || 0;
      const res = Number(productToEdit.reservedStock) || 0;
      const calcStock = Math.max(0, (open + inW) - outW - res);
      const sp = Number(productToEdit.sellingPrice || productToEdit.price || 1000);
      const cp = Number(productToEdit.purchasePrice || productToEdit.costPrice || Math.round(sp * 0.75));
      return {
        ...productToEdit,
        purchasePrice: cp,
        costPrice: cp,
        sellingPrice: sp,
        price: sp,
        openingStock: open,
        inwardStock: inW,
        outwardStock: outW,
        reservedStock: res,
        stock: calcStock
      };
    }
    return {
      id: nextId,
      name: "",
      category: "Animal Feed",
      purchasePrice: 750,
      costPrice: 750,
      sellingPrice: 1000,
      price: 1000,
      openingStock: 0,
      inwardStock: 50,
      outwardStock: 0,
      reservedStock: 0,
      stock: 50,
      minStock: 20
    };
  });

  const [errors, setErrors] = useState({});

  const handleFieldChange = (field, val) => {
    setForm(prev => ({ ...prev, [field]: val }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleStockParamChange = (field, val) => {
    const num = Math.max(0, Number(val) || 0);
    setForm(prev => {
      const updated = { ...prev, [field]: num };
      const open = Number(updated.openingStock) || 0;
      const inW = Number(updated.inwardStock) || 0;
      const outW = Number(updated.outwardStock) || 0;
      const res = Number(updated.reservedStock) || 0;
      updated.stock = Math.max(0, (open + inW) - outW - res);
      return updated;
    });
    if (errors[field] || errors.stock) {
      setErrors(prev => ({ ...prev, [field]: null, stock: null }));
    }
  };

  const validateForm = () => {
    const errs = {};

    const idVal = validateUniqueId(form.id, existingIds, isEditing ? productToEdit.id : null, "Product Reference ID");
    if (!idVal.isValid) errs.id = idVal.error;

    const nameVal = validateRequiredText(form.name, "Product Item Name", 2);
    if (!nameVal.isValid) errs.name = nameVal.error;

    const priceVal = validatePositiveNumber(form.price, "Unit Selling Price");
    if (!priceVal.isValid) errs.price = priceVal.error;

    const stockVal = validateNonNegativeNumber(form.stock, "Available Stock");
    if (!stockVal.isValid) errs.stock = stockVal.error;

    const minStockVal = validatePositiveNumber(form.minStock, "Safety Threshold Limit");
    if (!minStockVal.isValid) errs.minStock = minStockVal.error;

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }
    const open = Number(form.openingStock) || 0;
    const inW = Number(form.inwardStock) || 0;
    const outW = Number(form.outwardStock) || 0;
    const res = Number(form.reservedStock) || 0;
    const calculatedStock = Math.max(0, (open + inW) - outW - res);

    const sp = Number(form.price || form.sellingPrice || 0);
    const cp = Number(form.purchasePrice || form.costPrice || 0);

    onSave({
      ...form,
      price: sp,
      sellingPrice: sp,
      purchasePrice: cp,
      costPrice: cp,
      openingStock: open,
      inwardStock: inW,
      outwardStock: outW,
      reservedStock: res,
      stock: calculatedStock
    });
  };

  const stockStatus = form.stock <= 0 ? "Out of Stock" : form.stock <= form.minStock ? "Low Stock" : "In Stock";
  const stockBadgeClass = form.stock <= 0 ? "danger" : form.stock <= form.minStock ? "warning" : "success";

  const sellingRate = Number(form.price || form.sellingPrice || 0);
  const costRate = Number(form.purchasePrice || form.costPrice || 0);
  const unitProfit = sellingRate - costRate;
  const unitMarginPct = sellingRate > 0 ? ((unitProfit / sellingRate) * 100).toFixed(1) : 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 680,
          width: "95%",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
      >
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <h3>
            <Package size={19} style={{ color: "var(--primary)" }} />
            {isEditing ? `Edit Product: ${productToEdit.name}` : "Add New Catalogue Product"}
          </h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={17} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
        >
          <div
            className="modal-body"
            style={{ flex: 1, minHeight: 0, overflowY: "auto", maxHeight: "none" }}
          >
            <ValidationSummary errors={errors} title="Please resolve the following product errors:" />

            <div className="form-grid">
              <div className="form-group">
                <label>Product Reference ID <RequiredStar /></label>
                <input
                  className={`form-input ${errors.id ? "is-invalid" : ""}`}
                  value={form.id}
                  onChange={(e) => handleFieldChange("id", e.target.value)}
                />
                <FieldError error={errors.id} />
                <span className="form-help">Unique catalog SKU code</span>
              </div>

              <div className="form-group">
                <label>Category Sector</label>
                <select
                  className="form-select"
                  value={form.category}
                  onChange={(e) => handleFieldChange("category", e.target.value)}
                >
                  <option value="Animal Feed">Animal Feed</option>
                  <option value="Dairy Milk">Dairy Milk</option>
                  <option value="Farmer Direct">Farmer Direct</option>
                </select>
                <span className="form-help">Classification group</span>
              </div>

              <div className="form-group full">
                <label>Product Item Name <RequiredStar /></label>
                <input
                  className={`form-input ${errors.name ? "is-invalid" : ""}`}
                  placeholder="e.g. Industrial Pipe Set, Steel Conduit B"
                  value={form.name}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                  autoFocus
                />
                <FieldError error={errors.name} />
              </div>

              {/* Cost Price (Purchase Rate) */}
              <div className="form-group">
                <label>Unit Cost / Purchase Price (₹ INR)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-input"
                  value={form.purchasePrice}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    handleFieldChange("purchasePrice", val);
                    handleFieldChange("costPrice", val);
                  }}
                  placeholder="Cost price from supplier"
                />
                <span className="form-help">Inward acquisition cost from vendor</span>
              </div>

              {/* Selling Price */}
              <div className="form-group">
                <label>Unit Selling Price (₹ INR) <RequiredStar /></label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className={`form-input ${errors.price ? "is-invalid" : ""}`}
                  value={form.price}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    handleFieldChange("price", val);
                    handleFieldChange("sellingPrice", val);
                  }}
                />
                <FieldError error={errors.price} />
                <span className="form-help">Commercial billing rate to clients</span>
              </div>

              {/* Live Commercial Profit Margin Pill */}
              <div className="form-group full" style={{ marginTop: -4, marginBottom: 6 }}>
                <div style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  background: unitProfit >= 0 ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)",
                  border: `1px solid ${unitProfit >= 0 ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)"}`,
                  fontSize: "0.82rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 6,
                  color: unitProfit >= 0 ? "#059669" : "#dc2626",
                  fontWeight: 600
                }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Coins size={15} /> Unit Profit: <b>₹{unitProfit.toFixed(2)}</b> per unit
                  </span>
                  <span>Commercial Margin: <b>{unitMarginPct}%</b></span>
                </div>
              </div>

              <div className="form-group">
                <label>Safety Threshold Limit (Min. Stock) <RequiredStar /></label>
                <input
                  type="number"
                  min="1"
                  className={`form-input ${errors.minStock ? "is-invalid" : ""}`}
                  value={form.minStock}
                  onChange={(e) => handleFieldChange("minStock", Number(e.target.value) || 1)}
                />
                <FieldError error={errors.minStock} />
              </div>

              {/* SPECIFIC STOCK CALCULATION PARAMETERS */}
              <div className="form-group full" style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Calculator size={15} style={{ color: "var(--primary)" }} />
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)" }}>
                      Stock Baseline & Automatic Inventory Link
                    </span>
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Formula: (Opening + Inward) − Outward − Reserved
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Opening Base</label>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      style={{ width: "100%", boxSizing: "border-box", minWidth: 0 }}
                      value={form.openingStock}
                      onChange={(e) => handleStockParamChange("openingStock", e.target.value)}
                      title="Initial baseline stock units"
                    />
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <label style={{ fontSize: "0.75rem", color: "#059669", fontWeight: 600 }}>+ Inward Received</label>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      style={{ width: "100%", boxSizing: "border-box", minWidth: 0 }}
                      value={form.inwardStock}
                      onChange={(e) => handleStockParamChange("inwardStock", e.target.value)}
                      title="Total inward procured / supplier receipts (synced with Purchases)"
                    />
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <label style={{ fontSize: "0.75rem", color: "#d97706", fontWeight: 600 }}>− Outward Sold</label>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      style={{ width: "100%", boxSizing: "border-box", minWidth: 0 }}
                      value={form.outwardStock}
                      onChange={(e) => handleStockParamChange("outwardStock", e.target.value)}
                      title="Total outward dispatched / billed sales (synced with Invoices)"
                    />
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <label style={{ fontSize: "0.75rem", color: "#dc2626", fontWeight: 600 }}>− Reserved Hold</label>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      style={{ width: "100%", boxSizing: "border-box", minWidth: 0 }}
                      value={form.reservedStock}
                      onChange={(e) => handleStockParamChange("reservedStock", e.target.value)}
                      title="Allocated orders or quarantine units"
                    />
                  </div>
                </div>

                {/* LIVE SPECIFIC CALCULATION RESULT BAR */}
                <div style={{
                  background: "linear-gradient(135deg, rgba(0, 91, 181, 0.06) 0%, rgba(16, 185, 129, 0.06) 100%)",
                  border: "1.5px solid rgba(0, 91, 181, 0.2)",
                  borderRadius: 10,
                  padding: "12px 16px",
                  marginTop: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10
                }}>
                  <div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase" }}>
                      Specific Mathematical Calculation:
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "var(--text-main)", marginTop: 2 }}>
                      ({form.openingStock || 0} Open + {form.inwardStock || 0} Inward) − {form.outwardStock || 0} Outward − {form.reservedStock || 0} Reserved
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>
                      CURRENT AVAILABLE STOCK
                    </div>
                    <div style={{ fontSize: "1.35rem", fontWeight: 900, color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                      <span>{form.stock}</span>
                      <small style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>units</small>
                      <span className={`badge ${stockBadgeClass}`} style={{ fontSize: "0.7rem", padding: "1px 6px" }}>
                        {stockStatus}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div className="modal-footer" style={{ flexShrink: 0 }}>
            <button type="button" className="outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary">
              <Save size={15} /> {isEditing ? "Save Product & Stock" : "Create Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}