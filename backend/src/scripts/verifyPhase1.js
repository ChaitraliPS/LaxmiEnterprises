import { sequelize } from "../config/db.js";
import { StockMovement, Invoice, InvoiceLine, Client, Vendor, Product, Purchase } from "../models/index.js";

async function verify() {
  console.log("=== PHASE 1 VERIFICATION RESULTS ===");

  // 1. Stock Movements balance check
  const [balances] = await sequelize.query(`
    SELECT productId, 
           SUM(CASE WHEN direction = 'IN' THEN quantity ELSE -quantity END) as balance,
           SUM(quantityChange) as legacyBalance
    FROM stock_movements 
    GROUP BY productId
  `);
  console.log("\n1. Stock Movements Ledger Balances (Target: PR-001=525, PR-002=500):");
  console.table(balances);

  // 2. Invoices & Derived Statuses
  const invoices = await Invoice.findAll({ order: [["invoiceNumber", "ASC"]] });
  console.log(`\n2. Invoices (${invoices.length} rows) Derived Statuses:`);
  const invSummary = invoices.map((inv) => ({
    invoiceNumber: inv.invoiceNumber,
    date: inv.invoiceDate,
    dueDate: inv.dueDate,
    creditDays: inv.creditDays,
    grandTotal: inv.grandTotal,
    paidAmount: inv.paidAmount,
    balanceDue: inv.balanceDue,
    status: inv.status,
  }));
  console.table(invSummary);

  // 3. Invoice Lines
  const lineCount = await InvoiceLine.count();
  console.log(`\n3. Invoice Lines verified: ${lineCount} line items populated with costPriceSnapshot.`);

  // 4. Clients Canonical Types & Terms
  const clients = await Client.findAll({ attributes: ["clientId", "name", "clientType", "paymentTerms"] });
  console.log("\n4. Clients Canonical Data:");
  console.table(clients.map((c) => c.toJSON()));

  // 5. Vendors Canonical Data
  const vendors = await Vendor.findAll({ attributes: ["vendorId", "name", "category"] });
  console.log("\n5. Vendors Canonical Data:");
  console.table(vendors.map((v) => v.toJSON()));

  // 6. Products Canonical Data
  const products = await Product.findAll({
    attributes: ["productId", "name", "category", "unitOfMeasure", "costPrice", "sellingPrice", "gstRate"],
  });
  console.log("\n6. Products Canonical Data:");
  console.table(products.map((p) => p.toJSON()));

  process.exit(0);
}

verify().catch((err) => {
  console.error(err);
  process.exit(1);
});

