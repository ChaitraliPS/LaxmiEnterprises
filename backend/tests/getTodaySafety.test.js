import { test, describe, after } from "node:test";
import assert from "node:assert";
import dotenv from "dotenv";
dotenv.config();

import { getToday } from "../src/constants/erpConstants.js";
import { generateInvoiceNumber } from "../src/utils/numberSequence.js";
import { sequelize } from "../src/config/db.js";

describe("Dynamic getToday() & Real-Time Call Date Tests", () => {
  const originalAnchor = process.env.ANCHOR_DATE;
  const originalTestAnchor = process.env.TEST_ANCHOR_DATE;

  after(() => {
    // Restore environment override to avoid impacting other suites
    if (originalAnchor !== undefined) {
      process.env.ANCHOR_DATE = originalAnchor;
    } else {
      delete process.env.ANCHOR_DATE;
    }

    if (originalTestAnchor !== undefined) {
      process.env.TEST_ANCHOR_DATE = originalTestAnchor;
    } else {
      delete process.env.TEST_ANCHOR_DATE;
    }
  });

  test("mock the env override, call getToday() twice with a changed override, and assert different values", () => {
    delete process.env.TEST_ANCHOR_DATE;

    // Call 1 with initial override
    process.env.ANCHOR_DATE = "2026-04-10";
    const date1 = getToday();
    assert.strictEqual(date1, "2026-04-10", "getToday() must return first overridden date");

    // Call 2 with dynamically changed override
    process.env.ANCHOR_DATE = "2026-11-25";
    const date2 = getToday();
    assert.strictEqual(date2, "2026-11-25", "getToday() must return second overridden date");

    // Assert different values
    assert.notStrictEqual(date1, date2, "getToday() called at different times with changed overrides must return different values");
  });

  test("generateInvoiceNumber uses the date of the call", async () => {
    delete process.env.TEST_ANCHOR_DATE;

    // Call 1: Date in FY 2025-26
    process.env.ANCHOR_DATE = "2025-08-15";
    const t1 = await sequelize.transaction();
    let invNum1;
    try {
      invNum1 = await generateInvoiceNumber(t1);
      await t1.commit();
    } catch (err) {
      await t1.rollback();
      throw err;
    }
    assert.match(
      invNum1,
      /^LE-INV-2025-26-\d{4}$/,
      `Expected invoice number with FY 2025-26 prefix, received: ${invNum1}`
    );

    // Call 2: Date in FY 2027-28
    process.env.ANCHOR_DATE = "2027-05-20";
    const t2 = await sequelize.transaction();
    let invNum2;
    try {
      invNum2 = await generateInvoiceNumber(t2);
      await t2.commit();
    } catch (err) {
      await t2.rollback();
      throw err;
    }
    assert.match(
      invNum2,
      /^LE-INV-2027-28-\d{4}$/,
      `Expected invoice number with FY 2027-28 prefix, received: ${invNum2}`
    );

    assert.notStrictEqual(invNum1, invNum2, "Invoice numbers from different dates must reflect their respective fiscal years");
  });
});

