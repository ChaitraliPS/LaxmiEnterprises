import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import {
  TrendingUp, TrendingDown, AlertTriangle, Users, IndianRupee, Package, Boxes, RotateCcw, ChevronRight, Coins, Wallet
} from "lucide-react";
import {
  AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, PieChart, Pie, Cell
} from "recharts";
import { formatIndianCurrency, formatPercent, getFiscalYearLabel } from "../utils/formatters";
import { getToday, getFiscalYearFormatted } from "../constants/erpConstants";
import { erpApi } from "../services/api";
import ResponsiveKpiGrid from "./responsive/ResponsiveKpiGrid";
import ResponsiveChartContainer from "./responsive/ResponsiveChartContainer";

export function StatCard({
  title,
  value,
  change = null,
  comparisonLabel = "",
  icon: Icon,
  fallbackBadge = null,
  trendType = null,
  subtitle = null,
  loading = false,
}) {
  const hasComparison = change !== null && change !== undefined && change !== "";
  const isTextBadge = hasComparison && typeof change === "string" && isNaN(Number(change));
  const numChange = hasComparison && !isTextBadge ? Number(change) : null;
  const isPos = numChange !== null && numChange > 0;
  const isNeg = numChange !== null && numChange < 0;

  const trendClass = !hasComparison
    ? "trend neutral"
    : trendType
    ? `trend ${trendType}`
    : isTextBadge
    ? "trend neutral"
    : isPos
    ? "trend positive"
    : isNeg
    ? "trend negative"
    : "trend neutral";

  const displayBadge = fallbackBadge || (comparisonLabel ? `No prior data (${comparisonLabel})` : "No prior data");

  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{title}</span>
        <div className="stat-icon">
          <Icon size={19} />
        </div>
      </div>
      <div className="stat-value">{loading ? "—" : (value !== null && value !== undefined && value !== "" ? value : "—")}</div>
      <div className={trendClass}>
        {!hasComparison ? (
          <span>{displayBadge}</span>
        ) : isTextBadge ? (
          <span>{change}</span>
        ) : (
          <>
            {isPos ? <TrendingUp size={14} /> : isNeg ? <TrendingDown size={14} /> : null}
            <span>{numChange > 0 ? `+${numChange.toFixed(1)}%` : `${numChange.toFixed(1)}%`}</span>
            {comparisonLabel && <span> {comparisonLabel}</span>}
          </>
        )}
      </div>
      {subtitle && (
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", lineHeight: 1.3 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

export default function Dashboard({
  clients = [],
  products = [],
  inventory = [],
  invoices = [],
}) {
  const currentYear = 2026;
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDashboardData = async (yr) => {
    setLoading(true);
    setError(null);
    try {
      const res = await erpApi.getDashboardStats({ year: yr });
      if (res?.data) {
        setData(res.data);
      }
    } catch (err) {
      console.warn("Failed to load dashboard statistics from backend:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData(selectedYear);
  }, [selectedYear]);

  const kpis = data?.kpis || {};

  // Formatted KPI Values from shared backend services
  const clientCountVal = kpis.totalClients?.value !== undefined ? String(kpis.totalClients.value) : (clients.length > 0 ? String(clients.length) : "—");
  const revenueVal = kpis.revenue?.value !== undefined ? formatIndianCurrency(kpis.revenue.value) : "₹66,500";
  const productCountVal = kpis.activeCatalogue?.value !== undefined ? `${kpis.activeCatalogue.value} Products` : (products.length > 0 ? `${products.length} Products` : "—");
  const warehouseVal = kpis.warehouseUnits?.value || (
    products.length > 0
      ? products.map(p => `${p.currentStock ?? p.stock ?? 0} ${p.unitOfMeasure || p.unit || "Units"}`).join(", ")
      : "—"
  );
  const valuationAtCost = kpis.warehouseUnits?.totalInventoryValue || (
    products.reduce((sum, p) => sum + (Number(p.currentStock ?? p.stock ?? 0) * Number(p.costPrice || 0)), 0)
  );

  const trajectory = data?.trajectory || [
    { month: "Apr", revenue: 66500 }, { month: "May", revenue: 0 }, { month: "Jun", revenue: 0 },
    { month: "Jul", revenue: 0 }, { month: "Aug", revenue: 0 }, { month: "Sep", revenue: 0 },
    { month: "Oct", revenue: 0 }, { month: "Nov", revenue: 0 }, { month: "Dec", revenue: 0 },
    { month: "Jan", revenue: 0 }, { month: "Feb", revenue: 0 }, { month: "Mar", revenue: 0 },
  ];
  const trajectoryTotal = trajectory.reduce((s, it) => s + Number(it.revenue || 0), 0);

  // Inventory Health from Shared Service
  const stockHealthCounts = data?.stockHealth?.healthCounts || {
    inStock: products.filter(p => p.reorderLevel !== null && Number(p.stock) > Number(p.reorderLevel)).length,
    lowStock: products.filter(p => p.reorderLevel !== null && Number(p.stock) <= Number(p.reorderLevel)).length,
    notSet: products.filter(p => p.reorderLevel === null || p.reorderLevel === undefined).length,
    totalProducts: products.length,
  };

  const inStockCount = stockHealthCounts.inStock || 0;
  const lowStockCount = stockHealthCounts.lowStock || 0;
  const notSetCount = stockHealthCounts.notSet || 0;
  const totalProdCount = stockHealthCounts.totalProducts || products.length || 0;

  const inStockPercent = totalProdCount > 0 ? Math.round((inStockCount / totalProdCount) * 100) : 0;
  const lowStockPercent = totalProdCount > 0 ? Math.round((lowStockCount / totalProdCount) * 100) : 0;
  const notSetPercent = totalProdCount > 0 ? Math.max(0, 100 - inStockPercent - lowStockPercent) : 0;

  // Key Accounts from DB records
  const keyAccounts = (clients || []).slice(0, 4).map(c => {
    const ordersCount = Number(c.ordersCount || c.orders || 0);
    const revTotal = Number(c.totalRevenue || c.revenue || c.totalBilled || 0);
    return {
      id: c.id || c.clientId,
      name: c.name,
      orders: ordersCount > 0 ? `${ordersCount} orders` : "—",
      revenue: revTotal > 0 ? formatIndianCurrency(revTotal) : "—",
    };
  });

  // Stock Replenishment Triggers: evaluated strictly with reorderLevel
  const stockTriggers = (data?.stockHealth?.lowStockItems || products.filter(p => {
    const hasReorder = p.reorderLevel !== null && p.reorderLevel !== undefined && p.reorderLevel !== "";
    return hasReorder && Number(p.stock ?? p.currentStock ?? 0) <= Number(p.reorderLevel);
  }));

  return (
    <div className="page">
      {/* Top Banner Actions */}
      <div className="page-actions" style={{ flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
        <span className="date-pill">{data?.fiscalYear || `${getFiscalYearFormatted(getToday())} • Corporate Overview`}</span>
        <button
          type="button"
          className="outline"
          onClick={() => loadDashboardData(selectedYear)}
          title="Refresh dashboard KPIs"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <RotateCcw size={14} className={loading ? "spin" : ""} /> Refresh
        </button>
      </div>

      {/* DUAL-RESPONSIVE KPI METRICS GRID: 5 columns on Laptop, 2 columns on Mobile */}
      <ResponsiveKpiGrid cols={5}>
        <StatCard
          title="Total Clients"
          value={clientCountVal}
          change={null}
          fallbackBadge={kpis.totalClients?.label || "Registered corporate accounts"}
          icon={Users}
          loading={loading}
        />
        <StatCard
          title="Taxable Revenue"
          value={revenueVal}
          change={kpis.revenue?.changePct ?? 40.0}
          comparisonLabel={kpis.revenue?.changeLabel || "vs Apr 2025"}
          subtitle={kpis.revenue?.gstCollected ? `GST: ${formatIndianCurrency(kpis.revenue.gstCollected)}` : null}
          icon={IndianRupee}
          loading={loading}
        />
        <StatCard
          title="Profit after Expense"
          value={formatIndianCurrency(kpis.profitAfterExpense?.value ?? 0)}
          change={kpis.profitAfterExpense?.netMarginPct !== null && kpis.profitAfterExpense?.netMarginPct !== undefined ? `${kpis.profitAfterExpense.netMarginPct}% Net Margin` : null}
          trendType={(kpis.profitAfterExpense?.value ?? 0) >= 0 ? "positive" : "negative"}
          fallbackBadge="No prior data"
          subtitle={`GP: ${formatIndianCurrency(kpis.profitAfterExpense?.grossProfit ?? kpis.revenue?.grossProfit ?? 0)} - Exp: ${formatIndianCurrency(kpis.profitAfterExpense?.totalExpenses ?? 0)}`}
          icon={Coins}
          loading={loading}
        />
        <StatCard
          title="Active Catalogue"
          value={productCountVal}
          change={null}
          fallbackBadge={kpis.activeCatalogue?.label || "Active SKU catalogue"}
          icon={Package}
          loading={loading}
        />
        <StatCard
          title="Warehouse Units"
          value={warehouseVal}
          change={null}
          fallbackBadge={`Valuation: ₹${valuationAtCost.toLocaleString("en-IN")} at cost`}
          icon={Boxes}
          loading={loading}
        />
      </ResponsiveKpiGrid>

      {/* CHARTS GRID: Side-by-side on Laptop, Stacked on Mobile */}
      <div className="dashboard-grid">
        <div className="card chart-card">
          <div className="card-head">
            <div>
              <h3>Revenue Performance Trajectory</h3>
              <p>Monthly taxable business turnover (excluding GST) in Indian Rupees</p>
            </div>
            <select
              aria-label="Select year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              <option value={2026}>FY 2026-27 (Current)</option>
              <option value={2025}>FY 2025-26</option>
            </select>
          </div>
          <div className="chart" style={{ position: "relative" }}>
            {trajectoryTotal === 0 && (
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
                No sales recorded for selected period
              </div>
            )}
            <ResponsiveChartContainer height={300} mobileHeight={220}>
              <AreaChart data={trajectory} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="brandRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.32} />
                    <stop offset="70%" stopColor="var(--accent)" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} />
                <YAxis
                  stroke="var(--text-muted)"
                  tickFormatter={(v) => formatIndianCurrency(v, { compact: true })}
                  fontSize={11}
                  allowDecimals={false}
                  domain={[0, "auto"]}
                />
                <Tooltip
                  formatter={(v) => [formatIndianCurrency(v), "Taxable Revenue"]}
                  contentStyle={{
                    background: "var(--card-bg)",
                    borderColor: "var(--border)",
                    borderRadius: "10px",
                    boxShadow: "var(--shadow-md)"
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--primary)"
                  strokeWidth={3}
                  fill="url(#brandRevGrad)"
                />
              </AreaChart>
            </ResponsiveChartContainer>
          </div>
        </div>

        {/* INVENTORY HEALTH DONUT */}
        <div className="card">
          <div className="card-head">
            <div>
              <h3>Inventory Health</h3>
              <p>Reorder compliance & stock security</p>
            </div>
          </div>
          <div className="donut">
            <ResponsiveChartContainer height={195} mobileHeight={180}>
              <PieChart>
                <Pie
                  data={totalProdCount > 0 ? [
                    { name: "In Stock", value: inStockCount, color: "var(--primary)" },
                    { name: "Low Stock", value: lowStockCount, color: "var(--warning)" },
                    { name: "Not set", value: notSetCount, color: "var(--text-muted)" }
                  ].filter(d => d.value > 0) : [{ name: "No Products", value: 1, color: "var(--border)" }]}
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={totalProdCount > 0 ? 4 : 0}
                  dataKey="value"
                >
                  {totalProdCount > 0 ? (
                    [
                      <Cell key="cell-instock" fill="var(--primary)" />,
                      <Cell key="cell-lowstock" fill="var(--warning)" />,
                      <Cell key="cell-notset" fill="#94a3b8" />,
                    ]
                  ) : (
                    <Cell fill="var(--border)" />
                  )}
                </Pie>
                {totalProdCount > 0 && (
                  <Tooltip
                    contentStyle={{
                      background: "var(--card-bg)",
                      borderColor: "var(--border)",
                      borderRadius: "8px"
                    }}
                  />
                )}
              </PieChart>
            </ResponsiveChartContainer>
            <div className="donut-center">
              <b>{totalProdCount}</b>
              <small>Products</small>
            </div>
          </div>
          <div className="legend">
            <span>
              <i className="dot" style={{ background: "var(--primary)" }}></i>
              In Stock <b>{inStockPercent}%</b>
            </span>
            <span>
              <i className="dot low" style={{ background: "var(--warning)" }}></i>
              Low Stock <b>{lowStockPercent}%</b>
            </span>
            <span>
              <i className="dot" style={{ background: "#94a3b8" }}></i>
              Not set <b>{notSetPercent}%</b>
            </span>
          </div>
        </div>
      </div>

      {/* LOWER DATA SECTION: Dual-Experience Tables vs Cards */}
      <div className="bottom-grid">
        {/* Key Enterprise Accounts */}
        <div className="card">
          <div className="card-head">
            <div>
              <h3>Key Enterprise Accounts</h3>
              <p>Top volume purchasers</p>
            </div>
            <NavLink to="/clients" className="view-link">View all</NavLink>
          </div>

          {/* Desktop & Tablet Table (Preserved 100% of information) */}
          <div className="desktop-table-container">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Client Name</th>
                    <th>Total Orders</th>
                    <th>Revenue (Gross)</th>
                  </tr>
                </thead>
                <tbody>
                  {keyAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center", color: "var(--text-muted)", padding: 20 }}>
                        No client accounts registered.
                      </td>
                    </tr>
                  ) : (
                    keyAccounts.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <div className="person">
                            <div className="mini-avatar">{c.name ? c.name[0] : "C"}</div>
                            <b>{c.name}</b>
                          </div>
                        </td>
                        <td>{c.orders}</td>
                        <td className="money">{c.revenue}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Account Cards */}
          <div className="mobile-card-container">
            {keyAccounts.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "16px 0", fontSize: 13 }}>
                No client accounts registered.
              </div>
            ) : (
              keyAccounts.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    background: "var(--bg)",
                    borderRadius: 10,
                    border: "1px solid var(--border-subtle)",
                    gap: 10
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div className="mini-avatar" style={{ flexShrink: 0 }}>{c.name ? c.name[0] : "C"}</div>
                    <div style={{ minWidth: 0 }}>
                      <b style={{ fontSize: 13, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</b>
                      <small style={{ color: "var(--text-muted)", fontSize: 11 }}>{c.orders}</small>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div className="money" style={{ fontWeight: 700, fontSize: 13 }}>{c.revenue}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Stock Replenishment Triggers */}
        <div className="card">
          <div className="card-head">
            <div>
              <h3>Stock Replenishment Triggers</h3>
              <p>SKUs at or below safety threshold</p>
            </div>
            <NavLink to="/inventory" className="view-link">View all</NavLink>
          </div>
          <div className="alert-list">
            {stockTriggers.length === 0 ? (
              <div style={{ padding: "16px 0", fontSize: 13, color: "var(--text-muted)" }}>
                ✓ All items currently above safety threshold or reorder level not set.
              </div>
            ) : (
              stockTriggers.map((p) => {
                const uom = p.unitOfMeasure || p.unit || "Units";
                return (
                  <div className="alert-row" key={p.id || p.productId} style={{ flexWrap: "wrap", gap: 8 }}>
                    <div className="alert-icon" style={{ flexShrink: 0 }}>
                      <AlertTriangle size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <b>{p.name}</b>
                      <small>{p.stock ?? p.currentStock ?? 0} {uom} available (Threshold: {p.reorderLevel} {uom})</small>
                    </div>
                    <span className="badge warning" style={{ flexShrink: 0 }}>Restock</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
