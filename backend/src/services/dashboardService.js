import { Op } from "sequelize";
import { Client, Product, Invoice, Expense } from "../models/index.js";
import {
  getSalesSummary,
  getStockHealth,
  getReceivables,
  getPeriodComparison,
  getQuarterlyBreakdown,
  resolveDateRange,
  getRevenueSummary,
} from "./metrics/index.js";
import { getToday } from "../constants/erpConstants.js";

/**
 * Executive Dashboard Analytics Service
 * Single source of truth: delegates directly to shared metrics services.
 */
export async function getDashboardSummary({ referenceDate = getToday(), year = null } = {}) {
  const asOf = referenceDate || getToday();
  const fy = year || "fy";

  // 1. Sales & Revenue Summary for current FY (shared service)
  const salesSummary = await getSalesSummary(fy, asOf);

  // 1b. Expenses for the same selected time period
  const { startDate, endDate, isAllTime } = resolveDateRange(fy, asOf);
  const expenseWhere = {};
  if (!isAllTime) {
    expenseWhere.expenseDate = { [Op.between]: [startDate, endDate] };
  }
  const expenses = await Expense.findAll({
    where: expenseWhere,
    attributes: ["amount"],
  });
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const grossProfit = salesSummary.grossProfit || 0;
  const profitAfterExpense = grossProfit - totalExpenses;
  const netMarginPct = salesSummary.taxableRevenue > 0
    ? Math.round(((profitAfterExpense / salesSummary.taxableRevenue) * 100) * 10) / 10
    : null;

  // 2. Stock Health and Unit Balances (shared service)
  const stockHealth = await getStockHealth(asOf);

  // 3. Receivables & Outstanding (shared service)
  const receivables = await getReceivables(asOf);

  // 4. Clients KPI
  const totalClients = await Client.count();

  // 5. Active Catalogue KPI
  const activeProducts = await Product.count({ where: { isActive: true } });

  // 6. YoY comparison for Revenue
  const revComparison = await getPeriodComparison("revenue", "yoy", asOf, "2026-04");

  // Format warehouse units label: "525 Bags, 500 Liters"
  const warehouseUnitsFormatted = stockHealth.unitsSummary
    .map((u) => `${u.totalBalance} ${u.unit}`)
    .join(", ");

  // Low Stock Items (evaluated strictly by evaluateStockHealth rule)
  const lowStockItems = stockHealth.products.filter((p) => p.stockStatus === "Low Stock");

  // Recent Invoices
  const recentInvoices = await Invoice.findAll({
    where: { isCancelled: false },
    order: [["invoiceDate", "DESC"], ["createdAt", "DESC"]],
    limit: 5,
  });

  // 12-Month Trajectory for Dashboard chart
  const revenueSummaryData = await getRevenueSummary(fy, asOf);
  const monthlyTrendMap = {};
  for (const m of (revenueSummaryData.monthlyTrend || [])) {
    monthlyTrendMap[m.month] = m;
  }

  const startYear = parseInt((salesSummary.periodLabel || "2026-27").replace(/\D/g, "").slice(0, 4), 10) || 2026;
  const fyMonths = [
    { ym: `${startYear}-04`, name: "Apr" },
    { ym: `${startYear}-05`, name: "May" },
    { ym: `${startYear}-06`, name: "Jun" },
    { ym: `${startYear}-07`, name: "Jul" },
    { ym: `${startYear}-08`, name: "Aug" },
    { ym: `${startYear}-09`, name: "Sep" },
    { ym: `${startYear}-10`, name: "Oct" },
    { ym: `${startYear}-11`, name: "Nov" },
    { ym: `${startYear}-12`, name: "Dec" },
    { ym: `${startYear + 1}-01`, name: "Jan" },
    { ym: `${startYear + 1}-02`, name: "Feb" },
    { ym: `${startYear + 1}-03`, name: "Mar" },
  ];

  const trajectory = fyMonths.map((fm) => {
    const record = monthlyTrendMap[fm.ym];
    return {
      month: fm.name,
      monthKey: fm.ym,
      revenue: record ? record.turnover : 0,
      cost: record ? record.totalCost : 0,
      grossProfit: record ? record.grossProfit : 0,
      expenses: record ? record.expenses : 0,
      profitAfterExpense: record ? record.profitAfterExpense : 0,
    };
  });

  return {
    asOfDate: asOf,
    fiscalYear: salesSummary.periodLabel,
    kpis: {
      totalClients: {
        value: totalClients,
        changePct: null,
        label: "Registered accounts",
      },
      activeCatalogue: {
        value: activeProducts,
        changePct: null,
        label: "Active SKU catalogue",
      },
      warehouseUnits: {
        value: warehouseUnitsFormatted || "0 Units",
        unitsSummary: stockHealth.unitsSummary,
        totalInventoryValue: stockHealth.totalInventoryValue,
        label: "Stock balance at cost",
      },
      revenue: {
        value: salesSummary.taxableRevenue, // Taxable revenue (excluding GST)
        turnover: salesSummary.taxableRevenue,
        gstCollected: salesSummary.gstCollected,
        grossInvoiced: salesSummary.grossInvoiced,
        grossMarginPct: salesSummary.grossMarginPct,
        grossProfit,
        collectedAmount: salesSummary.collectedAmount,
        pendingDues: salesSummary.pendingDues,
        changePct: revComparison.changePct,
        changeLabel: revComparison.comparisonLabel,
        hasComparison: revComparison.hasComparison,
      },
      profitAfterExpense: {
        value: profitAfterExpense,
        grossProfit,
        totalExpenses,
        netMarginPct,
        changePct: null,
        label: `Net profit after expenses (${salesSummary.periodLabel || fy})`,
      },
      expenses: {
        value: totalExpenses,
        count: expenses.length,
        label: "Operating expenses",
      },
    },
    stockHealth: {
      healthCounts: stockHealth.healthCounts,
      lowStockItems,
      unitsSummary: stockHealth.unitsSummary,
      totalInventoryValue: stockHealth.totalInventoryValue,
    },
    receivables: {
      totalOutstanding: receivables.totalOutstanding,
      totalCollected: receivables.totalCollected,
      totalGrossInvoiced: receivables.totalGrossInvoiced,
    },
    recentSales: recentInvoices,
    trajectory,
  };
}
