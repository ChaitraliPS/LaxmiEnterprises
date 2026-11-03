import React, { useState } from "react";
import {
  X, Save, Package, Barcode, Warehouse, Tag, Coins, Percent
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
        gstRate: Number(productToEdit.gstRate || (productToEdit.category === PRODUCT_CATEGORIES.DAIRY ? 0 : 5)),
        reorderLevel: reorder,
        warehouseLocation: productToEdit.warehouseLocation || (productToEdit.category === PRODUCT_CATEGORIES.DAIRY ? "Cold Silo Tank 1" : "Godown Bay A-1"),
        description: productToEdit.description || "",
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
      gstRate: 5,
      reorderLevel: "",
      warehouseLocation: "Godown Bay A-1",
      description: "",
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
          next.gstRate = 0;
          next.warehouseLocation = "Cold Silo Tank 1";
        } else if (val === PRODUCT_CATEGORIES.ANIMAL_FEED && prev.unitOfMeasure === "Liters") {
          next.unitOfMeasure = "Bags";
          next.unit = "Bags";
          next.gstRate = 5;
          next.warehouseLocation = "Godown Bay A-1";
        }
      }
      return next;
    });
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
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

    const sp = Number(form.price || form.sellingPrice || 0);
    const cp = Number(form.costPrice || form.purchasePrice || 0);
    const reorder = form.reorderLevel !== "" && form.reorderLevel !== null && form.reorderLevel !== undefined
      ? Number(form.reorderLevel)
      : null;

    // The Products page must not edit stock. Stock changes are managed only in Inventory.
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
      warehouseLocation: form.warehouseLocation || "Main Warehouse - Bay 01",
      description: form.description || "",
    });
  };

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
          maxWidth: 640,
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
              <div className="form-group">
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
                <span className="form-help">Minimum safe threshold alert</span>
              </div>

              {/* Warehouse Location */}
              <div className="form-group">
                <label>Warehouse Bay / Location</label>
                <input
                  className="form-input"
                  value={form.warehouseLocation}
                  onChange={(e) => handleFieldChange("warehouseLocation", e.target.value)}
                  placeholder="e.g. Godown Bay A-1, Cold Silo Tank 1"
                />
                <span className="form-help">Designated warehouse storage bay</span>
              </div>

              {/* Description */}
              <div className="form-group full">
                <label>Product Description / Specifications</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={form.description}
                  onChange={(e) => handleFieldChange("description", e.target.value)}
                  placeholder="Optional notes or specifications"
                />
              </div>

            </div>
          </div>

          <div className="modal-footer" style={{ flexShrink: 0 }}>
            <button type="button" className="outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary">
              <Save size={15} /> {isEditing ? "Save Product Details" : "Create Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
