import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { sequelize } from "../src/config/db.js";
import { Product, Inventory, StockMovement } from "../src/models/index.js";
import { updateStock, applyStockChange } from "../src/utils/stockSync.js";
import { calculateNewStock, calculateCurrentStock, isStockAvailable } from "../src/constants/erpConstants.js";
import { getStockHealth, getStockBalance } from "../src/services/metrics/stockMetrics.js";

describe("Inventory as Single Source of Truth & Stock Rule Test Suite", () => {
  const TEST_PID = "PR-SSOT-TEST-01";
  const TEST_PID_CONCURRENT = "PR-SSOT-CONC-01";

  before(async () => {
    await sequelize.authenticate();

    // Clean up any existing test records
    await StockMovement.destroy({ where: { productId: [TEST_PID, TEST_PID_CONCURRENT] } });
    await Inventory.destroy({ where: { productId: [TEST_PID, TEST_PID_CONCURRENT] } });
    await Product.destroy({ where: { productId: [TEST_PID, TEST_PID_CONCURRENT] } });

    // Seed test product 1
    await Product.create({
      productId: TEST_PID,
      name: "Single Source Test Feed",
      category: "Animal Feed",
      unit: "Bags",
      unitOfMeasure: "Bags",
      costPrice: 500,
      sellingPrice: 650,
      extraData: { stock: 50 },
    });
    await Inventory.create({
      productId: TEST_PID,
      productName: "Single Source Test Feed",
      category: "Animal Feed",
      unit: "Bags",
      currentStock: 50,
      warehouseLocation: "Bay SSOT-1",
    });

    // Seed test product 2 for concurrency
    await Product.create({
      productId: TEST_PID_CONCURRENT,
      name: "Concurrency Test Feed",
      category: "Animal Feed",
      unit: "Bags",
      unitOfMeasure: "Bags",
      costPrice: 500,
      sellingPrice: 650,
      extraData: { stock: 50 },
    });
    await Inventory.create({
      productId: TEST_PID_CONCURRENT,
      productName: "Concurrency Test Feed",
      category: "Animal Feed",
      unit: "Bags",
      currentStock: 50,
      warehouseLocation: "Bay CONC-1",
    });
  });

  after(async () => {
    await StockMovement.destroy({ where: { productId: [TEST_PID, TEST_PID_CONCURRENT] } });
    await Inventory.destroy({ where: { productId: [TEST_PID, TEST_PID_CONCURRENT] } });
    await Product.destroy({ where: { productId: [TEST_PID, TEST_PID_CONCURRENT] } });
  });

  describe("1. Shared Mathematical Stock Rule Functions", () => {
    it("calculateNewStock: current 50, inward 50 -> new stock 100", () => {
      const res = calculateNewStock({ currentStock: 50, inward: 50, outward: 0 });
      assert.strictEqual(res, 100);
    });

    it("calculateNewStock: current 100, outward 30 -> new stock 70", () => {
      const res = calculateNewStock({ currentStock: 100, inward: 0, outward: 30 });
      assert.strictEqual(res, 70);
    });

    it("calculateNewStock: never returns negative stock", () => {
      const res = calculateNewStock({ currentStock: 20, inward: 0, outward: 50 });
      assert.strictEqual(res, 0);
    });

    it("isStockAvailable correctly checks availability and requested quantity", () => {
      assert.strictEqual(isStockAvailable(50, 10), true);
      assert.strictEqual(isStockAvailable(50, 50), true);
      assert.strictEqual(isStockAvailable(50, 51), false);
      assert.strictEqual(isStockAvailable(0, 1), false);
      assert.strictEqual(isStockAvailable(-5, 1), false);
    });
  });

  describe("2. Server-side updateStock Transactional Mechanics", () => {
    it("Case 1: current 50, inward 50 -> new stock 100", async () => {
      // Inventory starts at 50
      const res = await updateStock({
        productId: TEST_PID,
        type: "inward",
        quantity: 50,
        notes: "Inward shipment of 50",
      });

      assert.strictEqual(res.stockBefore, 50, "Stock before must be 50");
      assert.strictEqual(res.newStock, 100, "New stock must be 100");
      assert.strictEqual(res.currentStock, 100, "Current stock must be 100");

      const inv = await Inventory.findOne({ where: { productId: TEST_PID } });
      assert.strictEqual(Number(inv.currentStock), 100, "Inventory table must store 100");

      const prod = await Product.findOne({ where: { productId: TEST_PID } });
      assert.strictEqual(Number(prod.extraData?.stock), 100, "Product extraData must be synchronized");
      assert.strictEqual(prod.extraData?.openingStock, undefined, "No openingStock field permitted");
    });

    it("Case 2: current 100, outward 30 -> new stock 70", async () => {
      const res = await updateStock({
        productId: TEST_PID,
        type: "outward",
        quantity: 30,
        notes: "Outward dispatch of 30",
      });

      assert.strictEqual(res.stockBefore, 100, "Stock before must be 100");
      assert.strictEqual(res.newStock, 70, "New stock must be 70");
      assert.strictEqual(res.currentStock, 70, "Current stock must be 70");

      const inv = await Inventory.findOne({ where: { productId: TEST_PID } });
      assert.strictEqual(Number(inv.currentStock), 70, "Inventory table must store 70");
    });

    it("Case 3: outward greater than current stock -> rejected, stock unchanged", async () => {
      // Current stock is 70; attempting outward of 75
      await assert.rejects(
        async () => {
          await updateStock({
            productId: TEST_PID,
            type: "outward",
            quantity: 75,
            notes: "Should fail",
          });
        },
        (err) => {
          assert.match(err.message, /Insufficient stock/i);
          return true;
        }
      );

      // Verify stock remained 70
      const inv = await Inventory.findOne({ where: { productId: TEST_PID } });
      assert.strictEqual(Number(inv.currentStock), 70, "Stock must remain exactly 70");
    });

    it("Case 4: outward exactly equal to current stock -> allowed, stock becomes 0", async () => {
      // Current stock is 70; dispatching all 70
      const res = await updateStock({
        productId: TEST_PID,
        type: "outward",
        quantity: 70,
        notes: "Full inventory dispatch",
      });

      assert.strictEqual(res.stockBefore, 70);
      assert.strictEqual(res.newStock, 0);
      assert.strictEqual(res.currentStock, 0);

      const inv = await Inventory.findOne({ where: { productId: TEST_PID } });
      assert.strictEqual(Number(inv.currentStock), 0, "Stock must become 0");
    });

    it("Case 5: two outward requests at the same time -> stock never negative", async () => {
      // TEST_PID_CONCURRENT has current stock 50.
      // Fire two simultaneous requests for 30 each (total 60 > 50).
      const [p1, p2] = await Promise.allSettled([
        updateStock({
          productId: TEST_PID_CONCURRENT,
          type: "outward",
          quantity: 30,
          reference: "CONC-REQ-1",
        }),
        updateStock({
          productId: TEST_PID_CONCURRENT,
          type: "outward",
          quantity: 30,
          reference: "CONC-REQ-2",
        }),
      ]);

      const successes = [p1, p2].filter((p) => p.status === "fulfilled");
      const failures = [p1, p2].filter((p) => p.status === "rejected");

      assert.strictEqual(successes.length, 1, "Exactly one parallel request must succeed");
      assert.strictEqual(failures.length, 1, "The second concurrent request must be rejected");
      assert.match(failures[0].reason.message, /Insufficient stock/i);

      // Final stock must be 50 - 30 = 20, never negative
      const inv = await Inventory.findOne({ where: { productId: TEST_PID_CONCURRENT } });
      assert.strictEqual(Number(inv.currentStock), 20, "Stock must be exactly 20");
    });

    it("Transaction log row saves (product, type, quantity, stockBefore, stockAfter, timestamp) for history only", async () => {
      const mvt = await StockMovement.findOne({
        where: { productId: TEST_PID_CONCURRENT },
        order: [["id", "DESC"]],
      });

      assert.ok(mvt, "Movement log row must exist");
      assert.strictEqual(mvt.productId, TEST_PID_CONCURRENT);
      assert.strictEqual(Number(mvt.quantity), 30);
      assert.strictEqual(Number(mvt.stockBefore), 50);
      assert.strictEqual(Number(mvt.stockAfter), 20);
      assert.ok(mvt.movementDate, "Timestamp must be saved");
    });
  });

  describe("3. UI & Frontend Inspection (AST / Source Code Audit)", () => {
    it("no opening/inward/outward controls remain on the Products page", () => {
      const productsPagePath = path.resolve(process.cwd(), "src/components/ProductsPage.jsx");
      const content = fs.readFileSync(productsPagePath, "utf-8");

      assert.strictEqual(
        content.includes("ProductStockModal"),
        false,
        "ProductsPage must not import or render ProductStockModal"
      );
      assert.strictEqual(
        content.includes("View Calc"),
        false,
        "ProductsPage must not have 'View Calc' buttons"
      );
      assert.strictEqual(
        content.includes("Audit Calc"),
        false,
        "ProductsPage must not have 'Audit Calc' buttons"
      );
      assert.strictEqual(
        content.includes("Opening Base"),
        false,
        "ProductsPage must not display Opening Base"
      );
    });

    it("ProductModal does not edit stock and contains zero opening/inward/outward inputs", () => {
      const productModalPath = path.resolve(process.cwd(), "src/components/ProductModal.jsx");
      const content = fs.readFileSync(productModalPath, "utf-8");

      assert.strictEqual(
        content.includes("openingStock"),
        false,
        "ProductModal must not contain openingStock state or inputs"
      );
      assert.strictEqual(
        content.includes("inwardStock"),
        false,
        "ProductModal must not contain inwardStock state or inputs"
      );
      assert.strictEqual(
        content.includes("outwardStock"),
        false,
        "ProductModal must not contain outwardStock state or inputs"
      );
      assert.strictEqual(
        content.includes("Stock Balance Ledger Audit"),
        false,
        "ProductModal must not have stock calculation formula or audit section"
      );
    });

    it("Products and Inventory endpoints report identical stock for every product", async () => {
      const healthData = await getStockHealth();
      const inventories = await Inventory.findAll();
      const invMap = new Map(inventories.map((i) => [i.productId, Number(i.currentStock || 0)]));

      for (const p of healthData.products) {
        const invStock = invMap.get(p.productId);
        if (invStock !== undefined) {
          assert.strictEqual(
            p.currentBalance,
            invStock,
            `Product ${p.productId} balance (${p.currentBalance}) must equal Inventory stock (${invStock})`
          );
        }
      }
    });
  });
});

