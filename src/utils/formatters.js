/**
 * Shared Formatting Utilities for Laxmi Enterprises ERP
 * Standard Indian numbering system (Lakh/Crore), dates (DD/MM/YYYY IST), and percentages.
 */

/**
 * Formats a number to Indian currency (₹)
 * @param {number|string} amount 
 * @param {Object} options 
 * @param {boolean} options.showSymbol - Include ₹ prefix (default: true)
 * @param {boolean} options.compact - Use compact K / L / Cr format for charts and tight spaces (default: false)
 * @param {number} options.decimals - Decimals to show (default: 0 or 2)
 */
export function formatIndianCurrency(amount, { showSymbol = true, compact = false, decimals = null } = {}) {
  const num = Number(amount);
  const sym = showSymbol ? "₹" : "";

  if (amount === null || amount === undefined || isNaN(num)) {
    return `${sym}0`;
  }

  if (num === 0) {
    return `${sym}0`;
  }

  if (compact) {
    const abs = Math.abs(num);
    const sign = num < 0 ? "-" : "";

    if (abs < 1000) {
      return `${sign}${sym}${abs}`;
    }
    if (abs < 100000) {
      const val = (abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1);
      return `${sign}${sym}${val}K`;
    }
    if (abs < 10000000) {
      const val = (abs / 100000).toFixed(abs % 100000 === 0 ? 0 : 1);
      return `${sign}${sym}${val}L`;
    }
    const val = (abs / 10000000).toFixed(abs % 10000000 === 0 ? 0 : 2);
    return `${sign}${sym}${val}Cr`;
  }

  const dec = decimals !== null ? decimals : (Number.isInteger(num) ? 0 : 2);
  const formatted = num.toLocaleString("en-IN", {
    maximumFractionDigits: dec,
    minimumFractionDigits: dec,
  });

  return `${sym}${formatted}`;
}

/**
 * Formats a percentage change value
 * If change is null/undefined, returns the fallback string (e.g. "No prior data" or "—")
 */
export function formatPercent(value, { fallback = "—", withSign = true, decimals = 1 } = {}) {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return fallback;
  }
  const num = Number(value);
  const sign = withSign && num > 0 ? "+" : "";
  return `${sign}${num.toFixed(decimals)}%`;
}

/**
 * Formats a date into standard Indian format: DD/MM/YYYY
 */
export function formatDate(dateInput, { fallback = "—" } = {}) {
  if (!dateInput) return fallback;
  
  if (typeof dateInput === "string") {
    const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateInput)) {
      return dateInput;
    }
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return fallback;

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Computes Indian Fiscal Year string (April 1 to March 31)
 */
export function getFiscalYearLabel(dateInput = new Date()) {
  const d = new Date(dateInput);
  const month = d.getMonth(); // 0 = Jan, 3 = Apr
  const year = d.getFullYear();
  const startYear = month >= 3 ? year : year - 1;
  const endYearShort = String(startYear + 1).slice(-2);
  return `FY ${startYear}-${endYearShort}`;
}

