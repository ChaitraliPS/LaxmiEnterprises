import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sequelize } from "../src/config/db.js";
import {
  Invoice,
  InvoiceLine,
  Payment,
  Purchase,
  PurchaseLine,
  VendorPayment,
  Product,
  Inventory,
  StockMovement,
  Sequence,
  Client,
  Vendor,
} from "../src/models/index.js";
import {
  generateInvoiceNumber,
  generatePurchaseNumber,
  generatePaymentNumber,
  generateVendorPaymentNumber,
} from "../src/utils/numberSequence.js";
import {
  createInvoice,
  recordPayment,
  updateInvoice,
  deleteInvoice,
} from "../src/controllers/invoiceController.js";
import {
  createPurchase,
  recordVendorPayment,
  updatePurchase,
  deletePurchase,
} from "../src/controllers/purchaseController.js";
import { syncInvoices, syncPurchases } from "../src/controllers/syncController.js";
import { ANCHOR_DATE } from "../src/constants/erpConstants.js";

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
  const next = (err) => {
    if (err) {
      res.statusCode = err.statusCode || 500;
      res.data = { success: false, message: err.message, error: err };
    }
  };
  return { req, res, next };
}

describe("ERP Single Source of Truth & Concurrency Test Suite", () => {
  // -------------------------------------------------------------------------
  // TASK 4: RACE-SAFE NUMBER SEQUENCES WITH 20 PARALLEL CALLS
  // -------------------------------------------------------------------------
  describe("Task 4: Race-Safe Number Sequences Concurrency", () => {
    it("should generate 20 strictly sequential and unique invoice numbers under parallel execution", async () => {
      const fy = "2026-27";
      const totalCalls = 20;

      // Fire 20 parallel transactions requesting the next invoice sequence
      const promises = Array.from({ length: totalCalls }).map(async () => {
        const t = await sequelize.transaction();
        try {
          const num = await generateInvoiceNumber(t);
          await t.commit();
          return num;
        } catch (err) {
          await t.rollback();
          throw err;
        }
      });

      const results = await Promise.all(promises);

      // 1. Verify 20 results generated
      assert.strictEqual(results.length, totalCalls);

      // 2. Extract numeric suffixes
      const numericParts = results.map((code) => {
        const m = code.match(/LE-INV-.*-(\d+)/);
        assert.ok(m, `Invalid invoice number format: ${code}`);
        return parseInt(m[1], 10);
      });

      // 3. Verify all 20 are unique
      const uniqueSet = new Set(numericParts);
      assert.strictEqual(uniqueSet.size, totalCalls, "Duplicate sequence numbers were generated!");

      // 4. Verify strictly sequential with zero gaps
      const sorted = [...numericParts].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        assert.strictEqual(
          sorted[i],
          sorted[i - 1] + 1,
          `Sequence gap detected between ${sorted[i - 1]} and ${sorted[i]}`
        );
      }
    });
  });

  // -------------------------------------------------------------------------
  // TASK 3: PAYMENT SAFETY & OVERPAYMENT ROW-LOCK PROTECTION
  // -------------------------------------------------------------------------
  describe("Task 3: Payment Safety & Overpayment Protection", () => {
    it("recordPayment should reject non-positive amounts, invalid modes, and overpayments", async () => {
      // Create a temporary invoice with positive balance
      let inv;
      const t = await sequelize.transaction();
      try {
        const num = await generateInvoiceNumber(t);
        inv = await Invoice.create(
          {
            invoiceNumber: num,
            clientId: "CL-001",
            grandTotal: 1000,
            balanceDue: 1000,
            paidAmount: 0,
            taxableTotal: 950,
            dueDate: "2026-12-01",
            isCancelled: false,
            status: "Unpaid",
          },
          { transaction: t }
        );
        await t.commit();
      } catch (err) {
        await t.rollback();
        throw err;
      }

      const balance = Number(inv.balanceDue);

      try {
        // 1. Reject amount <= 0
        {
          const { req, res, next } = mockReqRes({ amount: 0, paymentMode: "UPI" }, { id: inv.invoiceNumber });
          await recordPayment(req, res, next);
          assert.strictEqual(res.statusCode, 400);
          assert.match(res.data.message, /greater than 0/i);
        }

        // 2. Reject missing paymentMode
        {
          const { req, res, next } = mockReqRes({ amount: 100 }, { id: inv.invoiceNumber });
          await recordPayment(req, res, next);
          assert.strictEqual(res.statusCode, 400);
          assert.match(res.data.message, /paymentMode/i);
        }

        // 3. Reject invalid paymentMode
        {
          const { req, res, next } = mockReqRes({ amount: 100, paymentMode: "Bitcoin" }, { id: inv.invoiceNumber });
          await recordPayment(req, res, next);
          assert.strictEqual(res.statusCode, 400);
          assert.match(res.data.message, /paymentMode/i);
        }

        // 4. Reject amount > balanceDue
        {
          const { req, res, next } = mockReqRes({ amount: balance + 5000, paymentMode: "NEFT" }, { id: inv.invoiceNumber });
          await recordPayment(req, res, next);
          assert.strictEqual(res.statusCode, 400);
          assert.match(res.data.message, /exceeds remaining balance due/i);
        }
      } finally {
        await inv.destroy();
      }
    });

    it("recordVendorPayment should reject non-positive amounts, invalid modes, and overpayments", async () => {
      // Create a temporary purchase bill
      let pur;
      const t = await sequelize.transaction();
      try {
        const num = await generatePurchaseNumber(t);
        pur = await Purchase.create(
          {
            purchaseId: num,
            vendorId: "VN-001",
            vendorName: "Baramati Feed Agro Mills Ltd",
            grandTotal: 1000,
            balanceDue: 500,
            paidAmount: 500,
            taxableTotal: 950,
            dueDate: "2026-12-01",
            isCancelled: false,
            status: "Partial",
          },
          { transaction: t }
        );
        await t.commit();
      } catch (err) {
        await t.rollback();
        throw err;
      }

      try {
        // 1. Reject amount <= 0
        {
          const { req, res, next } = mockReqRes({ amount: -50, paymentMode: "RTGS" }, { id: pur.purchaseId });
          await recordVendorPayment(req, res, next);
          assert.strictEqual(res.statusCode, 400);
        }

        // 2. Reject overpayment
        {
          const { req, res, next } = mockReqRes({ amount: 1000, paymentMode: "NEFT" }, { id: pur.purchaseId });
          await recordVendorPayment(req, res, next);
          assert.strictEqual(res.statusCode, 400);
          assert.match(res.data.message, /exceeds remaining balance due/i);
        }
      } finally {
        await pur.destroy();
      }
    });

    it("should reject recording payments on cancelled invoices and bills", async () => {
      // Create a temporary cancelled invoice
      let cancelledInv;
      const t = await sequelize.transaction();
      try {
        const num = await generateInvoiceNumber(t);
        cancelledInv = await Invoice.create(
          {
            invoiceNumber: num,
            clientId: "CL-001",
            grandTotal: 1000,
            balanceDue: 1000,
            taxableTotal: 950,
            isCancelled: true,
            status: "Cancelled",
          },
          { transaction: t }
        );
        await t.commit();
      } catch (err) {
        await t.rollback();
        throw err;
      }

      try {
        const { req, res, next } = mockReqRes({ amount: 500, paymentMode: "UPI" }, { id: cancelledInv.invoiceNumber });
        await recordPayment(req, res, next);
        assert.strictEqual(res.statusCode, 400);
        assert.match(res.data.message, /cancelled invoice/i);
      } finally {
        // Clean up test invoice
        await cancelledInv.destroy();
      }
    });
  });

  // -------------------------------------------------------------------------
  // TASK 5: DO NOT TRUST CLIENT LINE VALUES
  // -------------------------------------------------------------------------
  describe("Task 5: Server-Computed Financial Integrity & Line Snapshots", () => {
    it("should ignore client-sent gstRate, taxableAmount, and grandTotal, computing them from Product master", async () => {
      const testProdId = "PR-TEST-VAL-001";
      await Product.destroy({ where: { productId: testProdId } }).catch(() => {});
      await Inventory.destroy({ where: { productId: testProdId } }).catch(() => {});
      await StockMovement.destroy({ where: { productId: testProdId } }).catch(() => {});

      const prod = await Product.create({
        productId: testProdId,
        name: "Validation Test Feed",
        category: "Animal Feed",
        unitOfMeasure: "Bags",
        costPrice: 700.0,
        sellingPrice: 950.0,
        gstRate: 5.0,
      });

      await Inventory.create({
        productId: testProdId,
        productName: prod.name,
        category: prod.category,
        unit: prod.unitOfMeasure,
        currentStock: 10,
      });

      const qty = 5;
      const expectedUnitPrice = Number(prod.sellingPrice); // 950
      const expectedTaxable = qty * expectedUnitPrice; // 4750
      const expectedGstRate = Number(prod.gstRate); // 5.0
      const expectedGst = expectedTaxable * (expectedGstRate / 100); // 237.5
      const expectedGrand = Math.round((expectedTaxable + expectedGst) * 100) / 100; // 4987.5

      // Client sends malicious values (0 GST, 1 Rs total, Paid status)
      const maliciousPayload = {
        clientId: "CL-001",
        invoiceDate: "2026-11-01",
        notes: "Test server-computed line values",
        items: [
          {
            productId: testProdId,
            quantity: qty,
            taxableAmount: 1, // Malicious override
            gstRate: 0, // Malicious override
            gstAmount: 0, // Malicious override
            grandTotal: 1, // Malicious override
            status: "Paid", // Malicious override
          },
        ],
      };

      // Ensure test product has temporary stock for the test
      const tempMovement = await StockMovement.create({
        productId: testProdId,
        quantity: 10,
        direction: "IN",
        movementType: "ADJUSTMENT_IN",
        referenceType: "TEST",
        referenceId: "TEST-INIT-STOCK",
        movementDate: new Date(),
        warehouseLocation: "Main Warehouse - Bay 01",
      });

      let created = null;
      try {
        const { req, res, next } = mockReqRes(maliciousPayload);
        await createInvoice(req, res, next);

        assert.strictEqual(res.statusCode, 201);
        created = res.data.data;

        // 1. Server must compute totals from Master test product
        assert.strictEqual(Number(created.taxableTotal), expectedTaxable);
        assert.strictEqual(Number(created.grandTotal), expectedGrand);

        // 2. Client sent status "Paid" must be ignored; derived status should be "Unpaid"
        assert.strictEqual(created.status, "Unpaid");

        // 3. Invoice line must have captured costPriceSnapshot from Master
        const line = await InvoiceLine.findOne({ where: { invoiceId: created.invoiceNumber } });
        assert.ok(line);
        assert.strictEqual(Number(line.costPriceSnapshot), Number(prod.costPrice));
        assert.strictEqual(Number(line.gstRate), expectedGstRate);
      } finally {
        await tempMovement.destroy().catch(() => {});
        if (created) {
          await InvoiceLine.destroy({ where: { invoiceId: created.invoiceNumber } }).catch(() => {});
          await StockMovement.destroy({ where: { referenceId: created.invoiceNumber } }).catch(() => {});
          await Invoice.destroy({ where: { invoiceNumber: created.invoiceNumber } }).catch(() => {});
        }
        await StockMovement.destroy({ where: { productId: testProdId } }).catch(() => {});
        await Inventory.destroy({ where: { productId: testProdId } }).catch(() => {});
        await Product.destroy({ where: { productId: testProdId } }).catch(() => {});
      }
    });
  });

  // -------------------------------------------------------------------------
  // TASK 6: WEIGHTED AVERAGE COST (WAC) ON PURCHASES
  // -------------------------------------------------------------------------
  describe("Task 6: Weighted Average Cost (WAC) Inventory Valuation", () => {
    it("should update product cost price using the WAC formula when a purchase is received", async () => {
      // Create a dedicated product for WAC test
      const testProdId = "PR-WAC-TEST";
      await Product.destroy({ where: { productId: testProdId } });
      await Inventory.destroy({ where: { productId: testProdId } });
      await StockMovement.destroy({ where: { productId: testProdId } });

      const initialStock = 100;
      const initialCost = 500.0;
      const prod = await Product.create({
        productId: testProdId,
        name: "WAC Test Animal Feed",
        category: "Animal Feed",
        unitOfMeasure: "Bags",
        costPrice: initialCost,
        purchasePrice: initialCost,
        sellingPrice: 750.0,
        gstRate: 5.0,
      });

      await Inventory.create({
        productId: testProdId,
        productName: prod.name,
        category: prod.category,
        unit: prod.unitOfMeasure,
        currentStock: initialStock,
      });

      // Opening stock movement
      await StockMovement.create({
        productId: testProdId,
        quantity: initialStock,
        direction: "IN",
        movementType: "OPENING",
        referenceType: "OPENING",
        referenceId: "WAC-INIT",
        movementDate: new Date(),
      });

      // New purchase: 50 bags at 650.0 unit cost
      const newQty = 50;
      const newCost = 650.0;
      // Formula: ((100 * 500) + (50 * 650)) / (100 + 50) = (50000 + 32500) / 150 = 82500 / 150 = 550.0
      const expectedWAC = Math.round(((initialStock * initialCost + newQty * newCost) / (initialStock + newQty)) * 100) / 100;

      const purchasePayload = {
        vendorId: "VN-001",
        billDate: "2026-11-01",
        vendorInvoiceNo: "WAC-BILL-01",
        items: [
          {
            productId: testProdId,
            quantity: newQty,
            unitCost: newCost,
          },
        ],
      };

      let createdPur = null;
      try {
        const { req, res, next } = mockReqRes(purchasePayload);
        await createPurchase(req, res, next);

        assert.strictEqual(res.statusCode, 201);
        createdPur = res.data.data;

        // Reload product from database and verify costPrice was updated to expected WAC
        await prod.reload();
        assert.strictEqual(
          Number(prod.costPrice),
          expectedWAC,
          `Expected WAC ${expectedWAC}, got ${prod.costPrice}`
        );
      } finally {
        // Clean up test entities
        if (createdPur) {
          await PurchaseLine.destroy({ where: { purchaseId: createdPur.purchaseId } });
          await StockMovement.destroy({ where: { referenceId: createdPur.purchaseId } });
          await Purchase.destroy({ where: { purchaseId: createdPur.purchaseId } });
        }
        await StockMovement.destroy({ where: { productId: testProdId } });
        await Inventory.destroy({ where: { productId: testProdId } });
        await prod.destroy();
      }
    });
  });

  // -------------------------------------------------------------------------
  // TASK 7: PUT EDIT OF NON-FINANCIAL FIELDS ONLY
  // -------------------------------------------------------------------------
  describe("Task 7: Metadata Updates for Invoices & Purchases", () => {
    it("PUT /invoices/:id should allow updating notes, dueDate and address without touching financial fields", async () => {
      const tempInv = await Invoice.create({
        invoiceNumber: "LE-INV-TEMP-EDIT",
        clientId: "CL-001",
        grandTotal: 5000,
        taxableTotal: 4750,
        balanceDue: 5000,
        notes: "Original Notes",
        dueDate: "2026-11-30",
        clientAddress: "Original Address",
        isCancelled: false,
      });

      try {
        const { req, res, next } = mockReqRes(
          {
            notes: "Updated Notes",
            dueDate: "2026-12-31",
            clientAddress: "Updated Client Address Sector 4",
            grandTotal: 99999, // Should be ignored
            taxableTotal: 99999, // Should be ignored
          },
          { id: tempInv.invoiceNumber }
        );

        await updateInvoice(req, res, next);
        assert.strictEqual(res.statusCode, 200);

        await tempInv.reload();
        assert.strictEqual(tempInv.notes, "Updated Notes");
        assert.strictEqual(tempInv.dueDate, "2026-12-31");
        assert.strictEqual(tempInv.clientAddress, "Updated Client Address Sector 4");
        assert.strictEqual(Number(tempInv.grandTotal), 5000, "Grand total must not change via PUT");
        assert.strictEqual(Number(tempInv.taxableTotal), 4750, "Taxable total must not change via PUT");
      } finally {
        await tempInv.destroy();
      }
    });

    it("PUT /purchases/:id should allow updating notes, dueDate and vendorInvoiceNo without touching financials", async () => {
      const tempPur = await Purchase.create({
        purchaseId: "LE-PUR-TEMP-EDIT",
        vendorId: "VN-001",
        vendorName: "Baramati Feed Agro Mills Ltd",
        grandTotal: 5000,
        taxableTotal: 4750,
        balanceDue: 5000,
        notes: "Original Pur Notes",
        dueDate: "2026-11-30",
        vendorInvoiceNo: "VEND-ORIG",
        isCancelled: false,
      });

      try {
        const { req, res, next } = mockReqRes(
          {
            notes: "Purchase updated notes",
            vendorInvoiceNo: "VEND-INV-NEW-99",
            dueDate: "2026-12-15",
            grandTotal: 99999, // Should be ignored
          },
          { id: tempPur.purchaseId }
        );

        await updatePurchase(req, res, next);
        assert.strictEqual(res.statusCode, 200);

        await tempPur.reload();
        assert.strictEqual(tempPur.notes, "Purchase updated notes");
        assert.strictEqual(tempPur.vendorInvoiceNo, "VEND-INV-NEW-99");
        assert.strictEqual(Number(tempPur.grandTotal), 5000, "Purchase grand total must not change via PUT");
      } finally {
        await tempPur.destroy();
      }
    });
  });

  // -------------------------------------------------------------------------
  // TASK 2: DISABLED SYNC ENDPOINTS RETURN 410 GONE
  // -------------------------------------------------------------------------
  describe("Task 2: Disabled Sync Endpoints (HTTP 410 Gone)", () => {
    it("POST /sync/invoices should return HTTP 410 Gone", async () => {
      const { req, res } = mockReqRes([{ invoiceNumber: "HACK-01" }]);
      await syncInvoices(req, res);
      assert.strictEqual(res.statusCode, 410);
      assert.match(res.data.message, /permanently disabled/i);
    });

    it("POST /sync/purchases should return HTTP 410 Gone", async () => {
      const { req, res } = mockReqRes([{ purchaseId: "HACK-02" }]);
      await syncPurchases(req, res);
      assert.strictEqual(res.statusCode, 410);
      assert.match(res.data.message, /permanently disabled/i);
    });
  });

  // -------------------------------------------------------------------------
  // TASK 8: INITIAL PAYMENT & LINE VALIDATION AT CREATION
  // -------------------------------------------------------------------------
  describe("Task 8: Initial Payment, Line Validation & Sequential Enforcement", () => {
    it("createInvoice should reject overpayment, negative paidAmount, and invalid paymentMode", async () => {
      // Ensure product PR-001 has temporary stock
      const tempMovement = await StockMovement.create({
        productId: "PR-001",
        quantity: 50,
        direction: "IN",
        movementType: "ADJUSTMENT_IN",
        referenceType: "TEST",
        referenceId: "TEST-INIT-VAL",
        movementDate: new Date(),
        warehouseLocation: "Main Warehouse - Bay 01",
      });

      try {
        // 1. Overpayment: paidAmount > grandTotal
        {
          const { req, res, next } = mockReqRes({
            clientId: "CL-001",
            invoiceDate: "2026-11-01",
            paidAmount: 99999, // Exceeds grand total
            paymentMode: "UPI",
            items: [{ productId: "PR-001", quantity: 1 }],
          });
          await createInvoice(req, res, next);
          assert.strictEqual(res.statusCode, 400);
          assert.match(res.data.message, /exceeds invoice grand total/i);
        }

        // 2. Negative paidAmount
        {
          const { req, res, next } = mockReqRes({
            clientId: "CL-001",
            invoiceDate: "2026-11-01",
            paidAmount: -500,
            paymentMode: "UPI",
            items: [{ productId: "PR-001", quantity: 1 }],
          });
          await createInvoice(req, res, next);
          assert.strictEqual(res.statusCode, 400);
          assert.match(res.data.message, /valid non-negative number/i);
        }

        // 3. Missing or invalid paymentMode when paidAmount > 0
        {
          const { req, res, next } = mockReqRes({
            clientId: "CL-001",
            invoiceDate: "2026-11-01",
            paidAmount: 500,
            paymentMode: "Cryptocurrency", // Invalid mode
            items: [{ productId: "PR-001", quantity: 1 }],
          });
          await createInvoice(req, res, next);
          assert.strictEqual(res.statusCode, 400);
          assert.match(res.data.message, /valid paymentMode is required/i);
        }
      } finally {
        await tempMovement.destroy();
      }
    });

    it("createInvoice should reject negative discounts, excessive discounts, and negative unit prices", async () => {
      const tempMovement = await StockMovement.create({
        productId: "PR-001",
        quantity: 50,
        direction: "IN",
        movementType: "ADJUSTMENT_IN",
        referenceType: "TEST",
        referenceId: "TEST-INIT-VAL2",
        movementDate: new Date(),
        warehouseLocation: "Main Warehouse - Bay 01",
      });

      try {
        // 1. Negative discount
        {
          const { req, res, next } = mockReqRes({
            clientId: "CL-001",
            invoiceDate: "2026-11-01",
            items: [{ productId: "PR-001", quantity: 1, discount: -100 }],
          });
          await createInvoice(req, res, next);
          assert.strictEqual(res.statusCode, 400);
          assert.match(res.data.message, /discount cannot be negative/i);
        }

        // 2. Excessive discount exceeding line total
        {
          const { req, res, next } = mockReqRes({
            clientId: "CL-001",
            invoiceDate: "2026-11-01",
            items: [{ productId: "PR-001", quantity: 1, unitPrice: 500, discount: 1000 }],
          });
          await createInvoice(req, res, next);
          assert.strictEqual(res.statusCode, 400);
          assert.match(res.data.message, /cannot exceed line total/i);
        }

        // 3. Negative unit price
        {
          const { req, res, next } = mockReqRes({
            clientId: "CL-001",
            invoiceDate: "2026-11-01",
            items: [{ productId: "PR-001", quantity: 1, unitPrice: -50 }],
          });
          await createInvoice(req, res, next);
          assert.strictEqual(res.statusCode, 400);
          assert.match(res.data.message, /unit price must be a valid non-negative number/i);
        }
      } finally {
        await tempMovement.destroy();
      }
    });

    it("createInvoice should merge duplicate lines and enforce sequential invoiceNumber", async () => {
      const tempMovement = await StockMovement.create({
        productId: "PR-001",
        quantity: 50,
        direction: "IN",
        movementType: "ADJUSTMENT_IN",
        referenceType: "TEST",
        referenceId: "TEST-INIT-VAL3",
        movementDate: new Date(),
        warehouseLocation: "Main Warehouse - Bay 01",
      });

      let created = null;
      try {
        const { req, res, next } = mockReqRes({
          clientId: "CL-001",
          invoiceNumber: "CLIENT-ATTEMPTED-OVERRIDE", // Must be ignored
          invoiceDate: "2026-11-01",
          items: [
            { productId: "PR-001", quantity: 2, discount: 50 },
            { productId: "PR-001", quantity: 3, discount: 50 }, // Duplicate product line
          ],
        });

        await createInvoice(req, res, next);
        assert.strictEqual(res.statusCode, 201);
        created = res.data.data;

        // 1. invoiceNumber must follow server format and ignore client override
        assert.notStrictEqual(created.invoiceNumber, "CLIENT-ATTEMPTED-OVERRIDE");
        assert.match(created.invoiceNumber, /^LE-INV-/);

        // 2. Lines must be merged into 1 line with quantity = 5 (2 + 3)
        const lines = await InvoiceLine.findAll({ where: { invoiceId: created.invoiceNumber } });
        assert.strictEqual(lines.length, 1);
        assert.strictEqual(Number(lines[0].quantity), 5);
      } finally {
        await tempMovement.destroy();
        if (created) {
          await InvoiceLine.destroy({ where: { invoiceId: created.invoiceNumber } });
          await StockMovement.destroy({ where: { referenceId: created.invoiceNumber } });
          await Invoice.destroy({ where: { invoiceNumber: created.invoiceNumber } });
          await Client.update({ orders: 0, revenue: 0, outstanding: 0, outstandingBalance: 0 }, { where: { clientId: "CL-001" } });
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // TASK 9: CANCEL ROW-LOCK CONCURRENCY SAFETY
  // -------------------------------------------------------------------------
  describe("Task 9: Cancel Row-Lock Concurrency Safety", () => {
    it("parallel cancel calls on an invoice should be idempotent and not reverse stock twice", async () => {
      // 1. Create a temporary invoice
      const t = await sequelize.transaction();
      const num = await generateInvoiceNumber(t);
      const inv = await Invoice.create(
        {
          invoiceNumber: num,
          clientId: "CL-001",
          grandTotal: 1000,
          balanceDue: 1000,
          paidAmount: 0,
          taxableTotal: 950,
          dueDate: "2026-12-01",
          isCancelled: false,
          status: "Unpaid",
        },
        { transaction: t }
      );
      await InvoiceLine.create(
        {
          invoiceId: num,
          productId: "PR-001",
          quantity: 2,
          unitPrice: 475,
          taxableAmount: 950,
          gstRate: 5,
          gstAmount: 47.5,
          lineTotal: 997.5,
        },
        { transaction: t }
      );
      await t.commit();

      try {
        // Fire 5 concurrent cancel requests
        const cancelPromises = Array.from({ length: 5 }).map(async () => {
          const { req, res, next } = mockReqRes({}, { id: inv.invoiceNumber });
          await deleteInvoice(req, res, next);
          return res.statusCode;
        });

        const statusCodes = await Promise.all(cancelPromises);
        // All should succeed (200 OK)
        for (const code of statusCodes) {
          assert.strictEqual(code, 200);
        }

        // Verify RETURN stock movements were created exactly once (not 5 times)
        const returnMovements = await StockMovement.findAll({
          where: { reference: `Cancelled ${inv.invoiceNumber}` },
        });
        assert.strictEqual(returnMovements.length, 1, "Duplicate stock reversal movements detected!");
      } finally {
        await StockMovement.destroy({ where: { reference: `Cancelled ${inv.invoiceNumber}` } });
        await InvoiceLine.destroy({ where: { invoiceId: inv.invoiceNumber } });
        await Invoice.destroy({ where: { invoiceNumber: inv.invoiceNumber } });
        await Inventory.update({ currentStock: 0 }, { where: { productId: "PR-001" } });
        await Product.update({ currentStock: 0 }, { where: { productId: "PR-001" } });
        await Client.update({ orders: 0, revenue: 0, outstanding: 0, outstandingBalance: 0 }, { where: { clientId: "CL-001" } });
      }
    });
  });
});
