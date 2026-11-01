import React from "react";
import { NavLink } from "react-router-dom";
import {
  TrendingUp, AlertTriangle, Users, IndianRupee, Package, Boxes
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis,
  Tooltip, PieChart, Pie, Cell
} from "recharts";
export function StatCard({ title, value, change, icon: Icon, positive = true }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{title}</span>
        <div className="stat-icon">
          <Icon size={19} />
        </div>
      </div>
      <div className="stat-value">{value}</div>
      <div className={positive ? "trend positive" : "trend negative"}>
        <TrendingUp size={14} />
        {change}
        <span> vs last month</span>
      </div>
    </div>
  );
}
export const getMonthlyRevenue = (invoices = []) => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const map = {};
  months.forEach(m => { map[m] = 0; });
  (invoices || []).forEach(inv => {
    if (inv.date) {
      const d = new Date(inv.date);
      if (!isNaN(d.getMonth())) {
        const m = months[d.getMonth()];
        map[m] += Number(inv.grandTotal || inv.total || 0);
      }
    }
  });
  return months.map(m => ({ month: m, revenue: map[m] }));
};
export default function Dashboard({ clients = [], products = [], inventory = [], invoices = [], onExportMaster, adminProfile }) {
  // Connected reactively to live products and inventory state!
  const lowStockItems = products.filter(p => Number(p.stock) <= Number(p.minStock));
  const totalWarehouseUnits = products.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
  // Total dynamic revenue calculated from invoices
  const totalRevenueNumber = (invoices || []).reduce((sum, inv) => sum + Number(inv.grandTotal || inv.total || 0), 0);
  const formattedRevenue = `₹${totalRevenueNumber.toLocaleString("en-IN")}`;
  // Donut chart calculated from live products
  const inStockCount = products.filter(p => Number(p.stock) > Number(p.minStock)).length;
  const lowStockCount = products.filter(p => Number(p.stock) > 0 && Number(p.stock) <= Number(p.minStock)).length;
  const outOfStockCount = products.filter(p => Number(p.stock) <= 0).length;
  const totalProdCount = products.length || 1;
  const inStockPercent = Math.round((inStockCount / totalProdCount) * 100);
  const lowStockPercent = Math.round((lowStockCount / totalProdCount) * 100);
  const outOfStockPercent = Math.max(0, 100 - inStockPercent - lowStockPercent);
  return (
    <div className="page">
      <div className="page-actions" style={{ flexWrap: "wrap", gap: 10 }}>
        <span className="date-pill">Fiscal Year 2026-27 • Corporate Overview</span>
      </div>
      {/* KPI METRICS */}
      <div className="stats-grid">
        <StatCard title="Total Clients" value={String(clients.length)} change="+8.2%" icon={Users} />
        <StatCard title="Total Revenue" value={formattedRevenue} change="+12.5%" icon={IndianRupee} />
        <StatCard title="Active Catalogue" value={`${products.length} Products`} change="+4.8%" icon={Package} />
        <StatCard title="Warehouse Units" value={totalWarehouseUnits.toLocaleString("en-IN")} change="-2.4%" icon={Boxes} positive={false} />
      </div>
      {/* CHARTS GRID */}
      <div className="dashboard-grid">
        <div className="card chart-card">
          <div className="card-head">
            <div>
              <h3>Revenue Performance Trajectory</h3>
              <p>Monthly gross business volume in Indian Rupees</p>
            </div>
            <select aria-label="Select year">
              <option>CY 2026 (Current)</option>
              <option>CY 2025</option>
            </select>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={getMonthlyRevenue(invoices)}>
                <defs>
                  <linearGradient id="brandRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.32} />
                    <stop offset="70%" stopColor="var(--accent)" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
                <YAxis
                  stroke="var(--text-muted)"
                  tickFormatter={(v) => `₹${v / 1000}k`}
                  fontSize={12}
                />
                <Tooltip
                  formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, "Revenue"]}
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
            </ResponsiveContainer>
          </div>
        </div>
        {/* DONUT CHART */}
        <div className="card">
          <div className="card-head">
            <div>
              <h3>Inventory Health</h3>
              <p>Proportion of operational catalogue</p>
            </div>
          </div>
          <div className="donut">
            <ResponsiveContainer width="100%" height={195}>
              <PieChart>
                <Pie
                  data={[
                    { name: "In Stock", value: inStockCount || 1, color: "var(--primary)" },
                    { name: "Low Stock", value: lowStockCount, color: "var(--warning)" },
                    { name: "Out of Stock", value: outOfStockCount, color: "var(--danger)" }
                  ]}
                  innerRadius={55}
                  outerRadius={78}
                  paddingAngle={4}
                  dataKey="value"
                >
                  <Cell fill="var(--primary)" />
                  <Cell fill="var(--warning)" />
                  <Cell fill="var(--danger)" />
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--card-bg)",
                    borderColor: "var(--border)",
                    borderRadius: "8px"
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <b>{products.length}</b>
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
              <i className="dot out" style={{ background: "var(--danger)" }}></i>
              Out of Stock <b>{outOfStockPercent}%</b>
            </span>
          </div>
        </div>
      </div>
      {/* LOWER DATA SECTION */}
      <div className="bottom-grid">
        <div className="card">
          <div className="card-head">
            <div>
              <h3>Key Enterprise Accounts</h3>
              <p>Top volume purchasers this quarter</p>
            </div>
            <NavLink to="/clients" className="view-link">View all</NavLink>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Total Orders</th>
                  <th>Revenue (YTD)</th>
                </tr>
              </thead>
              <tbody>
                {clients.slice(0, 4).map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="person">
                        <div className="mini-avatar">{c.name ? c.name[0] : "C"}</div>
                        <b>{c.name}</b>
                      </div>
                    </td>
                    <td>{c.orders || 0} orders</td>
                    <td className="money">₹{Number(c.revenue || 0).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <div>
              <h3>Stock Replenishment Triggers</h3>
              <p>SKUs at or below safety threshold</p>
            </div>
            <NavLink to="/inventory" className="view-link">View all</NavLink>
          </div>
          <div className="alert-list">
            {lowStockItems.length === 0 ? (
              <div style={{ padding: "16px 0", fontSize: 13, color: "var(--text-muted)" }}>
                ✓ All items currently above safety threshold.
              </div>
            ) : (
              lowStockItems.map((p) => (
                <div className="alert-row" key={p.id}>
                  <div className="alert-icon">
                    <AlertTriangle size={16} />
                  </div>
                  <div>
                    <b>{p.name}</b>
                    <small>Only {p.stock} units available (Threshold: {p.minStock})</small>
                  </div>
                  <span className="badge warning">Restock</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}