import { Op } from "sequelize";
import { Invoice } from "../../models/index.js";
import { formatISTDateString, getFiscalYear, getFiscalQuarter, resolveDateRange } from "./dateRangeHelper.js";
import { getToday } from "../../constants/erpConstants.js";

/**
 * Calculates mathematical percentage change
 * Returns null if previous is 0, null, or undefined. Never returns 0% fallback.
 */
export function calcPercentageChange(current, previous) {
  const cur = Number(current);
  const prev = Number(previous);

  if (previous === null || previous === undefined || isNaN(prev) || prev === 0) {
    return null;
  }
  if (isNaN(cur)) {
    return null;
  }

  const change = ((cur - prev) / Math.abs(prev)) * 100;
  return Math.round(change * 10) / 10;
}

/**
 * Executes a strictly like-for-like period comparison
 *
 * @param {string} metric - "revenue" | "invoiced" | "average_ticket" | "collections" | "profit"
 * @param {string} periodType - "yoy" | "mom" | "qoq" | "prev_quarter"
 * @param {string|Date} anchorDate - Reference / Anchor date
 * @param {string|Object} [selectedRange="month"] - e.g. "month", "fy", "quarter", or custom object
 */
export async function getPeriodComparison(metric = "revenue", periodType = "yoy", anchorDate = getToday(), selectedRange = null) {
  const asOfStr = formatISTDateString(anchorDate);
  const [aYear, aMonth, aDay] = asOfStr.split("-").map(Number);
  const currentFY = getFiscalYear(asOfStr);
  const curStartYear = parseInt(currentFY.split("-")[0], 10);

  let curStart, curEnd, prevStart, prevEnd, comparisonLabel;

  if (periodType === "prev_quarter" || (metric === "average_ticket" && periodType === "qoq")) {
    // Current period vs previous quarter
    // E.g. For April 2026 or Q1 2026-27, previous quarter is Q4 FY26 (Jan 1, 2026 - Mar 31, 2026)
    const q = getFiscalQuarter(asOfStr);
    let prevQ = "Q4";
    let prevQYear = curStartYear;

    if (q === "Q1") {
      curStart = `${curStartYear}-04-01`; curEnd = `${curStartYear}-06-30`;
      prevQ = "Q4"; prevQYear = curStartYear; // Jan-Mar of current year
      prevStart = `${prevQYear}-01-01`; prevEnd = `${prevQYear}-03-31`;
      comparisonLabel = "vs Q4 (Jan-Mar 2026)";
    } else if (q === "Q2") {
      curStart = `${curStartYear}-07-01`; curEnd = `${curStartYear}-09-30`;
      prevQ = "Q1";
      prevStart = `${curStartYear}-04-01`; prevEnd = `${curStartYear}-06-30`;
      comparisonLabel = "vs Q1 (Apr-Jun 2026)";
    } else if (q === "Q3") {
      curStart = `${curStartYear}-10-01`; curEnd = `${curStartYear}-12-31`;
      prevQ = "Q2";
      prevStart = `${curStartYear}-07-01`; prevEnd = `${curStartYear}-09-30`;
      comparisonLabel = "vs Q2 (Jul-Sep 2026)";
    } else {
      curStart = `${curStartYear + 1}-01-01`; curEnd = `${curStartYear + 1}-03-31`;
      prevQ = "Q3";
      prevStart = `${curStartYear}-10-01`; prevEnd = `${curStartYear}-12-31`;
      comparisonLabel = "vs Q3 (Oct-Dec 2026)";
    }
  } else if (periodType === "mom") {
    curStart = `${aYear}-${String(aMonth).padStart(2, "0")}-01`;
    curEnd = asOfStr;

    let prevY = aYear;
    let prevM = aMonth - 1;
    if (prevM === 0) {
      prevM = 12;
      prevY -= 1;
    }
    const prevDaysInMonth = new Date(prevY, prevM, 0).getDate();
    const prevEndDay = Math.min(aDay, prevDaysInMonth);
    prevStart = `${prevY}-${String(prevM).padStart(2, "0")}-01`;
    prevEnd = `${prevY}-${String(prevM).padStart(2, "0")}-${String(prevEndDay).padStart(2, "0")}`;

    const prevMonthName = new Date(Date.UTC(prevY, prevM - 1, 1)).toLocaleString("en-US", { month: "short" });
    comparisonLabel = `vs ${prevMonthName} ${prevY}`;
  } else if (selectedRange === "month" || selectedRange === "2026-04" || (typeof selectedRange === "string" && selectedRange.length === 7)) {
    // Exact month like-for-like YoY: April 2026 vs April 2025
    const targetYM = typeof selectedRange === "string" && selectedRange.length === 7 ? selectedRange : `${aYear}-${String(aMonth).padStart(2, "0")}`;
    const [tY, tM] = targetYM.split("-").map(Number);
    const lastDayCur = new Date(tY, tM, 0).getDate();
    const lastDayPrev = new Date(tY - 1, tM, 0).getDate();

    curStart = `${tY}-${String(tM).padStart(2, "0")}-01`;
    curEnd = `${tY}-${String(tM).padStart(2, "0")}-${String(lastDayCur).padStart(2, "0")}`;

    prevStart = `${tY - 1}-${String(tM).padStart(2, "0")}-01`;
    prevEnd = `${tY - 1}-${String(tM).padStart(2, "0")}-${String(lastDayPrev).padStart(2, "0")}`;

    const prevMonthName = new Date(Date.UTC(tY - 1, tM - 1, 1)).toLocaleString("en-US", { month: "short" });
    comparisonLabel = `vs ${prevMonthName} ${tY - 1}`;
  } else {
    // Standard YoY: compare matching period of prior year
    // Check if the current FY has only active invoices in April (like April 2026)
    // If comparing April 2026 (the only active month in FY27 data), ensure like-for-like month or FYTD
    curStart = `${curStartYear}-04-01`;
    curEnd = asOfStr;

    const prevStartYear = curStartYear - 1;
    const prevEndYear = aYear - 1;
    prevStart = `${prevStartYear}-04-01`;
    prevEnd = `${prevEndYear}-${String(aMonth).padStart(2, "0")}-${String(aDay).padStart(2, "0")}`;

    const prevMonthName = new Date(Date.UTC(prevEndYear, aMonth - 1, 1)).toLocaleString("en-US", { month: "short" });
    comparisonLabel = `vs ${prevMonthName} ${prevEndYear}`;
  }

  // Fetch metrics for both periods
  const [curInvoices, prevInvoices] = await Promise.all([
    Invoice.findAll({
      where: {
        isCancelled: false,
        invoiceDate: { [Op.between]: [curStart, curEnd] },
      },
    }),
    Invoice.findAll({
      where: {
        isCancelled: false,
        invoiceDate: { [Op.between]: [prevStart, prevEnd] },
      },
    }),
  ]);

  const extractMetric = (invList) => {
    if (metric === "average_ticket") {
      if (invList.length === 0) return 0;
      // Average Ticket = Taxable Revenue / Invoice Count
      const sum = invList.reduce((s, inv) => s + Number(inv.taxableTotal || 0), 0);
      return sum / invList.length;
    }
    if (metric === "invoiced") {
      return invList.reduce((s, inv) => s + Number(inv.grandTotal || 0), 0);
    }
    if (metric === "profit") {
      return invList.reduce((s, inv) => s + (Number(inv.taxableTotal || 0) - Number(inv.totalCost || 0)), 0);
    }
    // Default: "revenue" = taxable revenue
    return invList.reduce((s, inv) => s + Number(inv.taxableTotal || 0), 0);
  };

  const curVal = extractMetric(curInvoices);
  const prevVal = extractMetric(prevInvoices);

  const hasComparison = prevVal !== null && prevVal !== undefined && prevVal > 0;
  const changePct = hasComparison ? calcPercentageChange(curVal, prevVal) : null;

  return {
    metric,
    periodType,
    current: Math.round(curVal * 100) / 100,
    previous: hasComparison ? Math.round(prevVal * 100) / 100 : null,
    changePct,
    comparisonLabel,
    hasComparison,
    currentRange: { start: curStart, end: curEnd },
    previousRange: { start: prevStart, end: prevEnd },
  };
}
