import React, { useState, useEffect } from "react";
import {
  X, Save, ShoppingCart, Milk, Tractor, Store, Wheat, MapPin, Phone,
  Calendar, CheckCircle2, AlertTriangle, FileText, Tag, IndianRupee, Clock, Warehouse
} from "lucide-react";
import { FieldError, RequiredStar, ValidationSummary } from "./ValidationFeedback";
import {
  validateRequiredText,
  validateMobile,
  validateDate,
  validatePositiveNumber,
  validatePaymentSettlement
} from "../utils/validators";
import { getToday } from "../constants/erpConstants";

export default function PurchaseModal({
  isOpen,
  onClose,
  onSave,
  purchaseToEdit = null,
  nextId = "LE-PUR-2026-001",
  vendors = [],
  products = [],
  company = {}
}) {
  if (!isOpen) return null;
  const isEditing = !!purchaseToEdit;

  const [form, setForm] = useState(() => {
    if (purchaseToEdit) {
      const pTaxable = Number(purchaseToEdit.taxableAmount || purchaseToEdit.amount || purchaseToEdit.subtotal || 0);
      const pQty = Number(purchaseToEdit.inwardQty || purchaseToEdit.quantity || 1);
      const pRate = pQty > 0 && pTaxable > 0 ? Math.round(pTaxable / pQty) : (Number(purchaseToEdit.unitRate || purchaseToEdit.rate) || 1000);
      const pGst = Number(purchaseToEdit.gstRate !== undefined ? purchaseToEdit.gstRate : 5);
      const pGstAmt = Number(purchaseToEdit.gstAmount !== undefined ? purchaseToEdit.gstAmount : Math.round(pTaxable * (pGst / 100)));
      const pTotal = Number(purchaseToEdit.totalAmount || purchaseToEdit.total || purchaseToEdit.grandTotal || (pTaxable + pGstAmt));
      const status = purchaseToEdit.paymentStatus || purchaseToEdit.status || "Paid";
      
      let pPaid = pTotal;
      if (status === "Paid") {
        pPaid = pTotal;
      } else if (status === "Pending") {
        pPaid = 0;
      } else if (status === "Partial") {
        const rawPaid = Number(purchaseToEdit.paidAmount);
        pPaid = (rawPaid > 0 && rawPaid < pTotal) ? rawPaid : (pTotal > 0 ? Math.round(pTotal / 2) : 0);
      }

      return {
        ...purchaseToEdit,
        vendorId: purchaseToEdit.vendorId || "",
        category: purchaseToEdit.category || "Animal Feed Shop",
        vendorName: purchaseToEdit.vendorName || purchaseToEdit.name || "",
        contactPerson: purchaseToEdit.contactPerson || "",
        village: purchaseToEdit.village || "",
        contact: purchaseToEdit.contact || "",
        billNumber: purchaseToEdit.billNumber || "BILL-" + Math.floor(1000 + Math.random() * 9000),
        productId: purchaseToEdit.productId || "",
        itemDescription: purchaseToEdit.itemDescription || purchaseToEdit.productName || "Inward Goods",
        inwardQty: pQty,
        unit: purchaseToEdit.unit || "Bags",
        unitRate: pRate,
        taxableAmount: pTaxable,
        gstRate: pGst,
        gstAmount: pGstAmt,
        totalAmount: pTotal,
        paidAmount: pPaid,
        paymentStatus: status,
        paymentMethod: purchaseToEdit.paymentMethod || "RTGS / Bank Transfer",
        date: purchaseToEdit.date || getToday(),
        dueDate: purchaseToEdit.dueDate || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        fatPercent: purchaseToEdit.fatPercent || "4.2",
        snfPercent: purchaseToEdit.snfPercent || "8.6",
        remarks: purchaseToEdit.remarks || "Direct inward to Warehouse Silo Bay 2"
      };
    }

    const defaultDate = getToday();
    const initialProduct = products && products.length > 0 ? products[0] : null;
    const defaultQty = 50;
    const defaultRate = initialProduct ? Number(initialProduct.purchasePrice || initialProduct.costPrice || 750) : 750;
    const defaultTaxable = defaultQty * defaultRate;
    const defaultGstRate = initialProduct ? Number(initialProduct.gstRate || 5) : 5;
    const defaultGstAmt = Math.round(defaultTaxable * (defaultGstRate / 100));
    const defaultTotal = defaultTaxable + defaultGstAmt;

    return {
      id: nextId,
      category: "Animal Feed Shop", // "Animal Feed Shop" | "Dairy" | "Farmers" | "Hardware"
      vendorName: "",
      contactPerson: "",
      village: "",
      contact: "",
      billNumber: "BILL-" + Math.floor(1000 + Math.random() * 9000),
      productId: initialProduct ? initialProduct.id : "",
      itemDescription: initialProduct ? initialProduct.name : "High-Yield Cattle Feed (50kg bags)",
      inwardQty: defaultQty,
      unit: initialProduct ? (initialProduct.unit || "Bags") : "Bags",
      unitRate: defaultRate,
      taxableAmount: defaultTaxable,
      gstRate: defaultGstRate,
      gstAmount: defaultGstAmt,
      totalAmount: defaultTotal,
      paidAmount: defaultTotal,
      paymentStatus: "Paid", // "Paid" | "Partial" | "Pending"
      paymentMethod: "RTGS / Bank Transfer",
      date: defaultDate,
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      fatPercent: "4.2",
      snfPercent: "8.6",
      remarks: "Direct inward to Warehouse Silo Bay 2"
    };
  });

  const [errors, setErrors] = useState({});

  // When quantity or rate or GST changes, auto-calculate taxable, gst amount, and grand total
  const recalculateAmounts = (qty, rate, gst) => {
    const q = Number(qty) || 0;
    const r = Number(rate) || 0;
    const g = Number(gst) || 0;
    const taxable = Math.round(q * r);
    const gstAmt = Math.round(taxable * (g / 100));
    const total = taxable + gstAmt;

    setForm(prev => {
      let paid = prev.paidAmount;
      if (prev.paymentStatus === "Paid") {
        paid = total;
      } else if (prev.paymentStatus === "Pending") {
        paid = 0;
      } else if (prev.paymentStatus === "Partial") {
        paid = Math.min(total, Math.max(0, Number(prev.paidAmount) || 0));
      }
      return {
        ...prev,
        inwardQty: q,
        unitRate: r,
        taxableAmount: taxable,
        gstRate: g,
        gstAmount: gstAmt,
        totalAmount: total,
        paidAmount: paid
      };
    });
  };

  const handleFieldChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleCategoryChange = (newCat) => {
    let defaultUnit = "Bags";
    let defaultRate = 750;
    let defaultGst = 5;
    let defaultDesc = "High-Yield Cattle Feed (50kg bags)";
    let defaultQty = 50;

    if (newCat === "Dairy") {
      defaultUnit = "Liters";
      defaultRate = 38.50;
      defaultGst = 0; // Raw milk is GST Exempt in India (0%)
      defaultDesc = "Chilled Raw Milk Bulk Procurement";
      defaultQty = 1000;
    } else if (newCat === "Farmers") {
      defaultUnit = "Tonnes";
      defaultRate = 3200;
      defaultGst = 0; // Agricultural fodder / fresh farm produce
      defaultDesc = "Sweet Corn Silage Bales & Green Fodder";
      defaultQty = 10;
    } else if (newCat === "Hardware") {
      defaultUnit = "Nos";
      defaultRate = 120;
      defaultGst = 18;
      defaultDesc = "Piping & Industrial Fasteners";
      defaultQty = 100;
    }

    setForm(prev => ({
      ...prev,
      category: newCat,
      unit: defaultUnit,
      unitRate: defaultRate,
      gstRate: defaultGst,
      itemDescription: defaultDesc,
      inwardQty: defaultQty
    }));

    recalculateAmounts(defaultQty, defaultRate, defaultGst);
  };

  const handleSelectProduct = (prodId) => {
    const p = products.find(prod => String(prod.id) === String(prodId));
    if (!p) return;

    const rate = Number(p.costPrice || p.purchasePrice || 0);
    const gst = Number(p.gstRate !== undefined ? p.gstRate : 5);
    const unit = p.unit || "Nos";

    setForm(prev => ({
      ...prev,
      productId: p.id,
      itemDescription: p.name,
      unit,
      unitRate: rate,
      gstRate: gst
    }));

    recalculateAmounts(form.inwardQty, rate, gst);
  };

  const handleSelectVendor = (vendorIdentifier) => {
    const found = vendors.find(v =>
      String(v.vendorId || v.id) === String(vendorIdentifier) || v.name === vendorIdentifier
    );
    if (!found) return;

    setForm(prev => ({
      ...prev,
      vendorId: found.vendorId || found.id,
      vendorName: found.name,
      contactPerson: found.contactPerson || found.name,
      village: found.village || found.city || prev.village,
      contact: found.phone || found.contact || prev.contact,
      vendorGstin: found.gstin || prev.vendorGstin,
    }));

    if (errors.vendorName || errors.contact || errors.vendorId) {
      setErrors(prev => ({ ...prev, vendorName: null, contact: null, vendorId: null }));
    }
  };

  const handleStatusChange = (newStatus) => {
    setForm(prev => {
      let paid = 0;
      if (newStatus === "Paid") {
        paid = prev.totalAmount;
      } else if (newStatus === "Pending") {
        paid = 0;
      } else if (newStatus === "Partial") {
        const existing = Number(prev.paidAmount);
        paid = (existing > 0 && existing < prev.totalAmount) ? existing : 0;
      }
      return {
        ...prev,
        paymentStatus: newStatus,
        paidAmount: paid
      };
    });
    if (errors.paidAmount || errors.dueDate) {
      setErrors(prev => ({ ...prev, paidAmount: null, dueDate: null }));
    }
  };

  // Compute live balance
  const balanceDue = Math.max(0, form.totalAmount - (Number(form.paidAmount) || 0));

  const validateForm = () => {
    const newErrors = {};

    // Catalogue Product (Strict Catalogue Selection)
    if (!form.productId) {
      newErrors.productId = "Please select a product from the existing catalogue.";
    }

    // Registered Vendor Selection from directory
    if (!form.vendorId && !form.vendorName) {
      newErrors.vendorId = "Please select a registered supplier from the directory.";
    }

    // PO ID
    const idVal = validateRequiredText(form.id, "Purchase Order ID", 2);
    if (!idVal.isValid) newErrors.id = idVal.error;

    // Item Description
    const descVal = validateRequiredText(form.itemDescription, "Procured Item / Description", 2);
    if (!descVal.isValid) newErrors.itemDescription = descVal.error;

    // Quantity
    const qtyVal = validatePositiveNumber(form.inwardQty, "Inward Quantity", 0.01);
    if (!qtyVal.isValid) newErrors.inwardQty = qtyVal.error;

    // Rate
    const rateVal = validatePositiveNumber(form.unitRate, "Unit Purchase Rate", 0.01);
    if (!rateVal.isValid) newErrors.unitRate = rateVal.error;

    // Issue Date
    const dVal = validateDate(form.date, "Bill Date");
    if (!dVal.isValid) newErrors.date = dVal.error;

    // Due Date (only if balance > 0)
    if (form.paymentStatus !== "Paid") {
      const dueVal = validateDate(form.dueDate, "Payment Due Date", { minDate: form.date });
      if (!dueVal.isValid) newErrors.dueDate = dueVal.error;
    }

    // Payment validation
    if (form.paymentStatus === "Partial") {
      const pVal = validatePaymentSettlement("Partial", form.totalAmount, form.paidAmount);
      if (!pVal.isValid) newErrors.paidAmount = pVal.error;
    }

    if (form.totalAmount <= 0) {
      newErrors.totalAmount = "Grand Total must be greater than ₹0.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const inwardQty = Number(form.inwardQty) || 1;
    const unitRate = Number(form.unitRate) || 0;
    const taxableAmount = Math.round(inwardQty * unitRate);
    const gstRate = Number(form.gstRate) || 0;
    const gstAmount = Math.round(taxableAmount * (gstRate / 100));
    const totalAmount = taxableAmount + gstAmount;

    let paidAmount = 0;
    if (form.paymentStatus === "Paid") {
      paidAmount = totalAmount;
    } else if (form.paymentStatus === "Pending") {
      paidAmount = 0;
    } else {
      const raw = Number(form.paidAmount) || 0;
      paidAmount = (raw > 0 && raw < totalAmount) ? raw : (raw >= totalAmount ? totalAmount : 0);
    }
    const currentBalance = Math.max(0, totalAmount - paidAmount);
    const billNumber = form.billNumber?.trim() || form.id;

    const payload = {
      ...form,
      purchaseId: form.id,
      billNumber,
      vendorInvoiceNo: billNumber,
      inwardQty,
      quantity: inwardQty,
      unitRate,
      rate: unitRate,
      taxableAmount,
      amount: taxableAmount,
      subtotal: taxableAmount,
      gstRate,
      gstAmount,
      totalAmount,
      total: totalAmount,
      grandTotal: totalAmount,
      paidAmount,
      balanceDue: currentBalance,
      status: form.paymentStatus,
      paymentStatus: form.paymentStatus,
      items: [
        {
          productId: form.productId || "",
          productName: form.itemDescription,
          quantity: inwardQty,
          unit: form.unit,
          rate: unitRate,
          taxable: taxableAmount,
          gstRate,
          gstAmount,
          total: totalAmount
        }
      ]
    };

    if (onSave) {
      try {
        await onSave(payload);
        onClose();
      } catch (err) {
        // Keep modal open on error
      }
    } else {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 880,
          width: "95vw",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column"
        }}
      >
        {/* Header */}
        <div className="modal-header" style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: "rgba(0, 91, 181, 0.12)",
              color: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <ShoppingCart size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "var(--text-main)" }}>
                {isEditing ? `Edit Purchase Voucher: ${form.id}` : "Record Inward Purchase & Restock"}
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Procurement of cattle feed, raw milk, farm fodder & commercial materials with automated stock update
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <div className="modal-body" style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
            
            <ValidationSummary errors={errors} title="Please fix the highlighted purchase details:" />

            {/* SECTOR / CATEGORY PICKER */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)", display: "block", marginBottom: 8 }}>
                Select Procurement Sector / Category <RequiredStar />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                {[
                  { id: "Animal Feed Shop", label: "Animal Feed", desc: "Bags • 5% GST", icon: Wheat },
                  { id: "Dairy", label: "Dairy Milk", desc: "Liters • 0% GST (Exempt)", icon: Milk },
                  { id: "Farmers", label: "Farmer Direct", desc: "Tonnes • 0% GST", icon: Tractor }
                ].map(cat => {
                  const Icon = cat.icon;
                  const isSelected = form.category === cat.id;
                  return (
                    <div
                      key={cat.id}
                      onClick={() => handleCategoryChange(cat.id)}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border)",
                        background: isSelected ? "rgba(0, 91, 181, 0.08)" : "var(--bg)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        transition: "all 0.15s ease"
                      }}
                    >
                      <div style={{
                        color: isSelected ? "var(--primary)" : "var(--text-muted)",
                        background: isSelected ? "rgba(0, 91, 181, 0.15)" : "transparent",
                        padding: 6,
                        borderRadius: 6
                      }}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: isSelected ? "var(--primary)" : "var(--text-main)" }}>
                          {cat.label}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                          {cat.desc}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SUPPLIER INFORMATION */}
            <div style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "14px 16px",
              marginBottom: 18
            }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <MapPin size={15} style={{ color: "var(--primary)" }} />
                Supplier / Farmer Information
              </div>

              {vendors && vendors.length > 0 ? (
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: "0.80rem", fontWeight: 700 }}>
                    Select Supplier / Vendor from Directory <RequiredStar />:
                  </label>
                  <select
                    className={`form-select ${errors.vendorId ? "is-invalid" : ""}`}
                    onChange={(e) => handleSelectVendor(e.target.value)}
                    value={form.vendorId || ""}
                  >
                    <option value="">-- Choose Registered Vendor to Auto-Fill --</option>
                    {vendors.map(v => (
                      <option key={v.vendorId || v.id} value={v.vendorId || v.id}>
                        {v.name} [{v.vendorId || v.id}] — {v.category || "Supplier"} | {v.city || v.village || "Maharashtra"} ({v.phone || v.contact || "—"})
                      </option>
                    ))}
                  </select>
                  <span className="form-help">Pulls verified vendor GSTIN, phone, and settlement details</span>
                </div>
              ) : (
                <div style={{
                  padding: "8px 12px",
                  background: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.25)",
                  borderRadius: 6,
                  color: "#b45309",
                  fontSize: "0.78rem",
                  marginBottom: 12,
                }}>
                  💡 Tip: You can register standard vendors in the <b>Vendors</b> tab to auto-fill suppliers here.
                </div>
              )}

              {/* Selected Vendor Verified Info Card */}
              {form.vendorName ? (
                <div style={{
                  background: "rgba(0, 91, 181, 0.05)",
                  border: "1px solid rgba(0, 91, 181, 0.2)",
                  borderRadius: 8,
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                  marginTop: 8
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 38,
                      height: 38,
                      borderRadius: 8,
                      background: "rgba(0, 91, 181, 0.12)",
                      color: "var(--primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: "14px"
                    }}>
                      {form.vendorName[0]?.toUpperCase() || "V"}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--text-main)" }}>
                        {form.vendorName}
                        {form.vendorId && (
                          <span style={{
                            marginLeft: 8,
                            fontSize: "0.75rem",
                            fontFamily: "monospace",
                            background: "var(--card-bg, #fff)",
                            border: "1px solid var(--border)",
                            padding: "2px 6px",
                            borderRadius: 4,
                            color: "var(--primary)"
                          }}>
                            {form.vendorId}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 12, marginTop: 2 }}>
                        {form.contact && <span><Phone size={11} style={{ display: "inline", marginRight: 3 }} />{form.contact}</span>}
                        {form.village && <span><MapPin size={11} style={{ display: "inline", marginRight: 3 }} />{form.village}</span>}
                        {form.vendorGstin && <span>GSTIN: <b>{form.vendorGstin}</b></span>}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    fontSize: "0.74rem",
                    fontWeight: 600,
                    color: "#059669",
                    background: "rgba(16, 185, 129, 0.1)",
                    padding: "3px 8px",
                    borderRadius: 6
                  }}>
                    ✓ Verified Vendor Linked
                  </span>
                </div>
              ) : (
                <div style={{ fontSize: "0.80rem", color: "var(--text-muted)", fontStyle: "italic", marginTop: 6 }}>
                  Select an existing vendor above to automatically link details.
                </div>
              )}
              {errors.vendorId && <FieldError error={errors.vendorId} />}
            </div>

            {/* INWARD GOODS & QUANTITY (SINGLE, CLEAN SECTION) */}
            <div style={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "16px",
              marginBottom: 18
            }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <Tag size={15} style={{ color: "var(--primary)" }} />
                Inward Goods & Quantity Specification
              </div>

              <div className="form-grid">
                {/* Catalog Product Link — REQUIRED */}
                <div className="form-group full">
                  <label>Link to Catalogue Product <RequiredStar /></label>
                  {products && products.length > 0 ? (
                    <select
                      className={`form-select ${errors.productId ? "is-invalid" : ""}`}
                      value={form.productId}
                      onChange={(e) => handleSelectProduct(e.target.value)}
                      required
                    >
                      <option value="">-- Select Product from Catalogue (Required) --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} [{p.id}] — Stock: {p.stock ?? p.currentStock ?? 0} {p.unit || 'units'} | Cost: ₹{p.purchasePrice || p.costPrice || 0}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div style={{ padding: "10px 14px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, color: "#b45309", fontSize: "0.85rem" }}>
                      ⚠️ No products in catalogue. Please add products before recording purchases.
                    </div>
                  )}
                  {errors.productId && <span style={{ fontSize: 11, color: "#ef4444", marginTop: 4, display: "block" }}>{errors.productId}</span>}
                  <span className="form-help">Stock will increase automatically for the selected product</span>
                </div>

                <div className="form-group full">
                  <label>Procurement Item (Auto-filled from Selected Product)</label>
                  <input
                    className="form-input"
                    value={form.itemDescription}
                    readOnly
                    style={{ background: "var(--bg)", cursor: "not-allowed", fontWeight: 600 }}
                    placeholder="Select a product from the dropdown above"
                  />
                  <FieldError error={errors.itemDescription} />
                  <span className="form-help">Locked to selected catalogue product for relational database integrity</span>
                </div>

                {/* Inward Quantity */}
                <div className="form-group">
                  <label>Inward Quantity <RequiredStar /></label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    className={`form-input ${errors.inwardQty ? "is-invalid" : ""}`}
                    value={form.inwardQty}
                    onChange={(e) => recalculateAmounts(e.target.value, form.unitRate, form.gstRate)}
                    required
                  />
                  <FieldError error={errors.inwardQty} />
                  <span className="form-help">Number of {form.unit} received</span>
                </div>

                {/* Unit of Measurement */}
                <div className="form-group">
                  <label>Unit of Measurement</label>
                  <select
                    className="form-select"
                    value={form.unit}
                    onChange={(e) => handleFieldChange("unit", e.target.value)}
                  >
                    <option value="Liters">Liters (Liquid Milk / Oil)</option>
                    <option value="Bags">Bags (50kg Feed / Pellets)</option>
                    <option value="Tonnes">Tonnes (Silage / Bulk Fodder)</option>
                    <option value="Nos">Nos (Units / Pieces)</option>
                    <option value="Kg">Kilograms (Kg)</option>
                    <option value="Quintals">Quintals</option>
                  </select>
                </div>

                {/* Rate per Unit */}
                <div className="form-group">
                  <label>Unit Purchase Rate (₹ per {form.unit}) <RequiredStar /></label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    className={`form-input ${errors.unitRate ? "is-invalid" : ""}`}
                    value={form.unitRate}
                    onChange={(e) => recalculateAmounts(form.inwardQty, e.target.value, form.gstRate)}
                    required
                  />
                  <FieldError error={errors.unitRate} />
                </div>

                {/* GST Rate */}
                <div className="form-group">
                  <label>Applicable GST Rate</label>
                  <select
                    className="form-select"
                    value={form.gstRate}
                    onChange={(e) => recalculateAmounts(form.inwardQty, form.unitRate, e.target.value)}
                  >
                    <option value="0">0% (Exempt - Raw Milk / Farm Produce)</option>
                    <option value="5">5% (Animal Feed & Essential Agrochemicals)</option>
                    <option value="12">12% (Standard Agri Equipment)</option>
                    <option value="18">18% (Industrial Hardware & Piping)</option>
                    <option value="28">28% (Luxury / Heavy Machinery)</option>
                  </select>
                </div>

                {/* Dairy-Specific Milk Parameters (Only if Dairy) */}
                {form.category === "Dairy" && (
                  <>
                    <div className="form-group">
                      <label>Milk Fat Content (%)</label>
                      <input
                        className="form-input"
                        value={form.fatPercent}
                        onChange={(e) => handleFieldChange("fatPercent", e.target.value)}
                        placeholder="e.g. 4.2"
                      />
                      <span className="form-help">Standard testing reading</span>
                    </div>

                    <div className="form-group">
                      <label>Solid-Not-Fat (SNF %)</label>
                      <input
                        className="form-input"
                        value={form.snfPercent}
                        onChange={(e) => handleFieldChange("snfPercent", e.target.value)}
                        placeholder="e.g. 8.6"
                      />
                      <span className="form-help">Quality grade indicator</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* FINANCIAL SUMMARY & SETTLEMENT */}
            <div style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "16px 20px",
              marginBottom: 18
            }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>
                    Taxable Subtotal ({form.inwardQty} × ₹{form.unitRate}):
                  </span>
                  <strong style={{ fontSize: "1.1rem", color: "var(--text-main)" }}>
                    ₹{form.taxableAmount.toLocaleString("en-IN")}
                  </strong>
                </div>

                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>
                    GST Tax ({form.gstRate}%):
                  </span>
                  <strong style={{ fontSize: "1.1rem", color: form.gstAmount > 0 ? "var(--text-main)" : "#059669" }}>
                    ₹{form.gstAmount.toLocaleString("en-IN")}
                  </strong>
                  {form.gstRate === 0 && (
                    <span style={{ fontSize: "0.7rem", color: "#059669", display: "block" }}>(Tax Exempt)</span>
                  )}
                </div>

                <div style={{ borderLeft: "2px solid var(--primary)", paddingLeft: 12 }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: 700, display: "block", textTransform: "uppercase" }}>
                    Grand Purchase Total:
                  </span>
                  <strong style={{ fontSize: "1.25rem", color: "var(--primary)", fontWeight: 900 }}>
                    ₹{form.totalAmount.toLocaleString("en-IN")}
                  </strong>
                </div>

                <div style={{ borderLeft: "2px solid #10b981", paddingLeft: 12 }}>
                  <span style={{ fontSize: "0.75rem", color: "#059669", fontWeight: 700, display: "block", textTransform: "uppercase" }}>
                    Amount Paid:
                  </span>
                  <strong style={{ fontSize: "1.1rem", color: "#059669", fontWeight: 800 }}>
                    ₹{(Number(form.paidAmount) || 0).toLocaleString("en-IN")}
                  </strong>
                </div>

                <div style={{ borderLeft: "2px solid #ef4444", paddingLeft: 12 }}>
                  <span style={{ fontSize: "0.75rem", color: balanceDue > 0 ? "#dc2626" : "#059669", fontWeight: 700, display: "block", textTransform: "uppercase" }}>
                    Balance Due to Vendor:
                  </span>
                  <strong style={{ fontSize: "1.1rem", color: balanceDue > 0 ? "#dc2626" : "#059669", fontWeight: 800 }}>
                    ₹{balanceDue.toLocaleString("en-IN")}
                  </strong>
                </div>
              </div>

              {errors.totalAmount && <FieldError error={errors.totalAmount} />}
            </div>

            {/* PAYMENT TERMS & DATES */}
            <div className="form-grid">
              <div className="form-group">
                <label>Bill Issue Date <RequiredStar /></label>
                <input
                  type="date"
                  className={`form-input ${errors.date ? "is-invalid" : ""}`}
                  value={form.date}
                  onChange={(e) => handleFieldChange("date", e.target.value)}
                  required
                />
                <FieldError error={errors.date} />
              </div>

              <div className="form-group">
                <label>Payment Settlement Status <RequiredStar /></label>
                <select
                  className="form-select"
                  value={form.paymentStatus}
                  onChange={(e) => handleStatusChange(e.target.value)}
                >
                  <option value="Paid">Fully Paid / Settled Today</option>
                  <option value="Partial">Partial / Advance Payment</option>
                  <option value="Pending">Payment Pending (Credit Purchase)</option>
                </select>
              </div>

              {form.paymentStatus === "Partial" && (
                <div className="form-group">
                  <label>Amount Paid Today (₹) <RequiredStar /></label>
                  <input
                    type="number"
                    min="1"
                    max={form.totalAmount - 1}
                    className={`form-input ${errors.paidAmount ? "is-invalid" : ""}`}
                    value={form.paidAmount}
                    onChange={(e) => handleFieldChange("paidAmount", Number(e.target.value) || 0)}
                    required
                  />
                  <FieldError error={errors.paidAmount} />
                </div>
              )}

              {form.paymentStatus !== "Paid" && (
                <div className="form-group">
                  <label>Payment Due Date <RequiredStar /></label>
                  <input
                    type="date"
                    className={`form-input ${errors.dueDate ? "is-invalid" : ""}`}
                    value={form.dueDate}
                    min={form.date}
                    onChange={(e) => handleFieldChange("dueDate", e.target.value)}
                    required
                  />
                  <FieldError error={errors.dueDate} />
                </div>
              )}

              <div className="form-group">
                <label>Payment Method</label>
                <select
                  className="form-select"
                  value={form.paymentMethod}
                  onChange={(e) => handleFieldChange("paymentMethod", e.target.value)}
                >
                  <option value="RTGS / Bank Transfer">RTGS / Bank Transfer</option>
                  <option value="UPI Commercial">UPI Commercial</option>
                  <option value="Cash Counter">Cash Counter</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              <div className="form-group">
                <label>Warehouse Storage Bay / Remarks</label>
                <input
                  className="form-input"
                  value={form.remarks}
                  onChange={(e) => handleFieldChange("remarks", e.target.value)}
                  placeholder="e.g. Silo Bay 2, Warehouse Rack A"
                />
              </div>
            </div>

          </div>

          {/* Footer Actions */}
          <div className="modal-footer" style={{
            padding: "14px 24px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10
          }}>
            <button type="button" className="outline" onClick={onClose} style={{ fontSize: "0.85rem" }}>
              Cancel
            </button>
            <button type="submit" className="primary" style={{ fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Save size={15} /> {isEditing ? "Update Purchase Voucher" : "Save & Inward Stock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
