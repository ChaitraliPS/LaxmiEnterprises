import React, { useState, useEffect, useMemo } from "react";
import {
  Wallet, Plus, Search, Filter, RotateCcw, Download,
  Pencil, Eye, Trash2, Calendar, Tag, CreditCard, User,
  FileText, CheckCircle2, AlertTriangle, ArrowUpDown, PieChart as PieIcon
} from "lucide-react";
import ExpenseModal from "./ExpenseModal";
import ExpenseDetailsModal from "./ExpenseDetailsModal";
import { StatCard } from "./Dashboard";
import ResponsiveKpiGrid from "./responsive/ResponsiveKpiGrid";
import { formatIndianCurrency } from "../utils/formatters";
import { downloadCSV } from "../utils/exportUtils";
import { erpApi } from "../services/api";
import {
  getToday,
  getFiscalYear,
  getFiscalYearOptions,
  EXPENSE_CATEGORY_LIST,
} from "../constants/erpConstants";

const CATEGORY_BADGE_COLORS = {
  "Rent & Premises": { bg: "rgba(14, 165, 233, 0.12)", color: "#0284c7" },
  "Electricity & Utilities": { bg: "rgba(234, 179, 8, 0.12)", color: "#b45309" },
  "Salaries & Wages": { bg: "rgba(16, 185, 129, 0.12)", color: "#059669" },
  "Transport & Fuel": { bg: "rgba(249, 115, 22, 0.12)", color: "#ea580c" },
  "Packaging & Bags": { bg: "rgba(168, 85, 247, 0.12)", color: "#9333ea" },
  "Machinery & Maintenance": { bg: "rgba(236, 72, 153, 0.12)", color: "#db2777" },
  "Office & Admin": { bg: "rgba(99, 102, 241, 0.12)", color: "#4f46e5" },
  "Marketing & Advertising": { bg: "rgba(20, 184, 166, 0.12)", color: "#0d9488" },
  "Taxes & Professional Fees": { bg: "rgba(244, 63, 94, 0.12)", color: "#e11d48" },
  "Miscellaneous": { bg: "rgba(100, 116, 139, 0.12)", color: "#475569" },
};

export default function ExpensesPage({
  expenses = [],
  onRefresh,
  showToast = () => {},
}) {
  const currentFY = useMemo(() => getFiscalYear(getToday()), []);
  const [selectedFY, setSelectedFY] = useState(currentFY);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("expenseDate");
  const [sortOrder, setSortOrder] = useState("DESC");
  const [loading, setLoading] = useState(false);
  const [localExpenses, setLocalExpenses] = useState(expenses);

  // Summary Metrics from Backend
  const [summaryData, setSummaryData] = useState(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingExpense, setViewingExpense] = useState(null);
  const [expenseToEdit, setExpenseToEdit] = useState(null);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Dynamic FY Options based on recorded expenses
  const fyOptions = useMemo(() => {
    return getFiscalYearOptions(localExpenses, getToday());
  }, [localExpenses]);

  // Fetch expenses from Backend
  const fetchExpensesData = async () => {
    setLoading(true);
    try {
      const [listRes, sumRes] = await Promise.all([
        erpApi.getExpenses({
          fiscalYear: selectedFY === "ALL" ? null : selectedFY,
          category: selectedCategory === "All" ? null : selectedCategory,
          search: searchTerm || null,
          sortBy,
          sortOrder,
        }),
        erpApi.getExpenseSummary({
          fiscalYear: selectedFY === "ALL" ? "all" : selectedFY,
        }),
      ]);

      if (listRes?.data?.expenses) {
        setLocalExpenses(listRes.data.expenses);
      }
      if (sumRes?.data) {
        setSummaryData(sumRes.data);
      }
    } catch (err) {
      console.warn("Failed to load expenses data:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpensesData();
  }, [selectedFY, selectedCategory, sortBy, sortOrder]);

  // Keep localExpenses in sync if parent expenses change
  useEffect(() => {
    if (expenses && expenses.length > 0 && localExpenses.length === 0) {
      setLocalExpenses(expenses);
    }
  }, [expenses]);

  // Filtered expenses based on search
  const filteredExpenses = useMemo(() => {
    if (!searchTerm.trim()) return localExpenses;
    const q = searchTerm.toLowerCase();
    return localExpenses.filter((e) => {
      const num = (e.expenseNumber || "").toLowerCase();
      const title = (e.title || "").toLowerCase();
      const cat = (e.category || "").toLowerCase();
      const payee = (e.paidTo || "").toLowerCase();
      const ref = (e.referenceNo || "").toLowerCase();
      return (
        num.includes(q) ||
        title.includes(q) ||
        cat.includes(q) ||
        payee.includes(q) ||
        ref.includes(q)
      );
    });
  }, [localExpenses, searchTerm]);

  // KPI Calculations
  const totalAmount = useMemo(() => {
    if (summaryData?.totalExpenses !== undefined && !searchTerm) {
      return summaryData.totalExpenses;
    }
    return filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  }, [summaryData, filteredExpenses, searchTerm]);

  const count = useMemo(() => {
    if (summaryData?.expenseCount !== undefined && !searchTerm) {
      return summaryData.expenseCount;
    }
    return filteredExpenses.length;
  }, [summaryData, filteredExpenses, searchTerm]);

  const avgExpense = count > 0 ? totalAmount / count : 0;

  const topCategory = useMemo(() => {
    if (summaryData?.byCategory && summaryData.byCategory.length > 0 && !searchTerm) {
      return summaryData.byCategory[0];
    }
    const catMap = {};
    for (const e of filteredExpenses) {
      const cat = e.category || "Miscellaneous";
      catMap[cat] = (catMap[cat] || 0) + Number(e.amount || 0);
    }
    const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? { category: sorted[0][0], totalAmount: sorted[0][1] } : null;
  }, [summaryData, filteredExpenses, searchTerm]);

  // Handlers
  const handleOpenCreateModal = () => {
    setExpenseToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (expense) => {
    setExpenseToEdit(expense);
    setIsModalOpen(true);
  };

  const handleSaveExpense = async (payload) => {
    try {
      if (expenseToEdit) {
        const res = await erpApi.updateExpense(expenseToEdit.id || expenseToEdit.expenseNumber, payload);
        showToast(`✓ Expense ${res?.data?.expenseNumber || expenseToEdit.expenseNumber} updated successfully!`);
      } else {
        const res = await erpApi.createExpense(payload);
        showToast(`✓ Expense ${res?.data?.expenseNumber || "voucher"} recorded successfully!`);
      }
      setIsModalOpen(false);
      setExpenseToEdit(null);
      await fetchExpensesData();
      if (onRefresh) onRefresh();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to save expense";
      showToast(`⚠️ ${msg}`);
      throw err;
    }
  };

  const handleDeleteExpenseConfirm = async () => {
    if (!expenseToDelete) return;
    setIsDeleting(true);
    try {
      await erpApi.deleteExpense(expenseToDelete.id || expenseToDelete.expenseNumber);
      showToast(`✓ Expense voucher ${expenseToDelete.expenseNumber} deleted.`);
      setExpenseToDelete(null);
      await fetchExpensesData();
      if (onRefresh) onRefresh();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to delete expense";
      showToast(`⚠️ ${msg}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ["Expense No", "Date", "Title", "Category", "Amount (INR)", "Payment Mode", "Paid To", "Reference No", "Notes"];
    const rows = filteredExpenses.map((e) => [
      `"${e.expenseNumber || ""}"`,
      `"${e.expenseDate || ""}"`,
      `"${(e.title || "").replace(/"/g, '""')}"`,
      `"${e.category || ""}"`,
      Number(e.amount || 0).toFixed(2),
      `"${e.paymentMode || ""}"`,
      `"${(e.paidTo || "").replace(/"/g, '""')}"`,
      `"${(e.referenceNo || "").replace(/"/g, '""')}"`,
      `"${(e.notes || "").replace(/"/g, '""')}"`,
    ]);
    downloadCSV(`Laxmi_Expenses_${selectedFY}_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    showToast("✓ Exported Expenses Register (.csv)");
  };

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortOrder((prev) => (prev === "ASC" ? "DESC" : "ASC"));
    } else {
      setSortBy(col);
      setSortOrder("DESC");
    }
  };

  return (
    <div className="page">
      {/* Top Action Bar */}
      <div className="page-actions" style={{ alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 800, margin: 0, color: "var(--text-main)", letterSpacing: "-0.02em" }}>
            Operational Expenses & Cost Tracking
          </h2>
          <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: "3px 0 0 0" }}>
            Track overhead costs, utility bills, logistics & salaries subtracted from gross profit
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginLeft: "auto" }}>
          {/* Fiscal Year Filter */}
          <select
            value={selectedFY}
            onChange={(e) => setSelectedFY(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", fontWeight: 600, fontSize: "13px" }}
            aria-label="Select fiscal year"
          >
            {fyOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
            <option value="ALL">All Time</option>
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", fontWeight: 500, fontSize: "13px" }}
            aria-label="Filter by category"
          >
            <option value="All">All Categories</option>
            {EXPENSE_CATEGORY_LIST.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Sync / Refresh */}
          <button
            type="button"
            className="outline"
            onClick={() => {
              fetchExpensesData();
              showToast("✓ Live MySQL expenses ledger synchronized.");
            }}
            title="Sync and refresh expenses ledger"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <RotateCcw size={14} className={loading ? "spin" : ""} /> Sync
          </button>

          {/* CSV Export */}
          <button
            type="button"
            className="outline"
            onClick={handleExportCSV}
            title="Download CSV report"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Download size={14} /> Export CSV
          </button>

          {/* Add Expense Primary Button */}
          <button className="primary" onClick={handleOpenCreateModal} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={16} /> Add Expense
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS: 4 columns on Laptop, 2 columns on Mobile */}
      <ResponsiveKpiGrid cols={4}>
        {/* 1. Total Expenses */}
        <StatCard
          title={`Total Expenses (${selectedFY === "ALL" ? "All Time" : `FY ${selectedFY}`})`}
          value={formatIndianCurrency(totalAmount)}
          change={count > 0 ? `${count} Vouchers` : null}
          comparisonLabel=""
          trendType="neutral"
          fallbackBadge="No expenses logged"
          icon={Wallet}
          loading={loading}
        />

        {/* 2. Number of Expense Vouchers */}
        <StatCard
          title="Expense Count"
          value={String(count)}
          change={null}
          fallbackBadge={`In ${selectedFY === "ALL" ? "all records" : `FY ${selectedFY}`}`}
          icon={FileText}
          loading={loading}
        />

        {/* 3. Average Expense Size */}
        <StatCard
          title="Average Expense"
          value={formatIndianCurrency(avgExpense)}
          change={null}
          fallbackBadge="Per expense entry"
          icon={CreditCard}
          loading={loading}
        />

        {/* 4. Top Category */}
        <StatCard
          title="Top Cost Center"
          value={topCategory ? topCategory.category : "—"}
          change={topCategory ? formatIndianCurrency(topCategory.totalAmount) : null}
          comparisonLabel=""
          trendType="neutral"
          fallbackBadge="No category data"
          icon={Tag}
          loading={loading}
        />
      </ResponsiveKpiGrid>

      {/* Filter & Search Bar */}
      <div className="card" style={{ marginBottom: 16, padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
              }}
            />
            <input
              type="text"
              placeholder="Search expenses by title, voucher #, payee, or reference..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 34px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 13.5,
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--text-muted)", fontSize: 13 }}>
            <span>Showing: <strong style={{ color: "var(--text-main)" }}>{filteredExpenses.length}</strong> entries</span>
          </div>
        </div>
      </div>

      {/* EXPENSES REGISTER TABLE (Desktop / Tablet) */}
      <div className="card table-card" style={{ overflow: "hidden" }}>
        <div className="table-responsive" style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg-subtle, rgba(0,0,0,0.02))", borderBottom: "1px solid var(--border)" }}>
                <th
                  onClick={() => toggleSort("expenseNumber")}
                  style={{ cursor: "pointer", padding: "12px 14px", textAlign: "left", fontSize: 12, fontWeight: 700 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    Voucher # <ArrowUpDown size={12} />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("expenseDate")}
                  style={{ cursor: "pointer", padding: "12px 14px", textAlign: "left", fontSize: 12, fontWeight: 700 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    Date <ArrowUpDown size={12} />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("title")}
                  style={{ cursor: "pointer", padding: "12px 14px", textAlign: "left", fontSize: 12, fontWeight: 700 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    Title / Purpose <ArrowUpDown size={12} />
                  </div>
                </th>
                <th style={{ padding: "12px 14px", textAlign: "left", fontSize: 12, fontWeight: 700 }}>
                  Category
                </th>
                <th style={{ padding: "12px 14px", textAlign: "left", fontSize: 12, fontWeight: 700 }}>
                  Paid To
                </th>
                <th style={{ padding: "12px 14px", textAlign: "left", fontSize: 12, fontWeight: 700 }}>
                  Payment Mode
                </th>
                <th
                  onClick={() => toggleSort("amount")}
                  style={{ cursor: "pointer", padding: "12px 14px", textAlign: "right", fontSize: 12, fontWeight: 700 }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                    Amount (₹) <ArrowUpDown size={12} />
                  </div>
                </th>
                <th style={{ padding: "12px 14px", textAlign: "center", fontSize: 12, fontWeight: 700, width: 90 }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <Wallet size={36} style={{ color: "var(--border)", strokeWidth: 1.5 }} />
                      <strong style={{ fontSize: 15, color: "var(--text-main)" }}>No expenses recorded</strong>
                      <p style={{ margin: 0, fontSize: 13 }}>
                        {searchTerm
                          ? "No expense records matching your search criteria."
                          : `No expenses logged for ${selectedFY === "ALL" ? "the selected period" : `FY ${selectedFY}`}.`}
                      </p>
                      <button
                        className="primary"
                        onClick={handleOpenCreateModal}
                        style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
                      >
                        <Plus size={14} /> Add First Expense
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => {
                  const badgeStyle = CATEGORY_BADGE_COLORS[exp.category] || CATEGORY_BADGE_COLORS["Miscellaneous"];
                  return (
                    <tr
                      key={exp.id || exp.expenseNumber}
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <td style={{ padding: "12px 14px", fontFamily: "monospace", fontWeight: 700, fontSize: 13 }}>
                        {exp.expenseNumber}
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 13, color: "var(--text-muted)" }}>
                        {exp.expenseDate}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text-main)" }}>
                          {exp.title}
                        </div>
                        {exp.notes && (
                          <small style={{ color: "var(--text-muted)", fontSize: 11.5, display: "block" }}>
                            {exp.notes}
                          </small>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 9px",
                            borderRadius: 999,
                            fontSize: 11.5,
                            fontWeight: 700,
                            background: badgeStyle.bg,
                            color: badgeStyle.color,
                          }}
                        >
                          {exp.category}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 13, color: exp.paidTo ? "var(--text-main)" : "var(--text-muted)" }}>
                        {exp.paidTo || "—"}
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 13 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: exp.paymentMode === "Cash" ? "#10b981" : "#6366f1",
                            }}
                          />
                          {exp.paymentMode || "Cash"}
                        </span>
                        {exp.referenceNo && (
                          <small style={{ display: "block", color: "var(--text-muted)", fontSize: 11 }}>
                            Ref: {exp.referenceNo}
                          </small>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, fontSize: 14, color: "var(--text-main)" }}>
                        {formatIndianCurrency(exp.amount)}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => setViewingExpense(exp)}
                            title="View Expense Details"
                            style={{ padding: 4 }}
                          >
                            <Eye size={15} style={{ color: "var(--accent)" }} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => setExpenseToDelete(exp)}
                            title="Delete Expense"
                            style={{ padding: 4 }}
                          >
                            <Trash2 size={15} style={{ color: "var(--danger)" }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {expenseToDelete && (
        <div className="modal-backdrop" onClick={() => setExpenseToDelete(null)} style={{ zIndex: 9999 }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "rgba(239, 68, 68, 0.12)",
                  color: "#ef4444",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-main)" }}>
                  Delete Expense Voucher?
                </h3>
                <small style={{ color: "var(--text-muted)" }}>This action cannot be undone.</small>
              </div>
            </div>

            <p style={{ fontSize: 13.5, color: "var(--text-main)", margin: "0 0 16px 0", lineHeight: 1.5 }}>
              Are you sure you want to permanently delete expense voucher{" "}
              <strong>{expenseToDelete.expenseNumber}</strong> ({expenseToDelete.title}) for{" "}
              <strong>{formatIndianCurrency(expenseToDelete.amount)}</strong>?
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                className="outline"
                onClick={() => setExpenseToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                onClick={handleDeleteExpenseConfirm}
                disabled={isDeleting}
                style={{ background: "var(--danger)", borderColor: "var(--danger)" }}
              >
                {isDeleting ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expense Add / Edit Modal */}
      <ExpenseDetailsModal
        isOpen={!!viewingExpense}
        onClose={() => setViewingExpense(null)}
        expense={viewingExpense}
        onEdit={(exp) => {
          setViewingExpense(null);
          handleOpenEditModal(exp);
        }}
      />

      <ExpenseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveExpense}
        expenseToEdit={expenseToEdit}
      />
    </div>
  );
}
