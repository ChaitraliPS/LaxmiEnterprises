/**
 * Date and Fiscal Calculation Utilities for Laxmi Enterprises ERP
 *
 * Requirements:
 * - Timestamps stored in UTC; grouped by month/quarter in IST (Asia/Kolkata, UTC+5:30).
 * - Indian Fiscal Year runs from April 1 to March 31.
 * - Accurate date ranges for MoM, QoQ, YoY comparisons, including leap years and month lengths.
 * - calcPercentageChange returns null if previous is 0 or null (never returns 0%, infinity, or fake values).
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30

/**
 * Returns current Date adjusted to IST components
 */
export function getNowIST() {
  const utcNow = new Date();
  return new Date(utcNow.getTime() + IST_OFFSET_MS);
}

/**
 * Parses a date string or Date object into an IST Date object
 */
export function toISTDate(dateInput) {
  if (!dateInput) return getNowIST();
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return getNowIST();
  return new Date(d.getTime() + IST_OFFSET_MS);
}

/**
 * Returns the Indian Fiscal Year string for a given date (e.g. "2026-27")
 * Apr 2026 - Mar 2027 => "2026-27"
 */
export function getFiscalYear(dateInput = new Date()) {
  const ist = toISTDate(dateInput);
  const year = ist.getUTCFullYear();
  const month = ist.getUTCMonth(); // 0 = Jan, 3 = Apr
  const startYear = month >= 3 ? year : year - 1;
  const endYearShort = String(startYear + 1).slice(-2);
  return `${startYear}-${endYearShort}`;
}

/**
 * Returns the quarter string for a given date within the Indian Fiscal Year ("Q1", "Q2", "Q3", "Q4")
 * Q1: Apr - Jun (months 3, 4, 5)
 * Q2: Jul - Sep (months 6, 7, 8)
 * Q3: Oct - Dec (months 9, 10, 11)
 * Q4: Jan - Mar (months 0, 1, 2)
 */
export function getFiscalQuarter(dateInput = new Date()) {
  const ist = toISTDate(dateInput);
  const m = ist.getUTCMonth();
  if (m >= 3 && m <= 5) return "Q1";
  if (m >= 6 && m <= 8) return "Q2";
  if (m >= 9 && m <= 11) return "Q3";
  return "Q4";
}

/**
 * Converts IST year, month (1-12), day to UTC start/end boundaries for SQL queries
 */
export function getMonthBoundsUTC(year, month1Based) {
  // IST 1st of month 00:00:00 -> UTC
  const istStart = new Date(Date.UTC(year, month1Based - 1, 1, 0, 0, 0, 0) - IST_OFFSET_MS);
  // Last day of month: day 0 of next month
  const lastDay = new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
  const istEnd = new Date(Date.UTC(year, month1Based - 1, lastDay, 23, 59, 59, 999) - IST_OFFSET_MS);
  return { startUTC: istStart, endUTC: istEnd };
}

/**
 * Returns UTC boundaries for a fiscal year (Apr 1 00:00 IST to Mar 31 23:59:59.999 IST)
 * @param {string} fyStr e.g. "2026-27"
 */
export function getFiscalYearBoundsUTC(fyStr) {
  const startYear = parseInt(fyStr.split("-")[0], 10);
  const istStart = new Date(Date.UTC(startYear, 3, 1, 0, 0, 0, 0) - IST_OFFSET_MS);
  const istEnd = new Date(Date.UTC(startYear + 1, 2, 31, 23, 59, 59, 999) - IST_OFFSET_MS);
  return { startUTC: istStart, endUTC: istEnd, startYear, endYear: startYear + 1 };
}

/**
 * Returns UTC boundaries for a specific quarter in a fiscal year
 * @param {string} fyStr e.g. "2026-27"
 * @param {string} quarter "Q1" | "Q2" | "Q3" | "Q4"
 */
export function getQuarterBoundsUTC(fyStr, quarter) {
  const startYear = parseInt(fyStr.split("-")[0], 10);
  let startMonth, endMonth, endDay, qYear;

  switch (quarter) {
    case "Q1":
      startMonth = 3; endMonth = 5; endDay = 30; qYear = startYear; // Apr 1 - Jun 30
      break;
    case "Q2":
      startMonth = 6; endMonth = 8; endDay = 30; qYear = startYear; // Jul 1 - Sep 30
      break;
    case "Q3":
      startMonth = 9; endMonth = 11; endDay = 31; qYear = startYear; // Oct 1 - Dec 31
      break;
    case "Q4":
    default:
      startMonth = 0; endMonth = 2; endDay = 31; qYear = startYear + 1; // Jan 1 - Mar 31
      break;
  }

  const istStart = new Date(Date.UTC(qYear, startMonth, 1, 0, 0, 0, 0) - IST_OFFSET_MS);
  const istEnd = new Date(Date.UTC(qYear, endMonth, endDay, 23, 59, 59, 999) - IST_OFFSET_MS);
  return { startUTC: istStart, endUTC: istEnd };
}

/**
 * Returns current month and previous month bounds in UTC
 * Handles month lengths, leap years, and year boundary (Jan vs Dec)
 */
export function getCurrentAndPreviousMonthBoundsUTC(referenceDate = new Date()) {
  const ist = toISTDate(referenceDate);
  const curYear = ist.getUTCFullYear();
  const curMonth1 = ist.getUTCMonth() + 1;

  // Previous month calculation
  let prevYear = curYear;
  let prevMonth1 = curMonth1 - 1;
  if (prevMonth1 === 0) {
    prevMonth1 = 12;
    prevYear = curYear - 1;
  }

  const currentMonth = getMonthBoundsUTC(curYear, curMonth1);
  const previousMonth = getMonthBoundsUTC(prevYear, prevMonth1);

  return {
    current: currentMonth,
    previous: previousMonth,
    curMonthName: new Date(Date.UTC(curYear, curMonth1 - 1, 1)).toLocaleString("en-US", { month: "short" }),
    prevMonthName: new Date(Date.UTC(prevYear, prevMonth1 - 1, 1)).toLocaleString("en-US", { month: "short" }),
  };
}

/**
 * Returns current quarter and previous quarter bounds in UTC
 */
export function getCurrentAndPreviousQuarterBoundsUTC(referenceDate = new Date()) {
  const ist = toISTDate(referenceDate);
  const fy = getFiscalYear(ist);
  const q = getFiscalQuarter(ist);
  const startYear = parseInt(fy.split("-")[0], 10);

  let prevFY = fy;
  let prevQ = "Q1";

  if (q === "Q1") {
    prevQ = "Q4";
    prevFY = `${startYear - 1}-${String(startYear).slice(-2)}`;
  } else if (q === "Q2") {
    prevQ = "Q1";
  } else if (q === "Q3") {
    prevQ = "Q2";
  } else if (q === "Q4") {
    prevQ = "Q3";
  }

  return {
    current: { ...getQuarterBoundsUTC(fy, q), fiscalYear: fy, quarter: q },
    previous: { ...getQuarterBoundsUTC(prevFY, prevQ), fiscalYear: prevFY, quarter: prevQ },
  };
}

/**
 * Returns current fiscal year and previous fiscal year bounds in UTC
 */
export function getCurrentAndPreviousFYBoundsUTC(referenceDate = new Date()) {
  const fy = getFiscalYear(referenceDate);
  const startYear = parseInt(fy.split("-")[0], 10);
  const prevFY = `${startYear - 1}-${String(startYear).slice(-2)}`;

  return {
    current: { ...getFiscalYearBoundsUTC(fy), fiscalYear: fy },
    previous: { ...getFiscalYearBoundsUTC(prevFY), fiscalYear: prevFY },
  };
}

/**
 * Mathematical percentage change calculator
 * - If previous period value is 0 or null, return null (never return 0%, infinity, or fake values).
 * - If current is equal to previous, return 0.0.
 * - Otherwise return percentage change rounded to 1 decimal place.
 */
export function calcPercentageChange(current, previous) {
  const cur = Number(current);
  const prev = Number(previous);

  if (previous === null || previous === undefined || isNaN(prev) || prev === 0) {
    return null;
  }
  if (isNaN(cur)) {
    return null;
  }

  const change = ((cur - prev) / Math.abs(prev)) * 100;
  return Math.round(change * 10) / 10;
}

