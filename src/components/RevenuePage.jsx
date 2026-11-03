import React, { useState, useEffect } from "react";
import {
  IndianRupee, Plus, Search, Filter, Receipt, FileText, Download, Eye, X,
  CheckCircle2, AlertTriangle, Pencil, Calendar, RotateCcw,
  TrendingUp, ShoppingCart, Coins, Wallet
} from "lucide-react";
import {
  AreaChart, Area, CartesianGrid, XAxis, YAxis,
  Tooltip, PieChart, Pie, Cell
} from "recharts";
import InvoiceModal from "./InvoiceModal";
import InvoiceViewModal from "./InvoiceViewModal";
import { StatCard } from "./Dashboard";
import ResponsiveKpiGrid from "./responsive/ResponsiveKpiGrid";
import ResponsiveChartContainer from "./responsive/ResponsiveChartContainer";
import { formatIndianCurrency, formatPercent } from "../utils/formatters";
import { erpApi } from "../services/api";
import { getToday, getFiscalYear, getFiscalYearOptions } from "../constants/erpConstants";

const CATEGORY_COLORS = {
  "Animal Feed": "var(--primary)",
  "Dairy": "#10b981",
};

export default function Revenue({
  clients = [],
  invoices = [],
  onCreateInvoice,
  products = [],
  company = {},
  onRefresh,
}) {
  const currentFY = React.useMemo(() => getFiscalYear(getToday()), []);
  const fyOptions = React.useMemo(() => getFiscalYearOptions(invoices, getToday()), [invoices]);
  const [selectedFY, setSelectedFY] = useState(currentFY);
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState(null);
  const [quarterlyData, setQuarterlyData] = useState([]);
  const [cashFlowData, setCashFlowData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchRevenueData = async (fy) => {
    setLoading(true);
    try {
      const [sumRes, qRes, cfRes, catRes] = await Promise.all([
        erpApi.getRevenueSummary({ fiscalYear: fy }),
        erpApi.getQuarterlyBreakdown({ fiscalYear: fy }),
        erpApi.get12MonthCashFlow({ fiscalYear: fy }),
        erpApi.getCategoryTurnover({ fiscalYear: fy }),
      ]);

      if (sumRes?.data) setSummaryData(sumRes.data);
      if (qRes?.data?.quarters) setQuarterlyData(qRes.data.quarters);
      if (cfRes?.data) setCashFlowData(cfRes.data);
      if (catRes?.data?.categories) {
        const pieData = catRes.data.categories
          .filter(c => c.turnover > 0)
          .map(c => ({
            name: c.category,
            value: c.turnover,
            sharePct: c.sharePct,
            color: CATEGORY_COLORS[c.category] || "#6366f1",
          }));
        setCategoryData(pieData);
      }
    } catch (err) {
      console.warn("Failed to load revenue metrics from backend:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRevenueData(selectedFY);
  }, [selectedFY, invoices.length]);

  const getQuarterBadgeStyle = (status) => {
    if (status === "Achieved") return { color: "var(--success)", background: "rgba(16, 185, 129, 0.12)" };
    if (status === "Tracking") return { color: "var(--primary)", background: "rgba(0, 91, 181, 0.12)" };
    if (status === "Behind" || status === "Missed") return { color: "var(--danger)", background: "rgba(239, 68, 68, 0.12)" };
    return { color: "var(--text-muted)", background: "var(--bg)" };
  };

  const isCashFlowEmpty = cashFlowData.length === 0 || cashFlowData.every(m => (m.turnover || 0) === 0);

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
            FY {selectedFY} fiscal cash flows, tax invoice ledger & realization analytics
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginLeft: "auto" }}>
          <select
            value={selectedFY}
            onChange={(e) => setSelectedFY(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", fontWeight: 600, fontSize: "13px" }}
          >
            {fyOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button 
            type="button"
            className="outline" 
            onClick={() => { fetchRevenueData(selectedFY); showToast("✓ Live MySQL financial ledger synchronized."); }}
            title="Sync and refresh live invoices"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <RotateCcw size={14} className={loading ? "spin" : ""} /> Sync Live Ledger
          </button>

          <button className="primary" onClick={() => setIsInvoiceModalOpen(true)}>
            <Plus size={16} /> Log Invoice
          </button>
        </div>
      </div>

      {/* DUAL-RESPONSIVE KPI METRIC CARDS: 6 cards in 3 cols on Laptop, 2 cols on Mobile */}
      <ResponsiveKpiGrid cols={3}>
        {/* 1. Gross Turnover */}
        <StatCard 
          title={`Taxable Revenue (${summaryData?.periodLabel || selectedFY})`} 
          value={formatIndianCurrency(summaryData?.taxableRevenue ?? 0)} 
          change={summaryData?.yoyComparison?.changePct ?? null} 
          comparisonLabel={summaryData?.yoyComparison?.label || "YoY"}
          subtitle={`GST Collected: ${formatIndianCurrency(summaryData?.gstCollected ?? 0)}`}
          icon={IndianRupee} 
          loading={loading}
        />

        {/* 2. Gross Commercial Profit & Margin */}
        <StatCard 
          title="Gross Profit" 
          value={formatIndianCurrency(summaryData?.grossProfit ?? 0)} 
          change={summaryData?.grossMarginPct !== null && summaryData?.grossMarginPct !== undefined ? `${summaryData.grossMarginPct}% Margin` : null} 
          comparisonLabel=""
          trendType={summaryData?.grossMarginPct !== null ? "positive" : "neutral"}
          fallbackBadge="No prior margin"
          subtitle="Taxable Revenue - COGS"
          icon={Coins} 
          loading={loading}
        />

        {/* 3. Profit after Expense (Net Profit) */}
        <StatCard 
          title="Profit after Expense" 
          value={formatIndianCurrency(summaryData?.profitAfterExpense ?? (summaryData?.grossProfit ?? 0) - (summaryData?.totalExpenses ?? 0))} 
          change={summaryData?.netMarginPct !== null && summaryData?.netMarginPct !== undefined ? `${summaryData.netMarginPct}% Net Margin` : null} 
          comparisonLabel=""
          trendType={(summaryData?.profitAfterExpense ?? 0) >= 0 ? "positive" : "negative"}
          fallbackBadge="No prior data"
          subtitle={`GP (${formatIndianCurrency(summaryData?.grossProfit ?? 0)}) - Expenses (${formatIndianCurrency(summaryData?.totalExpenses ?? 0)})`}
          icon={TrendingUp} 
          loading={loading}
        />

        {/* 4. Total Operating Expenses */}
        <StatCard 
          title="Operating Expenses" 
          value={formatIndianCurrency(summaryData?.totalExpenses ?? 0)} 
          change={summaryData?.expenseCount > 0 ? `${summaryData.expenseCount} Vouchers` : null} 
          comparisonLabel=""
          trendType="neutral"
          fallbackBadge="0 Expenses logged"
          subtitle={`Total overheads for ${selectedFY}`}
          icon={Wallet} 
          loading={loading}
        />

        {/* 5. Realized Collections */}
        <StatCard 
          title="Realized Collections" 
          value={formatIndianCurrency(summaryData?.collectedAmount ?? 0)} 
          change={summaryData?.realizedPct !== null && summaryData?.realizedPct !== undefined ? `${summaryData.realizedPct}% Realized` : null} 
          comparisonLabel=""
          trendType={summaryData?.realizedPct !== null ? "positive" : "neutral"}
          fallbackBadge="No collections"
          subtitle="Direct bank & cash receipts"
          icon={IndianRupee} 
          loading={loading}
        />

        {/* 6. Outstanding Receivables */}
        <StatCard 
          title="Outstanding Receivables" 
          value={formatIndianCurrency(summaryData?.pendingDues ?? 0)} 
          change={summaryData?.counts?.pending > 0 ? `${summaryData.counts.pending} Pending` : null} 
          comparisonLabel=""
          trendType={summaryData?.counts?.pending > 0 ? "negative" : "positive"}
          icon={AlertTriangle} 
          fallbackBadge="0 Pending"
          subtitle="Unsettled client invoices"
          loading={loading}
        />
      </ResponsiveKpiGrid>

      {/* Quarterly Targets & Milestone Grid: 4 columns on Laptop, 2 on Tablet/Mobile */}
      <div className="quarter-grid" style={{ marginBottom: 20 }}>
        {quarterlyData.map((q, idx) => {
          const badgeStyle = getQuarterBadgeStyle(q.status);
          return (
            <div key={idx} className="quarter-card">
              <div className="quarter-card-header">
                <span>{q.label}</span>
                <span style={{ ...badgeStyle, padding: "2px 8px", borderRadius: 999, fontWeight: 700, fontSize: "11px" }}>
                  {q.status}
                </span>
              </div>
              <div className="quarter-val">{formatIndianCurrency(q.turnover)}</div>
              <div className="quarter-target">
                <span>Target: {formatIndianCurrency(q.targetAmount)}</span>
                <span>Achieved: {q.achievedPct !== null ? `${q.achievedPct}%` : "—"}</span>
              </div>
              <div className="quarter-progress-track">
                <div
                  className="quarter-progress-bar"
                  style={{
                    width: `${Math.min(100, q.achievedPct || 0)}%`,
                    background: q.status === "Achieved" ? "var(--success)" : "var(--primary)"
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Dual Interactive Charts: Side-by-side on Laptop, Stacked on Mobile */}
      <div className="revenue-split-grid">
        {/* Left: Monthly Invoiced vs Realized Cash Flow */}
        <div className="card chart-card">
          <div className="card-head" style={{ padding: "16px 18px" }}>
            <div>
              <h3>12-Month Invoiced vs Realized Cash Flow</h3>
              <p>Comparative monthly billing inflow and bank collection trajectory</p>
            </div>
          </div>
          <div className="chart" style={{ padding: "10px 14px 20px 4px", position: "relative" }}>
            {isCashFlowEmpty && (
              <div
                style={{
                  position: "absolute",
                  top: "45%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  color: "var(--text-muted)",
                  fontSize: 13,
                  fontWeight: 600,
                  textAlign: "center",
                  pointerEvents: "none",
                  zIndex: 2,
                }}
              >
                No cash flow records for FY {selectedFY}
              </div>
            )}
            <ResponsiveChartContainer height={300} mobileHeight={220}>
              <AreaChart data={cashFlowData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
                <XAxis dataKey="monthName" stroke="var(--text-muted)" fontSize={11} />
                <YAxis
                  stroke="var(--text-muted)"
                  tickFormatter={(v) => formatIndianCurrency(v, { compact: true })}
                  fontSize={11}
                  allowDecimals={false}
                  domain={[0, "auto"]}
                />
                <Tooltip 
                  formatter={(v, name) => [
                    formatIndianCurrency(v),
                    name === "turnover" ? "Taxable Turnover" : name === "grossInvoiced" ? "Gross Invoiced" : name === "profitAfterExpense" ? "Profit after Expense" : "Expenses"
                  ]}
                  contentStyle={{
                    background: "var(--card-bg)",
                    borderColor: "var(--border)",
                    borderRadius: "8px",
                    boxShadow: "var(--shadow-md)"
                  }}
                />
                <Area type="monotone" dataKey="grossInvoiced" stroke="var(--primary)" strokeWidth={2.5} fillOpacity={1} fill="url(#invoicedGrad)" />
                <Area type="monotone" dataKey="turnover" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#collectedGrad)" />
              </AreaChart>
            </ResponsiveChartContainer>
            <div style={{ display: "flex", justifyContent: "center", gap: 20, fontSize: "12px", color: "var(--text-muted)", marginTop: 6, flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--primary)" }} /> Gross Invoiced
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: "#10b981" }} /> Taxable Turnover
              </span>
            </div>
          </div>
        </div>

        {/* Right: Category Distribution Donut */}
        <div className="card chart-card">
          <div className="card-head" style={{ padding: "16px 18px" }}>
            <div>
              <h3>Turnover by Category</h3>
              <p>Canonical product lines (Animal Feed vs Dairy)</p>
            </div>
          </div>
          <div style={{ padding: "10px 16px 20px 16px", display: "flex", flexDirection: "column", alignItems: "center", minHeight: 280, justifyContent: "center" }}>
            {categoryData.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: "40px 0" }}>
                No categorized sales recorded for FY {selectedFY}.
              </div>
            ) : (
              <>
                <ResponsiveChartContainer height={190} mobileHeight={175}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(v, name, item) => [
                        `${formatIndianCurrency(v)} (${item.payload.sharePct}%)`,
                        "Taxable Turnover"
                      ]}
                      contentStyle={{
                        background: "var(--card-bg)",
                        borderColor: "var(--border)",
                        borderRadius: "8px",
                        boxShadow: "var(--shadow-md)"
                      }}
                    />
                  </PieChart>
                </ResponsiveChartContainer>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", marginTop: 12 }}>
                  {categoryData.map((entry, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12.5px" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: entry.color }} />
                        <span style={{ fontWeight: 600 }}>{entry.name}</span>
                      </span>
                      <span style={{ color: "var(--text-muted)" }}>
                        {formatIndianCurrency(entry.value)} ({entry.sharePct}%)
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* CREATE INVOICE MODAL */}
      <InvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        onSave={async (newInv) => {
          try {
            if (onCreateInvoice) {
              await onCreateInvoice(newInv);
            } else {
              await erpApi.createInvoice(newInv);
            }
            setIsInvoiceModalOpen(false);
            await fetchRevenueData(selectedFY);
            if (onRefresh) await onRefresh();
          } catch (err) {
            const msg = err?.response?.data?.message || err.message;
            console.error("Failed to save invoice:", msg);
            throw err;
          }
        }}
        clients={clients}
        products={products}
        company={company}
        showToast={showToast}
      />
    </div>
  );
}
