import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { sequelize } from "../src/config/db.js";
import {
  Invoice,
  InvoiceLine,
  Payment,
  Collection,
  Client,
  Product,
} from "../src/models/index.js";
import {
  generateInvoiceNumber,
  generatePaymentNumber,
  generateCollectionNumber,
} from "../src/utils/numberSequence.js";
import {
  recordPayment,
  updatePayment,
  deletePayment,
  updateInvoice,
  createInvoice,
} from "../src/controllers/invoiceController.js";
import { getCollections, getSalesSummary } from "../src/services/metrics/salesMetrics.js";
import { getRevenueSummary } from "../src/services/revenueService.js";

function mockReqRes(body = {}, params = {}, query = {}) {
  const req = {
    body,
    params,
    query,
    user: { name: "Test User", role: "Super Administrator" },
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

describe("Invoice Payment & Collection Integrity Test Suite", () => {
  let testInvoice;
  let testClient;

  before(async () => {
    // Create test client if not exists
    testClient = await Client.findOne({ where: { clientId: "CL-TEST-PAY" } });
    if (!testClient) {
      testClient = await Client.create({
        clientId: "CL-TEST-PAY",
        name: "Test Payment Client",
        clientType: "Dairy",
        outstandingBalance: 10000,
        outstanding: 10000,
      });
    }
  });

  after(async () => {
    if (testInvoice) {
      await Collection.destroy({ where: { invoiceNumber: testInvoice.invoiceNumber } });
      await Payment.destroy({ where: { invoiceId: testInvoice.invoiceNumber } });
      await Invoice.destroy({ where: { invoiceNumber: testInvoice.invoiceNumber } });
    }
    if (testClient) {
      await testClient.destroy();
    }
  });

  it("Test Setup: Create invoice with total 10000, paid 0, balance 10000, Unpaid", async () => {
    const t = await sequelize.transaction();
    try {
      const invNum = await generateInvoiceNumber(t);
      testInvoice = await Invoice.create(
        {
          invoiceNumber: invNum,
          clientId: testClient.clientId,
          clientName: testClient.name,
          grandTotal: 10000,
          total: 10000,
          paidAmount: 0,
          balanceDue: 10000,
          taxableTotal: 9500,
          gstTotal: 500,
          dueDate: "2026-12-31",
          invoiceDate: "2026-05-01",
          status: "Unpaid",
          paymentStatus: "Unpaid",
          isCancelled: false,
        },
        { transaction: t }
      );
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }

    assert.strictEqual(Number(testInvoice.grandTotal), 10000);
    assert.strictEqual(Number(testInvoice.paidAmount), 0);
    assert.strictEqual(Number(testInvoice.balanceDue), 10000);
    assert.strictEqual(testInvoice.status, "Unpaid");
  });

  it("PART 5 - Test 1: total 10000, pay 4000 -> paid 4000, balance 6000, Partially Paid, Collection +4000", async () => {
    const initialColCount = await Collection.count({ where: { invoiceNumber: testInvoice.invoiceNumber } });

    const { req, res, next } = mockReqRes(
      {
        paymentAmount: 4000,
        paymentMode: "UPI",
        paymentDate: "2026-05-02",
        referenceNo: "UPI-TEST-4000",
        notes: "First installment",
      },
      { id: testInvoice.invoiceNumber }
    );

    await recordPayment(req, res, next);
    assert.strictEqual(res.statusCode, 200, `Expected 200 but got ${res.statusCode}: ${res.data?.message}`);

    // Verify invoice state in DB
    const refreshedInv = await Invoice.findOne({ where: { invoiceNumber: testInvoice.invoiceNumber } });
    assert.strictEqual(Number(refreshedInv.paidAmount), 4000);
    assert.strictEqual(Number(refreshedInv.balanceDue), 6000);
    assert.strictEqual(refreshedInv.status, "Partial");

    // Verify payment in DB
    const payments = await Payment.findAll({ where: { invoiceId: testInvoice.invoiceNumber, status: "Completed" } });
    assert.strictEqual(payments.length, 1);
    assert.strictEqual(Number(payments[0].amount), 4000);
    assert.strictEqual(payments[0].paymentMode, "UPI");

    // Verify Collection entry in DB
    const collections = await Collection.findAll({ where: { invoiceNumber: testInvoice.invoiceNumber, status: "Completed" } });
    assert.strictEqual(collections.length, initialColCount + 1);
    const col = collections[0];
    assert.strictEqual(Number(col.amount), 4000);
    assert.strictEqual(col.paymentId, payments[0].id);
    assert.strictEqual(col.invoiceNumber, testInvoice.invoiceNumber);
    assert.strictEqual(col.paymentMode, "UPI");
    assert.strictEqual(col.reference, "UPI-TEST-4000");

    // Verify Client outstanding updated
    const refreshedClient = await Client.findOne({ where: { clientId: testClient.clientId } });
    assert.strictEqual(Number(refreshedClient.outstandingBalance), 6000);
  });

  it("PART 5 - Test 2: then pay 6000 -> paid 10000, balance 0, Paid, Collection +6000", async () => {
    const { req, res, next } = mockReqRes(
      {
        paymentAmount: 6000,
        paymentMode: "NEFT",
        paymentDate: "2026-05-03",
        referenceNo: "NEFT-TEST-6000",
        notes: "Full settlement",
      },
      { id: testInvoice.invoiceNumber }
    );

    await recordPayment(req, res, next);
    assert.strictEqual(res.statusCode, 200, `Expected 200 but got ${res.statusCode}: ${res.data?.message}`);

    // Verify invoice state
    const refreshedInv = await Invoice.findOne({ where: { invoiceNumber: testInvoice.invoiceNumber } });
    assert.strictEqual(Number(refreshedInv.paidAmount), 10000);
    assert.strictEqual(Number(refreshedInv.balanceDue), 0);
    assert.strictEqual(refreshedInv.status, "Paid");

    // Verify payments in DB (now 2 payments)
    const payments = await Payment.findAll({ where: { invoiceId: testInvoice.invoiceNumber, status: "Completed" } });
    assert.strictEqual(payments.length, 2);
    const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
    assert.strictEqual(totalPaid, 10000);

    // Verify collections in DB (now 2 collections)
    const collections = await Collection.findAll({ where: { invoiceNumber: testInvoice.invoiceNumber, status: "Completed" } });
    assert.strictEqual(collections.length, 2);
    const totalCollected = collections.reduce((s, c) => s + Number(c.amount), 0);
    assert.strictEqual(totalCollected, 10000);

    // Verify Client outstanding reduced to 0
    const refreshedClient = await Client.findOne({ where: { clientId: testClient.clientId } });
    assert.strictEqual(Number(refreshedClient.outstandingBalance), 0);
  });

  it("PART 5 - Test 3: pay more than balance -> rejected, nothing saved", async () => {
    // Current balance is 0
    const { req, res, next } = mockReqRes(
      {
        paymentAmount: 500,
        paymentMode: "Cash",
      },
      { id: testInvoice.invoiceNumber }
    );

    await recordPayment(req, res, next);
    assert.strictEqual(res.statusCode, 400);
    assert.match(res.data.message, /exceeds remaining balance due/i);

    // Ensure no new payment was created
    const payments = await Payment.findAll({ where: { invoiceId: testInvoice.invoiceNumber } });
    assert.strictEqual(payments.length, 2);
  });

  it("PART 5 - Test 4: amount 0, negative or empty -> rejected", async () => {
    // Case 1: amount 0
    {
      const { req, res, next } = mockReqRes({ paymentAmount: 0, paymentMode: "UPI" }, { id: testInvoice.invoiceNumber });
      await recordPayment(req, res, next);
      assert.strictEqual(res.statusCode, 400);
      assert.match(res.data.message, /greater than 0/i);
    }

    // Case 2: negative amount
    {
      const { req, res, next } = mockReqRes({ paymentAmount: -500, paymentMode: "UPI" }, { id: testInvoice.invoiceNumber });
      await recordPayment(req, res, next);
      assert.strictEqual(res.statusCode, 400);
      assert.match(res.data.message, /greater than 0/i);
    }

    // Case 3: empty amount
    {
      const { req, res, next } = mockReqRes({ paymentAmount: "", paymentMode: "UPI" }, { id: testInvoice.invoiceNumber });
      await recordPayment(req, res, next);
      assert.strictEqual(res.statusCode, 400);
      assert.match(res.data.message, /greater than 0/i);
    }
  });

  it("PART 5 - Test 5: simulated failure while creating the Collection entry -> invoice and payment are rolled back", async () => {
    // Create another test invoice with 5000 balance
    let testInv2;
    const t = await sequelize.transaction();
    try {
      const invNum = await generateInvoiceNumber(t);
      testInv2 = await Invoice.create(
        {
          invoiceNumber: invNum,
          clientId: testClient.clientId,
          grandTotal: 5000,
          paidAmount: 0,
          balanceDue: 5000,
          taxableTotal: 4750,
          dueDate: "2026-12-31",
          status: "Unpaid",
          isCancelled: false,
        },
        { transaction: t }
      );
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }

    // Temporarily hook Collection.create to throw an error
    const originalCollectionCreate = Collection.create;
    Collection.create = async () => {
      throw new Error("Simulated Database Error during Collection entry insertion!");
    };

    try {
      const { req, res, next } = mockReqRes(
        { paymentAmount: 2000, paymentMode: "UPI", paymentDate: "2026-05-10" },
        { id: testInv2.invoiceNumber }
      );

      await recordPayment(req, res, next);
      assert.strictEqual(res.statusCode, 500);
      assert.match(res.data.message, /Simulated Database Error/i);

      // Verify that invoice was NOT updated and Payment was NOT saved (atomic rollback!)
      const invAfterFail = await Invoice.findOne({ where: { invoiceNumber: testInv2.invoiceNumber } });
      assert.strictEqual(Number(invAfterFail.paidAmount), 0);
      assert.strictEqual(Number(invAfterFail.balanceDue), 5000);
      assert.strictEqual(invAfterFail.status, "Unpaid");

      const payments = await Payment.findAll({ where: { invoiceId: testInv2.invoiceNumber } });
      assert.strictEqual(payments.length, 0);

      const collections = await Collection.findAll({ where: { invoiceNumber: testInv2.invoiceNumber } });
      assert.strictEqual(collections.length, 0);
    } finally {
      // Restore Collection.create
      Collection.create = originalCollectionCreate;
      await testInv2.destroy();
    }
  });

  it("PART 5 - Test 6: double click on Save (simultaneous concurrent payments) -> row lock prevents overpayment", async () => {
    // Create an invoice with balance 2000
    let testInv3;
    const t = await sequelize.transaction();
    try {
      const invNum = await generateInvoiceNumber(t);
      testInv3 = await Invoice.create(
        {
          invoiceNumber: invNum,
          clientId: testClient.clientId,
          grandTotal: 2000,
          paidAmount: 0,
          balanceDue: 2000,
          taxableTotal: 1900,
          dueDate: "2026-12-31",
          status: "Unpaid",
          isCancelled: false,
        },
        { transaction: t }
      );
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }

    try {
      // User double clicks "Save" paying full balance 2000 twice concurrently
      const call1 = mockReqRes({ paymentAmount: 2000, paymentMode: "UPI" }, { id: testInv3.invoiceNumber });
      const call2 = mockReqRes({ paymentAmount: 2000, paymentMode: "UPI" }, { id: testInv3.invoiceNumber });

      await Promise.all([
        recordPayment(call1.req, call1.res, call1.next),
        recordPayment(call2.req, call2.res, call2.next),
      ]);

      const successCount = (call1.res.statusCode === 200 ? 1 : 0) + (call2.res.statusCode === 200 ? 1 : 0);
      const rejectedCount = (call1.res.statusCode === 400 ? 1 : 0) + (call2.res.statusCode === 400 ? 1 : 0);

      // Exactly ONE must succeed and ONE must be rejected with 400
      assert.strictEqual(successCount, 1, "Exactly one parallel payment should succeed");
      assert.strictEqual(rejectedCount, 1, "The duplicate parallel payment should be rejected with 400");

      // Verify DB has exactly one payment and one collection entry
      const payments = await Payment.findAll({ where: { invoiceId: testInv3.invoiceNumber } });
      assert.strictEqual(payments.length, 1);
      assert.strictEqual(Number(payments[0].amount), 2000);

      const collections = await Collection.findAll({ where: { invoiceNumber: testInv3.invoiceNumber } });
      assert.strictEqual(collections.length, 1);
      assert.strictEqual(Number(collections[0].amount), 2000);
    } finally {
      await Collection.destroy({ where: { invoiceNumber: testInv3.invoiceNumber } });
      await Payment.destroy({ where: { invoiceId: testInv3.invoiceNumber } });
      await testInv3.destroy();
    }
  });

  it("PART 5 - Test 7: invoice page and Collection page show matching totals", async () => {
    // Query collections via getCollections service
    const colData = await getCollections("all");
    const totalFromCollections = colData.totalCollected;

    // Query sales summary
    const salesData = await getSalesSummary("all");
    const totalFromSales = salesData.collectedAmount;

    // Query revenue summary
    const revData = await getRevenueSummary({ fiscalYear: "all" });
    const totalFromRevenue = revData.collectedAmount;

    assert.strictEqual(
      Math.round(totalFromSales * 100) / 100,
      Math.round(totalFromCollections * 100) / 100,
      `Sales collected amount (${totalFromSales}) must match Collection data total (${totalFromCollections})`
    );

    assert.strictEqual(
      Math.round(totalFromRevenue * 100) / 100,
      Math.round(totalFromCollections * 100) / 100,
      `Revenue collected amount (${totalFromRevenue}) must match Collection data total (${totalFromCollections})`
    );
  });

  it("PART 4 - Test 8: update and delete payment updates invoice and linked Collection entry in one transaction", async () => {
    // Create an invoice with 1000 total and record 600 payment
    let inv;
    const t = await sequelize.transaction();
    try {
      const invNum = await generateInvoiceNumber(t);
      inv = await Invoice.create(
        {
          invoiceNumber: invNum,
          clientId: testClient.clientId,
          grandTotal: 1000,
          paidAmount: 0,
          balanceDue: 1000,
          taxableTotal: 950,
          dueDate: "2026-12-31",
          status: "Unpaid",
          isCancelled: false,
        },
        { transaction: t }
      );
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }

    try {
      // 1. Record payment of 600
      const rec = mockReqRes({ paymentAmount: 600, paymentMode: "UPI" }, { id: inv.invoiceNumber });
      await recordPayment(rec.req, rec.res, rec.next);
      assert.strictEqual(rec.res.statusCode, 200);

      const pay = await Payment.findOne({ where: { invoiceId: inv.invoiceNumber } });
      const col = await Collection.findOne({ where: { paymentId: pay.id } });
      assert.strictEqual(Number(pay.amount), 600);
      assert.strictEqual(Number(col.amount), 600);

      // 2. Update payment from 600 to 800
      const upd = mockReqRes({ paymentAmount: 800, paymentMode: "NEFT" }, { id: inv.invoiceNumber, paymentId: pay.id });
      await updatePayment(upd.req, upd.res, upd.next);
      assert.strictEqual(upd.res.statusCode, 200);

      const updatedPay = await Payment.findByPk(pay.id);
      const updatedCol = await Collection.findOne({ where: { paymentId: pay.id } });
      const updatedInv = await Invoice.findOne({ where: { invoiceNumber: inv.invoiceNumber } });

      assert.strictEqual(Number(updatedPay.amount), 800);
      assert.strictEqual(Number(updatedCol.amount), 800);
      assert.strictEqual(updatedCol.paymentMode, "NEFT");
      assert.strictEqual(Number(updatedInv.paidAmount), 800);
      assert.strictEqual(Number(updatedInv.balanceDue), 200);
      assert.strictEqual(updatedInv.status, "Partial");

      // 3. Delete payment
      const del = mockReqRes({}, { id: inv.invoiceNumber, paymentId: pay.id });
      await deletePayment(del.req, del.res, del.next);
      assert.strictEqual(del.res.statusCode, 200);

      // Verify payment and collection are destroyed and invoice balance restored to 1000
      const deletedPay = await Payment.findByPk(pay.id);
      const deletedCol = await Collection.findOne({ where: { paymentId: pay.id } });
      const restoredInv = await Invoice.findOne({ where: { invoiceNumber: inv.invoiceNumber } });

      assert.strictEqual(deletedPay, null);
      assert.strictEqual(deletedCol, null);
      assert.strictEqual(Number(restoredInv.paidAmount), 0);
      assert.strictEqual(Number(restoredInv.balanceDue), 1000);
      assert.strictEqual(restoredInv.status, "Unpaid");
    } finally {
      await Collection.destroy({ where: { invoiceNumber: inv.invoiceNumber } });
      await Payment.destroy({ where: { invoiceId: inv.invoiceNumber } });
      await inv.destroy();
    }
  });

  it("PART 1 & 2 - Test 9: updateInvoice with paymentDelta saves payment and collection in same transaction", async () => {
    let inv;
    const t = await sequelize.transaction();
    try {
      const invNum = await generateInvoiceNumber(t);
      inv = await Invoice.create(
        {
          invoiceNumber: invNum,
          clientId: testClient.clientId,
          grandTotal: 5000,
          paidAmount: 0,
          balanceDue: 5000,
          taxableTotal: 4750,
          dueDate: "2026-12-31",
          status: "Unpaid",
          isCancelled: false,
        },
        { transaction: t }
      );
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }

    try {
      // Simulate editing the invoice to record payment of 5000
      const { req, res, next } = mockReqRes(
        {
          notes: "Updated client note",
          paymentAmount: 5000,
          paymentMode: "UPI",
          paymentDate: "2026-05-15",
        },
        { id: inv.invoiceNumber }
      );

      await updateInvoice(req, res, next);
      assert.strictEqual(res.statusCode, 200);

      const savedInv = await Invoice.findOne({ where: { invoiceNumber: inv.invoiceNumber } });
      assert.strictEqual(savedInv.notes, "Updated client note");
      assert.strictEqual(Number(savedInv.paidAmount), 5000);
      assert.strictEqual(Number(savedInv.balanceDue), 0);
      assert.strictEqual(savedInv.status, "Paid");

      const savedPay = await Payment.findOne({ where: { invoiceId: inv.invoiceNumber } });
      assert.ok(savedPay);
      assert.strictEqual(Number(savedPay.amount), 5000);

      const savedCol = await Collection.findOne({ where: { invoiceNumber: inv.invoiceNumber } });
      assert.ok(savedCol);
      assert.strictEqual(Number(savedCol.amount), 5000);
      assert.strictEqual(savedCol.paymentId, savedPay.id);
    } finally {
      await Collection.destroy({ where: { invoiceNumber: inv.invoiceNumber } });
      await Payment.destroy({ where: { invoiceId: inv.invoiceNumber } });
      await inv.destroy();
    }
  });
});

