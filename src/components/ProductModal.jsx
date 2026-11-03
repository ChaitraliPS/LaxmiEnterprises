import React, { useState } from "react";
import {
  X, Save, AlertTriangle, Package, Barcode, Warehouse, Tag, Calculator, Coins, Percent
} from "lucide-react";
import {
  validateRequiredText,
  validatePositiveNumber,
  validateNonNegativeNumber,
  validateUniqueId
} from "../utils/validators";
import { FieldError, RequiredStar, ValidationSummary } from "./ValidationFeedback";
import { PRODUCT_CATEGORIES } from "../constants/erpConstants";

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
        : Number(productToEdit.stock) || 0;
      const outW = Number(productToEdit.outwardStock) || 0;
      const res = Number(productToEdit.reservedStock) || 0;
      const calcStock = Math.max(0, (open + inW) - outW - res);
      const sp = Number(productToEdit.sellingPrice || productToEdit.price || 0);
      const cp = Number(productToEdit.costPrice || productToEdit.purchasePrice || 0);
      const reorder = productToEdit.reorderLevel !== null && productToEdit.reorderLevel !== undefined && productToEdit.reorderLevel !== ""
        ? Number(productToEdit.reorderLevel)
        : (productToEdit.minStock !== null && productToEdit.minStock !== undefined ? Number(productToEdit.minStock) : "");

      return {
        ...productToEdit,
        id: productToEdit.id || productToEdit.productId,
        name: productToEdit.name || "",
        category: productToEdit.category === PRODUCT_CATEGORIES.DAIRY ? PRODUCT_CATEGORIES.DAIRY : PRODUCT_CATEGORIES.ANIMAL_FEED,
        unitOfMeasure: productToEdit.unitOfMeasure || productToEdit.unit || (productToEdit.category === PRODUCT_CATEGORIES.DAIRY ? "Liters" : "Bags"),
        unit: productToEdit.unitOfMeasure || productToEdit.unit || (productToEdit.category === PRODUCT_CATEGORIES.DAIRY ? "Liters" : "Bags"),
        costPrice: cp,
        purchasePrice: cp,
        sellingPrice: sp,
        price: sp,
        gstRate: 0,
        reorderLevel: reorder,
        openingStock: open,
        inwardStock: inW,
        outwardStock: outW,
        reservedStock: res,
        stock: calcStock,
      };
    }
    return {
      id: nextId,
      name: "",
      category: PRODUCT_CATEGORIES.ANIMAL_FEED,
      unitOfMeasure: "Bags",
      unit: "Bags",
      costPrice: "",
      purchasePrice: "",
      sellingPrice: "",
      price: "",
      gstRate: 0,
      reorderLevel: "",
      openingStock: 0,
      inwardStock: 0,
      outwardStock: 0,
      reservedStock: 0,
      stock: 0,
    };
  });

  const [errors, setErrors] = useState({});

  const handleFieldChange = (field, val) => {
    setForm(prev => {
      const next = { ...prev, [field]: val };
      if (field === "unitOfMeasure") {
        next.unit = val;
      }
      if (field === "category") {
        if (val === PRODUCT_CATEGORIES.DAIRY && prev.unitOfMeasure === "Bags") {
          next.unitOfMeasure = "Liters";
          next.unit = "Liters";
        } else if (val === PRODUCT_CATEGORIES.ANIMAL_FEED && prev.unitOfMeasure === "Liters") {
          next.unitOfMeasure = "Bags";
          next.unit = "Bags";
        }
      }
      return next;
    });
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

    const idVal = validateUniqueId(form.id, existingIds, isEditing ? (productToEdit.id || productToEdit.productId) : null, "Product ID");
    if (!idVal.isValid) errs.id = idVal.error;

    const nameVal = validateRequiredText(form.name, "Product Name", 2);
    if (!nameVal.isValid) errs.name = nameVal.error;

    const costVal = validateNonNegativeNumber(form.costPrice, "Unit Cost Price (Purchase Rate)");
    if (!costVal.isValid) errs.costPrice = costVal.error;

    const priceVal = validatePositiveNumber(form.price, "Unit Selling Price");
    if (!priceVal.isValid) errs.price = priceVal.error;

    const stockVal = validateNonNegativeNumber(form.stock, "Available Stock");
    if (!stockVal.isValid) errs.stock = stockVal.error;

    if (form.reorderLevel !== "" && form.reorderLevel !== null && form.reorderLevel !== undefined) {
      const reorderVal = validateNonNegativeNumber(form.reorderLevel, "Reorder Level");
      if (!reorderVal.isValid) errs.reorderLevel = reorderVal.error;
    }

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
    const cp = Number(form.costPrice || form.purchasePrice || 0);
    const reorder = form.reorderLevel !== "" && form.reorderLevel !== null && form.reorderLevel !== undefined
      ? Number(form.reorderLevel)
      : null;

    onSave({
      ...form,
      id: form.id,
      productId: form.id,
      name: form.name.trim(),
      category: form.category === PRODUCT_CATEGORIES.DAIRY ? PRODUCT_CATEGORIES.DAIRY : PRODUCT_CATEGORIES.ANIMAL_FEED,
      unit: form.unitOfMeasure,
      unitOfMeasure: form.unitOfMeasure,
      price: sp,
      sellingPrice: sp,
      costPrice: cp,
      purchasePrice: cp,
      gstRate: Number(form.gstRate || 0),
      reorderLevel: reorder,
      minStock: reorder,
      openingStock: open,
      inwardStock: inW,
      outwardStock: outW,
      reservedStock: res,
      stock: calculatedStock,
    });
  };

  const hasReorder = form.reorderLevel !== "" && form.reorderLevel !== null && form.reorderLevel !== undefined;
  const reorderNum = hasReorder ? Number(form.reorderLevel) : null;
  const stockStatus = !hasReorder ? "Not set" : form.stock <= 0 ? "Out of Stock" : form.stock <= reorderNum ? "Low Stock" : "In Stock";
  const stockBadgeClass = !hasReorder ? "muted" : form.stock <= 0 ? "danger" : form.stock <= reorderNum ? "warning" : "success";

  const sellingRate = Number(form.price || form.sellingPrice || 0);
  const costRate = Number(form.costPrice || form.purchasePrice || 0);
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
                  disabled={isEditing}
                />
                <FieldError error={errors.id} />
                <span className="form-help">Unique catalog SKU code</span>
              </div>

              <div className="form-group">
                <label>Product Category <RequiredStar /></label>
                <select
                  className="form-select"
                  value={form.category}
                  onChange={(e) => handleFieldChange("category", e.target.value)}
                >
                  <option value={PRODUCT_CATEGORIES.ANIMAL_FEED}>Animal Feed</option>
                  <option value={PRODUCT_CATEGORIES.DAIRY}>Dairy</option>
                </select>
                <span className="form-help">Single source of category everywhere</span>
              </div>

              <div className="form-group full">
                <label>Product Item Name <RequiredStar /></label>
                <input
                  className={`form-input ${errors.name ? "is-invalid" : ""}`}
                  placeholder="e.g. Cattle Feed Supreme 50kg, Pasteurized Buffalo Milk 1L"
                  value={form.name}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                  autoFocus
                />
                <FieldError error={errors.name} />
              </div>

              {/* Unit of Measure */}
              <div className="form-group">
                <label>Unit of Measure <RequiredStar /></label>
                <select
                  className="form-select"
                  value={form.unitOfMeasure}
                  onChange={(e) => handleFieldChange("unitOfMeasure", e.target.value)}
                >
                  <option value="Bags">Bags</option>
                  <option value="Liters">Liters</option>
                  <option value="Kg">Kg</option>
                </select>
                <span className="form-help">Measurement unit (Bags, Liters, Kg)</span>
              </div>

              {/* Cost Price (Purchase Rate) - REQUIRED */}
              <div className="form-group">
                <label>Unit Cost Price (₹ INR) <RequiredStar /></label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={`form-input ${errors.costPrice ? "is-invalid" : ""}`}
                  value={form.costPrice}
                  onChange={(e) => {
                    const val = e.target.value === "" ? "" : Number(e.target.value);
                    handleFieldChange("costPrice", val);
                    handleFieldChange("purchasePrice", val);
                  }}
                  placeholder="Inward acquisition cost"
                />
                <FieldError error={errors.costPrice} />
                <span className="form-help">Required: Valuation uses cost price, not selling price</span>
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
                    const val = e.target.value === "" ? "" : Number(e.target.value);
                    handleFieldChange("price", val);
                    handleFieldChange("sellingPrice", val);
                  }}
                  placeholder="Selling rate to clients"
                />
                <FieldError error={errors.price} />
                <span className="form-help">Commercial billing rate to clients</span>
              </div>

              {/* Live Gross Profit Margin Pill */}
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
                    <Coins size={15} /> Unit Gross Profit: <b>₹{unitProfit.toFixed(2)}</b> per {form.unitOfMeasure}
                  </span>
                  <span>Gross Margin: <b>{unitMarginPct}%</b></span>
                </div>
              </div>

              {/* Reorder Level (Nullable) */}
              <div className="form-group full">
                <label>Reorder Level (Optional / Nullable)</label>
                <input
                  type="number"
                  min="0"
                  className={`form-input ${errors.reorderLevel ? "is-invalid" : ""}`}
                  value={form.reorderLevel}
                  onChange={(e) => handleFieldChange("reorderLevel", e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Leave blank for 'Not set'"
                />
                <FieldError error={errors.reorderLevel} />
                <span className="form-help">Minimum safe threshold. If not configured, status shows "Not set"</span>
              </div>

              {/* STOCK LEDGER BASELINE PARAMETERS */}
              <div className="form-group full" style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Calculator size={15} style={{ color: "var(--primary)" }} />
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)" }}>
                      Stock Balance Ledger Audit
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
                      title="Total inward procured / supplier receipts"
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
                      title="Total outward dispatched / billed sales"
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
                      Ledger Movement Balance:
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
                      <small style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>{form.unitOfMeasure}</small>
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
