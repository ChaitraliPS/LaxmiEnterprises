import { Client, Product, Invoice } from "../models/index.js";
import {
  getSalesSummary,
  getStockHealth,
  getReceivables,
  getPeriodComparison,
  getQuarterlyBreakdown,
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
        collectedAmount: salesSummary.collectedAmount,
        pendingDues: salesSummary.pendingDues,
        changePct: revComparison.changePct,
        changeLabel: revComparison.comparisonLabel,
        hasComparison: revComparison.hasComparison,
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
  };
}
