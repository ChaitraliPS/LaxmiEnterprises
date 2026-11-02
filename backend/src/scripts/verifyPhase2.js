import {
  getSalesSummary,
  getRevenueSummary,
  getCollections,
  getReceivables,
  getOverdue,
  getPurchaseSummary,
  getVendorPayables,
  getStockBalance,
  getInventoryValue,
  getStockHealth,
  getPeriodComparison,
  getQuarterlyBreakdown,
  getCategoryTurnover,
} from "../services/metrics/index.js";

async function run() {
  console.log("=== VERIFYING PHASE 2 SHARED METRICS SERVICES ===");

  // 1. Sales Summary for current FY (FY 2026-27)
  const salesFY = await getSalesSummary("2026-27");
  console.log("\n1. Sales Summary FY 2026-27:");
  console.log({
    periodLabel: salesFY.periodLabel,
    taxableRevenue: salesFY.taxableRevenue,
    gstCollected: salesFY.gstCollected,
    grossInvoiced: salesFY.grossInvoiced,
    collectedAmount: salesFY.collectedAmount,
    pendingDues: salesFY.pendingDues,
    invoiceCount: salesFY.invoiceCount,
    counts: salesFY.counts,
  });

  // 2. All-time Sales Summary
  const salesAll = await getSalesSummary("all");
  console.log("\n2. All-Time Sales Summary (Target: Invoiced 9,42,640, Collected 9,22,640, Due 20,000):");
  console.log({
    taxableRevenue: salesAll.taxableRevenue,
    gstCollected: salesAll.gstCollected,
    grossInvoiced: salesAll.grossInvoiced,
    collectedAmount: salesAll.collectedAmount,
    pendingDues: salesAll.pendingDues,
    counts: salesAll.counts,
  });

  // 3. Receivables & Overdue
  const rec = await getReceivables();
  console.log("\n3. Receivables as of 01/11/2026:");
  console.log({
    totalGrossInvoiced: rec.totalGrossInvoiced,
    totalCollected: rec.totalCollected,
    totalOutstanding: rec.totalOutstanding,
    clientCount: rec.clientBreakdown.length,
  });

  const over = await getOverdue();
  console.log("\n4. Overdue as of 01/11/2026:");
  console.log({
    count: over.count,
    totalOverdueAmount: over.totalOverdueAmount,
    overdueInvoices: over.overdueInvoices,
  });

  // 5. Stock Balances & Valuation
  const pr1 = await getStockBalance("PR-001");
  const pr2 = await getStockBalance("PR-002");
  const invVal = await getInventoryValue();
  console.log("\n5. Stock Balances & Inventory Value at Cost (PR-001=525, PR-002=500):");
  console.log({
    PR001: pr1.balance,
    PR002: pr2.balance,
    totalInventoryValueAtCost: invVal.totalInventoryValueAtCost,
    totalInventoryValueAtSelling: invVal.totalInventoryValueAtSelling,
  });

  // 6. Purchases & Vendor Payables
  const purSummary = await getPurchaseSummary("all");
  console.log("\n6. Purchase Summary All-Time:");
  console.log({
    billCount: purSummary.billCount,
    grandTotal: purSummary.grandTotal,
    paidTotal: purSummary.paidTotal,
    pendingVendorDues: purSummary.pendingVendorDues,
  });

  // 7. Like-for-Like Comparisons
  const yoyRev = await getPeriodComparison("revenue", "yoy");
  console.log("\n7. YoY Like-for-Like Revenue Comparison:");
  console.log(yoyRev);

  // 8. Quarterly Breakdown for FY 2026-27
  const qb = await getQuarterlyBreakdown("2026-27");
  console.log("\n8. Quarterly Breakdown FY 2026-27:");
  console.table(qb.quarters);

  // 9. Category Breakdown
  const catBreakdown = await getCategoryTurnover("all");
  console.log("\n9. Category Breakdown (Taxable Turnover):");
  console.table(catBreakdown.categories);

  process.exit(0);
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});

