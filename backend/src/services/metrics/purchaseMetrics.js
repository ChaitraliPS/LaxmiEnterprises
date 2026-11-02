import { Op } from "sequelize";
import { Purchase, PurchaseLine, VendorPayment, Vendor } from "../../models/index.js";
import { resolveDateRange, formatISTDateString } from "./dateRangeHelper.js";
import { getToday, TRANSACTION_STATUSES, deriveTransactionStatus } from "../../constants/erpConstants.js";

/**
 * Returns comprehensive Procurement metrics
 * - Inward Total per bill = Server-calculated grand total
 * - Pending Vendor Dues = Purchase Bill Grand Totals - Vendor Payments
 */
export async function getPurchaseSummary(range = "fy", asOfDate = getToday()) {
  const { startDate, endDate, isAllTime, label } = resolveDateRange(range, asOfDate);
  const asOfStr = formatISTDateString(asOfDate);

  const whereClause = { isCancelled: false };
  if (!isAllTime) {
    whereClause.purchaseDate = { [Op.between]: [startDate, endDate] };
  }

  const purchases = await Purchase.findAll({
    where: whereClause,
    include: [
      {
        model: VendorPayment,
        as: "vendorPayments",
        attributes: ["amount"],
      },
      {
        model: PurchaseLine,
        as: "lines",
      },
    ],
    order: [["purchaseDate", "ASC"]],
  });

  let grandTotal = 0;
  let taxableTotal = 0;
  let gstTotal = 0;
  let paidTotal = 0;

  const counts = {
    all: purchases.length,
    paid: 0,
    partial: 0,
    unpaid: 0,
    overdue: 0,
    cancelled: 0,
  };

  const quantityByUnit = {};

  for (const p of purchases) {
    const lines = p.lines || [];
    let lineTaxable = 0;
    let lineGst = 0;
    let lineGrand = 0;

    for (const l of lines) {
      const tax = Number(l.taxableAmount || 0);
      const gst = Number(l.gstAmount || 0);
      lineTaxable += tax;
      lineGst += gst;
      lineGrand += Number(l.lineTotal || (tax + gst));

      const u = l.unitOfMeasure || "Units";
      quantityByUnit[u] = (quantityByUnit[u] || 0) + Number(l.quantity || 0);
    }

    // Server-calculated grandTotal: if lines exist use line sum, else fallback to header
    const purGrand = lineGrand > 0 ? lineGrand : Number(p.grandTotal || 0);
    const purTaxable = lineTaxable > 0 ? lineTaxable : Number(p.taxableTotal || purGrand);
    const purGst = lineGst > 0 ? lineGst : Number(p.gstTotal || 0);

    const vpPayments = p.vendorPayments || [];
    const vpSum = vpPayments.reduce((s, vp) => s + Number(vp.amount || 0), 0);
    const purPaid = vpSum > 0 ? vpSum : Number(p.paidAmount || 0);

    grandTotal += purGrand;
    taxableTotal += purTaxable;
    gstTotal += purGst;
    paidTotal += purPaid;

    const status = deriveTransactionStatus({
      grandTotal: purGrand,
      paidAmount: purPaid,
      dueDate: p.dueDate || p.purchaseDate,
      isCancelled: p.isCancelled,
      asOfDate: asOfStr,
    });

    if (status === TRANSACTION_STATUSES.PAID) counts.paid += 1;
    else if (status === TRANSACTION_STATUSES.PARTIAL) counts.partial += 1;
    else if (status === TRANSACTION_STATUSES.OVERDUE) {
      counts.overdue += 1;
      counts.partial += 1;
    } else if (status === TRANSACTION_STATUSES.UNPAID) counts.unpaid += 1;
    else if (status === TRANSACTION_STATUSES.CANCELLED) counts.cancelled += 1;
  }

  const pendingDues = Math.max(0, grandTotal - paidTotal);

  return {
    periodLabel: label,
    startDate,
    endDate,
    asOfDate: asOfStr,
    billCount: counts.all,
    grandTotal,
    taxableTotal,
    gstTotal,
    paidTotal,
    pendingVendorDues: pendingDues,
    quantityByUnit,
    counts: {
      ...counts,
      pending: counts.unpaid + counts.partial,
    },
  };
}

/**
 * Returns vendor payables as of a specific date
 */
export async function getVendorPayables(asOfDate = getToday()) {
  const asOfStr = formatISTDateString(asOfDate);

  const purchases = await Purchase.findAll({
    where: {
      isCancelled: false,
      purchaseDate: { [Op.lte]: asOfStr },
    },
    include: [
      {
        model: VendorPayment,
        as: "vendorPayments",
        attributes: ["amount"],
      },
      {
        model: Vendor,
        as: "vendor",
        attributes: ["vendorId", "name", "category"],
      },
    ],
  });

  let totalPayable = 0;
  let totalBilled = 0;
  let totalPaid = 0;
  const vendorBreakdown = {};

  for (const p of purchases) {
    const grand = Number(p.grandTotal || 0);
    const vpSum = (p.vendorPayments || []).reduce((s, vp) => s + Number(vp.amount || 0), 0);
    const paid = vpSum > 0 ? vpSum : Number(p.paidAmount || 0);
    const bal = Math.max(0, grand - paid);

    totalBilled += grand;
    totalPaid += paid;
    totalPayable += bal;

    const vId = p.vendorId || "UNKNOWN";
    if (!vendorBreakdown[vId]) {
      vendorBreakdown[vId] = {
        vendorId: vId,
        vendorName: p.vendor?.name || p.vendorName,
        category: p.vendor?.category || p.category,
        totalBilled: 0,
        totalPaid: 0,
        balanceDue: 0,
        billCount: 0,
      };
    }
    vendorBreakdown[vId].totalBilled += grand;
    vendorBreakdown[vId].totalPaid += paid;
    vendorBreakdown[vId].balanceDue += bal;
    vendorBreakdown[vId].billCount += 1;
  }

  return {
    asOfDate: asOfStr,
    totalBilled,
    totalPaid,
    totalPayable,
    vendorBreakdown: Object.values(vendorBreakdown),
  };
}

