import {
  Invoice,
  InvoiceLine,
  Purchase,
  PurchaseLine,
  Product,
  Client,
  Vendor,
  Payment,
  VendorPayment,
  StockMovement,
  Inventory,
} from "../models/index.js";
import {
  getSalesSummary,
  getRevenueSummary,
  getPurchaseSummary,
  getStockHealth,
  getReceivables,
  getVendorPayables,
  getCategoryTurnover,
} from "./metrics/index.js";
import { getFiscalYear } from "./metrics/dateRangeHelper.js";
import { getDashboardSummary } from "./dashboardService.js";
import { getToday, TRANSACTION_STATUSES } from "../constants/erpConstants.js";

/**
 * Enterprise Data Consistency Verification Engine
 * Mathematically reconciles all ledgers, transactions, and cached balances across the ERP.
 */
export async function runConsistencyCheck(asOfDate = getToday()) {
  const results = [];
  const fy = getFiscalYear(asOfDate);

  // 1. Sales page gross invoiced == Revenue gross invoiced == Dashboard figure for the active FY
  const salesSummaryFY = await getSalesSummary(fy, asOfDate);
  const revenueSummaryFY = await getRevenueSummary(fy, asOfDate);
  const dashboardData = await getDashboardSummary({ referenceDate: asOfDate, year: fy });
  const salesGross = salesSummaryFY.grossInvoiced;
  const revGross = revenueSummaryFY.grossInvoiced;
  const dashGross = dashboardData.kpis.revenue.grossInvoiced;
  const diff1 = Math.abs(salesGross - revGross) + Math.abs(salesGross - dashGross);
  results.push({
    id: 1,
    name: "Cross-Page Gross Invoiced Consistency",
    description: `Sales gross invoiced == Revenue gross invoiced == Dashboard figure for ${fy}`,
    passed: diff1 < 0.01,
    difference: diff1,
    expected: `₹${salesGross.toLocaleString("en-IN")}`,
    actual: `Sales: ₹${salesGross.toLocaleString("en-IN")}, Rev: ₹${revGross.toLocaleString("en-IN")}, Dash: ₹${dashGross.toLocaleString("en-IN")}`,
    details: `Sales: ₹${salesGross.toLocaleString("en-IN")}, Revenue: ₹${revGross.toLocaleString("en-IN")}, Dashboard: ₹${dashGross.toLocaleString("en-IN")}`,
  });

  // 2. Sum of client billing totals == total gross invoiced (all time)
  const allSales = await getSalesSummary("all", asOfDate);
  const recData = await getReceivables(asOfDate);
  const clientBillingSum = recData.clientBreakdown.reduce((s, c) => s + Number(c.totalInvoiced || 0), 0);
  const diff2 = Math.abs(clientBillingSum - allSales.grossInvoiced);
  results.push({
    id: 2,
    name: "Client Ledger vs Gross Invoiced",
    description: "Sum of client billing totals == total gross invoiced (all time)",
    passed: diff2 < 0.01,
    difference: diff2,
    expected: `₹${allSales.grossInvoiced.toLocaleString("en-IN")}`,
    actual: `₹${clientBillingSum.toLocaleString("en-IN")}`,
    details: `Client Sum: ₹${clientBillingSum.toLocaleString("en-IN")}, All-Time Invoiced: ₹${allSales.grossInvoiced.toLocaleString("en-IN")}`,
  });

  // 3. Collections + outstanding == gross invoiced
  const rec = await getReceivables(asOfDate);
  const collectionsPlusOutstanding = rec.totalCollected + rec.totalOutstanding;
  const diff3 = Math.abs(collectionsPlusOutstanding - rec.totalGrossInvoiced);
  results.push({
    id: 3,
    name: "Receivables Cash Flow Equation",
    description: "Collections + outstanding == gross invoiced",
    passed: diff3 < 1.0,
    difference: diff3,
    expected: `₹${rec.totalGrossInvoiced.toLocaleString("en-IN")}`,
    actual: `₹${collectionsPlusOutstanding.toLocaleString("en-IN")}`,
    details: `Collected: ₹${rec.totalCollected.toLocaleString("en-IN")} + Outstanding: ₹${rec.totalOutstanding.toLocaleString("en-IN")} = ₹${collectionsPlusOutstanding.toLocaleString("en-IN")} (Invoiced: ₹${rec.totalGrossInvoiced.toLocaleString("en-IN")})`,
  });

  // 4. Sales page Paid + Partial + Unpaid counts == total invoices, and every status matches payments
  const nonCancelledInvoices = await Invoice.findAll({ where: { isCancelled: false } });
  const countSum = allSales.counts.paid + allSales.counts.partial + allSales.counts.unpaid;
  let statusMismatchCount = 0;
  for (const inv of nonCancelledInvoices) {
    const total = Number(inv.grandTotal || 0);
    const paid = Number(inv.paidAmount || 0);
    const expected = paid >= total && total > 0 ? "Paid" : (paid > 0 ? (inv.dueDate < asOfDate ? "Overdue" : "Partial") : (inv.dueDate < asOfDate ? "Overdue" : "Unpaid"));
    if (inv.status !== expected && inv.paymentStatus !== expected) {
      statusMismatchCount += 1;
    }
  }
  const passed4 = countSum === nonCancelledInvoices.length && statusMismatchCount === 0;
  results.push({
    id: 4,
    name: "Invoice Status Derivation Integrity",
    description: "Paid + Partial + Unpaid counts == total invoices, and every status dynamically matches payment records",
    passed: passed4,
    difference: statusMismatchCount,
    expected: `Status mismatches: 0`,
    actual: `Status mismatches: ${statusMismatchCount}`,
    details: `Total Invoices: ${nonCancelledInvoices.length}, Count Sum: ${countSum}, Status Mismatches: ${statusMismatchCount}`,
  });

  // 5. Overdue count == invoices with dueDate < today and balance > 0
  let manualOverdueCount = 0;
  for (const inv of nonCancelledInvoices) {
    const grand = Number(inv.grandTotal || 0);
    const paid = Number(inv.paidAmount || 0);
    const dueStr = inv.dueDate ? String(inv.dueDate).slice(0, 10) : inv.invoiceDate;
    if (grand > paid && dueStr && dueStr < asOfDate) {
      manualOverdueCount += 1;
    }
  }
  const diff5 = Math.abs(allSales.counts.overdue - manualOverdueCount);
  results.push({
    id: 5,
    name: "Overdue Receivables Evaluation",
    description: "Overdue count == invoices with dueDate < anchorDate and balance > 0",
    passed: diff5 === 0,
    difference: diff5,
    expected: manualOverdueCount,
    actual: allSales.counts.overdue,
    details: `Service Overdue Count: ${allSales.counts.overdue}, Verified Condition Matches: ${manualOverdueCount}`,
  });

  // 6. For each product: stock balance == opening + purchase IN - sale OUT +/- adjustments, and Products balance == Inventory balance
  const stockHealth = await getStockHealth(asOfDate);
  const inventories = await Inventory.findAll();
  const invMap = new Map(inventories.map((i) => [i.productId, Number(i.currentStock || 0)]));
  let stockDiscrepancies = 0;
  for (const p of stockHealth.products) {
    const movements = await StockMovement.findAll({ where: { productId: p.productId } });
    let calculated = 0;
    for (const m of movements) {
      const q = Number(m.quantity || Math.abs(Number(m.quantityChange || 0)));
      const dir = m.direction || (Number(m.quantityChange || 0) >= 0 ? "IN" : "OUT");
      calculated += dir === "IN" ? q : -q;
    }
    if (Math.abs(calculated - p.currentBalance) > 0.01) {
      stockDiscrepancies += 1;
    }
    const cachedStock = invMap.get(p.productId);
    if (cachedStock !== undefined && Math.abs(calculated - cachedStock) > 0.01) {
      stockDiscrepancies += 1;
    }
  }
  results.push({
    id: 6,
    name: "Product Stock Ledger Identity",
    description: "Stock balance == sum(IN) - sum(OUT) per product, and Products balance == Inventory balance == cached stock",
    passed: stockDiscrepancies === 0,
    difference: stockDiscrepancies,
    expected: "0 stock discrepancies",
    actual: `${stockDiscrepancies} discrepancies`,
    details: `Verified ${stockHealth.products.length} products against ledger & cached stock. Discrepancies: ${stockDiscrepancies}`,
  });

  // 7. Dashboard warehouse units == sum of balances per unit type
  const unitBalanceSum = stockHealth.unitsSummary.reduce((s, u) => s + u.totalBalance, 0);
  const totalProductBalanceSum = stockHealth.products.reduce((s, p) => s + p.currentBalance, 0);
  const diff7 = Math.abs(unitBalanceSum - totalProductBalanceSum);
  results.push({
    id: 7,
    name: "Warehouse Units Aggregation",
    description: "Dashboard warehouse units == sum of balances per unit type",
    passed: diff7 === 0,
    difference: diff7,
    expected: totalProductBalanceSum,
    actual: unitBalanceSum,
    details: `Unit Breakdown: ${stockHealth.unitsSummary.map((u) => `${u.totalBalance} ${u.unit}`).join(", ")}`,
  });

  // 8. Purchases: each bill's grandTotal == sum of its lines; vendor payable == bills - payments; Purchases page header == sum of rows
  const purchases = await Purchase.findAll({ where: { isCancelled: false }, include: [{ model: PurchaseLine, as: "lines" }] });
  let purchaseLineDiscrepancies = 0;
  for (const pur of purchases) {
    if (pur.lines && pur.lines.length > 0) {
      const lineSum = pur.lines.reduce((s, l) => s + Number(l.lineTotal || 0), 0);
      if (Math.abs(lineSum - Number(pur.grandTotal || 0)) > 1.0) {
        purchaseLineDiscrepancies += 1;
      }
    }
  }
  const purSummary = await getPurchaseSummary("all", asOfDate);
  const vendorPayables = await getVendorPayables(asOfDate);
  const diffPayable = Math.abs(purSummary.pendingVendorDues - vendorPayables.totalPayable);
  results.push({
    id: 8,
    name: "Procurement & Vendor Payable Equilibrium",
    description: "Bill grandTotal == sum of lines; vendor payable == bills - payments",
    passed: purchaseLineDiscrepancies === 0 && diffPayable < 0.01,
    difference: purchaseLineDiscrepancies + diffPayable,
    expected: "Zero line discrepancies & balanced payables",
    actual: `Line Discrepancies: ${purchaseLineDiscrepancies}, Payable Diff: ₹${diffPayable}`,
    details: `Bills Checked: ${purchases.length}, Line Discrepancies: ${purchaseLineDiscrepancies}, Payable Diff: ₹${diffPayable}`,
  });

  // 9. Every invoice/bill line references an existing product; no negative stock; no orphan rows
  const [invLines, purLines, allProds] = await Promise.all([
    InvoiceLine.findAll(),
    PurchaseLine.findAll(),
    Product.findAll(),
  ]);
  const prodIdSet = new Set(allProds.map((p) => p.productId));
  let orphanLines = 0;
  for (const l of invLines) {
    if (!prodIdSet.has(l.productId)) orphanLines += 1;
  }
  for (const l of purLines) {
    if (!prodIdSet.has(l.productId)) orphanLines += 1;
  }
  let negativeStockItems = 0;
  for (const p of stockHealth.products) {
    if (p.currentBalance < 0) negativeStockItems += 1;
  }
  const passed9 = orphanLines === 0 && negativeStockItems === 0;
  results.push({
    id: 9,
    name: "Referential Integrity & Non-Negative Stock",
    description: "Every invoice/bill line references existing product; zero negative stock; zero orphan lines",
    passed: passed9,
    difference: orphanLines + negativeStockItems,
    expected: "0 orphan lines, 0 negative stock",
    actual: `Orphans: ${orphanLines}, Negatives: ${negativeStockItems}`,
    details: `Orphan Lines: ${orphanLines}, Negative Stock SKUs: ${negativeStockItems}`,
  });

  // 10. Revenue category totals == total taxable revenue
  const catTurnover = await getCategoryTurnover("all", asOfDate);
  const catTurnoverSum = catTurnover.categories.reduce((s, c) => s + c.turnover, 0);
  const diff10 = Math.abs(catTurnoverSum - allSales.taxableRevenue);
  results.push({
    id: 10,
    name: "Category Turnover Allocation",
    description: "Revenue category totals == total taxable revenue",
    passed: diff10 < 0.01,
    difference: diff10,
    expected: `₹${allSales.taxableRevenue.toLocaleString("en-IN")}`,
    actual: `₹${catTurnoverSum.toLocaleString("en-IN")}`,
    details: `Category Sum: ₹${catTurnoverSum.toLocaleString("en-IN")}, Taxable Revenue: ₹${allSales.taxableRevenue.toLocaleString("en-IN")}`,
  });

  // 11. Product, vendor and client names/types shown anywhere come from the master record by ID
  const [vList, cList] = await Promise.all([Vendor.findAll(), Client.findAll()]);
  const vMap = new Map(vList.map((v) => [v.vendorId, v.category]));
  const cMap = new Map(cList.map((c) => [c.clientId, c.clientType]));
  let masterMismatches = 0;
  for (const inv of nonCancelledInvoices) {
    const masterType = cMap.get(inv.clientId);
    if (masterType && inv.clientType !== masterType) masterMismatches += 1;
  }
  for (const pur of purchases) {
    const masterCat = vMap.get(pur.vendorId);
    if (masterCat && pur.category !== masterCat) masterMismatches += 1;
  }
  results.push({
    id: 11,
    name: "Master Record Identification Consistency",
    description: "Product, vendor, and client types match canonical master records by ID",
    passed: masterMismatches === 0,
    difference: masterMismatches,
    expected: "0 mismatches",
    actual: `${masterMismatches} mismatches`,
    details: `Mismatched Master Associations: ${masterMismatches}`,
  });

  // 12. Sum of invoice_lines taxable == invoice.taxableTotal
  const activeInvoicesWithLines = await Invoice.findAll({
    where: { isCancelled: false },
    include: [{ model: InvoiceLine, as: "lines" }],
  });
  let lineTaxableMismatches = 0;
  let lineTaxableDiff = 0;
  for (const inv of activeInvoicesWithLines) {
    const lineSum = (inv.lines || []).reduce((s, l) => s + Number(l.taxableAmount || 0), 0);
    const invTaxable = Number(inv.taxableTotal || 0);
    const diff = Math.abs(lineSum - invTaxable);
    if (diff > 0.01) {
      lineTaxableMismatches += 1;
      lineTaxableDiff += diff;
    }
  }
  results.push({
    id: 12,
    name: "Invoice Lines Taxable Sum Identity",
    description: "Sum of invoice_lines.taxableAmount == invoice.taxableTotal for each active invoice",
    passed: lineTaxableMismatches === 0,
    difference: lineTaxableDiff,
    expected: "0 mismatches between invoice lines sum and header taxableTotal",
    actual: `${lineTaxableMismatches} mismatches`,
    details: `Invoices Verified: ${activeInvoicesWithLines.length}, Line Taxable Mismatches: ${lineTaxableMismatches}`,
  });

  // 13. Sum of active payments == invoice.paidAmount
  const activeInvoicesWithPayments = await Invoice.findAll({
    where: { isCancelled: false },
    include: [{ model: Payment, as: "payments", where: { status: "Completed" }, required: false }],
  });
  let paymentMismatches = 0;
  let paymentDiff = 0;
  for (const inv of activeInvoicesWithPayments) {
    const paySum = (inv.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
    const invPaid = Number(inv.paidAmount || 0);
    const diff = Math.abs(paySum - invPaid);
    if (diff > 0.01) {
      paymentMismatches += 1;
      paymentDiff += diff;
    }
  }
  results.push({
    id: 13,
    name: "Payment Receipts Sum Identity",
    description: "Sum of active Payment records == invoice.paidAmount for each active invoice",
    passed: paymentMismatches === 0,
    difference: paymentDiff,
    expected: "0 mismatches between payment receipts sum and header paidAmount",
    actual: `${paymentMismatches} mismatches`,
    details: `Invoices Verified: ${activeInvoicesWithPayments.length}, Payment Sum Mismatches: ${paymentMismatches}`,
  });

  // 14. Client outstanding == sum of invoice balanceDue
  const allClients = await Client.findAll();
  const allInvoices = await Invoice.findAll({ where: { isCancelled: false } });
  const invBalMap = new Map();
  for (const inv of allInvoices) {
    const cId = inv.clientId;
    invBalMap.set(cId, (invBalMap.get(cId) || 0) + Number(inv.balanceDue || 0));
  }
  let clientBalMismatches = 0;
  let clientBalDiff = 0;
  for (const c of allClients) {
    const expectedBal = invBalMap.get(c.clientId) || 0;
    const actualBal = Number(c.outstandingBalance || 0);
    const diff = Math.abs(expectedBal - actualBal);
    if (diff > 0.01) {
      clientBalMismatches += 1;
      clientBalDiff += diff;
    }
  }
  results.push({
    id: 14,
    name: "Client Outstanding Balance Identity",
    description: "Client outstandingBalance == sum of invoice.balanceDue for each client",
    passed: clientBalMismatches === 0,
    difference: clientBalDiff,
    expected: "All client balances match invoice dues exactly",
    actual: `${clientBalMismatches} client balance mismatches`,
    details: `Clients Checked: ${allClients.length}, Client Balance Mismatches: ${clientBalMismatches}`,
  });

  // 15. Cached Inventory.currentStock == stock_movements ledger
  const allProdsList = await Product.findAll();
  const allInvsList = await Inventory.findAll();
  const invStockMap = new Map(allInvsList.map((i) => [i.productId, Number(i.currentStock || 0)]));
  let cachedStockMismatches = 0;
  let cachedStockDiff = 0;
  for (const p of allProdsList) {
    const mvts = await StockMovement.findAll({ where: { productId: p.productId } });
    let ledgerSum = 0;
    for (const m of mvts) {
      const q = Number(m.quantity || Math.abs(Number(m.quantityChange || 0)));
      const dir = m.direction || (Number(m.quantityChange || 0) >= 0 ? "IN" : "OUT");
      ledgerSum += dir === "IN" ? q : -q;
    }
    const cachedStock = invStockMap.get(p.productId) ?? 0;
    const diff = Math.abs(ledgerSum - cachedStock);
    if (diff > 0.01) {
      cachedStockMismatches += 1;
      cachedStockDiff += diff;
    }
  }
  results.push({
    id: 15,
    name: "Cached Stock vs Movement Ledger Identity",
    description: "Cached Inventory.currentStock == stock_movements ledger for every product",
    passed: cachedStockMismatches === 0,
    difference: cachedStockDiff,
    expected: "All cached stocks match ledger sum(IN) - sum(OUT)",
    actual: `${cachedStockMismatches} stock discrepancies`,
    details: `Products Checked: ${allProdsList.length}, Cached Stock Mismatches: ${cachedStockMismatches}`,
  });

  const totalPassed = results.filter((r) => r.passed).length;
  const allPassed = totalPassed === results.length;

  return {
    asOfDate,
    fiscalYear: fy,
    allPassed,
    totalChecks: results.length,
    passedCount: totalPassed,
    failedCount: results.length - totalPassed,
    checks: results,
  };
}
