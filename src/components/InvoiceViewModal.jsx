import React from "react";
import {
  X, Download, Receipt, ShieldCheck, Edit3
} from "lucide-react";
import { generateInvoicePDF, numberToWordsINR } from "../services/pdfService";

export default function InvoiceViewModal({
  isOpen,
  onClose,
  invoice,
  company = {},
  client = null,
  onDelete,
  onEdit,
  showToast
}) {
  if (!isOpen || !invoice) return null;

  const companyInfo = {
    name: company.name || "Laxmi Enterprises",
    tagline: company.tagline || "Industrial Supplies, Hardware & Trading",
    gstin: company.gstin || "27AAACL1234F1Z5",
    pan: company.pan || "AAACL1234F",
    phone: company.phone || "+91 98765 43210",
    email: company.email || "contact@laxmienterprises.com",
    address: company.address || "Shop No. 12, Commercial Complex, Near Industrial Estate, Pune - 411038, Maharashtra, India"
  };

  const amount = Number(invoice.amount) || 0;
  const tax = Number(invoice.tax) || Math.round(amount * 0.18);
  const total = Number(invoice.total) || (amount + tax);
  const cgst = Math.round(tax / 2);
  const sgst = tax - cgst;

  const handleDownloadPDF = () => {
    try {
      const { fileName } = generateInvoicePDF(invoice, companyInfo, client || {});
      if (showToast) showToast(`✓ Downloaded ${fileName} to your PC`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      if (showToast) showToast("⚠️ Failed to generate PDF: " + err.message);
    }
  };

  const statusClass = (invoice.status || "Paid").toLowerCase();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card invoice-preview-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 840, width: "95vw", maxHeight: "92vh", display: "flex", flexDirection: "column" }}
      >
        {/* ── MODAL HEADER — title + close only ── */}
        <div className="modal-header" style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="mini-avatar" style={{ background: "rgba(0, 91, 181, 0.12)", color: "var(--primary)" }}>
              <Receipt size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, margin: 0, color: "var(--text-main)" }}>
                Tax Invoice: <span style={{ color: "var(--primary)" }}>{invoice.id}</span>
              </h3>
              <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                GST Tax Invoice Preview • Ready for PDF Download
              </span>
            </div>
          </div>

          {/* Close only — no duplicate download button */}
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close invoice viewer"
          >
            <X size={17} />
          </button>
        </div>

        {/* ── PRINTABLE INVOICE PAPER BODY ── */}
        <div className="modal-body" style={{ overflowY: "auto", padding: 24, background: "#f8fafc" }}>
          <div
            className="invoice-paper"
            id="printable-invoice"
            style={{
              background: "#ffffff",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
              padding: 32,
              color: "#0f172a",
              fontFamily: "Inter, -apple-system, sans-serif"
            }}
          >
            {/* Top Brand Stripe */}
            <div
              style={{
                height: 6,
                background: "linear-gradient(90deg, #005bb5 0%, #00b4d8 100%)",
                borderRadius: "4px 4px 0 0",
                margin: "-32px -32px 24px -32px"
              }}
            />

            {/* Header: Company & Invoice Info */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, borderBottom: "1px solid #e2e8f0", paddingBottom: 20 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <img
                    src="/logo.png"
                    alt="Laxmi Enterprises"
                    style={{ height: 42, width: "auto", objectFit: "contain" }}
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                  <div>
                    <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "#002b5c", letterSpacing: "-0.02em" }}>
                      {companyInfo.name}
                    </h2>
                    <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {companyInfo.tagline}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 10, lineHeight: 1.5, maxWidth: 380 }}>
                  {companyInfo.address}
                </div>
                <div style={{ fontSize: 12, color: "#1e293b", marginTop: 6, display: "flex", gap: 16, flexWrap: "wrap", fontWeight: 600 }}>
                  <span>GSTIN: <strong style={{ color: "#005bb5" }}>{companyInfo.gstin}</strong></span>
                  <span>PAN: <strong>{companyInfo.pan}</strong></span>
                </div>
                <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 4 }}>
                  <span>Tel: {companyInfo.phone}</span> • <span>Email: {companyInfo.email}</span>
                </div>
              </div>

              {/* Right Side: Tax Invoice badge */}
              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    display: "inline-block",
                    background: "rgba(0, 91, 181, 0.08)",
                    color: "#005bb5",
                    padding: "4px 14px",
                    borderRadius: 6,
                    fontWeight: 800,
                    fontSize: 16,
                    letterSpacing: "0.04em",
                    border: "1px solid rgba(0, 91, 181, 0.2)"
                  }}
                >
                  TAX INVOICE
                </span>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                  Original for Recipient
                </div>

                <div
                  style={{
                    marginTop: 14,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    padding: "10px 14px",
                    textAlign: "right",
                    minWidth: 200
                  }}
                >
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    Invoice #: <strong style={{ color: "#005bb5", fontSize: 13 }}>{invoice.id}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                    Date: <strong>{invoice.date}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                    Due Date: <strong>{invoice.dueDate || "-"}</strong>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <span
                      className={`badge ${statusClass === "paid" ? "paid" : statusClass === "pending" ? "pending-payment" : "overdue"}`}
                      style={{ fontSize: 11, padding: "3px 10px" }}
                    >
                      {invoice.status || "Paid"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Billed By & Billed To Split Cards */}
            <div className="responsive-two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, margin: "20px 0" }}>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: 14 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#005bb5", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                  Billed By (Supplier)
                </div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{companyInfo.name}</div>
                <div style={{ fontSize: 11.5, color: "#475569", marginTop: 4 }}>Industrial Estate, Pune - 411038</div>
                <div style={{ fontSize: 11.5, color: "#475569", marginTop: 2 }}>State: Maharashtra (State Code: 27)</div>
                <div style={{ fontSize: 11.5, color: "#475569", marginTop: 2 }}>Place of Supply: Maharashtra (27)</div>
              </div>

              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: 14 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#002b5c", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                  Billed To (Customer / Recipient)
                </div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{invoice.clientName}</div>
                <div style={{ fontSize: 11.5, color: "#475569", marginTop: 4 }}>
                  Account ID: <strong>{invoice.clientId || "CL-001"}</strong>
                </div>
                <div style={{ fontSize: 11.5, color: "#475569", marginTop: 2 }}>
                  GSTIN: {client?.gstin || "27AABCS1429B1Z2 (Registered)"}
                </div>
                <div style={{ fontSize: 11.5, color: "#475569", marginTop: 2 }}>
                  Payment Method: <strong>{invoice.paymentMethod || "NEFT / RTGS"}</strong>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10, minWidth: 620 }}>
                <thead>
                  <tr style={{ background: "#005bb5", color: "#ffffff", fontSize: 12 }}>
                    <th style={{ padding: "10px 12px", textAlign: "center", width: 40 }}>#</th>
                    <th style={{ padding: "10px 12px", textAlign: "left" }}>Item Description & Particulars</th>
                    <th style={{ padding: "10px 12px", textAlign: "center", width: 110 }}>HSN / SAC</th>
                    <th style={{ padding: "10px 12px", textAlign: "center", width: 90 }}>Qty & Unit</th>
                    <th style={{ padding: "10px 12px", textAlign: "right", width: 100 }}>Rate (₹)</th>
                    <th style={{ padding: "10px 12px", textAlign: "center", width: 70 }}>GST %</th>
                    <th style={{ padding: "10px 12px", textAlign: "right", width: 110 }}>Taxable (₹)</th>
                    <th style={{ padding: "10px 12px", textAlign: "right", width: 110 }}>Total (₹)</th>
                  </tr>
                </thead>
                <tbody style={{ fontSize: 12 }}>
                  {Array.isArray(invoice.items) && invoice.items.length > 0 ? (
                    invoice.items.map((it, idx) => {
                      const itemTaxable = Number(it.taxable) || (Number(it.qty || 1) * Number(it.rate || 0));
                      const itemGst = Number(it.gstRate || 18);
                      const itemTax = Math.round(itemTaxable * (itemGst / 100));
                      const itemTotal = Number(it.total) || (itemTaxable + itemTax);
                      return (
                        <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "10px 12px", textAlign: "center", color: "#64748b" }}>{idx + 1}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <div style={{ fontWeight: 700, color: "#0f172a" }}>
                              {it.description || it.name || "Industrial Supplies Item"}
                            </div>
                            {it.productId && (
                              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                                Catalog Code: {it.productId}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "center", fontFamily: "monospace", color: "#475569" }}>
                            {it.hsn || "7306 / 8481"}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600 }}>
                            {it.qty || 1} {it.unit || "Nos"}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right" }}>
                            ₹{Number(it.rate || 0).toLocaleString("en-IN")}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "center", color: "#64748b" }}>{itemGst}%</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>
                            ₹{itemTaxable.toLocaleString("en-IN")}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#005bb5" }}>
                            ₹{itemTotal.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "12px", textAlign: "center", color: "#64748b" }}>1</td>
                      <td style={{ padding: "12px" }}>
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>
                          {invoice.category || "Industrial Hardware"} Supplies Lot
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                          Commercial supply order as per agreed technical specification & delivery challan
                        </div>
                      </td>
                      <td style={{ padding: "12px", textAlign: "center", fontFamily: "monospace", color: "#475569" }}>8481 / 7318</td>
                      <td style={{ padding: "12px", textAlign: "center" }}>1 Lot</td>
                      <td style={{ padding: "12px", textAlign: "right" }}>₹{amount.toLocaleString("en-IN")}</td>
                      <td style={{ padding: "12px", textAlign: "center", color: "#64748b" }}>18% GST</td>
                      <td style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>₹{amount.toLocaleString("en-IN")}</td>
                      <td style={{ padding: "12px", textAlign: "right", fontWeight: 800, color: "#005bb5" }}>₹{total.toLocaleString("en-IN")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Calculations & Bank Details Split */}
            <div className="responsive-two-col" style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 20, marginTop: 20 }}>
              <div>
                <div style={{ background: "#f1f5f9", padding: "10px 14px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "#005bb5", textTransform: "uppercase" }}>
                    Invoice Amount in Words:
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", marginTop: 3, fontStyle: "italic" }}>
                    {numberToWordsINR(total)}
                  </div>
                </div>

                <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 6, border: "1px solid #e2e8f0", marginTop: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#002b5c", marginBottom: 6 }}>
                    Bank Remittance Account Details (NEFT / RTGS / IMPS)
                  </div>
                  <div style={{ fontSize: 11.5, color: "#334155", lineHeight: 1.6 }}>
                    <div>Bank Name: <strong>State Bank of India (SBI)</strong></div>
                    <div>Account Name: <strong>Laxmi Enterprises Commercial</strong></div>
                    <div>Account Number: <strong style={{ fontFamily: "monospace" }}>398201554902</strong></div>
                    <div>IFSC Code: <strong style={{ fontFamily: "monospace" }}>SBIN0001245</strong> • Branch: Pune Industrial</div>
                  </div>
                </div>
              </div>

              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#475569", marginBottom: 6 }}>
                  <span>Taxable Subtotal:</span>
                  <span style={{ fontWeight: 600 }}>₹{amount.toLocaleString("en-IN")}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#475569", marginBottom: 6 }}>
                  <span>CGST @ 9%:</span>
                  <span>₹{cgst.toLocaleString("en-IN")}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#475569", marginBottom: 6 }}>
                  <span>SGST @ 9%:</span>
                  <span>₹{sgst.toLocaleString("en-IN")}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#475569", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #cbd5e1" }}>
                  <span>Total Tax (GST 18%):</span>
                  <span style={{ fontWeight: 700 }}>₹{tax.toLocaleString("en-IN")}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 14,
                    color: "#ffffff",
                    background: "#005bb5",
                    padding: "8px 12px",
                    borderRadius: 6,
                    fontWeight: 800
                  }}
                >
                  <span>Grand Total (INR):</span>
                  <span>₹{total.toLocaleString("en-IN")}</span>
                </div>

                {invoice.paidAmount !== undefined && (
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#059669", marginBottom: 4 }}>
                      <span>Amount Received / Paid:</span>
                      <span style={{ fontWeight: 700 }}>₹{Number(invoice.paidAmount || 0).toLocaleString("en-IN")}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: (Number(invoice.balanceDue) || 0) > 0 ? "#dc2626" : "#059669" }}>
                      <span>Remaining Balance Due:</span>
                      <span style={{ fontWeight: 800 }}>₹{(Number(invoice.balanceDue) || 0).toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Terms and Signatory */}
            <div className="responsive-two-col" style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 20, marginTop: 24, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 10.5, color: "#64748b", lineHeight: 1.5 }}>
                <strong style={{ color: "#334155" }}>Terms & Conditions:</strong>
                <div>1. Goods once inspected cannot be returned without prior authorization.</div>
                <div>2. Payment is due within agreed terms. Delayed payments attract interest @ 18% p.a.</div>
                <div>3. All disputes subject to Pune, Maharashtra jurisdiction.</div>
              </div>

              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#002b5c" }}>
                  For {companyInfo.name}
                </div>
                <div
                  style={{
                    height: 48,
                    border: "1px dashed #cbd5e1",
                    borderRadius: 4,
                    margin: "8px auto",
                    maxWidth: 200,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    color: "#94a3b8",
                    fontStyle: "italic"
                  }}
                >
                  [ Digitally Verified Seal ]
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#0f172a" }}>
                  Authorized Signatory
                </div>
              </div>
            </div>

            <div style={{ textAlign: "center", fontSize: 10, color: "#94a3b8", marginTop: 20, paddingTop: 10, borderTop: "1px solid #f1f5f9" }}>
              Computer generated Tax Invoice issued by Laxmi Enterprises ERP Portal • Valid for Input Tax Credit (ITC)
            </div>
          </div>
        </div>

        {/* ── MODAL FOOTER ── */}
        <div
          className="modal-footer"
          style={{
            padding: "12px 20px",
            background: "var(--card-bg)",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10
          }}
        >
          {/* Left: verified badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "12px", color: "var(--text-muted)" }}>
            <ShieldCheck size={16} color="#10b981" />
            <span>Verified Tax Invoice</span>
          </div>

          {/* Right: Edit Invoice | Download PDF */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              className="outline"
              onClick={() => {
                if (onEdit) onEdit(invoice);
                onClose();
              }}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
              title="Edit this invoice"
            >
              <Edit3 size={14} />
              <span>Edit Invoice</span>
            </button>

            <button
              type="button"
              className="primary"
              onClick={handleDownloadPDF}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Download size={15} />
              <span>Download PDF</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
