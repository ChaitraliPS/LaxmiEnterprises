import { Op } from "sequelize";
import { Invoice, InvoiceLine, Target, Product } from "../../models/index.js";
import { resolveDateRange, getFiscalYear, formatISTDateString } from "./dateRangeHelper.js";
import { getSalesSummary } from "./salesMetrics.js";
import { getToday, PRODUCT_CATEGORIES, TARGET_STATUSES } from "../../constants/erpConstants.js";

/**
 * Returns Revenue Summary including monthly breakdown
 */
export async function getRevenueSummary(range = "fy", asOfDate = getToday()) {
  const summary = await getSalesSummary(range, asOfDate);
  const { startDate, endDate, isAllTime } = resolveDateRange(range, asOfDate);

  const whereClause = { isCancelled: false };
  if (!isAllTime) {
    whereClause.invoiceDate = { [Op.between]: [startDate, endDate] };
  }

  const invoices = await Invoice.findAll({
    where: whereClause,
    include: [{ model: InvoiceLine, as: "lines" }],
    order: [["invoiceDate", "ASC"]],
  });

  // Group by month in IST (YYYY-MM)
  const monthlyMap = {};
  for (const inv of invoices) {
    const dStr = inv.invoiceDate || (inv.createdAt ? inv.createdAt.toISOString().slice(0, 10) : "");
    if (!dStr) continue;
    const ym = dStr.slice(0, 7); // "2026-04"

    if (!monthlyMap[ym]) {
      const [y, m] = ym.split("-").map(Number);
      const mName = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "short" });
      monthlyMap[ym] = {
        month: ym,
        monthName: `${mName} ${y}`,
        turnover: 0,
        gstCollected: 0,
        grossInvoiced: 0,
        totalCost: 0,
        invoiceCount: 0,
      };
    }

    const taxable = Number(inv.taxableTotal || 0);
    const gst = Number(inv.gstTotal || 0);
    const grand = Number(inv.grandTotal || 0);
    const cost = Number(inv.totalCost || 0);

    monthlyMap[ym].turnover += taxable;
    monthlyMap[ym].gstCollected += gst;
    monthlyMap[ym].grossInvoiced += grand;
    monthlyMap[ym].totalCost += cost;
    monthlyMap[ym].invoiceCount += 1;
  }

  const monthlyTrend = Object.values(monthlyMap).map((m) => {
    const gp = m.turnover - m.totalCost;
    const gm = m.turnover > 0 ? (gp / m.turnover) * 100 : null;
    return {
      ...m,
      grossProfit: gp,
      grossMarginPct: gm !== null ? Math.round(gm * 10) / 10 : null,
    };
  });

  return {
    ...summary,
    monthlyTrend,
  };
}

/**
 * Returns turnover by product category (Animal Feed vs Dairy)
 * Excludes GST from turnover.
 */
export async function getCategoryTurnover(range = "fy", asOfDate = getToday()) {
  const { startDate, endDate, isAllTime } = resolveDateRange(range, asOfDate);

  const whereClause = { isCancelled: false };
  if (!isAllTime) {
    whereClause.invoiceDate = { [Op.between]: [startDate, endDate] };
  }

  const invoices = await Invoice.findAll({
    where: whereClause,
    attributes: ["invoiceNumber", "invoiceDate"],
    include: [
      {
        model: InvoiceLine,
        as: "lines",
        include: [{ model: Product, as: "product", attributes: ["category", "unitOfMeasure"] }],
      },
    ],
  });

  const categoryMap = {
    [PRODUCT_CATEGORIES.ANIMAL_FEED]: {
      category: PRODUCT_CATEGORIES.ANIMAL_FEED,
      turnover: 0,
      gstAmount: 0,
      grossInvoiced: 0,
      totalCost: 0,
      quantity: 0,
      unit: "Bags",
    },
    [PRODUCT_CATEGORIES.DAIRY]: {
      category: PRODUCT_CATEGORIES.DAIRY,
      turnover: 0,
      gstAmount: 0,
      grossInvoiced: 0,
      totalCost: 0,
      quantity: 0,
      unit: "Liters",
    },
  };

  let totalTaxableAll = 0;

  for (const inv of invoices) {
    for (const line of inv.lines || []) {
      const prodCat = line.product?.category || (String(line.productName).toLowerCase().includes("milk") ? PRODUCT_CATEGORIES.DAIRY : PRODUCT_CATEGORIES.ANIMAL_FEED);
      const cat = prodCat === PRODUCT_CATEGORIES.DAIRY ? PRODUCT_CATEGORIES.DAIRY : PRODUCT_CATEGORIES.ANIMAL_FEED;

      const taxable = Number(line.taxableAmount || 0);
      const gst = Number(line.gstAmount || 0);
      const total = Number(line.lineTotal || (taxable + gst));
      const cost = Number(line.costPriceSnapshot || 0) * Number(line.quantity || 1);
      const qty = Number(line.quantity || 0);

      categoryMap[cat].turnover += taxable;
      categoryMap[cat].gstAmount += gst;
      categoryMap[cat].grossInvoiced += total;
      categoryMap[cat].totalCost += cost;
      categoryMap[cat].quantity += qty;

      totalTaxableAll += taxable;
    }
  }

  const categories = Object.values(categoryMap).map((c) => {
    const gp = c.turnover - c.totalCost;
    const gm = c.turnover > 0 ? (gp / c.turnover) * 100 : null;
    const share = totalTaxableAll > 0 ? (c.turnover / totalTaxableAll) * 100 : 0;
    return {
      ...c,
      sharePct: Math.round(share * 10) / 10,
      grossProfit: gp,
      grossMarginPct: gm !== null ? Math.round(gm * 10) / 10 : null,
    };
  });

  return {
    totalTaxable: totalTaxableAll,
    categories,
  };
}

/**
 * Returns quarterly breakdown with targets and computed statuses
 * Statuses: Not started, Tracking, Behind, Achieved, Missed
 */
export async function getQuarterlyBreakdown(targetFY = null, asOfDate = getToday()) {
  const asOfStr = formatISTDateString(asOfDate);
  const fy = targetFY || getFiscalYear(asOfStr);
  const startYear = parseInt(fy.split("-")[0], 10);

  const quarters = [
    { q: "Q1", label: "Q1 (Apr - Jun)", start: `${startYear}-04-01`, end: `${startYear}-06-30` },
    { q: "Q2", label: "Q2 (Jul - Sep)", start: `${startYear}-07-01`, end: `${startYear}-09-30` },
    { q: "Q3", label: "Q3 (Oct - Dec)", start: `${startYear}-10-01`, end: `${startYear}-12-31` },
    { q: "Q4", label: "Q4 (Jan - Mar)", start: `${startYear + 1}-01-01`, end: `${startYear + 1}-03-31` },
  ];

  // Fetch targets from targets table
  const dbTargets = await Target.findAll({
    where: { fiscalYear: fy },
  });
  const targetMap = new Map(dbTargets.map((t) => [t.quarter, Number(t.targetAmount || 0)]));

  const resultQuarters = [];
  let fyTurnover = 0;
  let fyTargetTotal = 0;

  for (const qDef of quarters) {
    const targetAmt = targetMap.get(qDef.q) || 0;
    fyTargetTotal += targetAmt;

    // Fetch taxable revenue for this quarter
    const invoices = await Invoice.findAll({
      where: {
        isCancelled: false,
        invoiceDate: { [Op.between]: [qDef.start, qDef.end] },
      },
      attributes: ["taxableTotal"],
    });

    const turnover = invoices.reduce((s, inv) => s + Number(inv.taxableTotal || 0), 0);
    fyTurnover += turnover;

    const achPct = targetAmt > 0 ? (turnover / targetAmt) * 100 : null;

    // Derive status based on anchor date
    let status = TARGET_STATUSES.NOT_STARTED;
    if (asOfStr < qDef.start) {
      status = TARGET_STATUSES.NOT_STARTED;
    } else if (asOfStr > qDef.end) {
      status = turnover >= targetAmt && targetAmt > 0 ? TARGET_STATUSES.ACHIEVED : TARGET_STATUSES.MISSED;
    } else {
      // Currently in progress
      if (targetAmt > 0) {
        // Proportion of days elapsed
        const totalDays = (new Date(qDef.end).getTime() - new Date(qDef.start).getTime()) / (1000 * 60 * 60 * 24);
        const elapsedDays = (new Date(asOfStr).getTime() - new Date(qDef.start).getTime()) / (1000 * 60 * 60 * 24);
        const expPct = (elapsedDays / totalDays) * 100;
        status = achPct >= expPct ? TARGET_STATUSES.TRACKING : TARGET_STATUSES.BEHIND;
      } else {
        status = TARGET_STATUSES.TRACKING;
      }
    }

    resultQuarters.push({
      quarter: qDef.q,
      label: qDef.label,
      startDate: qDef.start,
      endDate: qDef.end,
      targetAmount: targetAmt,
      turnover,
      achievedPct: achPct !== null ? Math.round(achPct * 10) / 10 : null,
      status,
    });
  }

  return {
    fiscalYear: fy,
    asOfDate: asOfStr,
    totalTarget: fyTargetTotal,
    totalTurnover: fyTurnover,
    quarters: resultQuarters,
  };
}

