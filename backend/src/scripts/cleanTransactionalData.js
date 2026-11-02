import dotenv from "dotenv";
dotenv.config();

import { sequelize } from "../config/db.js";
import {
  Invoice,
  InvoiceLine,
  Purchase,
  PurchaseLine,
  Payment,
  VendorPayment,
  StockMovement,
  Sequence,
  Product,
  Inventory,
  Client,
  Vendor,
} from "../models/index.js";

/**
 * Production Readiness: Clean Transactional Test Data
 * - Clears all invoices, purchases, payments, vendor payments, stock movements, and sequence counters.
 * - Reconciles stock and client/vendor ledger balances to 0.
 * - Preserves Master Catalog (Products, Clients, Vendors), Company Profile, Admin User, and Targets.
 */
export async function cleanTransactionalData() {
  console.log("🧹 Clearing transactional test data for production deployment...");

  const t = await sequelize.transaction();

  try {
    // 1. Delete lines and payments
    await InvoiceLine.destroy({ where: {}, transaction: t });
    await PurchaseLine.destroy({ where: {}, transaction: t });
    await Payment.destroy({ where: {}, transaction: t });
    await VendorPayment.destroy({ where: {}, transaction: t });
    await StockMovement.destroy({ where: {}, transaction: t });

    // 2. Delete headers
    await Invoice.destroy({ where: {}, transaction: t });
    await Purchase.destroy({ where: {}, transaction: t });

    // 3. Reset sequences counters to 0
    await Sequence.destroy({ where: {}, transaction: t });

    // 4. Reset cached stocks to 0 (matching 0 movements in ledger)
    await Product.update({ currentStock: 0 }, { where: {}, transaction: t });
    await Inventory.update({ currentStock: 0 }, { where: {}, transaction: t });

    // 5. Reset client balances and orders
    await Client.update(
      { orders: 0, revenue: 0, outstanding: 0, outstandingBalance: 0 },
      { where: {}, transaction: t }
    );

    // 6. Reset vendor balances and orders
    await Vendor.update(
      { totalOrders: 0, totalPurchases: 0, outstandingPayable: 0, outstanding: 0, outstandingBalance: 0, paidAmount: 0 },
      { where: {}, transaction: t }
    );

    await t.commit();
    console.log("✅ Successfully cleared transactional data. Master Catalog, Company Profile, and Admin User preserved.");
  } catch (err) {
    await t.rollback();
    console.error("❌ Failed to clear transactional data:", err);
    throw err;
  }
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("cleanTransactionalData.js")) {
  cleanTransactionalData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
