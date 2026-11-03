import { Op } from "sequelize";
import { Invoice, Payment, Collection, InvoiceLine, Client } from "../../models/index.js";
import { resolveDateRange, formatISTDateString } from "./dateRangeHelper.js";
import { getToday, TRANSACTION_STATUSES, deriveTransactionStatus } from "../../constants/erpConstants.js";

/**
 * Calculates comprehensive Sales metrics for any specified period.
 * Strict definitions:
 * - Revenue/Turnover = TAXABLE amount of non-cancelled invoices (GST excluded).
 * - Gross Invoiced = Taxable + GST.
 * - Gross Profit = Taxable Revenue - Cost of Goods Sold.
 * - Gross Margin % = Gross Profit / Taxable Revenue.
 * - Average Ticket = Taxable Revenue / Invoice Count.
 */
export async function getSalesSummary(range = "fy", asOfDate = getToday()) {
  const { startDate, endDate, isAllTime, label } = resolveDateRange(range, asOfDate);
  const asOfStr = formatISTDateString(asOfDate);

  const whereClause = {
    isCancelled: false,
  };

  if (!isAllTime) {
    whereClause.invoiceDate = {
      [Op.between]: [startDate, endDate],
    };
  }

  const invoices = await Invoice.findAll({
    where: whereClause,
    include: [
      {
        model: Payment,
        as: "payments",
        attributes: ["id", "amount", "paymentDate", "paymentMode"],
      },
    ],
    order: [["invoiceDate", "ASC"], ["invoiceNumber", "ASC"]],
  });

  let taxableRevenue = 0;
  let gstCollected = 0;
  let grossInvoiced = 0;
  let totalCost = 0;
  let collectedAmount = 0;

  const counts = {
    all: invoices.length,
    paid: 0,
    partial: 0,
    unpaid: 0,
    overdue: 0,
    cancelled: 0,
  };

  for (const inv of invoices) {
    const taxable = Number(inv.taxableTotal || 0);
    const gst = Number(inv.gstTotal || 0);
    const grand = Number(inv.grandTotal || 0);
    const cost = Number(inv.totalCost || 0);

    // Sum actual payments recorded for this invoice
    const invPayments = inv.payments || [];
    const invPaid = invPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const paid = invPaid > 0 ? invPaid : Number(inv.paidAmount || 0);

    taxableRevenue += taxable;
    gstCollected += gst;
    grossInvoiced += grand;
    totalCost += cost;
    collectedAmount += Math.min(grand, paid);

    const derivedStatus = deriveTransactionStatus({
      grandTotal: grand,
      paidAmount: paid,
      dueDate: inv.dueDate,
      isCancelled: inv.isCancelled,
      asOfDate: asOfStr,
    });

    if (derivedStatus === TRANSACTION_STATUSES.PAID) counts.paid += 1;
    else if (derivedStatus === TRANSACTION_STATUSES.PARTIAL) counts.partial += 1;
    else if (derivedStatus === TRANSACTION_STATUSES.OVERDUE) {
      counts.overdue += 1;
      counts.partial += 1; // Overdue is a subset of pending/unsettled
    } else if (derivedStatus === TRANSACTION_STATUSES.UNPAID) counts.unpaid += 1;
    else if (derivedStatus === TRANSACTION_STATUSES.CANCELLED) counts.cancelled += 1;
  }

  // Dashboard/Sales metrics read collection totals directly from the Collection data
  const colSummary = await getCollections(range, asOfDate);
  const collectionsCollected = Number(colSummary.totalCollected || 0);
  const effectiveCollected = colSummary.paymentCount > 0 ? collectionsCollected : collectedAmount;

  const pendingDues = Math.max(0, grossInvoiced - effectiveCollected);
  const grossProfit = taxableRevenue - totalCost;
  const grossMarginPct = taxableRevenue > 0 ? (grossProfit / taxableRevenue) * 100 : null;
  const realizedPct = grossInvoiced > 0 ? (effectiveCollected / grossInvoiced) * 100 : null;
  const averageTicket = counts.all > 0 ? taxableRevenue / counts.all : null;
  const roundOff = Math.round((grossInvoiced - (taxableRevenue + gstCollected)) * 100) / 100;

  return {
    periodLabel: label,
    startDate,
    endDate,
    asOfDate: asOfStr,
    invoiceCount: counts.all,
    taxableRevenue,
    turnover: taxableRevenue,
    gstCollected,
    roundOff,
    grossInvoiced,
    totalCost,
    grossProfit,
    grossMarginPct: grossMarginPct !== null ? Math.round(grossMarginPct * 10) / 10 : null,
    collectedAmount: effectiveCollected,
    pendingDues,
    outstandingReceivables: pendingDues,
    realizedPct: realizedPct !== null ? Math.round(realizedPct * 10) / 10 : null,
    averageTicket: averageTicket !== null ? Math.round(averageTicket * 100) / 100 : null,
    counts: {
      ...counts,
      pending: counts.unpaid + counts.partial,
    },
  };
}

/**
 * Returns collections received in a date range
 */
export async function getCollections(range = "fy", asOfDate = getToday()) {
  const { startDate, endDate, isAllTime, label } = resolveDateRange(range, asOfDate);

  const whereClause = {
    status: { [Op.ne]: "Cancelled" },
  };
  if (!isAllTime) {
    const startUTC = new Date(`${startDate}T00:00:00+05:30`);
    const endUTC = new Date(`${endDate}T23:59:59.999+05:30`);
    whereClause.paymentDate = { [Op.between]: [startUTC, endUTC] };
  }

  const collections = await Collection.findAll({
    where: whereClause,
    order: [["paymentDate", "ASC"]],
  });

  let totalCollected = 0;
  const byMode = {};

  for (const c of collections) {
    const amt = Number(c.amount || 0);
    totalCollected += amt;
    const mode = c.paymentMode || "Other";
    byMode[mode] = (byMode[mode] || 0) + amt;
  }

  return {
    periodLabel: label,
    startDate,
    endDate,
    totalCollected,
    paymentCount: collections.length,
    byMode,
  };
}

/**
 * Computes all outstanding receivables as of a specific date
 */
export async function getReceivables(asOfDate = getToday()) {
  const asOfStr = formatISTDateString(asOfDate);

  const invoices = await Invoice.findAll({
    where: {
      isCancelled: false,
      invoiceDate: { [Op.lte]: asOfStr },
    },
    include: [
      {
        model: Payment,
        as: "payments",
        attributes: ["amount"],
      },
      {
        model: Client,
        as: "client",
        attributes: ["clientId", "name", "clientType", "paymentTerms"],
      },
    ],
  });

  let totalGrossInvoiced = 0;
  let totalCollected = 0;
  let totalOutstanding = 0;
  const clientBreakdown = {};

  for (const inv of invoices) {
    const grand = Number(inv.grandTotal || 0);
    const paid = (inv.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0) || Number(inv.paidAmount || 0);
    const bal = Math.max(0, grand - paid);

    totalGrossInvoiced += grand;
    totalCollected += paid;
    totalOutstanding += bal;

    const cId = inv.clientId || "UNKNOWN";
    if (!clientBreakdown[cId]) {
      clientBreakdown[cId] = {
        clientId: cId,
        clientName: inv.client?.name || inv.clientName,
        clientType: inv.client?.clientType || inv.clientType,
        totalInvoiced: 0,
        totalCollected: 0,
        outstanding: 0,
        invoiceCount: 0,
      };
    }
    clientBreakdown[cId].totalInvoiced += grand;
    clientBreakdown[cId].totalCollected += paid;
    clientBreakdown[cId].outstanding += bal;
    clientBreakdown[cId].invoiceCount += 1;
  }

  return {
    asOfDate: asOfStr,
    totalGrossInvoiced,
    totalCollected,
    totalOutstanding,
    clientBreakdown: Object.values(clientBreakdown),
  };
}

/**
 * Returns list and summary of overdue invoices as of a specific date
 */
export async function getOverdue(asOfDate = getToday()) {
  const asOfStr = formatISTDateString(asOfDate);

  const invoices = await Invoice.findAll({
    where: {
      isCancelled: false,
      invoiceDate: { [Op.lte]: asOfStr },
    },
    include: [
      {
        model: Payment,
        as: "payments",
        attributes: ["amount"],
      },
    ],
  });

  const overdueInvoices = [];
  let totalOverdueAmount = 0;

  for (const inv of invoices) {
    const grand = Number(inv.grandTotal || 0);
    const paid = (inv.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0) || Number(inv.paidAmount || 0);
    const bal = Math.max(0, grand - paid);
    const dueStr = inv.dueDate ? String(inv.dueDate).slice(0, 10) : inv.invoiceDate;

    if (bal > 0 && dueStr && dueStr < asOfStr) {
      totalOverdueAmount += bal;
      const dueTime = new Date(dueStr).getTime();
      const asOfTime = new Date(asOfStr).getTime();
      const daysOverdue = Math.max(0, Math.floor((asOfTime - dueTime) / (1000 * 60 * 60 * 24)));

      overdueInvoices.push({
        invoiceNumber: inv.invoiceNumber,
        clientId: inv.clientId,
        clientName: inv.clientName,
        invoiceDate: inv.invoiceDate,
        dueDate: dueStr,
        daysOverdue,
        grandTotal: grand,
        paidAmount: paid,
        balanceDue: bal,
      });
    }
  }

  return {
    asOfDate: asOfStr,
    count: overdueInvoices.length,
    totalOverdueAmount,
    overdueInvoices,
  };
}

