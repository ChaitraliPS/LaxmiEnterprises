import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calcPercentageChange,
  getFiscalYear,
  getFiscalQuarter,
  getMonthBoundsUTC,
  getFiscalYearBoundsUTC,
  getQuarterBoundsUTC,
  getCurrentAndPreviousMonthBoundsUTC,
  getCurrentAndPreviousQuarterBoundsUTC,
  getCurrentAndPreviousFYBoundsUTC,
} from "../src/utils/dateUtils.js";

describe("dateUtils Unit Tests", () => {
  describe("calcPercentageChange", () => {
    it("should calculate positive growth correctly", () => {
      const res = calcPercentageChange(125, 100);
      assert.strictEqual(res, 25.0);
    });

    it("should calculate negative decline correctly", () => {
      const res = calcPercentageChange(75, 100);
      assert.strictEqual(res, -25.0);
    });

    it("should return 0.0 when there is no change", () => {
      const res = calcPercentageChange(500, 500);
      assert.strictEqual(res, 0.0);
    });

    it("should return null when previous is 0 (division by zero / no baseline)", () => {
      const res = calcPercentageChange(100, 0);
      assert.strictEqual(res, null);
    });

    it("should return null when previous is null or undefined", () => {
      assert.strictEqual(calcPercentageChange(100, null), null);
      assert.strictEqual(calcPercentageChange(100, undefined), null);
    });

    it("should return null when both are 0", () => {
      assert.strictEqual(calcPercentageChange(0, 0), null);
    });

    it("should return -100.0 when current is 0 and previous is positive", () => {
      const res = calcPercentageChange(0, 50);
      assert.strictEqual(res, -100.0);
    });

    it("should round to 1 decimal place", () => {
      const res = calcPercentageChange(133.33, 100);
      assert.strictEqual(res, 33.3);
    });
  });

  describe("Indian Fiscal Year & Quarters", () => {
    it("should correctly identify FY 2026-27 for dates from Apr 1 2026 to Mar 31 2027", () => {
      assert.strictEqual(getFiscalYear(new Date("2026-04-01T00:00:00Z")), "2026-27");
      assert.strictEqual(getFiscalYear(new Date("2026-12-15T12:00:00Z")), "2026-27");
      assert.strictEqual(getFiscalYear(new Date("2027-01-15T12:00:00Z")), "2026-27");
      assert.strictEqual(getFiscalYear(new Date("2027-03-31T12:00:00Z")), "2026-27");
    });

    it("should correctly identify FY 2025-26 for Mar 31, 2026", () => {
      // Mar 31 2026 12:00 UTC is March 31 IST => FY 2025-26
      assert.strictEqual(getFiscalYear(new Date("2026-03-31T12:00:00Z")), "2025-26");
    });

    it("should correctly assign quarters for Indian Fiscal Year", () => {
      // Q1: Apr, May, Jun
      assert.strictEqual(getFiscalQuarter(new Date("2026-04-10T10:00:00Z")), "Q1");
      assert.strictEqual(getFiscalQuarter(new Date("2026-06-25T10:00:00Z")), "Q1");

      // Q2: Jul, Aug, Sep
      assert.strictEqual(getFiscalQuarter(new Date("2026-07-05T10:00:00Z")), "Q2");
      assert.strictEqual(getFiscalQuarter(new Date("2026-09-30T10:00:00Z")), "Q2");

      // Q3: Oct, Nov, Dec
      assert.strictEqual(getFiscalQuarter(new Date("2026-10-15T10:00:00Z")), "Q3");
      assert.strictEqual(getFiscalQuarter(new Date("2026-12-31T10:00:00Z")), "Q3");

      // Q4: Jan, Feb, Mar
      assert.strictEqual(getFiscalQuarter(new Date("2027-01-05T10:00:00Z")), "Q4");
      assert.strictEqual(getFiscalQuarter(new Date("2027-03-31T10:00:00Z")), "Q4");
    });
  });

  describe("Month Boundaries and Leap Year Handling", () => {
    it("should handle February in a leap year (2024 has 29 days)", () => {
      const feb2024 = getMonthBoundsUTC(2024, 2);
      // Feb 29 23:59:59.999 IST minus 5:30 = Feb 29 18:29:59.999 UTC
      const endIST = new Date(feb2024.endUTC.getTime() + 5.5 * 3600 * 1000);
      assert.strictEqual(endIST.getUTCDate(), 29);
      assert.strictEqual(endIST.getUTCMonth(), 1); // 0-based Feb
    });

    it("should handle February in a non-leap year (2025 has 28 days)", () => {
      const feb2025 = getMonthBoundsUTC(2025, 2);
      const endIST = new Date(feb2025.endUTC.getTime() + 5.5 * 3600 * 1000);
      assert.strictEqual(endIST.getUTCDate(), 28);
      assert.strictEqual(endIST.getUTCMonth(), 1);
    });

    it("should handle year-boundary transition (Jan previous month is Dec of previous year)", () => {
      const bounds = getCurrentAndPreviousMonthBoundsUTC(new Date("2027-01-15T10:00:00Z"));
      assert.strictEqual(bounds.curMonthName, "Jan");
      assert.strictEqual(bounds.prevMonthName, "Dec");

      const prevStartIST = new Date(bounds.previous.startUTC.getTime() + 5.5 * 3600 * 1000);
      assert.strictEqual(prevStartIST.getUTCFullYear(), 2026);
      assert.strictEqual(prevStartIST.getUTCMonth(), 11); // December
    });
  });

  describe("Quarter and FY Transitions", () => {
    it("should handle Q1 transition: previous quarter is Q4 of prior fiscal year", () => {
      const qBounds = getCurrentAndPreviousQuarterBoundsUTC(new Date("2026-05-15T10:00:00Z"));
      assert.strictEqual(qBounds.current.quarter, "Q1");
      assert.strictEqual(qBounds.current.fiscalYear, "2026-27");
      assert.strictEqual(qBounds.previous.quarter, "Q4");
      assert.strictEqual(qBounds.previous.fiscalYear, "2025-26");
    });

    it("should handle FY transition bounds", () => {
      const fyBounds = getCurrentAndPreviousFYBoundsUTC(new Date("2026-08-15T10:00:00Z"));
      assert.strictEqual(fyBounds.current.fiscalYear, "2026-27");
      assert.strictEqual(fyBounds.previous.fiscalYear, "2025-26");
    });
  });
});

