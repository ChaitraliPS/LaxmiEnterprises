import React, { useState, useEffect, useRef } from "react";
import {
  Milk, Tractor, Wheat, X, Save, AlertTriangle, Building2, Phone, Mail,
  Calendar, Building, Tag, Users, CreditCard
} from "lucide-react";
import {
  validateMobile,
  validateEmail,
  validateGSTIN,
  validatePAN,
  validateRequiredText,
  validateDate,
  validateUniqueId,
  validateNonNegativeNumber,
  validatePositiveNumber
} from "../utils/validators";
import { FieldError, RequiredStar, ValidationSummary } from "./ValidationFeedback";

export default function ClientModal({ isOpen, onClose, onSave, clientToEdit, nextId, existingIds = [] }) {
  if (!isOpen) return null;
  const isEditing = !!clientToEdit;
  const modalBodyRef = useRef(null);

  const [form, setForm] = useState(() => {
    if (clientToEdit) {
      return { 
        ...clientToEdit,
        clientType: clientToEdit.clientType === "Animal Feed Shop" ? "Feed Shop" : clientToEdit.clientType === "Farmers" ? "Farmer" : (clientToEdit.clientType || "Feed Shop"),
        village: clientToEdit.village || "",
        taluka: clientToEdit.taluka || "",
        district: clientToEdit.district || clientToEdit.city || "",
        contactPerson: clientToEdit.contactPerson || "",
        contact: clientToEdit.contact || "",
        email: clientToEdit.email || "",
        dob: clientToEdit.dob || "",
        productTypes: clientToEdit.productTypes || "",
        companies: clientToEdit.companies || "",
        brands: clientToEdit.brands || "",
        numberOfSuppliers: clientToEdit.numberOfSuppliers || "",
        milkQuantity: clientToEdit.milkQuantity || "",
        numberOfAnimals: clientToEdit.numberOfAnimals || "",
        animalDetails: clientToEdit.animalDetails || "",
        gstin: clientToEdit.gstin || "",
        tier: clientToEdit.tier || "Gold",
        paymentTerms: clientToEdit.paymentTerms || "Net 30",
        outstanding: clientToEdit.outstanding !== undefined ? clientToEdit.outstanding : 0,
        orders: clientToEdit.orders || 0,
        revenue: clientToEdit.revenue || 0,
        status: clientToEdit.status || "Active",
        city: clientToEdit.city || ""
      };
    }
    return {
      id: nextId,
      clientType: "Feed Shop",
      name: "",
      village: "",
      taluka: "",
      district: "",
      contact: "",
      email: "",
      dob: "",
      contactPerson: "",
      productTypes: "",
      companies: "",
      brands: "",
      numberOfSuppliers: "",
      milkQuantity: "",
      numberOfAnimals: "",
      animalDetails: "",
      city: "",
      gstin: "",
      tier: "Gold",
      paymentTerms: "Net 30",
      outstanding: 0,
      orders: 0,
      revenue: 0,
      status: "Active"
    };
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFieldChange = (field, val) => {
    setForm(prev => ({ ...prev, [field]: val }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const errs = {};

    // ID validation
    const idVal = validateUniqueId(form.id || nextId, existingIds, isEditing ? clientToEdit.id : null, "Client Reference ID");
    if (!idVal.isValid) errs.id = idVal.error;

    // Optional phone validation (only if entered)
    if (form.contact && form.contact.trim()) {
      const phoneVal = validateMobile(form.contact, false);
      if (!phoneVal.isValid) errs.contact = phoneVal.error;
    }

    // Optional email validation
    if (form.email && form.email.trim()) {
      const emailVal = validateEmail(form.email, false);
      if (!emailVal.isValid) errs.email = emailVal.error;
    }

    // Optional DOB validation
    if (form.dob && form.dob.trim()) {
      const dobVal = validateDate(form.dob, "Date of Birth", { isRequired: false });
      if (!dobVal.isValid) errs.dob = dobVal.error;
    }

    // Optional GSTIN validation
    if (form.gstin && form.gstin.trim()) {
      const gstinVal = validateGSTIN(form.gstin, false);
      if (!gstinVal.isValid) errs.gstin = gstinVal.error;
    }

    // Financial balances
    if (form.outstanding) {
      const outVal = validateNonNegativeNumber(form.outstanding, "Outstanding Balance");
      if (!outVal.isValid) errs.outstanding = outVal.error;
    }
    if (form.orders) {
      const ordVal = validateNonNegativeNumber(form.orders, "Total Completed Orders");
      if (!ordVal.isValid) errs.orders = ordVal.error;
    }
    if (form.revenue) {
      const revVal = validateNonNegativeNumber(form.revenue, "Cumulative Invoiced Revenue");
      if (!revVal.isValid) errs.revenue = revVal.error;
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isSubmitting) return;

    if (!validateForm()) {
      if (modalBodyRef.current) {
        modalBodyRef.current.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }

    setIsSubmitting(true);

    const clientCategory = form.clientType || "Animal Feed Shop";
    const clientId = form.id || nextId;
    const fallbackName = `${clientCategory} Account (${clientId})`;
    const finalName = form.name && form.name.trim().length > 0 ? form.name.trim() : fallbackName;

    const finalForm = {
      ...form,
      id: clientId,
      name: finalName,
      city: (form.city && form.city.trim()) || (form.district && form.district.trim()) || "Maharashtra",
      outstanding: Number(form.outstanding || 0),
      orders: Number(form.orders || 0),
      revenue: Number(form.revenue || 0)
    };

    try {
      onSave(finalForm);
    } catch (err) {
      console.error("Save client error:", err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 740, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="modal-header">
          <h3>
            <Users size={19} style={{ color: "var(--primary)" }} />
            {isEditing ? `Edit Client: ${clientToEdit.name}` : "Add New Client Account"}
          </h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={17} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
          <div className="modal-body" ref={modalBodyRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 20px" }}>
            
            <ValidationSummary errors={errors} title="Please resolve the following client errors:" />

            {/* Step 1: Sleek Category Selector Tabs */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 800, marginBottom: 6, display: "block", color: "var(--text-main)" }}>
                Select Client Category / Type <RequiredStar />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {[
                  { type: "Feed Shop", label: "Feed Shop", sub: "पशूखाद्य दुकान", icon: Wheat, color: "#059669", bg: "rgba(16, 185, 129, 0.12)" },
                  { type: "Dairy", label: "Dairy", sub: "दूध डेअरी", icon: Milk, color: "#0284c7", bg: "rgba(2, 132, 199, 0.12)" },
                  { type: "Farmer", label: "Farmer", sub: "शेतकरी", icon: Tractor, color: "#d97706", bg: "rgba(217, 119, 6, 0.12)" },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = form.clientType === item.type;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => handleFieldChange("clientType", item.type)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "9px 6px",
                        borderRadius: 10,
                        border: isSelected ? `2px solid ${item.color}` : "1.5px solid var(--border)",
                        background: isSelected ? item.bg : "var(--card-bg)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        textAlign: "center"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 5, color: isSelected ? item.color : "var(--text-main)", fontWeight: 700, fontSize: 13 }}>
                        <Icon size={16} />
                        <span>{item.label}</span>
                      </div>
                      <span style={{ fontSize: 11, color: isSelected ? item.color : "var(--text-muted)", marginTop: 2 }}>{item.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Common Information */}
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--primary)", borderBottom: "1.5px solid var(--border)", paddingBottom: 6, marginBottom: 12, display: "flex", alignItems: "center", gap: 7 }}>
                <Building2 size={15} /> Common Information
              </div>

              <div className="form-grid">
                {/* Client Name is the prominent #1 field right at top */}
                <div className="form-group full">
                  <label style={{ fontSize: 13, fontWeight: 700 }}>
                    {form.clientType === "Farmers" ? "Farmer Full Name (शेतकऱ्याचे नाव)" :
                     form.clientType === "Dairy" ? "Dairy / Cooperative Sanstha Name (डेअरी नाव)" :
                     "Animal Feed Store / Firm Name (दुकानाचे नाव)"} <RequiredStar />
                  </label>
                  <input
                    className={`form-input ${errors.name ? "is-invalid" : ""}`}
                    placeholder={
                      form.clientType === "Farmers" ? "e.g. Tukaram Ramchandra Patil" :
                      form.clientType === "Dairy" ? "e.g. Gokul Dudh Utpadak Sahakari Dairy" :
                      "e.g. Shree Samarth Animal Feed & Agro Traders"
                    }
                    value={form.name}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                    autoFocus
                  />
                  <FieldError error={errors.name} />
                  <span className="form-help">Client legal or trade name (auto-assigned if left blank)</span>
                </div>

                <div className="form-group">
                  <label>Client Reference ID <RequiredStar /></label>
                  <input
                    className={`form-input ${errors.id ? "is-invalid" : ""}`}
                    value={form.id}
                    onChange={(e) => handleFieldChange("id", e.target.value)}
                  />
                  <FieldError error={errors.id} />
                  <span className="form-help">Unique ledger code</span>
                </div>

                <div className="form-group">
                  <label>Account Status</label>
                  <select
                    className="form-select"
                    value={form.status}
                    onChange={(e) => handleFieldChange("status", e.target.value)}
                  >
                    <option value="Active">Active Account</option>
                    <option value="Inactive">Inactive / Suspended</option>
                  </select>
                  <span className="form-help">Relationship state</span>
                </div>

                <div className="form-group">
                  <label>Village (गाव)</label>
                  <input
                    className={`form-input ${errors.village ? "is-invalid" : ""}`}
                    placeholder="e.g. Baramati Rural, Kasaba Bawada"
                    value={form.village}
                    onChange={(e) => handleFieldChange("village", e.target.value)}
                  />
                  <FieldError error={errors.village} />
                </div>

                <div className="form-group">
                  <label>Taluka (तालुका)</label>
                  <input
                    className={`form-input ${errors.taluka ? "is-invalid" : ""}`}
                    placeholder="e.g. Baramati, Karveer, Haveli"
                    value={form.taluka}
                    onChange={(e) => handleFieldChange("taluka", e.target.value)}
                  />
                  <FieldError error={errors.taluka} />
                </div>

                <div className="form-group">
                  <label>District (जिल्हा)</label>
                  <input
                    className={`form-input ${errors.district ? "is-invalid" : ""}`}
                    placeholder="e.g. Pune, Kolhapur, Satara, Sangli"
                    value={form.district}
                    onChange={(e) => handleFieldChange("district", e.target.value)}
                  />
                  <FieldError error={errors.district} />
                </div>

                <div className="form-group">
                  <label>Contact Phone Number</label>
                  <input
                    type="tel"
                    className={`form-input ${errors.contact ? "is-invalid" : ""}`}
                    placeholder="e.g. 9822456789"
                    value={form.contact}
                    onChange={(e) => handleFieldChange("contact", e.target.value)}
                  />
                  <FieldError error={errors.contact} />
                  <span className="form-help">10-digit Indian mobile number</span>
                </div>

                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    className={`form-input ${errors.email ? "is-invalid" : ""}`}
                    placeholder="e.g. client@gmail.com"
                    value={form.email}
                    onChange={(e) => handleFieldChange("email", e.target.value)}
                  />
                  <FieldError error={errors.email} />
                </div>

                <div className="form-group">
                  <label>Date of Birth (DOB)</label>
                  <input
                    type="date"
                    className={`form-input ${errors.dob ? "is-invalid" : ""}`}
                    value={form.dob}
                    onChange={(e) => handleFieldChange("dob", e.target.value)}
                  />
                  <FieldError error={errors.dob} />
                  <span className="form-help">Birth date for record & loyalty verification</span>
                </div>

                <div className="form-group">
                  <label>Contact Person / Proprietor</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Dattatray Shinde, Suresh Patel"
                    value={form.contactPerson}
                    onChange={(e) => handleFieldChange("contactPerson", e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>GSTIN / Tax Identifier (Optional)</label>
                  <input
                    className={`form-input ${errors.gstin ? "is-invalid" : ""}`}
                    placeholder="e.g. 27AABCS1429B1Z2"
                    value={form.gstin}
                    onChange={(e) => handleFieldChange("gstin", e.target.value.toUpperCase())}
                  />
                  <FieldError error={errors.gstin} />
                  <span className="form-help">15-character Indian GST format</span>
                </div>
              </div>
            </div>

            {/* Step 3: Specific Information Section */}
            <div className="specific-form-section" style={{
              borderLeft: form.clientType === "Dairy" ? "4px solid #0284c7" :
                          form.clientType === "Farmers" ? "4px solid #d97706" :
                          "4px solid #059669"
            }}>
              <div className="specific-form-section-header">
                {form.clientType === "Dairy" ? <Milk size={17} style={{ color: "#0284c7" }} /> :
                 form.clientType === "Farmers" ? <Tractor size={17} style={{ color: "#d97706" }} /> :
                 <Wheat size={17} style={{ color: "#059669" }} />}
                <span>
                  {form.clientType === "Dairy" ? "Dairy Specific Details" :
                   form.clientType === "Farmers" ? "Farmers Specific Details" :
                   "Animal Feed Shop Specific Details"}
                </span>
              </div>

              {/* Specific fields for Animal Feed Shop */}
              {(form.clientType === "Feed Shop" || form.clientType === "Animal Feed Shop") && (
                <div className="form-grid">
                  <div className="form-group full">
                    <label>Types of Products Sold</label>
                    <input
                      className={`form-input ${errors.productTypes ? "is-invalid" : ""}`}
                      placeholder="e.g. Cattle Feed, Calf Starter, Mineral Mixture, Calcium Supplement, Silage"
                      value={form.productTypes}
                      onChange={(e) => handleFieldChange("productTypes", e.target.value)}
                    />
                    <FieldError error={errors.productTypes} />
                    <span className="form-help">Comma-separated product categories and inventory types</span>
                  </div>

                  <div className="form-group">
                    <label>Companies Selling Products</label>
                    <input
                      className={`form-input ${errors.companies ? "is-invalid" : ""}`}
                      placeholder="e.g. Godrej Agrovet, Baramati Agro, Amul, Cargill India"
                      value={form.companies}
                      onChange={(e) => handleFieldChange("companies", e.target.value)}
                    />
                    <FieldError error={errors.companies} />
                    <span className="form-help">Distributor / Manufacturer parent companies</span>
                  </div>

                  <div className="form-group">
                    <label>Selling Product Brands</label>
                    <input
                      className={`form-input ${errors.brands ? "is-invalid" : ""}`}
                      placeholder="e.g. Godrej MilkMore, Samruddhi Supreme, Kapila Gold, Amul Dan"
                      value={form.brands}
                      onChange={(e) => handleFieldChange("brands", e.target.value)}
                    />
                    <FieldError error={errors.brands} />
                    <span className="form-help">Major brand names stocked on shelves</span>
                  </div>

                  <div className="form-group full">
                    <label>No. Of Animals Covered / Serviced (Network)</label>
                    <input
                      className="form-input"
                      placeholder="e.g. 550+ Local Cattle Network or 500"
                      value={form.numberOfAnimals}
                      onChange={(e) => handleFieldChange("numberOfAnimals", e.target.value)}
                    />
                    <span className="form-help">Estimated number of dairy animals / livestock served by this feed shop</span>
                  </div>
                </div>
              )}

              {/* Specific fields for Dairy */}
              {form.clientType === "Dairy" && (
                <div className="form-grid">
                  <div className="form-group">
                    <label>Number of Suppliers (पुरवठादार शेतकरी) <RequiredStar /></label>
                    <input
                      type="number"
                      min="0"
                      className={`form-input ${errors.numberOfSuppliers ? "is-invalid" : ""}`}
                      placeholder="e.g. 92"
                      value={form.numberOfSuppliers}
                      onChange={(e) => handleFieldChange("numberOfSuppliers", e.target.value)}
                    />
                    <FieldError error={errors.numberOfSuppliers} />
                    <span className="form-help">Total farmers / suppliers delivering milk</span>
                  </div>

                  <div className="form-group">
                    <label>Quantity of Milk (दूध प्रमाण / लिटर) <RequiredStar /></label>
                    <input
                      className={`form-input ${errors.milkQuantity ? "is-invalid" : ""}`}
                      placeholder="e.g. 4,500 Liters / Day or 1,20,000 Liters / Month"
                      value={form.milkQuantity}
                      onChange={(e) => handleFieldChange("milkQuantity", e.target.value)}
                    />
                    <FieldError error={errors.milkQuantity} />
                    <span className="form-help">Milk collection volume per day or month</span>
                  </div>
                </div>
              )}

              {/* Specific fields for Farmers */}
              {(form.clientType === "Farmer" || form.clientType === "Farmers") && (
                <div className="form-grid">
                  <div className="form-group">
                    <label>No. Of Animals (जनावरांची संख्या) <RequiredStar /></label>
                    <input
                      className={`form-input ${errors.numberOfAnimals ? "is-invalid" : ""}`}
                      placeholder="e.g. 18 or 18 Animals"
                      value={form.numberOfAnimals}
                      onChange={(e) => handleFieldChange("numberOfAnimals", e.target.value)}
                    />
                    <FieldError error={errors.numberOfAnimals} />
                    <span className="form-help">Total cows, buffaloes, or cattle owned</span>
                  </div>

                  <div className="form-group">
                    <label>Animal Details & Breeds</label>
                    <input
                      className="form-input"
                      placeholder="e.g. 10 HF Crossbreed Cows, 5 Murrah Buffaloes, 3 Heifers"
                      value={form.animalDetails}
                      onChange={(e) => handleFieldChange("animalDetails", e.target.value)}
                    />
                    <span className="form-help">Livestock types, breeds, and count</span>
                  </div>
                </div>
              )}
            </div>

            {/* Step 4: Commercial & Account Details */}
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-muted)", borderBottom: "1.5px solid var(--border)", paddingBottom: 6, marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}>
                <CreditCard size={15} /> Commercial & Payment Terms
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Client Commercial Tier</label>
                  <select
                    className="form-select"
                    value={form.tier}
                    onChange={(e) => handleFieldChange("tier", e.target.value)}
                  >
                    <option value="Platinum">Platinum (High Volume)</option>
                    <option value="Gold">Gold (Preferred)</option>
                    <option value="Silver">Silver (Regular)</option>
                    <option value="Bronze">Bronze (Standard)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Payment Terms Agreement</label>
                  <select
                    className="form-select"
                    value={form.paymentTerms}
                    onChange={(e) => handleFieldChange("paymentTerms", e.target.value)}
                  >
                    <option value="Immediate">Immediate / Advance</option>
                    <option value="Net 15">Net 15 Days</option>
                    <option value="Net 30">Net 30 Days</option>
                    <option value="Net 45">Net 45 Days</option>
                    <option value="Net 60">Net 60 Days</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Opening / Ledger Balance (₹ INR)</label>
                  <input
                    type="number"
                    min="0"
                    className={`form-input ${errors.outstanding ? "is-invalid" : ""}`}
                    placeholder="0"
                    value={form.outstanding}
                    onChange={(e) => handleFieldChange("outstanding", Number(e.target.value) || 0)}
                  />
                  <FieldError error={errors.outstanding} />
                  <span className="form-help">Opening balance or ledger dues</span>
                </div>

                <div className="form-group">
                  <label>Total Completed Orders</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.orders}
                    readOnly
                    disabled
                    style={{ background: "var(--hover-bg, #f1f5f9)", cursor: "not-allowed" }}
                  />
                  <span className="form-help">Automatically computed from sales ledger</span>
                </div>

                <div className="form-group full">
                  <label>Cumulative Invoiced Revenue (₹ INR)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.revenue}
                    readOnly
                    disabled
                    style={{ background: "var(--hover-bg, #f1f5f9)", cursor: "not-allowed" }}
                  />
                  <span className="form-help">Automatically computed from sales ledger</span>
                </div>
              </div>
            </div>
          </div>

          <div
            className="modal-footer"
            style={{
              flexShrink: 0,
              padding: "14px 20px",
              background: "var(--card-bg)",
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              zIndex: 10
            }}
          >
            <div>
              {Object.keys(errors).length > 0 && (
                <div style={{ color: "var(--danger)", fontSize: "0.84rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  <AlertTriangle size={15} />
                  <span>{errors.name || errors.id || Object.values(errors)[0]}</span>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button
                type="submit"
                id="create-client-btn"
                className="primary"
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={{ cursor: isSubmitting ? "not-allowed" : "pointer", touchAction: "manipulation", minWidth: 160 }}
              >
                <Save size={15} /> {isSubmitting ? "Saving..." : (isEditing ? "Save Client Details" : "Create Client Account")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================================================
// DEDICATED EDITABLE CLIENTS DIRECTORY PAGE
// ==========================================================================
