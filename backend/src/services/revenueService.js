import {
  getRevenueSummary as getMetricsRevenueSummary,
  getQuarterlyBreakdown as getMetricsQuarterlyBreakdown,
  getCategoryTurnover as getMetricsCategoryTurnover,
  getPeriodComparison,
  resolveDateRange,
} from "./metrics/index.js";
import { getToday } from "../constants/erpConstants.js";

/**
 * Revenue Service delegating directly to shared metrics services
 */
export async function getRevenueSummary({ referenceDate = getToday(), fiscalYear = null } = {}) {
  const fyRange = fiscalYear || "fy";
  const revenueData = await getMetricsRevenueSummary(fyRange, referenceDate);

  // Like-for-like YoY comparison for the revenue card
  // If April 2026 is viewed or FYTD 2026-27 is viewed:
  const yoyComparison = await getPeriodComparison("revenue", "yoy", referenceDate, fyRange === "fy" || fyRange === "2026-27" ? "2026-04" : fyRange);

  // Average ticket QoQ comparison (vs previous quarter Q4)
  const avgTicketComparison = await getPeriodComparison("average_ticket", "prev_quarter", referenceDate);

  // Gross Margin %
  const grossMarginPct = revenueData.grossMarginPct;

  return {
    ...revenueData,
    // Gross Turnover uses taxable revenue (excluding GST)
    grossTurnover: revenueData.taxableRevenue,
    turnover: revenueData.taxableRevenue,
    gstCollected: revenueData.gstCollected,
    grossInvoiced: revenueData.grossInvoiced,
    grossMarginPct,
    grossProfit: revenueData.grossProfit,
    totalExpenses: revenueData.totalExpenses ?? 0,
    profitAfterExpense: revenueData.profitAfterExpense ?? revenueData.grossProfit,
    profitAfterExpenses: revenueData.profitAfterExpense ?? revenueData.grossProfit,
    netMarginPct: revenueData.netMarginPct,
    expenseCount: revenueData.expenseCount ?? 0,
    realizedPct: revenueData.realizedPct,
    averageTicket: revenueData.averageTicket,
    yoyComparison: {
      changePct: yoyComparison.changePct,
      label: yoyComparison.comparisonLabel,
      hasComparison: yoyComparison.hasComparison,
      previous: yoyComparison.previous,
    },
    avgTicketComparison: {
      changePct: avgTicketComparison.changePct,
      label: avgTicketComparison.comparisonLabel,
      hasComparison: avgTicketComparison.hasComparison,
      previous: avgTicketComparison.previous,
    },
  };
}

export async function getQuarterlyBreakdown({ referenceDate = getToday(), fiscalYear = null } = {}) {
  return await getMetricsQuarterlyBreakdown(fiscalYear, referenceDate);
}

export async function getCategoryTurnover({ referenceDate = getToday(), fiscalYear = null } = {}) {
  const fyRange = fiscalYear || "fy";
  return await getMetricsCategoryTurnover(fyRange, referenceDate);
}

export async function get12MonthCashFlow({ fiscalYear = null, referenceDate = getToday() } = {}) {
  const rev = await getMetricsRevenueSummary(fiscalYear || "all", referenceDate);
  return rev.monthlyTrend || [];
}
