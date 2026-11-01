import React, { useState, useMemo } from "react";
import {
  Receipt, Download, Plus, Search, X, Trash2,
  CheckCircle2, AlertTriangle, TrendingUp, IndianRupee, Clock,
  Eye, RefreshCw, Printer, ShieldCheck, Filter, ArrowUpRight, ChevronDown, FileText
} from "lucide-react";
import { generateInvoicePDF } from "../services/pdfService";
import { erpApi } from "../services/api";
import InvoiceViewModal from "./InvoiceViewModal";
import InvoiceModal from "./InvoiceModal";

export const formatDisplayDate = (dStr) => {
  if (!dStr) return "—";
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(dStr)) return dStr;
  const match = String(dStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [_, y, m, d] = match;
    return `${d}/${m}/${y}`;
  }
  const d = new Date(dStr);
  if (isNaN(d.getTime())) return dStr;
  const day = String(d.getDate()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const yr = d.getFullYear();
  return `${day}/${mo}/${yr}`;
};

export default function InvoicesPage({
  invoices = [],
  onSaveInvoices,
  onCreateInvoice,
  clients = [],
  products = [],
  company = {},
  showToast,
  onOpenCreateInvoice
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editInvoice, setEditInvoice] = useState(null);
  const [localToast, setLocalToast] = useState(null);
  const [reportDropdownOpen, setReportDropdownOpen] = useState(false);

  const nextInvoiceId = useMemo(() => {
    const ids = (invoices || [])
      .map(inv => {
        const match = inv.id.match(/\d+$/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter(n => !isNaN(n));
    const maxNum = ids.length ? Math.max(...ids) : 0;
    return `LE-INV-2026-${String(maxNum + 1).padStart(3, "0")}`;
  }, [invoices]);

  const handleAddInvoice = (newInv) => {
    if (editInvoice) {
      const updated = invoices.map(inv => (inv.id === newInv.id || inv.invoiceNumber === newInv.id ? newInv : inv));
      if (onSaveInvoices) onSaveInvoices(updated);
      notify(`? Updated invoice ${newInv.id}`);
    } else if (onCreateInvoice) {
      onCreateInvoice(newInv);
      notify(`? Created invoice ${newInv.id} for ${newInv.clientName}`);
    } else if (onSaveInvoices) {
      onSaveInvoices([newInv, ...invoices]);
      notify(`? Created invoice ${newInv.id} for ${newInv.clientName}`);
    }
    setIsCreateModalOpen(false);
    setEditInvoice(null);
  };

  const notify = (msg) => {
    if (showToast) {
      showToast(msg);
    } else {
      setLocalToast(msg);
      setTimeout(() => setLocalToast(null), 3000);
    }
  };

  // ── Download Report ──────────────────────────────────────────────────
  /**
   * Safely parse an invoice date.
   * Priority: inv.date (YYYY-MM-DD string) -> inv.createdAt -> null
   * Returns a Date object or null if unparseable.
   */
  const parseInvDate = (inv) => {
    const raw = inv.date || inv.createdAt || inv.invoiceDate || "";
    if (!raw) return null;
    // YYYY-MM-DD stored as UTC midnight — read parts directly to avoid TZ shift
    const isoMatch = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return new Date(
        parseInt(isoMatch[1], 10),
        parseInt(isoMatch[2], 10) - 1,
        parseInt(isoMatch[3], 10)
      );
    }
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  };

  const downloadReport = (period) => {
    const now = new Date();
    let filtered = [];
    let label = "";

    if (period === "monthly") {
      // Current calendar month
      const yr = now.getFullYear(), mo = now.getMonth();
      filtered = invoices.filter(inv => {
        const d = parseInvDate(inv);
        return d && d.getFullYear() === yr && d.getMonth() === mo;
      });
      label = `${now.toLocaleString("en-IN", { month: "long" })}_${yr}`;

    } else if (period === "quarterly") {
      // Indian Financial Year quarters: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
      const calMo = now.getMonth(); // 0-based
      // Shift to FY month (Apr=0 ... Mar=11)
      const fyMo = (calMo + 9) % 12;
      const q = Math.floor(fyMo / 3) + 1; // Q1..Q4
      // Calendar month ranges for each FY quarter
      const qRanges = {
        1: { months: [3, 4, 5], label: "Apr-Jun" },   // Q1
        2: { months: [6, 7, 8], label: "Jul-Sep" },   // Q2
        3: { months: [9, 10, 11], label: "Oct-Dec" },  // Q3
        4: { months: [0, 1, 2], label: "Jan-Mar" },   // Q4
      };
      const { months, label: qLabel } = qRanges[q];
      const fyYear = calMo >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const fyEnd = fyYear + 1;
      filtered = invoices.filter(inv => {
        const d = parseInvDate(inv);
        if (!d) return false;
        const dMo = d.getMonth();
        const dYr = d.getFullYear();
        if (!months.includes(dMo)) return false;
        // Q4 spans Jan-Mar of the next FY year
        if (q === 4) return dYr === fyEnd;
        return dYr === fyYear;
      });
      label = `Q${q}_FY${fyYear}-${String(fyEnd).slice(2)}_${qLabel}`;

    } else if (period === "yearly") {
      // Indian Financial Year: Apr 1 of fyYear -> Mar 31 of fyYear+1
      const calMo = now.getMonth();
      const fyYear = calMo >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const fyEnd = fyYear + 1;
      const fyStart = new Date(fyYear, 3, 1);   // Apr 1
      const fyEndDate = new Date(fyEnd, 2, 31);  // Mar 31
      filtered = invoices.filter(inv => {
        const d = parseInvDate(inv);
        return d && d >= fyStart && d <= fyEndDate;
      });
      label = `FY${fyYear}-${String(fyEnd).slice(2)}`;
    }

    setReportDropdownOpen(false);

    if (filtered.length === 0) {
      notify(`⚠️ No sales records found for the selected period (${label}).`);
      return;
    }

    // ── Build CSV ────────────────────────────────────────────────────────
    const headers = [
      "Invoice ID", "Client Name", "Invoice Date", "Due Date",
      "Category", "Payment Method",
      "Taxable Amt (INR)", "GST (INR)", "Grand Total (INR)",
      "Paid Amt (INR)", "Balance Due (INR)", "Status"
    ];

    const rows = filtered.map(inv => {
      const taxable = Number(inv.amount || inv.subtotal || 0);
      const gst = Number(inv.tax || (Number(inv.cgstTotal || 0) + Number(inv.sgstTotal || 0) + Number(inv.igstTotal || 0)) || Math.round(taxable * 0.18));
      const total = Number(inv.total || inv.grandTotal || 0);
      const paid = Number(inv.paidAmount || 0);
      const balance = Number(inv.balanceDue || Math.max(0, total - paid));
      return [
        inv.id || inv.invoiceNumber || "",
        inv.clientName || "",
        inv.date || inv.invoiceDate || "",
        inv.dueDate || "",
        (inv.category && !inv.category.toLowerCase().includes("hardware")) ? inv.category : "Animal Feed",
        inv.paymentMethod || inv.paymentMode || "NEFT",
        taxable.toFixed(2),
        gst.toFixed(2),
        total.toFixed(2),
        paid.toFixed(2),
        balance.toFixed(2),
        inv.status || inv.paymentStatus || ""
      ];
    });

    // ── Summary totals ───────────────────────────────────────────────────
    const sum = (key, idx) => filtered.reduce((s, inv) => s + Number(rows[filtered.indexOf(inv)][idx]), 0);
    const totTaxable = filtered.reduce((s, _, i) => s + parseFloat(rows[i][6]), 0);
    const totGST = filtered.reduce((s, _, i) => s + parseFloat(rows[i][7]), 0);
    const totTotal = filtered.reduce((s, _, i) => s + parseFloat(rows[i][8]), 0);
    const totPaid = filtered.reduce((s, _, i) => s + parseFloat(rows[i][9]), 0);
    const totBal = filtered.reduce((s, _, i) => s + parseFloat(rows[i][10]), 0);

    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;

    const csvContent = [
      esc(`Laxmi Enterprises - Sales Report (${label})`),
      esc(`Generated on: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`),
      esc(`Period: ${label}`) + `,` + esc(`Total Invoices: ${filtered.length}`),
      "",
      headers.map(esc).join(","),
      ...rows.map(r => r.map(esc).join(",")),
      "",
      [esc("TOTAL"), esc(""), esc(""), esc(""), esc(""), esc(""),
      esc(totTaxable.toFixed(2)), esc(totGST.toFixed(2)), esc(totTotal.toFixed(2)),
      esc(totPaid.toFixed(2)), esc(totBal.toFixed(2)), esc("")].join(",")
    ].join("\n");

    const BOM = "\uFEFF"; // UTF-8 BOM for Excel compatibility
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `LaxmiEnterprises_Sales_${label}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify(`✓ Sales report (${filtered.length} records) downloaded — ${label}`);
  };

  // High-Level Commercial KPIs
  const grossInvoiced = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + (Number(inv.total ?? inv.grandTotal ?? 0) || 0), 0);
  }, [invoices]);

  const realizedCollections = useMemo(() => {
    return invoices.reduce((sum, inv) => {
      const invTotal = Number(inv.total ?? inv.grandTotal ?? 0);
      if (inv.paidAmount !== undefined && inv.paidAmount !== null && inv.paidAmount !== "") {
        return sum + (Number(inv.paidAmount) || 0);
      }
      return sum + (inv.status === "Paid" ? invTotal : 0);
    }, 0);
  }, [invoices]);

  const pendingReceivables = useMemo(() => {
    return invoices.reduce((sum, inv) => {
      const invTotal = Number(inv.total ?? inv.grandTotal ?? 0);
      if (inv.balanceDue !== undefined && inv.balanceDue !== null && inv.balanceDue !== "") {
        return sum + (Number(inv.balanceDue) || 0);
      }
      return sum + (inv.status !== "Paid" ? invTotal : 0);
    }, 0);
  }, [invoices]);

  const overdueCount = useMemo(() => {
    return invoices.filter(inv => inv.status === "Overdue").length;
  }, [invoices]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchesStatus = statusFilter === "All" || inv.status === statusFilter;
      const q = search.toLowerCase().trim();
      const matchesSearch = !q || (
        inv.id.toLowerCase().includes(q) ||
        inv.clientName.toLowerCase().includes(q) ||
        (inv.clientId && inv.clientId.toLowerCase().includes(q)) ||
        (inv.category && inv.category.toLowerCase().includes(q)) ||
        (inv.paymentMethod && inv.paymentMethod.toLowerCase().includes(q))
      );
      return matchesStatus && matchesSearch;
    });
  }, [invoices, search, statusFilter]);

  // Handle single invoice PDF download directly to PC
  const handleDownloadPDF = (invoice) => {
    try {
      const client = clients.find(c => c.id === invoice.clientId || c.name === invoice.clientName);
      const { fileName } = generateInvoicePDF(invoice, company, client || {});
      notify(`✓ Downloaded ${fileName} to your PC`);
    } catch (err) {
      console.error("PDF download failed:", err);
      notify("⚠️ Failed to download PDF: " + err.message);
    }
  };


  // Toggle invoice status (Paid -> Pending -> Overdue -> Paid)
  const handleToggleStatus = (invoice) => {
    const order = ["Paid", "Pending", "Overdue"];
    const currentIdx = order.indexOf(invoice.status);
    const nextStatus = order[(currentIdx + 1) % order.length];
    const updated = invoices.map(inv => inv.id === invoice.id ? { ...inv, status: nextStatus } : inv);
    if (onSaveInvoices) onSaveInvoices(updated);
    notify(`✓ Updated ${invoice.id} status to ${nextStatus}`);
  };

  // Delete an invoice
  const handleDeleteInvoice = (id) => {
    if (window.confirm(`Are you sure you want to delete invoice ${id}?`)) {
      const updated = invoices.filter(inv => inv.id !== id && inv.invoiceNumber !== id && inv.invoiceNo !== id);
      if (onSaveInvoices) onSaveInvoices(updated);
      erpApi.deleteInvoice(id).catch(() => { });
      notify(`✓ Invoice ${id} deleted.`);
    }
  };

  return (
    <div className="page invoices-page">
      {localToast && (
        <div className="toast-notification">
          <CheckCircle2 size={18} style={{ color: "var(--success)" }} />
          <span>{localToast}</span>
        </div>
      )}

      {/* TOP HEADER & ACTION BUTTONS */}
      <div className="page-actions" style={{ alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 800, margin: 0, color: "var(--text-main)", letterSpacing: "-0.02em" }}>
            Commercial Tax Invoices & Billing Ledger
          </h2>
          <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: "3px 0 0 0" }}>
            Download GST tax invoice PDFs and manage digital billing directly
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {/* Add Sale Button */}
          <button
            type="button"
            className="primary"
            onClick={() => onOpenCreateInvoice ? onOpenCreateInvoice() : setIsCreateModalOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Plus size={16} />
            <span>Add Sale</span>
          </button>

          {/* Download Report Dropdown */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              className="outline"
              onClick={() => setReportDropdownOpen(o => !o)}
              style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}
            >
              <FileText size={15} />
              <span>Download Report</span>
              <ChevronDown size={14} style={{ marginLeft: 2, transition: "transform 0.2s", transform: reportDropdownOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
            </button>
            {reportDropdownOpen && (
              <>
                <div
                  onClick={() => setReportDropdownOpen(false)}
                  style={{ position: "fixed", inset: 0, zIndex: 99 }}
                />
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0,
                  background: "var(--card-bg)", border: "1px solid var(--border)",
                  borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                  zIndex: 100, minWidth: 190, overflow: "hidden"
                }}>
                  {[
                    { key: "monthly", label: "Monthly Report", sub: "Current month invoices" },
                    { key: "quarterly", label: "Quarterly Report", sub: "Current quarter invoices" },
                    { key: "yearly", label: "Yearly Report", sub: "Current financial year" },
                  ].map(({ key, label, sub }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => downloadReport(key)}
                      style={{
                        width: "100%", textAlign: "left", background: "none",
                        border: "none", padding: "11px 16px", cursor: "pointer",
                        display: "flex", flexDirection: "column", gap: 2,
                        borderBottom: key !== "yearly" ? "1px solid var(--border)" : "none"
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--hover-bg, rgba(0,91,181,0.06))"}
                      onMouseLeave={e => e.currentTarget.style.background = "none"}
                    >
                      <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 6 }}>
                        <Download size={13} style={{ color: "var(--primary)" }} />
                        {label}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", paddingLeft: 19 }}>{sub}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

      </div>

      {/* 4 PRIMARY METRIC CARDS */}
      <div className="stats-grid" style={{ marginBottom: 22 }}>
        <div className="stat-card">
          <div className="stat-top">
            <span>Gross Invoiced YTD</span>
            <div className="stat-icon" style={{ background: "rgba(0, 91, 181, 0.12)", color: "var(--primary)" }}>
              <IndianRupee size={19} />
            </div>
          </div>
          <div className="stat-value">₹{grossInvoiced.toLocaleString("en-IN")}</div>
          <div className="trend positive">
            <TrendingUp size={14} />
            <span>{invoices.length} Total Invoices</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Realized Collections</span>
            <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.12)", color: "#10b981" }}>
              <CheckCircle2 size={19} />
            </div>
          </div>
          <div className="stat-value">₹{realizedCollections.toLocaleString("en-IN")}</div>
          <div className="trend positive">
            <CheckCircle2 size={14} />
            <span>{invoices.filter(i => i.status === "Paid").length} Paid & Verified</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Pending Receivables</span>
            <div className="stat-icon" style={{ background: "rgba(245, 158, 11, 0.12)", color: "#f59e0b" }}>
              <Clock size={19} />
            </div>
          </div>
          <div className="stat-value">₹{pendingReceivables.toLocaleString("en-IN")}</div>
          <div className="trend negative">
            <Clock size={14} />
            <span>{invoices.filter(i => i.status === "Pending").length} In Clearance</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Overdue Invoices</span>
            <div className="stat-icon" style={{ background: "rgba(239, 68, 68, 0.12)", color: "#ef4444" }}>
              <AlertTriangle size={19} />
            </div>
          </div>
          <div className="stat-value">{overdueCount}</div>
          <div className="trend negative">
            <AlertTriangle size={14} />
            <span>Follow-up Required</span>
          </div>
        </div>
      </div>

      {/* INVOICE TABLE CARD */}
      <div className="card table-card">
        {/* Card Header & Status Filter Pills */}
        <div className="card-head" style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)" }}>
          <div>
            <h3>Tax Invoices Registry</h3>
            <p>1-Click instant PDF generation and printable invoices</p>
          </div>

          <div className="filter-pills-bar">
            {["All", "Paid", "Pending", "Overdue"].map(st => (
              <button
                key={st}
                className={`filter-pill ${statusFilter === st ? "active" : ""}`}
                onClick={() => setStatusFilter(st)}
              >
                {st} ({st === "All" ? invoices.length : invoices.filter(i => i.status === st).length})
              </button>
            ))}
          </div>
        </div>

        {/* Search & Counter Toolbar */}
        <div className="table-toolbar">
          <div className="local-search">
            <Search size={16} />
            <input
              placeholder="Search by invoice #, client name, account ID, category, payment mode..."
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
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>
              Showing {filteredInvoices.length} of {invoices.length} commercial tax invoices
            </span>
          </div>
        </div>

        {/* Invoices Table Body */}
        <div className="table-wrap">
          {filteredInvoices.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Receipt size={28} /></div>
              <h4 style={{ fontSize: 16, color: "var(--text-main)", marginBottom: 6 }}>No Invoices Found</h4>
              <p style={{ fontSize: 13, marginBottom: 16, maxWidth: 450 }}>
                {invoices.length === 0
                  ? "Your commercial ledger is empty. Click below to create your first invoice."
                  : "No invoice records match your current search query or status filter."}
              </p>
              <button className="primary" onClick={() => onOpenCreateInvoice ? onOpenCreateInvoice() : setIsCreateModalOpen(true)}>
                <Plus size={15} /> Add Sale
              </button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Invoice ID</th>
                  <th>Client Account</th>
                  <th>Category & Settlement</th>
                  <th>Date Issued</th>
                  <th>Payment Due</th>
                  <th>Taxable (₹)</th>
                  <th>GST (18%)</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  <th style={{ textAlign: "center" }}>Download / Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => {
                  const client = clients.find(c => c.id === inv.clientId || c.name === inv.clientName);
                  const isOverdue = inv.status === "Overdue";

                  return (
                    <tr key={inv.id}>
                      {/* Invoice ID */}
                      <td>
                        <button
                          type="button"
                          onClick={() => setSelectedInvoice(inv)}
                          title="Click to preview & print invoice"
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                            textAlign: "left"
                          }}
                        >
                          <code style={{
                            color: "var(--primary)",
                            fontWeight: 700,
                            background: "rgba(0, 91, 181, 0.08)",
                            padding: "3px 8px",
                            borderRadius: 4
                          }}>
                            {inv.id}
                          </code>
                        </button>
                      </td>

                      {/* Client Account */}
                      <td>
                        <div className="person">
                          <div className="mini-avatar" style={{ background: "rgba(0, 91, 181, 0.12)", color: "var(--primary)" }}>
                            {inv.clientName ? inv.clientName[0] : "C"}
                          </div>
                          <div>
                            <b style={{ color: "var(--text-main)" }}>{inv.clientName}</b>
                            {inv.clientId && (
                              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                Acc: {inv.clientId} {client?.clientType ? `• ${client.clientType}` : ""} {client?.taluka ? `• ${client.taluka}` : (client?.city ? `• ${client.city}` : "")}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category & Payment Mode */}
                      <td>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "12.5px" }}>
                            {(inv.category && !inv.category.toLowerCase().includes("hardware") && !inv.category.toLowerCase().includes("industrial"))
                              ? inv.category
                              : (client?.clientType || inv.items?.[0]?.category || "Animal Feed")}
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{inv.paymentMethod || "NEFT / RTGS"}</div>
                        </div>
                      </td>

                      {/* Invoice Date */}
                      <td style={{ fontSize: "12.5px", fontWeight: 500 }}>{formatDisplayDate(inv.date)}</td>

                      {/* Due Date */}
                      <td style={{ fontSize: "12.5px" }}>
                        <span style={{
                          color: isOverdue ? "var(--danger)" : "inherit",
                          fontWeight: isOverdue ? 700 : "500"
                        }}>
                          {formatDisplayDate(inv.dueDate)}
                        </span>
                      </td>

                      {/* Taxable Amount */}
                      <td className="money" style={{ color: "var(--text-muted)" }}>
                        ₹{Number(inv.amount || 0).toLocaleString("en-IN")}
                      </td>

                      {/* Tax */}
                      <td className="money" style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                        ₹{Number(inv.tax || Math.round(Number(inv.amount || 0) * 0.18)).toLocaleString("en-IN")}
                      </td>

                      {/* Grand Total */}
                      <td className="money">
                        <b style={{ color: "var(--primary)", fontSize: "13.5px" }}>
                          ₹{Number(inv.total || 0).toLocaleString("en-IN")}
                        </b>
                      </td>

                      {/* Status Badge */}
                      <td>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(inv)}
                          title="Click to cycle status: Paid -> Pending -> Overdue"
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
                        >
                          <span className={`badge ${inv.status === "Paid"
                              ? "paid"
                              : inv.status === "Pending"
                                ? "pending-payment"
                                : "overdue"
                            }`}>
                            <span
                              className={`badge-dot ${inv.status === "Paid" ? "pulse" : ""}`}
                              style={{
                                background: inv.status === "Paid" ? "#10b981" : inv.status === "Pending" ? "#f59e0b" : "#ef4444",
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                display: "inline-block",
                                marginRight: 6
                              }}
                            />
                            {inv.status}
                          </span>
                        </button>
                      </td>

                      {/* ACTION BUTTONS: View only � all other actions inside the view modal */}
                      <td>
                        <div className="row-actions" style={{ justifyContent: "center" }}>
                          <button
                            type="button"
                            title={`View ${inv.id}`}
                            onClick={() => setSelectedInvoice(inv)}
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
          )}
        </div>
      </div>

      {/* INVOICE PREVIEW & PRINT MODAL */}
      <InvoiceViewModal
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        invoice={selectedInvoice}
        company={company}
        client={clients.find(c => c.id === selectedInvoice?.clientId || c.name === selectedInvoice?.clientName)}
        onEdit={(inv) => {
          setSelectedInvoice(null);
          setEditInvoice(inv);
          setIsCreateModalOpen(true);
        }}
        onDelete={(inv) => {
          setSelectedInvoice(null);
          handleDeleteInvoice(inv.id);
        }}
        showToast={notify}
      />

      {/* CREATE / EDIT INVOICE MODAL */}
      <InvoiceModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditInvoice(null);
        }}
        onSave={handleAddInvoice}
        clients={clients}
        products={products}
        nextId={nextInvoiceId}
        company={company}
        editInvoice={editInvoice}
        showToast={notify}
      />
    </div>
  );
}
