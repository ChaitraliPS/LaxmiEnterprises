import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import dotenv from "dotenv";
dotenv.config();

import { sequelize } from "../src/config/db.js";
import {
  Invoice,
  Purchase,
  Product,
  SchemaMigration,
} from "../src/models/index.js";
import { runMigrations } from "../src/migrations/runMigrations.js";

describe("Database Migration Safety & Data Preservation Tests", () => {
  const TEST_INV_ACTIVE = "INV-TEST-MIGSAFE-001";
  const TEST_INV_CANCELLED = "INV-TEST-MIGSAFE-002";
  const TEST_PUR = "PUR-TEST-MIGSAFE-001";
  const TEST_PROD = "PR-TEST-MIGSAFE-001";

  async function cleanup() {
    await Invoice.destroy({ where: { invoiceNumber: [TEST_INV_ACTIVE, TEST_INV_CANCELLED] } }).catch(() => {});
    await Purchase.destroy({ where: { purchaseId: TEST_PUR } }).catch(() => {});
    await Product.destroy({ where: { productId: TEST_PROD } }).catch(() => {});
  }

  before(async () => {
    await cleanup();
  });

  after(async () => {
    await cleanup();
  });

  test("runMigrations() is idempotent, safe, and preserves existing live data on multiple runs", async () => {
    try {
      // 1. Seed test records matching the required conditions:
      // a) Active invoice with creditDays 0 and exact decimal grandTotal
      // Note: Use date in previous fiscal year (e.g. 2024-05-15) so as not to pollute current FY metrics
      const createdActiveInv = await Invoice.create({
        invoiceNumber: TEST_INV_ACTIVE,
        clientId: "CL-001",
        clientName: "Test Agro Center",
        invoiceDate: "2024-05-15",
        creditDays: 0,
        dueDate: "2024-05-15",
        taxableTotal: 1234.56,
        gstTotal: 0.0,
        grandTotal: 1234.56,
        paidAmount: 0.0,
        balanceDue: 1234.56,
        status: "Unpaid",
        paymentStatus: "Unpaid",
        isCancelled: false,
      });

      // b) Cancelled invoice with balanceDue 0 (partial paid historical record)
      const createdCancelledInv = await Invoice.create({
        invoiceNumber: TEST_INV_CANCELLED,
        clientId: "CL-001",
        clientName: "Test Agro Center",
        invoiceDate: "2024-05-15",
        creditDays: 15,
        dueDate: "2024-05-30",
        taxableTotal: 4000.0,
        gstTotal: 200.0,
        grandTotal: 4200.0,
        paidAmount: 1000.0,
        balanceDue: 0.0,
        status: "Cancelled",
        paymentStatus: "Cancelled",
        isCancelled: true,
      });

      // c) Purchase with taxableTotal != grandTotal
      const createdPur = await Purchase.create({
        purchaseId: TEST_PUR,
        vendorId: "VN-001",
        vendorName: "Godrej Agrovet Ltd",
        purchaseDate: "2024-05-15",
        dueDate: "2024-06-15",
        taxableTotal: 800.0,
        gstTotal: 40.0,
        grandTotal: 840.0,
        paidAmount: 0.0,
        balanceDue: 840.0,
        status: "Unpaid",
        paymentStatus: "Unpaid",
        isCancelled: false,
      });

      // d) Product with custom gstRate 12
      const createdProd = await Product.create({
        productId: TEST_PROD,
        name: "Specialty Nutritional Feed (12% GST)",
        category: "Animal Feed",
        unitOfMeasure: "Kg",
        costPrice: 550.0,
        gstRate: 12.0,
        sellingPrice: 700.0,
        currentStock: 25,
        warehouseLocation: "Godown Bay A-1",
      });

      // --- RUN 1 OF runMigrations() ---
      await runMigrations();

      // Verify after Run 1:
      const inv1AfterRun1 = await Invoice.findOne({ where: { invoiceNumber: TEST_INV_ACTIVE } });
      assert.strictEqual(
        Number(inv1AfterRun1.creditDays),
        0,
        "Invoice creditDays 0 must not be forced to 30 on migration"
      );
      assert.strictEqual(
        Number(inv1AfterRun1.grandTotal),
        1234.56,
        "Invoice exact decimal grandTotal (1234.56) must not be rounded by Math.round"
      );
      assert.strictEqual(
        inv1AfterRun1.dueDate,
        "2024-05-15",
        "Invoice dueDate must not be overwritten"
      );

      const inv2AfterRun1 = await Invoice.findOne({ where: { invoiceNumber: TEST_INV_CANCELLED } });
      assert.strictEqual(
        Boolean(inv2AfterRun1.isCancelled),
        true,
        "Cancelled invoice must remain isCancelled = true"
      );
      assert.strictEqual(
        Number(inv2AfterRun1.balanceDue),
        0.0,
        "Cancelled invoice balanceDue must strictly remain 0 and not be reset to grandTotal - paidAmount"
      );
      assert.strictEqual(
        inv2AfterRun1.status,
        "Cancelled",
        "Cancelled invoice status must remain Cancelled"
      );

      const purAfterRun1 = await Purchase.findOne({ where: { purchaseId: TEST_PUR } });
      assert.strictEqual(
        Number(purAfterRun1.taxableTotal),
        800.0,
        "Purchase taxableTotal must strictly remain 800.00 and not be overwritten with grandTotal (840.00)"
      );
      assert.strictEqual(
        Number(purAfterRun1.grandTotal),
        840.0,
        "Purchase grandTotal must strictly remain 840.00"
      );

      const prodAfterRun1 = await Product.findOne({ where: { productId: TEST_PROD } });
      assert.strictEqual(
        Number(prodAfterRun1.gstRate),
        12.0,
        "Product custom gstRate (12%) must strictly remain 12 and not be forced to 5 or 0"
      );
      assert.strictEqual(
        prodAfterRun1.unitOfMeasure,
        "Kg",
        "Product unitOfMeasure must not be overwritten"
      );
      assert.strictEqual(
        Number(prodAfterRun1.costPrice),
        550.0,
        "Product costPrice must not be overwritten"
      );

      // --- RUN 2 OF runMigrations() ---
      await runMigrations();

      // Verify after Run 2:
      const inv1AfterRun2 = await Invoice.findOne({ where: { invoiceNumber: TEST_INV_ACTIVE } });
      assert.strictEqual(
        Number(inv1AfterRun2.creditDays),
        0,
        "Invoice creditDays must remain 0 after second migration run"
      );
      assert.strictEqual(
        Number(inv1AfterRun2.grandTotal),
        1234.56,
        "Invoice grandTotal must remain 1234.56 after second migration run"
      );
      assert.strictEqual(
        inv1AfterRun2.dueDate,
        "2024-05-15",
        "Invoice dueDate must remain unchanged"
      );

      const inv2AfterRun2 = await Invoice.findOne({ where: { invoiceNumber: TEST_INV_CANCELLED } });
      assert.strictEqual(
        Number(inv2AfterRun2.balanceDue),
        0.0,
        "Cancelled invoice balanceDue must remain 0 after second migration run"
      );
      assert.strictEqual(
        inv2AfterRun2.status,
        "Cancelled",
        "Cancelled invoice status must remain Cancelled"
      );

      const purAfterRun2 = await Purchase.findOne({ where: { purchaseId: TEST_PUR } });
      assert.strictEqual(
        Number(purAfterRun2.taxableTotal),
        800.0,
        "Purchase taxableTotal must remain 800.00 after second migration run"
      );
      assert.strictEqual(
        Number(purAfterRun2.grandTotal),
        840.0,
        "Purchase grandTotal must remain 840.00 after second migration run"
      );

      const prodAfterRun2 = await Product.findOne({ where: { productId: TEST_PROD } });
      assert.strictEqual(
        Number(prodAfterRun2.gstRate),
        12.0,
        "Product gstRate must remain 12 after second migration run"
      );
      assert.strictEqual(
        Number(prodAfterRun2.costPrice),
        550.0,
        "Product costPrice must remain 550.00 after second migration run"
      );

      // Check schema_migrations table contains records
      const migrations = await SchemaMigration.findAll();
      assert.ok(
        migrations.length >= 4,
        "schema_migrations table must contain all recorded backfill migrations"
      );
    } finally {
      await cleanup();
    }
  });
});
