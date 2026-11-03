import { getToday } from "../../constants/erpConstants.js";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30

/**
 * Returns Date object representing today in IST
 */
export function getAnchorDateIST() {
  return new Date(`${getToday()}T00:00:00+05:30`);
}

/**
 * Parses any date into YYYY-MM-DD string in IST
 */
export function formatISTDateString(dateInput) {
  if (!dateInput) return getToday();
  if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
    return dateInput.slice(0, 10);
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return getToday();
  const istDate = new Date(d.getTime() + IST_OFFSET_MS);
  return istDate.toISOString().slice(0, 10);
}

/**
 * Returns Indian Fiscal Year string for any date (e.g. "2026-27")
 */
export function getFiscalYear(dateInput = getToday()) {
  const dStr = formatISTDateString(dateInput);
  const [yearStr, monthStr] = dStr.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-12
  const startYear = month >= 4 ? year : year - 1;
  const endYearShort = String(startYear + 1).slice(-2);
  return `${startYear}-${endYearShort}`;
}

/**
 * Returns quarter in Indian FY ("Q1", "Q2", "Q3", "Q4")
 * Q1: Apr - Jun (months 4, 5, 6)
 * Q2: Jul - Sep (months 7, 8, 9)
 * Q3: Oct - Dec (months 10, 11, 12)
 * Q4: Jan - Mar (months 1, 2, 3)
 */
export function getFiscalQuarter(dateInput = getToday()) {
  const dStr = formatISTDateString(dateInput);
  const month = parseInt(dStr.split("-")[1], 10);
  if (month >= 4 && month <= 6) return "Q1";
  if (month >= 7 && month <= 9) return "Q2";
  if (month >= 10 && month <= 12) return "Q3";
  return "Q4";
}

/**
 * Returns start and end UTC boundaries for standard range presets
 * @param {string|Object} range
 * @param {string|Date} [asOfDate=getToday()]
 */
export function resolveDateRange(range = "fy", asOfDate = getToday()) {
  const anchorStr = formatISTDateString(asOfDate);
  const [aYear, aMonth, aDay] = anchorStr.split("-").map(Number);
  const currentFY = getFiscalYear(anchorStr);

  if (typeof range === "object" && range !== null) {
    if (range.fiscalYear) {
      return resolveDateRange(range.fiscalYear, asOfDate);
    }
    const sStr = range.startDate ? formatISTDateString(range.startDate) : "1970-01-01";
    const eStr = range.endDate ? formatISTDateString(range.endDate) : "2099-12-31";
    const startUTC = new Date(`${sStr}T00:00:00+05:30`);
    const endUTC = new Date(`${eStr}T23:59:59.999+05:30`);
    return {
      startDate: sStr,
      endDate: eStr,
      startUTC,
      endUTC,
      label: `${sStr} to ${eStr}`,
      isAllTime: false,
    };
  }

  const r = String(range || "fy").toLowerCase().trim();

  if (r === "all" || r === "all_time") {
    return {
      startDate: "1970-01-01",
      endDate: "2099-12-31",
      startUTC: new Date(0),
      endUTC: new Date("2099-12-31T23:59:59.999Z"),
      label: "All Time",
      isAllTime: true,
    };
  }

  if (r === "month" || r === "current_month") {
    const lastDay = new Date(aYear, aMonth, 0).getDate();
    const sStr = `${aYear}-${String(aMonth).padStart(2, "0")}-01`;
    const eStr = `${aYear}-${String(aMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return {
      startDate: sStr,
      endDate: eStr,
      startUTC: new Date(`${sStr}T00:00:00+05:30`),
      endUTC: new Date(`${eStr}T23:59:59.999+05:30`),
      label: new Date(aYear, aMonth - 1, 1).toLocaleString("en-US", { month: "short", year: "numeric" }),
      isAllTime: false,
    };
  }

  if (r === "quarter" || r === "current_quarter") {
    const q = getFiscalQuarter(anchorStr);
    const startYear = parseInt(currentFY.split("-")[0], 10);
    let sStr, eStr;
    if (q === "Q1") {
      sStr = `${startYear}-04-01`; eStr = `${startYear}-06-30`;
    } else if (q === "Q2") {
      sStr = `${startYear}-07-01`; eStr = `${startYear}-09-30`;
    } else if (q === "Q3") {
      sStr = `${startYear}-10-01`; eStr = `${startYear}-12-31`;
    } else {
      sStr = `${startYear + 1}-01-01`; eStr = `${startYear + 1}-03-31`;
    }
    return {
      startDate: sStr,
      endDate: eStr,
      startUTC: new Date(`${sStr}T00:00:00+05:30`),
      endUTC: new Date(`${eStr}T23:59:59.999+05:30`),
      label: `${q} FY ${currentFY}`,
      isAllTime: false,
    };
  }

  // Specific FY like "2025-26" or "2026-27" or 4-digit start year like "2026" / "2025"
  const fyMatch = r.match(/(\d{4})-(\d{2})/);
  const fourDigitMatch = r.match(/^(\d{4})$/);
  let targetFY = currentFY;
  if (fyMatch) {
    targetFY = `${fyMatch[1]}-${fyMatch[2]}`;
  } else if (fourDigitMatch) {
    const y = parseInt(fourDigitMatch[1], 10);
    targetFY = `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
  }
  const startYear = parseInt(targetFY.split("-")[0], 10);
  const sStr = `${startYear}-04-01`;
  const eStr = `${startYear + 1}-03-31`;

  return {
    startDate: sStr,
    endDate: eStr,
    startUTC: new Date(`${sStr}T00:00:00+05:30`),
    endUTC: new Date(`${eStr}T23:59:59.999+05:30`),
    label: `FY ${targetFY}`,
    isAllTime: false,
  };
}
