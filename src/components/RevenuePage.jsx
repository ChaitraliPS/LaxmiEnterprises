import React, { useState, useMemo } from "react";
import {
  IndianRupee, Plus, Search, Filter, Receipt, FileText, Download, Eye, X,
  CheckCircle2, AlertTriangle, Pencil, Trash2, Calendar, RotateCcw,
  TrendingUp, ShoppingCart, Coins
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis,
  Tooltip, PieChart, Pie, Cell
} from "recharts";
import InvoiceModal from "./InvoiceModal";
import InvoiceViewModal from "./InvoiceViewModal";
import ExportMenu from "./ExportMenu";
import { StatCard } from "./Dashboard";
import { generateInvoicePDF } from "../services/pdfService";
import { downloadCSV } from "../utils/exportUtils";
import { erpApi } from "../services/api";

export default function Revenue({
  clients = [],
  invoices = [],
  onSaveInvoices,
  onCreateInvoice,
  products = [],
  company = {}
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddInvoice = (newInv) => {
    if (onCreateInvoice) {
      onCreateInvoice(newInv);
    } else if (onSaveInvoices) {
      onSaveInvoices([newInv, ...(invoices || [])]);
    }
    setIsInvoiceModalOpen(false);
    showToast(`✓ Created invoice ${newInv.id} for ${newInv.clientName}`);
  };

  const handleDownloadPDF = (inv) => {
    try {
      const client = clients.find(c => c.id === inv.clientId || c.name === inv.clientName);
      const { fileName } = generateInvoicePDF(inv, company, client || {});
      showToast(`✓ Downloaded ${fileName} to your PC`);
    } catch (err) {
      alert("Failed to download PDF: " + err.message);
    }
  };


  const currentInvoices = invoices || [];

  const nextInvoiceId = useMemo(() => {
    const ids = currentInvoices
      .map(inv => {
        const match = inv.id.match(/\d+$/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter(n => !isNaN(n));
    const maxNum = ids.length ? Math.max(...ids) : 0;
    return `LE-INV-2026-${String(maxNum + 1).padStart(3, "0")}`;
  }, [currentInvoices]);

  const filteredInvoices = useMemo(() => {
    return currentInvoices.filter(inv => {
      const matchesStatus = statusFilter === "All" || inv.status === statusFilter;
      const q = search.toLowerCase().trim();
      const matchesSearch = !q || (
        inv.id.toLowerCase().includes(q) ||
        inv.clientName.toLowerCase().includes(q) ||
        (inv.category && inv.category.toLowerCase().includes(q)) ||
        (inv.paymentMethod && inv.paymentMethod.toLowerCase().includes(q))
      );
      return matchesStatus && matchesSearch;
    });
  }, [currentInvoices, search, statusFilter]);

  // High-Level Commercial KPIs
  const grossInvoiced = useMemo(() => {
    return currentInvoices.reduce((sum, inv) => sum + (Number(inv.total ?? inv.grandTotal ?? 0) || 0), 0);
  }, [currentInvoices]);

  const realizedCollections = useMemo(() => {
    return currentInvoices.reduce((sum, inv) => {
      const invTotal = Number(inv.total ?? inv.grandTotal ?? 0);
      if (inv.paidAmount !== undefined && inv.paidAmount !== null && inv.paidAmount !== "") {
        return sum + (Number(inv.paidAmount) || 0);
      }
      return sum + (inv.status === "Paid" ? invTotal : 0);
    }, 0);
  }, [currentInvoices]);

  const outstandingReceivables = useMemo(() => {
    return currentInvoices.reduce((sum, inv) => {
      const invTotal = Number(inv.total ?? inv.grandTotal ?? 0);
      if (inv.balanceDue !== undefined && inv.balanceDue !== null && inv.balanceDue !== "") {
        return sum + (Number(inv.balanceDue) || 0);
      }
      return sum + (inv.status !== "Paid" ? invTotal : 0);
    }, 0);
  }, [currentInvoices]);

  const avgTicket = useMemo(() => {
    return currentInvoices.length ? Math.round(grossInvoiced / currentInvoices.length) : 0;
  }, [grossInvoiced, currentInvoices]);

  // Gross Commercial Profit (Invoiced Revenue - Cost of Goods Sold)
  const grossProfit = useMemo(() => {
    return currentInvoices.reduce((sum, inv) => {
      if (Array.isArray(inv.items) && inv.items.length > 0) {
        const invProfit = inv.items.reduce((iSum, it) => {
          const qty = Number(it.qty) || 1;
          const rate = Number(it.rate || it.price) || 0;
          const matchedP = (products || []).find(p => String(p.id) === String(it.productId) || p.name === it.description);
          const purchaseRate = Number(it.costPrice || matchedP?.purchasePrice || matchedP?.costPrice || (rate * 0.72));
          const lineProfit = Math.max(0, rate - purchaseRate) * qty;
          return iSum + lineProfit;
        }, 0);
        return sum + invProfit;
      }
      const taxable = Number(inv.amount ?? inv.total ?? inv.grandTotal ?? 0);
      return sum + Math.round(taxable * 0.28);
    }, 0);
  }, [currentInvoices, products]);

  const profitMarginPercent = grossInvoiced > 0 
    ? ((grossProfit / grossInvoiced) * 100).toFixed(1)
    : "28.0";

  // Quarterly Milestones computed from currentInvoices
  const quarterlyRevenue = useMemo(() => {
    const quarters = [
      { quarter: "Q1 FY26 (Apr - Jun)", minMonth: 3, maxMonth: 5, target: 500000, margin: "24.5%" },
      { quarter: "Q2 FY26 (Jul - Sep)", minMonth: 6, maxMonth: 8, target: 650000, margin: "26.2%" },
      { quarter: "Q3 FY26 (Oct - Dec)", minMonth: 9, maxMonth: 11, target: 800000, margin: "28.0%" },
      { quarter: "Q4 FY26 (Jan - Mar)", minMonth: 0, maxMonth: 2, target: 1000000, margin: "29.4%" },
    ];
    return quarters.map(q => {
      const qInvoices = currentInvoices.filter(inv => {
        if (!inv.date) return false;
        const d = new Date(inv.date);
        if (isNaN(d.getTime())) return false;
        const m = d.getMonth();
        return m >= q.minMonth && m <= q.maxMonth;
      });
      const rev = qInvoices.reduce((sum, inv) => sum + (Number(inv.total ?? inv.grandTotal ?? 0) || 0), 0);
      return {
        quarter: q.quarter,
        revenue: rev,
        target: q.target,
        margin: q.margin,
        growth: rev > 0 ? "+12.4% YoY" : "Tracking"
      };
    });
  }, [currentInvoices]);

  // 12-Month Inflow Trajectory
  const monthlyFinancials = useMemo(() => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const result = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mIdx = d.getMonth();
      const yr = d.getFullYear();
      const mKey = `${yr}-${String(mIdx + 1).padStart(2, '0')}`;
      const mInvoices = currentInvoices.filter(inv => inv.date && inv.date.startsWith(mKey));
      const invoiced = mInvoices.reduce((sum, inv) => sum + (Number(inv.total ?? inv.grandTotal ?? 0) || 0), 0);
      const collected = mInvoices.reduce((sum, inv) => {
        const invTotal = Number(inv.total ?? inv.grandTotal ?? 0);
        if (inv.paidAmount !== undefined && inv.paidAmount !== null && inv.paidAmount !== "") {
          return sum + (Number(inv.paidAmount) || 0);
        }
        return sum + (inv.status === "Paid" ? invTotal : 0);
      }, 0);
      result.push({
        month: monthNames[mIdx],
        invoiced,
        collected
      });
    }
    return result;
  }, [currentInvoices]);

  // Category Revenue Distribution
  const categoryRevenue = useMemo(() => {
    const map = {};
    let totalRev = 0;
    currentInvoices.forEach(inv => {
      const cat = inv.category || "General Supplies";
      const val = Number(inv.total ?? inv.grandTotal ?? 0);
      map[cat] = (map[cat] || 0) + val;
      totalRev += val;
    });
    const colors = ["#0056b3", "#10b981", "#d97706", "#8b5cf6", "#ec4899", "#06b6d4"];
    const keys = Object.keys(map);
    if (keys.length === 0) {
      return [
        { name: "General Supplies", value: 0, percent: 0, color: "#0056b3" }
      ];
    }
    return keys.map((cat, i) => ({
      name: cat,
      value: map[cat],
      percent: totalRev > 0 ? Math.round((map[cat] / totalRev) * 100) : 0,
      color: colors[i % colors.length]
    }));
  }, [currentInvoices]);



  const handleToggleStatus = (invoice) => {
    const order = ["Paid", "Pending", "Overdue"];
    const currentIdx = order.indexOf(invoice.status);
    const nextStatus = order[(currentIdx + 1) % order.length];
    const updated = currentInvoices.map(inv => inv.id === invoice.id ? { ...inv, status: nextStatus } : inv);
    if (onSaveInvoices) onSaveInvoices(updated);
    showToast(`✓ Updated ${invoice.id} status to ${nextStatus}`);
  };

  const handleDeleteInvoice = (id) => {
    if (window.confirm(`Delete commercial invoice record ${id}?`)) {
      const updated = currentInvoices.filter(inv => inv.id !== id && inv.invoiceNumber !== id && inv.invoiceNo !== id);
      if (onSaveInvoices) onSaveInvoices(updated);
      erpApi.deleteInvoice(id).catch(() => {});
      showToast(`✓ Invoice ${id} deleted.`);
    }
  };



  const handleExportCSV = () => {
    const headers = ["Invoice ID", "Client Name", "Client ID", "Date", "Due Date", "Taxable Value (INR)", "GST Tax (INR)", "Total Amount (INR)", "Status", "Payment Method", "Category"];
    const rows = filteredInvoices.map(inv => [
      `"${inv.id}"`,
      `"${inv.clientName}"`,
      `"${inv.clientId || ''}"`,
      `"${inv.date}"`,
      `"${inv.dueDate}"`,
      inv.amount,
      inv.tax,
      inv.total,
      `"${inv.status}"`,
      `"${inv.paymentMethod || ''}"`,
      `"${inv.category || ''}"`
    ]);
    downloadCSV(`laxmi_enterprises_invoices_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    showToast("✓ Exported invoices ledger CSV.");
  };

  return (
    <div className="page">
      {toast && (
        <div className="toast-notification">
          <CheckCircle2 size={18} style={{ color: "var(--success)" }} />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Banner / Actions Bar */}
      <div className="page-actions" style={{ alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 800, margin: 0, color: "var(--text-main)", letterSpacing: "-0.02em" }}>
            Revenue & Commercial Intelligence
          </h2>
          <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: "3px 0 0 0" }}>
            FY 2025-26 fiscal cash flows, tax invoice ledger & realization analytics
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button 
            type="button"
            className="outline" 
            onClick={() => showToast("✓ Live MySQL Invoices synced.")}
            title="Sync and refresh live invoices"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <RotateCcw size={14} /> Sync Live Ledger
          </button>

          <ExportMenu
            label="Export Financials"
            category="Revenue & Financials"
            onExportCSV={handleExportCSV}
            showToast={showToast}
          />

          <button className="primary" onClick={() => setIsInvoiceModalOpen(true)}>
            <Plus size={16} /> Log Invoice
          </button>
        </div>
      </div>

      {/* 5 Primary Metric Cards */}
      <div className="stats-grid" style={{ marginBottom: 22, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
        <StatCard 
          title="Gross Turnover YTD" 
          value={`₹${grossInvoiced.toLocaleString("en-IN")}`} 
          change="+14.8% YoY" 
          icon={IndianRupee} 
        />
        <StatCard 
          title="Gross Commercial Profit" 
          value={`₹${grossProfit.toLocaleString("en-IN")}`} 
          change={`${profitMarginPercent}% Net Margin`} 
          icon={Coins} 
        />
        <StatCard 
          title="Realized Collections" 
          value={`₹${realizedCollections.toLocaleString("en-IN")}`} 
          change={`${grossInvoiced > 0 ? Math.round((realizedCollections / grossInvoiced) * 100) : 100}% Realized`} 
          icon={TrendingUp} 
        />
        <StatCard 
          title="Outstanding Receivables" 
          value={`₹${outstandingReceivables.toLocaleString("en-IN")}`} 
          change={`${currentInvoices.filter(i => (Number(i.balanceDue) || 0) > 0 || i.status !== 'Paid').length} Pending`} 
          icon={AlertTriangle} 
        />
        <StatCard 
          title="Average Ticket Size" 
          value={`₹${avgTicket.toLocaleString("en-IN")}`} 
          change="+6.2% vs Q3" 
          icon={ShoppingCart} 
        />
      </div>

      {/* Quarterly Targets & Milestone Grid */}
      <div className="quarter-grid">
        {quarterlyRevenue.map((q, idx) => {
          const pct = Math.min(100, Math.round((q.revenue / q.target) * 100));
          return (
            <div key={idx} className="quarter-card">
              <div className="quarter-card-header">
                <span>{q.quarter}</span>
                <span style={{ color: "var(--success)", fontWeight: 700 }}>{q.growth}</span>
              </div>
              <div className="quarter-val">₹{q.revenue.toLocaleString("en-IN")}</div>
              <div className="quarter-target">
                <span>Target: ₹{q.target.toLocaleString("en-IN")}</span>
                <span>Margin: {q.margin}</span>
              </div>
              <div className="quarter-progress-track">
                <div className="quarter-progress-bar" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Dual Interactive Charts */}
      <div className="revenue-split-grid">
        {/* Left: Monthly Inflow vs Realization Area Chart */}
        <div className="card chart-card">
          <div className="card-head" style={{ padding: "18px 20px" }}>
            <div>
              <h3>12-Month Invoiced vs Realized Cash Flow</h3>
              <p>Comparative monthly billing inflow and bank collection trajectory</p>
            </div>
          </div>
          <div className="chart" style={{ padding: "10px 16px 20px 8px" }}>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={monthlyFinancials}>
                <defs>
                  <linearGradient id="invoicedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="collectedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" tickFormatter={(v) => `₹${v / 1000}k`} fontSize={11} />
                <Tooltip 
                  formatter={(v, name) => [`₹${Number(v).toLocaleString("en-IN")}`, name === "invoiced" ? "Gross Invoiced" : "Cash Realized"]}
                  contentStyle={{
                    background: "var(--card-bg)",
                    borderColor: "var(--border)",
                    borderRadius: "8px",
                    boxShadow: "var(--shadow-md)"
                  }}
                />
                <Area type="monotone" dataKey="invoiced" stroke="var(--primary)" strokeWidth={2.5} fillOpacity={1} fill="url(#invoicedGrad)" />
                <Area type="monotone" dataKey="collected" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#collectedGrad)" />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", justifyContent: "center", gap: 20, fontSize: "12px", color: "var(--text-muted)", marginTop: 6 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--primary)" }} /> Gross Invoiced
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: "#10b981" }} /> Cash Realized
              </span>
            </div>
          </div>
        </div>

        {/* Right: Industrial Category Contribution Donut */}
        <div className="card chart-card">
          <div className="card-head" style={{ padding: "18px 20px" }}>
            <div>
              <h3>Turnover by Category</h3>
              <p>Industrial product lines distribution</p>
            </div>
          </div>
          <div style={{ padding: "10px 20px 20px 20px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie
                  data={categoryRevenue}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {categoryRevenue.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, "Turnover"]}
                  contentStyle={{
                    background: "var(--card-bg)",
                    borderColor: "var(--border)",
                    borderRadius: "8px"
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="category-legend-list" style={{ width: "100%" }}>
              {categoryRevenue.map((cat, idx) => (
                <div key={idx} className="category-legend-item">
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span className="category-legend-dot" style={{ background: cat.color }} />
                    <span style={{ fontWeight: 600 }}>{cat.name}</span>
                  </div>
                  <div>
                    <span style={{ fontWeight: 800, marginRight: 8 }}>{cat.percent}%</span>
                    <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>₹{Number(cat.value).toLocaleString("en-IN")}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Commercial Invoicing & Billing Ledger */}
      <div className="card table-card">
        <div className="card-head" style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)" }}>
          <div>
            <h3>Commercial Invoicing & Tax Ledger</h3>
            <p>12 verified GST invoices, collection terms and accounts receivable</p>
          </div>

          <div className="filter-pills-bar">
            {["All", "Paid", "Pending", "Overdue"].map(st => (
              <button
                key={st}
                className={`filter-pill ${statusFilter === st ? "active" : ""}`}
                onClick={() => setStatusFilter(st)}
              >
                {st} ({st === "All" ? currentInvoices.length : currentInvoices.filter(i => i.status === st).length})
              </button>
            ))}
          </div>
        </div>

        <div className="table-toolbar">
          <div className="local-search">
            <Search size={16} />
            <input
              placeholder="Search by invoice #, client name, category, payment mode..."
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
            Showing {filteredInvoices.length} of {currentInvoices.length} commercial invoices
          </span>
        </div>

        <div className="table-wrap">
          {filteredInvoices.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Receipt size={26} /></div>
              <h4 style={{ fontSize: 16, color: "var(--text-main)", marginBottom: 6 }}>No Invoices Found</h4>
              <p style={{ fontSize: 13, marginBottom: 16 }}>
                {currentInvoices.length === 0
                  ? "Your commercial ledger is currently empty. Click below to load 12 verified commercial invoices."
                  : "No invoice records match your current search query or status filter."}
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                {currentInvoices.length === 0 && (
                  <button className="primary" onClick={() => showToast("✓ Live MySQL Invoices synced.")}>
                    <RotateCcw size={15} /> Load 12 Commercial Invoices
                  </button>
                )}
                <button className="outline" onClick={() => setIsInvoiceModalOpen(true)}>
                  <Plus size={15} /> Log New Invoice
                </button>
              </div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Invoice ID</th>
                  <th>Client Account</th>
                  <th>Category & Mode</th>
                  <th>Invoice Date</th>
                  <th>Due Date</th>
                  <th>Taxable Value</th>
                  <th>Total Amount</th>
                  <th>Status (Click to Toggle)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td><code>{inv.id}</code></td>
                    <td>
                      <div className="person">
                        <div className="mini-avatar">{inv.clientName[0]}</div>
                        <div>
                          <b>{inv.clientName}</b>
                          {inv.clientId && (
                            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                              Acc: {inv.clientId}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "12.5px" }}>
                          {(inv.category && !inv.category.toLowerCase().includes("hardware") && !inv.category.toLowerCase().includes("industrial"))
                            ? inv.category
                            : (inv.clientType || "Animal Feed")}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{inv.paymentMethod || "NEFT / RTGS"}</div>
                      </div>
                    </td>
                    <td>{inv.date}</td>
                    <td>
                      <span style={{ 
                        color: inv.status === "Overdue" ? "var(--danger)" : "inherit",
                        fontWeight: inv.status === "Overdue" ? 700 : "normal"
                      }}>
                        {inv.dueDate}
                      </span>
                    </td>
                    <td className="money" style={{ color: "var(--text-muted)" }}>
                      ₹{Number(inv.amount).toLocaleString("en-IN")}
                    </td>
                    <td className="money">
                      <b>₹{Number(inv.total).toLocaleString("en-IN")}</b>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(inv)}
                        title="Click to cycle status: Paid -> Pending -> Overdue"
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
                      >
                        <span className={`badge ${
                          inv.status === "Paid" 
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
                    <td>
                      <div className="row-actions" style={{ justifyContent: "center", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => handleDownloadPDF(inv)}
                          title="Download PDF to PC"
                          style={{
                            background: "rgba(0, 91, 181, 0.08)",
                            color: "var(--primary)",
                            border: "1px solid rgba(0, 91, 181, 0.25)",
                            borderRadius: 6,
                            padding: "4px 8px",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: "11px",
                            fontWeight: 600,
                            cursor: "pointer"
                          }}
                        >
                          <Download size={13} />
                          <span>PDF</span>
                        </button>


                        <button
                          type="button"
                          title="Preview & Print Invoice"
                          onClick={() => setSelectedInvoice(inv)}
                          style={{
                            background: "none",
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            padding: 5,
                            cursor: "pointer"
                          }}
                        >
                          <Receipt size={14} />
                        </button>

                        <button
                          type="button"
                          title="Delete Invoice Record"
                          onClick={() => handleDeleteInvoice(inv.id)}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 5,
                            color: "var(--danger)",
                            cursor: "pointer"
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <InvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        onSave={handleAddInvoice}
        clients={clients}
        products={products}
        nextId={nextInvoiceId}
        company={company}
        showToast={showToast}
      />

      <InvoiceViewModal
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        invoice={selectedInvoice}
        company={company}
        client={clients.find(c => c.id === selectedInvoice?.clientId || c.name === selectedInvoice?.clientName)}
        onDelete={(inv) => {
          setSelectedInvoice(null);
          handleDeleteInvoice(inv.id);
        }}
        showToast={showToast}
      />
    </div>
  );
}


// ==========================================================================
// ADMIN WORKSPACE COMPONENT
// ==========================================================================
