import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { sequelize } from "../src/config/db.js";
import { Product, Inventory, StockMovement } from "../src/models/index.js";
import { applyStockChange } from "../src/utils/stockSync.js";
import { recordStockMovement, adjustStock } from "../src/controllers/inventoryController.js";
import { calculateCurrentStock, getToday } from "../src/constants/erpConstants.js";
import { getStockBalance } from "../src/services/metrics/stockMetrics.js";

function mockReqRes(body = {}, params = {}, query = {}) {
  const req = {
    body,
    params,
    query,
    user: { name: "QA Tester", role: "Super Administrator" },
  };
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    },
  };
  return { req, res };
}

describe("Outward Stock Equation & Race Safety Test Suite", () => {
  const TEST_PID = "PR-TEST-EQ-001";
  const CONCURRENT_PID = "PR-TEST-EQ-RACE";

  async function cleanupProduct(productId) {
    await StockMovement.destroy({ where: { productId } });
    await Inventory.destroy({ where: { productId } });
    await Product.destroy({ where: { productId } });
  }

  before(async () => {
    await cleanupProduct(TEST_PID);
    await cleanupProduct(CONCURRENT_PID);
  });

  after(async () => {
    await cleanupProduct(TEST_PID);
    await cleanupProduct(CONCURRENT_PID);
  });

  // ---------------------------------------------------------------------------
  // 1. UNIT TESTS: calculateCurrentStock({ opening, inward, outward })
  // ---------------------------------------------------------------------------
  describe("1. Shared Stock Calculation Function", () => {
    it("opening 50, inward 50, outward 30 -> current stock 70", () => {
      const stock = calculateCurrentStock({ opening: 50, inward: 50, outward: 30 });
      assert.strictEqual(stock, 70);
    });

    it("parses numeric strings cleanly without concatenation", () => {
      // Must not do "50" + "50" = "5050"
      const stock = calculateCurrentStock({ opening: "50", inward: "50", outward: "30" });
      assert.strictEqual(stock, 70);
    });

    it("handles property aliases (openingStock, inwardStock, outwardStock, in, out)", () => {
      const stock1 = calculateCurrentStock({ openingStock: 50, inwardStock: 50, outwardStock: 30 });
      assert.strictEqual(stock1, 70);

      const stock2 = calculateCurrentStock({ openingStock: 50, in: 50, out: 30 });
      assert.strictEqual(stock2, 70);
    });

    it("outward exactly equal to opening + inward results in 0", () => {
      const stock = calculateCurrentStock({ opening: 50, inward: 50, outward: 100 });
      assert.strictEqual(stock, 0);
    });

    it("handles missing/undefined parameters gracefully with 0 defaults", () => {
      assert.strictEqual(calculateCurrentStock(), 0);
      assert.strictEqual(calculateCurrentStock({ opening: 10 }), 10);
      assert.strictEqual(calculateCurrentStock({ inward: 25 }), 25);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. SERVER VALIDATION TESTS
  // ---------------------------------------------------------------------------
  describe("2. Server-side Outward Validation", () => {
    it("rejects non-positive quantities (0 or negative)", async () => {
      const { req, res } = mockReqRes({
        productId: TEST_PID,
        quantity: 0,
        movementType: "outward",
      });

      await assert.rejects(
        async () => {
          await recordStockMovement(req, res);
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /positive integer/i);
          return true;
        }
      );
    });

    it("rejects non-integer quantities (floats)", async () => {
      const { req, res } = mockReqRes({
        productId: TEST_PID,
        quantity: 5.5,
        movementType: "outward",
      });

      await assert.rejects(
        async () => {
          await recordStockMovement(req, res);
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /positive integer/i);
          return true;
        }
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 3. INTEGRATION TESTS FOR THE SPECIFIED SCENARIOS
  // ---------------------------------------------------------------------------
  describe("3. End-to-End Stock Ledger Equilibrium", () => {
    it("Case 1: opening 50, inward 50, outward 30 -> current stock 70", async () => {
      const testDate = new Date(`${getToday()}T10:00:00.000+05:30`);

      // Create product with baseline opening stock 50
      const prod = await Product.create({
        productId: TEST_PID,
        name: "Equation Test Product",
        category: "Animal Feed",
        unitOfMeasure: "Bags",
        unit: "Bags",
        costPrice: 400,
        sellingPrice: 550,
        isActive: true,
        createdAt: testDate,
        updatedAt: testDate,
        extraData: {
          openingStock: 50,
          stock: 50,
          inwardStock: 0,
          outwardStock: 0,
        },
      });

      const inv = await Inventory.create({
        productId: TEST_PID,
        productName: prod.name,
        category: prod.category,
        unit: prod.unitOfMeasure,
        currentStock: 50,
        minStockAlert: 10,
        warehouseLocation: "Main Warehouse - Bay 01",
      });

      // Add inward 50
      const inwardRes = await applyStockChange(TEST_PID, 50, {
        movementType: "ADJUSTMENT_IN",
        referenceType: "MANUAL",
        reference: "INWARD-50",
        date: testDate,
      });
      assert.strictEqual(inwardRes.newBalance, 100, "Balance after inward 50 must be 100");

      // Record outward 30 via API controller (simulating UI dispatch form)
      const { req, res } = mockReqRes({
        productId: TEST_PID,
        quantity: "30", // Passed as string to test Number() parsing
        movementType: "outward",
        warehouseLocation: "Main Warehouse - Bay 01",
        reason: "Dispatch to Client",
      });

      await recordStockMovement(req, res);
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.data.data.newBalance, 70, "API response newBalance must be 70");

      // Verify DB equilibrium
      const balance = await getStockBalance(TEST_PID, getToday());
      assert.strictEqual(balance.balance, 70, "Current stock must be 70 (50 + 50 - 30)");
      assert.strictEqual(balance.currentStock, 70, "Current stock must be 70");

      const updatedInv = await Inventory.findOne({ where: { productId: TEST_PID } });
      assert.strictEqual(Number(updatedInv.currentStock), 70, "Inventory.currentStock in DB must be 70");

      const updatedProd = await Product.findOne({ where: { productId: TEST_PID } });
      assert.strictEqual(Number(updatedProd.extraData.stock), 70, "Product.extraData.stock must be 70");
    });

    it("Case 2: outward greater than current stock -> rejected, stock unchanged", async () => {
      // Current stock is 70; attempt to dispatch 80
      const { req, res } = mockReqRes({
        productId: TEST_PID,
        quantity: 80,
        movementType: "outward",
        reason: "Excessive outward",
      });

      await assert.rejects(
        async () => {
          await recordStockMovement(req, res);
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /Insufficient stock|Stock cannot be negative/);
          return true;
        }
      );

      // Verify stock was NOT deducted and remains strictly 70
      const balance = await getStockBalance(TEST_PID, getToday());
      assert.strictEqual(balance.balance, 70, "Stock must remain unchanged at 70");

      const inv = await Inventory.findOne({ where: { productId: TEST_PID } });
      assert.strictEqual(Number(inv.currentStock), 70);
    });

    it("Case 3: outward exactly equal to current stock -> allowed, stock becomes 0", async () => {
      // Current stock is 70; dispatch exactly 70
      const { req, res } = mockReqRes({
        productId: TEST_PID,
        quantity: 70,
        movementType: "outward",
        reason: "Exact full depletion",
      });

      await recordStockMovement(req, res);
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.data.data.newBalance, 0, "Stock must reach exactly 0");

      const balance = await getStockBalance(TEST_PID, getToday());
      assert.strictEqual(balance.balance, 0, "Current stock must be 0");
      assert.strictEqual(balance.currentStock, 0, "Current stock must be 0");

      const inv = await Inventory.findOne({ where: { productId: TEST_PID } });
      assert.strictEqual(Number(inv.currentStock), 0);
    });

    it("Case 4: two outward requests fired at the same time -> only valid ones succeed, stock never negative", async () => {
      // Setup a fresh product with 50 units
      const testDate = new Date(`${getToday()}T10:00:00.000+05:30`);
      await Product.create({
        productId: CONCURRENT_PID,
        name: "Concurrency Test Product",
        category: "Animal Feed",
        unitOfMeasure: "Bags",
        unit: "Bags",
        costPrice: 500,
        sellingPrice: 700,
        isActive: true,
        createdAt: testDate,
        updatedAt: testDate,
        extraData: {
          openingStock: 50,
          stock: 50,
          inwardStock: 0,
          outwardStock: 0,
        },
      });

      await Inventory.create({
        productId: CONCURRENT_PID,
        productName: "Concurrency Test Product",
        category: "Animal Feed",
        unit: "Bags",
        currentStock: 50,
        minStockAlert: 10,
        warehouseLocation: "Main Warehouse - Bay 01",
      });

      // Available stock is 50. Fire TWO simultaneous outward dispatches of 40 units each.
      // If race condition exists, both would read 50 and succeed, resulting in 50 - 80 = -30.
      // With row locking and transactions, only one can succeed (remaining: 10), and the second must be rejected!
      const op1 = (async () => {
        const { req, res } = mockReqRes({
          productId: CONCURRENT_PID,
          quantity: 40,
          movementType: "outward",
          reason: "Concurrent Dispatch 1",
        });
        await recordStockMovement(req, res);
        return { success: true, res };
      })();

      const op2 = (async () => {
        const { req, res } = mockReqRes({
          productId: CONCURRENT_PID,
          quantity: 40,
          movementType: "outward",
          reason: "Concurrent Dispatch 2",
        });
        await recordStockMovement(req, res);
        return { success: true, res };
      })();

      const results = await Promise.allSettled([op1, op2]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      assert.strictEqual(fulfilled.length, 1, "Exactly one parallel outward request must succeed");
      assert.strictEqual(rejected.length, 1, "The second parallel request must be rejected for insufficient stock");
      assert.match(rejected[0].reason.message, /Insufficient stock|Stock cannot be negative/);

      // Verify resulting stock in database is strictly 10 (never negative!)
      const balance = await getStockBalance(CONCURRENT_PID, getToday());
      assert.strictEqual(balance.balance, 10, "Stock must be strictly 10 (50 - 40)");

      const inv = await Inventory.findOne({ where: { productId: CONCURRENT_PID } });
      assert.strictEqual(Number(inv.currentStock), 10, "Inventory table must be 10");
    });

    it("Case 5: outward followed by another inward -> equation still balances", async () => {
      // Product CONCURRENT_PID currently has:
      // Opening: 50, Inward: 0, Outward: 40 -> Current stock: 10
      // Now receive another inward delivery of 35 bags
      const { req, res } = mockReqRes({
        productId: CONCURRENT_PID,
        quantity: 35,
        movementType: "inward",
        warehouseLocation: "Main Warehouse - Bay 01",
        reason: "Supplier Procurement Delivery",
      });

      await recordStockMovement(req, res);
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.data.data.newBalance, 45, "10 + 35 = 45");

      // Verify stock in DB
      const balance = await getStockBalance(CONCURRENT_PID, getToday());
      assert.strictEqual(balance.balance, 45, "Equation must strictly balance: 10 + 35 = 45");
      assert.strictEqual(balance.currentStock, 45, "Current stock must be 45");

      const inv = await Inventory.findOne({ where: { productId: CONCURRENT_PID } });
      assert.strictEqual(Number(inv.currentStock), 45);

      const prod = await Product.findOne({ where: { productId: CONCURRENT_PID } });
      assert.strictEqual(Number(prod.extraData.stock), 45);
    });
  });
});
