import React, { useState, useEffect } from "react";
import {
  Receipt, X, Save, Download, Plus, Trash2,
  CheckCircle2, Building2, Calendar, CreditCard, Layers, AlertCircle, IndianRupee, ShieldCheck
} from "lucide-react";
import { generateInvoicePDF } from "../services/pdfService";
import { FieldError, RequiredStar, ValidationSummary } from "./ValidationFeedback";
import {
  validateRequiredText,
  validateDate,
  validateInvoiceItems,
  validatePaymentSettlement
} from "../utils/validators";
import { getToday } from "../constants/erpConstants";

export const getTodayLocalDate = () => getToday();


export const getLocalDateInDays = (days = 30) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${da}`;
};

export default function InvoiceModal({
  isOpen,
  onClose,
  onSave,
  clients = [],
  products = [],
  nextId = "LE-INV-2026-001",
  company = {},
  defaultClient = null,
  editInvoice = null,
  showToast
}) {
  if (!isOpen) return null;

  const initialClient = defaultClient || (clients.length > 0 ? clients[0] : null);

  const [form, setForm] = useState({
    id: nextId,
    clientName: initialClient ? initialClient.name : "",
    clientId: initialClient ? initialClient.id : "",
    date: getTodayLocalDate(),
    dueDate: getLocalDateInDays(30),
    category: initialClient?.clientType?.toLowerCase().includes("dairy") ? "Dairy Milk" :
              initialClient?.clientType?.toLowerCase().includes("farm") ? "Farmer Direct" : "Animal Feed",
    status: "Paid", // "Paid" | "Partial" | "Unpaid"
    paymentMethod: "UPI Commercial / NEFT",
    paidAmountInput: 0,
    notes: ""
  });

  const [items, setItems] = useState(() => {
    if (products && products.length > 0) {
      const p = products[0];
      const qty = 1;
      const rate = Number(p.sellingPrice || p.price || 0);
      const gstRate = p && p.gstRate !== undefined && p.gstRate !== null && !isNaN(Number(p.gstRate)) ? Number(p.gstRate) : 0;
      const taxable = Math.round(qty * rate);
      const tax = Math.round(taxable * (gstRate / 100));
      return [{
        productId: p.id,
        description: p.name,
        hsn: p.hsnCode || p.sku || "7306",
        qty,
        unit: p.unit || "Nos",
        rate,
        taxable,
        gstRate,
        total: taxable + tax
      }];
    }
    return [
      {
        productId: "",
        description: "Animal Feed & Cattle Nutrition Stock",
        hsn: "2309",
        qty: 1,
        unit: "Bags",
        rate: 750,
        taxable: 750,
        gstRate: 0,
        total: 750,
        category: "Animal Feed"
      }
    ];
  });

  const [errors, setErrors] = useState({});
  const [itemErrors, setItemErrors] = useState([]);

  useEffect(() => {
    if (defaultClient) {
      setForm(prev => ({
        ...prev,
        clientName: defaultClient.name,
        clientId: defaultClient.id
      }));
    }
  }, [defaultClient]);

  useEffect(() => {
    if (isOpen) {
      if (editInvoice) {
        setForm({
          id: editInvoice.id || editInvoice.invoiceNumber || nextId,
          clientName: editInvoice.clientName || "",
          clientId: editInvoice.clientId || "",
          date: editInvoice.date || getTodayLocalDate(),
          dueDate: editInvoice.dueDate || getLocalDateInDays(30),
          category: editInvoice.category || "Animal Feed",
          status: editInvoice.status || "Paid",
          paymentMethod: editInvoice.paymentMethod || editInvoice.paymentMode || "UPI Commercial / NEFT",
          paidAmountInput: editInvoice.paidAmount !== undefined ? editInvoice.paidAmount : (editInvoice.status === "Paid" ? (editInvoice.total || 0) : 0),
          notes: editInvoice.notes || ""
        });
        if (Array.isArray(editInvoice.items) && editInvoice.items.length > 0) {
          setItems(editInvoice.items);
        }
      } else {
        setForm(prev => ({
          ...prev,
          id: nextId || prev.id,
          date: getTodayLocalDate(),
          dueDate: getLocalDateInDays(30),
        }));
      }
    }
  }, [isOpen, nextId, editInvoice]);

  // Calculations
  const taxableAmount = items.reduce((sum, it) => sum + (Number(it.taxable) || 0), 0);
  const gstTax = items.reduce((sum, it) => {
    const t = Number(it.taxable) || 0;
    const r = (it.gstRate !== undefined && it.gstRate !== null && !isNaN(Number(it.gstRate)) ? Number(it.gstRate) : 0) / 100;
    return sum + Math.round(t * r);
  }, 0);
  const grandTotal = taxableAmount + gstTax;
  const cgst = Math.round(gstTax / 2);
  const sgst = gstTax - cgst;

  // Compute actual paid amount and balance due based on status
  let actualPaid = 0;
  let balanceDue = 0;

  if (form.status === "Paid") {
    actualPaid = grandTotal;
    balanceDue = 0;
  } else if (form.status === "Unpaid") {
    actualPaid = 0;
    balanceDue = grandTotal;
  } else if (form.status === "Partial") {
    actualPaid = Math.min(grandTotal, Math.max(0, Number(form.paidAmountInput || 0)));
    balanceDue = Math.max(0, grandTotal - actualPaid);
  }

  // Selected client object & outstanding
  const selectedClient = clients.find(c => c.id === form.clientId || c.name === form.clientName) || defaultClient || null;
  const clientOutstanding = selectedClient ? Number(selectedClient.outstandingBalance ?? selectedClient.outstanding ?? 0) : 0;

  const handleClientChange = (clientName) => {
    const found = clients.find(c => c.name === clientName);
    let autoCat = undefined;
    if (found?.clientType) {
      const ct = found.clientType.toLowerCase();
      if (ct.includes("feed")) autoCat = "Animal Feed";
      else if (ct.includes("dairy") || ct.includes("milk")) autoCat = "Dairy Milk";
      else if (ct.includes("farm")) autoCat = "Farmer Direct";
    }
    setForm(prev => ({
      ...prev,
      clientName,
      clientId: found ? found.id : prev.clientId,
      ...(autoCat ? { category: autoCat } : {})
    }));
    if (errors.clientName) {
      setErrors(prev => ({ ...prev, clientName: null }));
    }
  };

  const handleStatusChange = (newStatus) => {
    setForm(prev => {
      let defaultPaidInput = prev.paidAmountInput;
      if (newStatus === "Partial" && (!defaultPaidInput || defaultPaidInput === 0)) {
        defaultPaidInput = Math.round(grandTotal / 2);
      }
      return {
        ...prev,
        status: newStatus,
        paidAmountInput: defaultPaidInput
      };
    });
    if (errors.status || errors.paidAmount || errors.dueDate) {
      setErrors(prev => ({ ...prev, status: null, paidAmount: null, dueDate: null }));
    }
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: value };

    if (field === "qty" || field === "rate" || field === "gstRate") {
      const q = Number(field === "qty" ? value : item.qty) || 0;
      const r = Number(field === "rate" ? value : item.rate) || 0;
      const gst = field === "gstRate" ? (value === "" ? 0 : Number(value)) : (item.gstRate !== undefined && item.gstRate !== null ? Number(item.gstRate) : 0);
      item.gstRate = gst;
      item.taxable = Math.round(q * r);
      const tax = Math.round(item.taxable * (gst / 100));
      item.total = item.taxable + tax;
    }

    updated[index] = item;
    setItems(updated);

    if (itemErrors[index] && itemErrors[index][field]) {
      const updatedItemErrs = [...itemErrors];
      updatedItemErrs[index] = { ...updatedItemErrs[index], [field]: null };
      setItemErrors(updatedItemErrs);
    }
    if (errors.items) {
      setErrors(prev => ({ ...prev, items: null }));
    }
  };

  const handleSelectProduct = (index, prodId) => {
    const p = products.find(prod => String(prod.id) === String(prodId));
    if (!p) return;

    const updated = [...items];
    const currentQty = Number(updated[index]?.qty) || 1;
    const rate = Number(p.sellingPrice || p.price || 0);
    const gstRate = p && p.gstRate !== undefined && p.gstRate !== null && !isNaN(Number(p.gstRate)) ? Number(p.gstRate) : 0;
    const taxable = Math.round(currentQty * rate);
    const tax = Math.round(taxable * (gstRate / 100));

    updated[index] = {
      ...updated[index],
      productId: p.id,
      description: p.name,
      hsn: p.hsnCode || p.sku || "7306",
      unit: p.unit || "Nos",
      rate,
      gstRate,
      taxable,
      total: taxable + tax
    };

    setItems(updated);

    if (itemErrors[index]) {
      const updatedItemErrs = [...itemErrors];
      updatedItemErrs[index] = { ...updatedItemErrs[index], description: null, rate: null };
      setItemErrors(updatedItemErrs);
    }
    if (errors.items) {
      setErrors(prev => ({ ...prev, items: null }));
    }
  };

  const handleAddItem = () => {
    const p = products && products.length > 0 ? products[0] : null;
    const qty = 1;
    const rate = p ? Number(p.sellingPrice || p.price || 0) : 500;
    const gstRate = p && p.gstRate !== undefined && p.gstRate !== null && !isNaN(Number(p.gstRate)) ? Number(p.gstRate) : 0;
    const taxable = Math.round(qty * rate);
    const tax = Math.round(taxable * (gstRate / 100));

    setItems(prev => [
      ...prev,
      {
        productId: p ? p.id : "",
        description: p ? p.name : "Animal Feed & Cattle Nutrition Stock",
        hsn: p ? (p.hsnCode || p.sku || "2309") : "2309",
        category: p ? (p.category || "Animal Feed") : "Animal Feed",
        qty,
        unit: p ? (p.unit || "Nos") : "Nos",
        rate,
        taxable,
        gstRate,
        total: taxable + tax
      }
    ]);
    setItemErrors(prev => [...prev, {}]);
    if (errors.items) {
      setErrors(prev => ({ ...prev, items: null }));
    }
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) {
      setErrors(prev => ({ ...prev, items: "At least one itemized product is required." }));
      return;
    }
    setItems(items.filter((_, i) => i !== index));
    setItemErrors(itemErrors.filter((_, i) => i !== index));
    setErrors(prev => ({ ...prev, items: null }));
  };

  const validateForm = () => {
    const newErrors = {};

    // Invoice ID
    const idVal = validateRequiredText(form.id, "Invoice Number", 3);
    if (!idVal.isValid) newErrors.id = idVal.error;

    // Client Name
    const clientVal = validateRequiredText(form.clientName, "Client Account", 2);
    if (!clientVal.isValid) newErrors.clientName = clientVal.error;

    // Invoice Date
    const dateVal = validateDate(form.date, "Invoice Date");
    if (!dateVal.isValid) newErrors.date = dateVal.error;

    // Due Date (only required when there is pending balance)
    if (form.status !== "Paid") {
      const dueDateVal = validateDate(form.dueDate, "Payment Due Date", { minDate: form.date });
      if (!dueDateVal.isValid) newErrors.dueDate = dueDateVal.error;
    }

    // Payment Settlement Validation
    if (form.status === "Partial") {
      const payVal = validatePaymentSettlement("Partial", grandTotal, form.paidAmountInput);
      if (!payVal.isValid) newErrors.paidAmount = payVal.error;
    }

    // Itemized lines validation — strictly enforce catalogue product selection
    const lineItemVal = validateInvoiceItems(items);
    let hasMissingProduct = false;
    const customItemErrors = items.map((it, idx) => {
      const errs = { ...(lineItemVal.itemErrors[idx] || {}) };
      if (!it.productId) {
        errs.productId = "Please select a product from the catalogue dropdown.";
        errs.description = "Product must be selected from the catalogue.";
        hasMissingProduct = true;
      }
      return errs;
    });

    if (!lineItemVal.isValid || hasMissingProduct) {
      newErrors.items = hasMissingProduct
        ? "All line items must be selected from existing catalogue products."
        : (lineItemVal.generalError || "Please verify product quantities and rates.");
      setItemErrors(customItemErrors);
    } else {
      setItemErrors([]);
    }

    // Grand total
    if (grandTotal <= 0) {
      newErrors.total = "Invoice Grand Total must be greater than ₹0.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getInvoicePayload = () => {
    const client = selectedClient || {};
    return {
      ...form,
      invoiceNumber: form.id,
      clientId: client.id || form.clientId,
      clientName: client.name || form.clientName,
      clientType: client.clientType || client.category || "Commercial",
      clientGstin: client.gstin || "",
      clientContact: client.contact || "",
      clientAddress: client.address || client.city || "",
      date: form.date,
      dueDate: form.status === "Paid" ? form.date : form.dueDate,
      status: form.status,
      paymentStatus: form.status,
      paymentMode: form.paymentMethod,
      paymentMethod: form.paymentMethod,
      amount: taxableAmount,
      subtotal: taxableAmount,
      tax: gstTax,
      cgstTotal: cgst,
      sgstTotal: sgst,
      total: grandTotal,
      grandTotal: grandTotal,
      paidAmount: actualPaid,
      balanceDue: balanceDue,
      category: form.category || items[0]?.category || (selectedClient?.clientType ? `${selectedClient.clientType}` : "Animal Feed"),
      items,
      clientExtra: {
        gstin: client.gstin,
        city: client.city || client.district,
        contact: client.contact
      }
    };
  };

  const handleDownloadPDF = () => {
    if (!validateForm()) return;
    try {
      const inv = getInvoicePayload();
      const { fileName } = generateInvoicePDF(inv, company, selectedClient || {});
      if (showToast) {
        showToast(`✓ Downloaded ${fileName} to your PC`);
      }
    } catch (err) {
      console.error("PDF download error:", err);
      setErrors(prev => ({ ...prev, pdf: "Failed to download PDF: " + err.message }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    const inv = getInvoicePayload();
    if (onSave) {
      try {
        await onSave(inv);
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
          maxWidth: 960,
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
              <Receipt size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "var(--text-main)" }}>
                {editInvoice ? `Edit Tax Invoice: ${editInvoice.id || editInvoice.invoiceNumber}` : "Create Commercial Tax Invoice"}
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Itemized GST sales invoice with product catalog link, stock deduction & customer ledger cascade
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
            
            {/* Validation summary banner */}
            <ValidationSummary errors={errors} title="Please fix the following invoice details:" />

            {/* Basic Info Grid */}
            <div className="form-grid" style={{ marginBottom: 16 }}>
              <div className="form-group">
                <label>Invoice Number <RequiredStar /></label>
                <input
                  className={`form-input ${errors.id ? "is-invalid" : ""}`}
                  value={form.id}
                  onChange={(e) => {
                    setForm({ ...form, id: e.target.value });
                    if (errors.id) setErrors(prev => ({ ...prev, id: null }));
                  }}
                  required
                />
                <FieldError error={errors.id} />
                <span className="form-help">Unique GST Tax Invoice ID</span>
              </div>

              <div className="form-group">
                <label>Invoice Date <RequiredStar /></label>
                <input
                  type="date"
                  className={`form-input ${errors.date ? "is-invalid" : ""}`}
                  value={form.date}
                  onChange={(e) => {
                    setForm({ ...form, date: e.target.value });
                    if (errors.date) setErrors(prev => ({ ...prev, date: null }));
                  }}
                  required
                />
                <FieldError error={errors.date} />
              </div>

              {/* Sales Category Selector */}
              <div className="form-group">
                <label>Sales Category / Sector <RequiredStar /></label>
                <select
                  className="form-select"
                  value={form.category || "Animal Feed"}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  <option value="Animal Feed">Animal Feed</option>
                  <option value="Dairy Milk">Dairy Milk</option>
                  <option value="Farmer Direct">Farmer Direct</option>
                  <option value="Agricultural Supplies">Agricultural Supplies</option>
                  <option value="General Trading">General Trading</option>
                </select>
                <span className="form-help">Trade sector classification</span>
              </div>

              {/* Client Selection */}
              <div className="form-group full">
                <label>Client Commercial Account <RequiredStar /></label>
                <select
                  className={`form-select ${errors.clientName ? "is-invalid" : ""}`}
                  value={form.clientName}
                  onChange={(e) => handleClientChange(e.target.value)}
                  required
                >
                  <option value="">-- Select Client Account --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.name}>
                      {c.clientType ? `[${c.clientType}] ` : ""}{c.name} — {c.district || c.city || "MS"} (Ph: {c.contact})
                    </option>
                  ))}
                </select>
                <FieldError error={errors.clientName} />

                {/* Client Credit & Info Card */}
                {selectedClient && (
                  <div style={{
                    marginTop: 8,
                    padding: "10px 14px",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 10,
                    fontSize: "0.82rem"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <span style={{
                        padding: "2px 8px",
                        background: "rgba(0, 91, 181, 0.1)",
                        color: "var(--primary)",
                        borderRadius: 4,
                        fontWeight: 700,
                        fontSize: "0.75rem"
                      }}>
                        {selectedClient.clientType || selectedClient.category || "Commercial Account"}
                      </span>
                      <span>GSTIN: <b>{selectedClient.gstin || "Unregistered"}</b></span>
                      <span>Location: <b>{selectedClient.village || selectedClient.city || "Maharashtra"}</b></span>
                      <span>Phone: <b>{selectedClient.contact}</b></span>
                    </div>

                    <div style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontWeight: 700,
                      background: clientOutstanding > 0 ? "rgba(245, 158, 11, 0.12)" : "rgba(16, 185, 129, 0.12)",
                      color: clientOutstanding > 0 ? "#b45309" : "#059669"
                    }}>
                      {clientOutstanding > 0
                        ? `⚠️ Current Outstanding: ₹${clientOutstanding.toLocaleString("en-IN")}`
                        : "✓ Outstanding: ₹0 (No Pending Debt)"}
                    </div>
                  </div>
                )}
              </div>

              {/* Settlement & Status Section */}
              <div className="form-group">
                <label>Billing & Payment Status <RequiredStar /></label>
                <select
                  className="form-select"
                  value={form.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                >
                  <option value="Paid">Verified Paid (Settled in Full)</option>
                  <option value="Partial">Partial / Advance Payment</option>
                  <option value="Unpaid">Credit Sale (Pending Payment)</option>
                </select>
                <span className="form-help">Settlement arrangement for this order</span>
              </div>

              <div className="form-group">
                <label>Payment Method</label>
                <select
                  className="form-select"
                  value={form.paymentMethod}
                  onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                >
                  <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
                  <option value="NEFT">NEFT (National Electronic Fund Transfer)</option>
                  <option value="RTGS">RTGS (Real Time Gross Settlement)</option>
                  <option value="IMPS">IMPS (Immediate Payment)</option>
                  <option value="Cash">Cash Counter</option>
                  <option value="Cheque">Cheque (In Clearance)</option>
                  <option value="Commercial Transfer">Commercial Transfer / Net Banking</option>
                  <option value="UPI Commercial / NEFT">UPI Commercial / NEFT</option>
                  <option value="Bank Transfer (NEFT/RTGS)">Bank Transfer (NEFT/RTGS)</option>
                  <option value="Cash Counter">Cash Counter</option>
                  <option value="Cheque (In Clearance)">Cheque (In Clearance)</option>
                  <option value="Direct Deposit">Direct Deposit</option>
                </select>
              </div>

              {/* Conditional Partial Payment Input */}
              {form.status === "Partial" && (
                <div className="form-group">
                  <label>Amount Paid Today (₹) <RequiredStar /></label>
                  <input
                    type="number"
                    min="1"
                    max={grandTotal - 1}
                    className={`form-input ${errors.paidAmount ? "is-invalid" : ""}`}
                    value={form.paidAmountInput}
                    onChange={(e) => {
                      setForm({ ...form, paidAmountInput: Number(e.target.value) || 0 });
                      if (errors.paidAmount) setErrors(prev => ({ ...prev, paidAmount: null }));
                    }}
                    placeholder="Enter partial amount received"
                    required
                  />
                  <FieldError error={errors.paidAmount} />
                  <span className="form-help">Remaining: ₹{balanceDue.toLocaleString("en-IN")}</span>
                </div>
              )}

              {/* Payment Due Date */}
              {form.status !== "Paid" ? (
                <div className="form-group">
                  <label>Payment Due Date <RequiredStar /></label>
                  <input
                    type="date"
                    className={`form-input ${errors.dueDate ? "is-invalid" : ""}`}
                    value={form.dueDate}
                    min={form.date}
                    onChange={(e) => {
                      setForm({ ...form, dueDate: e.target.value });
                      if (errors.dueDate) setErrors(prev => ({ ...prev, dueDate: null }));
                    }}
                    required
                  />
                  <FieldError error={errors.dueDate} />
                  <span className="form-help">Due date for remaining balance ₹{balanceDue.toLocaleString("en-IN")}</span>
                </div>
              ) : (
                <div className="form-group" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <label>Payment Realization</label>
                  <div style={{
                    padding: "8px 12px",
                    background: "rgba(16, 185, 129, 0.08)",
                    border: "1px solid rgba(16, 185, 129, 0.2)",
                    borderRadius: 6,
                    fontSize: "0.82rem",
                    color: "#059669",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}>
                    <CheckCircle2 size={16} /> Fully Paid & Settled (Balance Due: ₹0)
                  </div>
                </div>
              )}
            </div>

            {/* Itemized Table Section */}
            <div style={{ marginBottom: 20 }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8
              }}>
                <div>
                  <strong style={{ fontSize: "0.95rem", color: "var(--text-main)" }}>
                    Itemized Commercial Particulars (GST Line Items)
                  </strong>
                  <span style={{ display: "block", fontSize: "0.76rem", color: "var(--text-muted)" }}>
                    Select registered products from catalog to auto-fill HSN, unit, pricing, and update live inventory
                  </span>
                </div>
              </div>

              {errors.items && (
                <div style={{ marginBottom: 8 }}>
                  <FieldError error={errors.items} />
                </div>
              )}

              <div className="table-wrap" style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
                <table style={{ width: "100%", fontSize: "0.82rem", borderCollapse: "collapse", minWidth: 600 }}>
                  <thead>
                    <tr style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
                      <th style={{ padding: "8px 10px", textAlign: "left", width: "40%" }}>Product from Catalog <RequiredStar /></th>
                      <th style={{ padding: "8px 10px", textAlign: "center", width: "12%" }}>HSN/SAC</th>
                      <th style={{ padding: "8px 10px", textAlign: "center", width: "12%" }}>Qty & Unit <RequiredStar /></th>
                      <th style={{ padding: "8px 10px", textAlign: "right", width: "13%" }}>Rate (₹) <RequiredStar /></th>
                      <th style={{ padding: "8px 10px", textAlign: "center", width: "10%" }}>GST %</th>
                      <th style={{ padding: "8px 10px", textAlign: "right", width: "13%" }}>Taxable (₹)</th>
                      <th style={{ padding: "8px 10px", textAlign: "center", width: "6%" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => {
                      const rowErrs = itemErrors[idx] || {};
                      const selectedProd = products.find(p => String(p.id) === String(it.productId) || p.name === it.description);
                      const availableStock = selectedProd ? Number(selectedProd.stock ?? selectedProd.currentStock ?? 0) : null;
                      const isStockLow = availableStock !== null && availableStock <= 10;
                      const isOutOfStock = availableStock !== null && availableStock <= 0;

                      return (
                        <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "8px" }}>
                            {products && products.length > 0 ? (
                              <select
                                className={`form-select ${rowErrs.description || rowErrs.productId ? "is-invalid" : ""}`}
                                style={{ height: 34, fontSize: "0.82rem", padding: "2px 8px", width: "100%", fontWeight: 600 }}
                                value={it.productId || ""}
                                onChange={(e) => handleSelectProduct(idx, e.target.value)}
                                required
                              >
                                <option value="">-- Select Product from Catalogue --</option>
                                {products.map((p) => {
                                  const pStock = Number(p.stock ?? p.currentStock ?? 0);
                                  return (
                                    <option key={p.id} value={p.id}>
                                      {p.name} [{p.id}] — ₹{Number(p.sellingPrice || p.price || 0).toLocaleString("en-IN")} | Stock: {pStock} {p.unit || 'units'}
                                    </option>
                                  );
                                })}
                              </select>
                            ) : (
                              <div style={{
                                padding: "6px 10px",
                                background: "rgba(239, 68, 68, 0.08)",
                                border: "1px solid rgba(239, 68, 68, 0.2)",
                                borderRadius: 6,
                                color: "#ef4444",
                                fontSize: "0.78rem",
                                fontWeight: 600
                              }}>
                                ⚠️ No products in catalogue. Add products first.
                              </div>
                            )}

                            {/* Linked Product Status & Stock Indicator */}
                            {selectedProd && (
                              <div style={{ fontSize: 11, marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ color: "var(--text-muted)" }}>
                                  Category: <b>{selectedProd.category || "General"}</b>
                                </span>
                                <span style={{
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  background: isOutOfStock ? "rgba(239, 68, 68, 0.12)" : isStockLow ? "rgba(245, 158, 11, 0.12)" : "rgba(16, 185, 129, 0.12)",
                                  color: isOutOfStock ? "#ef4444" : isStockLow ? "#d97706" : "#059669"
                                }}>
                                  {isOutOfStock ? "⚠️ Out of Stock (0)" : `✓ In Stock: ${availableStock} ${selectedProd.unit || 'units'}`}
                                </span>
                              </div>
                            )}

                            {rowErrs.description && (
                              <span style={{ fontSize: 10.5, color: "#ef4444", display: "block", marginTop: 2 }}>
                                {rowErrs.description}
                              </span>
                            )}
                          </td>

                          <td style={{ padding: "8px", verticalAlign: "top" }}>
                            <input
                              className="form-input"
                              style={{ height: 34, fontSize: "0.82rem", padding: "4px 8px", textAlign: "center" }}
                              value={it.hsn}
                              onChange={(e) => handleItemChange(idx, "hsn", e.target.value)}
                              placeholder="HSN"
                            />
                          </td>

                          <td style={{ padding: "8px", verticalAlign: "top" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <input
                                type="number"
                                min="1"
                                className={`form-input ${rowErrs.qty ? "is-invalid" : ""}`}
                                style={{ height: 34, fontSize: "0.82rem", padding: "4px 8px", textAlign: "center", width: "100%" }}
                                value={it.qty}
                                onChange={(e) => handleItemChange(idx, "qty", e.target.value)}
                                required
                              />
                            </div>
                            <span style={{ fontSize: 10, color: "var(--text-muted)", display: "block", textAlign: "center", marginTop: 2 }}>
                              {it.unit || "Nos"}
                            </span>
                            {rowErrs.qty && (
                              <span style={{ fontSize: 10.5, color: "#ef4444", display: "block", marginTop: 2 }}>
                                {rowErrs.qty}
                              </span>
                            )}
                          </td>

                          <td style={{ padding: "8px", verticalAlign: "top" }}>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              className={`form-input ${rowErrs.rate ? "is-invalid" : ""}`}
                              style={{ height: 34, fontSize: "0.82rem", padding: "4px 8px", textAlign: "right" }}
                              value={it.rate}
                              onChange={(e) => handleItemChange(idx, "rate", e.target.value)}
                              required
                            />
                            {rowErrs.rate && (
                              <span style={{ fontSize: 10.5, color: "#ef4444", display: "block", marginTop: 2 }}>
                                {rowErrs.rate}
                              </span>
                            )}
                          </td>

                          <td style={{ padding: "8px", verticalAlign: "top" }}>
                            <select
                              className="form-select"
                              style={{ height: 34, fontSize: "0.82rem", padding: "2px 4px", textAlign: "center" }}
                              value={it.gstRate !== undefined && it.gstRate !== null ? it.gstRate : 0}
                              onChange={(e) => handleItemChange(idx, "gstRate", e.target.value)}
                            >
                              <option value="0">0%</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                            </select>
                          </td>

                          <td style={{ padding: "8px", textAlign: "right", fontWeight: 700, verticalAlign: "top", paddingTop: 14 }}>
                            ₹{(Number(it.taxable) || 0).toLocaleString("en-IN")}
                          </td>

                          <td style={{ padding: "8px", textAlign: "center", verticalAlign: "top", paddingTop: 10 }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="icon-btn"
                              style={{ color: "var(--danger)", padding: 6, borderRadius: 6, background: "rgba(239, 68, 68, 0.08)" }}
                              title="Remove line item"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                className="outline"
                onClick={handleAddItem}
                style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.82rem", padding: "6px 14px" }}
              >
                <Plus size={14} /> Add Another Product
              </button>
            </div>

            {/* Financial Summary Card */}
            <div style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "16px 20px"
            }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Taxable Subtotal:</span>
                  <strong style={{ fontSize: "1.05rem", color: "var(--text-main)" }}>
                    ₹{taxableAmount.toLocaleString("en-IN")}
                  </strong>
                </div>

                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>CGST + SGST (9% + 9%):</span>
                  <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-main)" }}>
                    ₹{cgst.toLocaleString("en-IN")} + ₹{sgst.toLocaleString("en-IN")}
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Total GST Tax:</span>
                  <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-main)" }}>
                    ₹{gstTax.toLocaleString("en-IN")}
                  </span>
                </div>

                <div style={{ borderLeft: "2px solid var(--primary)", paddingLeft: 12 }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: 700, display: "block", textTransform: "uppercase" }}>
                    Grand Net Invoice:
                  </span>
                  <strong style={{ fontSize: "1.25rem", color: "var(--primary)", fontWeight: 800 }}>
                    ₹{grandTotal.toLocaleString("en-IN")}
                  </strong>
                </div>

                <div style={{ borderLeft: "2px solid #10b981", paddingLeft: 12 }}>
                  <span style={{ fontSize: "0.75rem", color: "#059669", fontWeight: 700, display: "block", textTransform: "uppercase" }}>
                    Paid Today:
                  </span>
                  <strong style={{ fontSize: "1.1rem", color: "#059669", fontWeight: 800 }}>
                    ₹{actualPaid.toLocaleString("en-IN")}
                  </strong>
                </div>

                <div style={{ borderLeft: "2px solid #ef4444", paddingLeft: 12 }}>
                  <span style={{ fontSize: "0.75rem", color: balanceDue > 0 ? "#dc2626" : "#059669", fontWeight: 700, display: "block", textTransform: "uppercase" }}>
                    Balance Due:
                  </span>
                  <strong style={{ fontSize: "1.1rem", color: balanceDue > 0 ? "#dc2626" : "#059669", fontWeight: 800 }}>
                    ₹{balanceDue.toLocaleString("en-IN")}
                  </strong>
                </div>
              </div>

              {balanceDue > 0 && selectedClient && (
                <div style={{
                  marginTop: 12,
                  paddingTop: 10,
                  borderTop: "1px dashed var(--border)",
                  fontSize: "0.8rem",
                  color: "var(--text-muted)"
                }}>
                  ℹ️ <b>₹{balanceDue.toLocaleString("en-IN")}</b> will be added to <b>{selectedClient.name}</b>'s commercial ledger balance (New total outstanding: ₹{(clientOutstanding + balanceDue).toLocaleString("en-IN")}).
                </div>
              )}

              {errors.total && <FieldError error={errors.total} />}
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
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                className="primary"
                onClick={handleDownloadPDF}
                title="Generate branded GST Tax Invoice PDF and save directly to your PC"
                style={{
                  background: "#005bb5",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  fontSize: "0.85rem",
                  fontWeight: 600
                }}
              >
                <Download size={15} /> Download PDF to PC
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button type="button" className="outline" onClick={onClose} style={{ fontSize: "0.85rem" }}>
                Cancel
              </button>
              <button type="submit" className="primary" style={{ fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Save size={15} /> {editInvoice ? "Update Invoice" : "Save & Issue Invoice"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
