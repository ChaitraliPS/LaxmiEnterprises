import React, { useState, useMemo, useEffect } from "react";
import {
  Receipt, Download, Plus, Search, X,
  CheckCircle2, AlertTriangle, TrendingUp, IndianRupee, Clock,
  Eye, RefreshCw, Printer, ShieldCheck, Filter, ArrowUpRight, ChevronDown, FileText, Calendar
} from "lucide-react";
import { generateInvoicePDF } from "../services/pdfService";
import { erpApi } from "../services/api";
import InvoiceViewModal from "./InvoiceViewModal";
import InvoiceModal from "./InvoiceModal";
import { formatIndianCurrency, formatDate } from "../utils/formatters";
import { getToday } from "../constants/erpConstants";

export default function InvoicesPage({
  invoices = [],
  onCreateInvoice,
  clients = [],
  products = [],
  company = {},
  showToast,
  onOpenCreateInvoice,
  onRefresh
}) {
  const today = useMemo(() => getToday(), []);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFY, setSelectedFY] = useState("FY 2026-27");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editInvoice, setEditInvoice] = useState(null);
  const [localToast, setLocalToast] = useState(null);
  const [reportDropdownOpen, setReportDropdownOpen] = useState(false);

  useEffect(() => {
    if (onRefresh) onRefresh();
  }, [onRefresh]);

  const handleManualRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      await onRefresh();
      setTimeout(() => setIsRefreshing(false), 500);
      notify("✓ Sales synchronized with MySQL database");
    }
  };

  const notify = (msg) => {
    if (showToast) {
      showToast(msg);
    } else {
      setLocalToast(msg);
      setTimeout(() => setLocalToast(null), 3000);
    }
  };

  // Indian FY helper for date filtering
  const getInvoiceFY = (inv) => {
    const dStr = inv.invoiceDate || inv.date || (inv.createdAt ? String(inv.createdAt).slice(0, 10) : "");
    if (!dStr) return "FY 2026-27";
    const parts = dStr.split("-");
    if (parts.length < 2) return "FY 2026-27";
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const startY = m >= 4 ? y : y - 1;
    return `FY ${startY}-${String(startY + 1).slice(-2)}`;
  };

  // Period Invoices (based on selected FY or All Time)
  const periodInvoices = useMemo(() => {
    if (selectedFY === "All Time") return invoices;
    return invoices.filter(inv => getInvoiceFY(inv) === selectedFY);
  }, [invoices, selectedFY]);

  // High-Level Commercial KPIs for selected period
  const kpis = useMemo(() => {
    let grossInvoiced = 0;
    let taxableRevenue = 0;
    let gstCollected = 0;
    let collectedAmount = 0;
    let pendingReceivables = 0;
    let overdueCount = 0;

    for (const inv of periodInvoices) {
      if (inv.isCancelled) continue;
      const grand = Number(inv.grandTotal ?? inv.total ?? 0);
      const taxable = Number(inv.taxableTotal ?? inv.subtotal ?? inv.amount ?? 0);
      const gst = Number(inv.gstTotal ?? inv.tax ?? 0);
      const paid = Number(inv.paidAmount || 0);
      const bal = Number(inv.balanceDue ?? Math.max(0, grand - paid));

      grossInvoiced += grand;
      taxableRevenue += taxable;
      gstCollected += gst;
      collectedAmount += Math.min(grand, paid);
      pendingReceivables += bal;

      if (inv.status === "Overdue") {
        overdueCount += 1;
      }
    }

    return {
      grossInvoiced,
      taxableRevenue,
      gstCollected,
      collectedAmount,
      pendingReceivables,
      overdueCount,
    };
  }, [periodInvoices]);

  // All time gross invoiced for transparency
  const allTimeGrossInvoiced = useMemo(() => {
    return invoices.reduce((s, inv) => inv.isCancelled ? s : s + Number(inv.grandTotal ?? inv.total ?? 0), 0);
  }, [invoices]);

  // Filtered invoices by status and search
  const filteredInvoices = useMemo(() => {
    return periodInvoices.filter(inv => {
      const st = inv.status || inv.paymentStatus || "Unpaid";
      let matchesStatus = true;
      if (statusFilter === "Paid") matchesStatus = st === "Paid";
      else if (statusFilter === "Pending") matchesStatus = st === "Unpaid" || st === "Partial";
      else if (statusFilter === "Overdue") matchesStatus = st === "Overdue";
      else if (statusFilter === "Cancelled") matchesStatus = Boolean(inv.isCancelled) || st === "Cancelled";

      const q = search.toLowerCase().trim();
      const invId = String(inv.invoiceNumber || inv.id || "").toLowerCase();
      const cName = String(inv.clientName || "").toLowerCase();
      const cId = String(inv.clientId || "").toLowerCase();
      const pMode = String(inv.paymentMode || "").toLowerCase();

      const matchesSearch = !q || (
        invId.includes(q) ||
        cName.includes(q) ||
        cId.includes(q) ||
        pMode.includes(q)
      );

      return matchesStatus && matchesSearch;
    });
  }, [periodInvoices, search, statusFilter]);

  // Counts for status pills
  const statusCounts = useMemo(() => {
    const counts = { all: periodInvoices.length, paid: 0, pending: 0, overdue: 0, cancelled: 0 };
    for (const inv of periodInvoices) {
      const st = inv.status || inv.paymentStatus;
      if (inv.isCancelled || st === "Cancelled") counts.cancelled += 1;
      else if (st === "Paid") counts.paid += 1;
      else if (st === "Overdue") {
        counts.overdue += 1;
        counts.pending += 1;
      } else if (st === "Partial" || st === "Unpaid") {
        counts.pending += 1;
      }
    }
    return counts;
  }, [periodInvoices]);

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
            Commercial Tax Invoices & Sales Ledger
          </h2>
          <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: "3px 0 0 0" }}>
            Real-time transactional ledger powered by MySQL backend services (Anchor: 01/11/2026)
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {/* Fiscal Year Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Calendar size={15} style={{ color: "var(--text-muted)" }} />
            <select
              className="form-input"
              style={{ width: "auto", padding: "6px 12px", fontSize: "13px", fontWeight: 600 }}
              value={selectedFY}
              onChange={(e) => setSelectedFY(e.target.value)}
            >
              <option value="FY 2026-27">FY 2026-27 (Current)</option>
              <option value="FY 2025-26">FY 2025-26</option>
              <option value="All Time">All Time</option>
            </select>
          </div>

          {onRefresh && (
            <button
              type="button"
              className="outline"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              title="Sync sales with database"
            >
              <RefreshCw size={15} className={isRefreshing ? "spin-animation" : ""} />
              {isRefreshing ? "Syncing..." : "Sync"}
            </button>
          )}

          <button
            type="button"
            className="primary"
            onClick={() => onOpenCreateInvoice ? onOpenCreateInvoice() : setIsCreateModalOpen(true)}
          >
            <Plus size={16} /> Create Invoice
          </button>
        </div>
      </div>

      {/* SUMMARY KPI CARDS */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-top">
            <span>Gross Invoiced ({selectedFY})</span>
            <div className="stat-icon" style={{ background: "rgba(0, 91, 181, 0.12)", color: "var(--primary)" }}>
              <IndianRupee size={19} />
            </div>
          </div>
          <div className="stat-value">{formatIndianCurrency(kpis.grossInvoiced)}</div>
          <div className="trend neutral" style={{ fontSize: 11, color: "var(--text-muted)" }}>
            <span>Taxable: {formatIndianCurrency(kpis.taxableRevenue)} | GST: {formatIndianCurrency(kpis.gstCollected)}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Realized Collections</span>
            <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.12)", color: "#10b981" }}>
              <TrendingUp size={19} />
            </div>
          </div>
          <div className="stat-value">{formatIndianCurrency(kpis.collectedAmount)}</div>
          <div className="trend positive">
            <CheckCircle2 size={14} />
            <span>{kpis.grossInvoiced > 0 ? `${((kpis.collectedAmount / kpis.grossInvoiced) * 100).toFixed(1)}% Realized` : "No billing"}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Pending Receivables</span>
            <div className="stat-icon" style={{ background: "rgba(245, 158, 11, 0.12)", color: "#f59e0b" }}>
              <Clock size={19} />
            </div>
          </div>
          <div className="stat-value">{formatIndianCurrency(kpis.pendingReceivables)}</div>
          <div className="trend negative">
            <Clock size={14} />
            <span>{statusCounts.pending} Unsettled</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Overdue Invoices</span>
            <div className="stat-icon" style={{ background: kpis.overdueCount > 0 ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)", color: kpis.overdueCount > 0 ? "#ef4444" : "#10b981" }}>
              {kpis.overdueCount > 0 ? <AlertTriangle size={19} /> : <CheckCircle2 size={19} />}
            </div>
          </div>
          <div className="stat-value">{kpis.overdueCount}</div>
          <div className={`trend ${kpis.overdueCount > 0 ? "negative" : "positive"}`}>
            {kpis.overdueCount > 0 ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
            <span>{kpis.overdueCount > 0 ? "Due Date Passed" : "All Accounts Current"}</span>
          </div>
        </div>
      </div>

      {/* TABLE CARD */}
      <div className="card table-card">
        <div className="card-head" style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)" }}>
          <div>
            <h3>Tax Invoices Registry ({selectedFY})</h3>
            <p>Derived transactional statuses from verified payment ledger</p>
          </div>

          <div className="filter-pills-bar">
            {[
              { id: "All", label: `All (${statusCounts.all})` },
              { id: "Paid", label: `Paid (${statusCounts.paid})` },
              { id: "Pending", label: `Pending (${statusCounts.pending})` },
              { id: "Overdue", label: `Overdue (${statusCounts.overdue})` },
            ].map(tab => (
              <button
                key={tab.id}
                className={`filter-pill ${statusFilter === tab.id ? "active" : ""}`}
                onClick={() => setStatusFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search Toolbar */}
        <div className="table-toolbar">
          <div className="local-search">
            <Search size={16} />
            <input
              placeholder="Search by invoice #, client name, account ID, payment mode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{ border: "none", background: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2 }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>
              Showing {filteredInvoices.length} of {periodInvoices.length} invoices | All-Time Total: {formatIndianCurrency(allTimeGrossInvoiced)}
            </span>
          </div>
        </div>

        {/* Table Body */}
        <div className="table-wrap">
          {filteredInvoices.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Receipt size={28} /></div>
              <h4>No Invoices Found</h4>
              <p>No sales records match your current filters for {selectedFY}.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Invoice ID</th>
                  <th>Client Account</th>
                  <th>Category</th>
                  <th>Payment Mode</th>
                  <th>Invoice Date</th>
                  <th>Due Date</th>
                  <th style={{ textAlign: "right" }}>Taxable (₹)</th>
                  <th style={{ textAlign: "right" }}>GST (₹)</th>
                  <th style={{ textAlign: "right" }}>Grand Total (₹)</th>
                  <th style={{ textAlign: "center" }}>Derived Status</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => {
                  const client = clients.find(c => c.id === inv.clientId || c.clientId === inv.clientId || c.name === inv.clientName);
                  const status = inv.status || inv.paymentStatus || "Unpaid";
                  const isOverdue = status === "Overdue";
                  const invId = inv.invoiceNumber || inv.id;

                  return (
                    <tr key={invId}>
                      <td>
                        <button
                          type="button"
                          onClick={() => setSelectedInvoice(inv)}
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
                        >
                          <code style={{
                            color: "var(--primary)",
                            fontWeight: 700,
                            background: "rgba(0, 91, 181, 0.08)",
                            padding: "3px 8px",
                            borderRadius: 4
                          }}>
                            {invId}
                          </code>
                        </button>
                      </td>

                      <td>
                        <div className="person">
                          <div className="mini-avatar" style={{ background: "rgba(0, 91, 181, 0.12)", color: "var(--primary)" }}>
                            {inv.clientName ? inv.clientName[0] : "C"}
                          </div>
                          <div>
                            <b>{inv.clientName}</b>
                            {inv.clientId && (
                              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                {inv.clientId} {client?.clientType ? `• ${client.clientType}` : ""}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td>
                        <span style={{ fontSize: "12.5px", fontWeight: 600 }}>
                          {inv.clientType || client?.clientType || "Feed Shop"}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontSize: "12px", color: inv.paymentMode ? "var(--text-main)" : "var(--text-muted)" }}>
                          {inv.paymentMode || "—"}
                        </span>
                      </td>

                      <td style={{ fontSize: "12.5px" }}>{formatDate(inv.invoiceDate || inv.date)}</td>

                      <td style={{ fontSize: "12.5px", color: isOverdue ? "var(--danger)" : "inherit", fontWeight: isOverdue ? 700 : "normal" }}>
                        {formatDate(inv.dueDate || inv.invoiceDate)}
                      </td>

                      <td className="money" style={{ textAlign: "right", color: "var(--text-muted)" }}>
                        {formatIndianCurrency(inv.taxableTotal ?? inv.subtotal ?? 0, { showSymbol: false })}
                      </td>

                      <td className="money" style={{ textAlign: "right", color: "var(--text-muted)", fontSize: "12px" }}>
                        {formatIndianCurrency(inv.gstTotal ?? inv.tax ?? 0, { showSymbol: false })}
                      </td>

                      <td className="money" style={{ textAlign: "right" }}>
                        <b style={{ color: "var(--primary)", fontSize: "13.5px" }}>
                          {formatIndianCurrency(inv.grandTotal ?? inv.total ?? 0)}
                        </b>
                      </td>

                      <td style={{ textAlign: "center" }}>
                        <span className={`badge ${
                          status === "Paid" ? "paid" : (status === "Overdue" ? "overdue" : "pending-payment")
                        }`}>
                          <span
                            className="badge-dot"
                            style={{
                              background: status === "Paid" ? "#10b981" : status === "Overdue" ? "#ef4444" : "#f59e0b",
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              display: "inline-block",
                              marginRight: 6
                            }}
                          />
                          {status}
                        </span>
                      </td>

                      <td style={{ textAlign: "center" }}>
                        <div className="row-actions" style={{ justifyContent: "center" }}>
                          <button
                            type="button"
                            title={`View & print ${invId}`}
                            onClick={() => setSelectedInvoice(inv)}
                            style={{ color: "var(--primary)" }}
                          >
                            <Eye size={15} />
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

      {/* INVOICE VIEW MODAL */}
      <InvoiceViewModal
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        invoice={selectedInvoice}
        company={company}
        client={clients.find(c => c.id === selectedInvoice?.clientId || c.clientId === selectedInvoice?.clientId || c.name === selectedInvoice?.clientName)}
        onEdit={(inv) => {
          setSelectedInvoice(null);
          setEditInvoice(inv);
          setIsCreateModalOpen(true);
        }}
        showToast={notify}
        onRefresh={onRefresh}
      />

      {/* CREATE / EDIT MODAL */}
      <InvoiceModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditInvoice(null);
        }}
        onSave={async (newInv) => {
          try {
            if (editInvoice) {
              await erpApi.updateInvoice(editInvoice.invoiceNumber || editInvoice.id, {
                notes: newInv.notes,
                dueDate: newInv.dueDate,
                clientAddress: newInv.clientAddress,
                clientContact: newInv.clientContact,
              });
              notify(`✓ Invoice ${editInvoice.invoiceNumber || editInvoice.id} metadata updated`);
            } else if (onCreateInvoice) {
              await onCreateInvoice(newInv);
            } else {
              await erpApi.createInvoice(newInv);
            }
            setIsCreateModalOpen(false);
            setEditInvoice(null);
            if (onRefresh) await onRefresh();
          } catch (err) {
            const msg = err?.response?.data?.message || err.message;
            notify(`⚠️ ${msg}`);
            throw err;
          }
        }}
        clients={clients}
        products={products}
        company={company}
        editInvoice={editInvoice}
        showToast={notify}
      />
    </div>
  );
}
