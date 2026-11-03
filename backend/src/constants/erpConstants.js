/**
 * Canonical Master Data Constants & Enums for Laxmi Enterprises ERP
 * Single Source of Truth for Backend modules (Self-contained, zero external path dependencies).
 */

/**
 * Single source of truth stock rule:
 * New Stock = Current Stock + Inward Received - Outward Dispatched
 * - Inward: add the quantity to the product's current stock.
 * - Outward: subtract the quantity from the product's current stock.
 * Stock must never go negative.
 *
 * @param {Object} params
 * @param {number|string} [params.currentStock] - Current Stock in inventory
 * @param {number|string} [params.current] - Current Stock alias
 * @param {number|string} [params.stock] - Current Stock alias
 * @param {number|string} [params.inward] - Inward Received quantity
 * @param {number|string} [params.inwardStock] - Inward Received alias
 * @param {number|string} [params.in] - Inward Received alias
 * @param {number|string} [params.outward] - Outward Dispatched quantity
 * @param {number|string} [params.outwardStock] - Outward Dispatched alias
 * @param {number|string} [params.out] - Outward Dispatched alias
 * @returns {number} New Current Stock (non-negative)
 */
export function calculateNewStock(params = {}) {
  const current = Number(params?.currentStock ?? params?.current ?? params?.stock ?? params?.opening ?? params?.openingStock ?? 0) || 0;
  const inward = Number(params?.inward ?? params?.inwardStock ?? params?.in ?? 0) || 0;
  const outward = Number(params?.outward ?? params?.outwardStock ?? params?.out ?? 0) || 0;
  return Math.max(0, current + inward - outward);
}

export function calculateCurrentStock(params = {}) {
  return calculateNewStock(params);
}

/**
 * Single source of truth stock availability rule:
 * "Is stock available?" = inventory current_stock > 0 (and for cart/orders, requested quantity <= current_stock).
 *
 * @param {number|string} currentStock - Stored inventory current stock
 * @param {number|string} [requestedQty=1] - Requested quantity to purchase/dispatch
 * @returns {boolean} True if stock is available
 */
export function isStockAvailable(currentStock, requestedQty = 1) {
  const stock = Number(currentStock || 0);
  const qty = Number(requestedQty || 1);
  return stock > 0 && stock >= qty;
}

// Real IST Date string (YYYY-MM-DD)
export function getRealISTDateString() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

/**
 * Returns current IST date string (YYYY-MM-DD) dynamically on every call.
 * Honors environment override (ANCHOR_DATE / TEST_ANCHOR_DATE / VITE_ANCHOR_DATE) when set.
 */
export function getToday() {
  const envDateOverride =
    (typeof process !== "undefined" && (process.env?.ANCHOR_DATE || process.env?.TEST_ANCHOR_DATE)) ||
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_ANCHOR_DATE) ||
    (typeof window !== "undefined" && window.__APP_DATE__);
  return envDateOverride || getRealISTDateString();
}

export function getFiscalYear(dateInput = getToday()) {
  const d = typeof dateInput === "string" ? new Date(`${dateInput.slice(0, 10)}T00:00:00`) : new Date(dateInput);
  if (isNaN(d.getTime())) return "2026-27";
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-12
  const startYear = month >= 4 ? year : year - 1;
  const endYearShort = String((startYear + 1) % 100).padStart(2, "0");
  return `${startYear}-${endYearShort}`;
}

export function getFiscalYearFormatted(dateInput = getToday()) {
  return `FY ${getFiscalYear(dateInput)}`;
}

export function getFiscalYearOptions(dataRecords = [], asOfDate = getToday()) {
  const currentFY = getFiscalYear(asOfDate);
  const fySet = new Set([currentFY]);

  for (const item of dataRecords || []) {
    const dStr = item.invoiceDate || item.purchaseDate || item.date || item.createdAt;
    if (dStr && typeof dStr === "string" && dStr.length >= 4) {
      fySet.add(getFiscalYear(dStr));
    }
  }

  const sorted = Array.from(fySet).sort().reverse();
  return sorted.map((fy) => ({
    value: fy,
    formattedValue: `FY ${fy}`,
    isCurrent: fy === currentFY,
    label: fy === currentFY ? `FY ${fy} (Current)` : `FY ${fy}`,
  }));
}

/**
 * @deprecated Use getToday() instead. Preserved strictly as legacy alias for backwards compatibility.
 */
export const ANCHOR_DATE = getToday();
export const ANCHOR_DATE_OBJECT = new Date(`${getToday()}T00:00:00+05:30`);

// Product Categories (The ONLY source for category everywhere)
export const PRODUCT_CATEGORIES = {
  ANIMAL_FEED: "Animal Feed",
  DAIRY: "Dairy",
};

export const PRODUCT_CATEGORY_LIST = Object.values(PRODUCT_CATEGORIES);

// Client Types
export const CLIENT_TYPES = {
  FEED_SHOP: "Feed Shop",
  DAIRY: "Dairy",
  FARMER: "Farmer",
};

export const CLIENT_TYPE_LIST = Object.values(CLIENT_TYPES);

// Vendor Types (Supplier Category)
export const VENDOR_TYPES = {
  FEED_MANUFACTURER: "Feed Manufacturer",
  DAIRY_PROCESSOR: "Dairy Processor",
  RAW_MATERIALS: "Raw Materials Supplier",
};

export const VENDOR_TYPE_LIST = Object.values(VENDOR_TYPES);

// Units of Measure
export const UNITS_OF_MEASURE = {
  BAGS: "Bags",
  LITERS: "Liters",
  KG: "Kg",
};

export const UNITS_OF_MEASURE_LIST = Object.values(UNITS_OF_MEASURE);

// Stock Movement Directions
export const STOCK_DIRECTIONS = {
  IN: "IN",
  OUT: "OUT",
};

// Stock Movement Types (History & Audit Log only)
export const STOCK_MOVEMENT_TYPES = {
  INWARD: "INWARD",
  OUTWARD: "OUTWARD",
  PURCHASE_IN: "PURCHASE_IN",
  SALE_OUT: "SALE_OUT",
  ADJUSTMENT_IN: "ADJUSTMENT_IN",
  ADJUSTMENT_OUT: "ADJUSTMENT_OUT",
  RETURN: "RETURN",
  OPENING: "OPENING", // Legacy only
};

export const STOCK_MOVEMENT_TYPE_LIST = Object.values(STOCK_MOVEMENT_TYPES);

// Status Enums for Invoices & Purchases
export const TRANSACTION_STATUSES = {
  UNPAID: "Unpaid",
  PARTIAL: "Partial",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};

// Target Statuses for Quarterly Performance
export const TARGET_STATUSES = {
  NOT_STARTED: "Not started",
  TRACKING: "Tracking",
  BEHIND: "Behind",
  ACHIEVED: "Achieved",
  MISSED: "Missed",
};

// Payment Modes (No silent defaults)
export const PAYMENT_MODES = {
  CASH: "Cash",
  NEFT: "NEFT",
  RTGS: "RTGS",
  CHEQUE: "Cheque",
  UPI: "UPI",
};

export const PAYMENT_MODE_LIST = Object.values(PAYMENT_MODES);

// Operating Expense Categories
export const EXPENSE_CATEGORIES = {
  RENT: "Rent & Premises",
  ELECTRICITY_UTILITIES: "Electricity & Utilities",
  SALARIES_WAGES: "Salaries & Wages",
  TRANSPORT_FUEL: "Transport & Fuel",
  PACKAGING: "Packaging & Bags",
  MAINTENANCE: "Machinery & Maintenance",
  OFFICE_ADMIN: "Office & Admin",
  MARKETING: "Marketing & Advertising",
  TAXES_FEES: "Taxes & Professional Fees",
  MISCELLANEOUS: "Miscellaneous",
};

export const EXPENSE_CATEGORY_LIST = Object.values(EXPENSE_CATEGORIES);

/**
 * Low-stock evaluation rule (defined ONCE for both backend and frontend):
 * - If reorderLevel is null or undefined: "Not set" (does not count as low or in-stock by default)
 * - If currentStock <= reorderLevel: "Low Stock"
 * - Else: "In Stock"
 *
 * @param {number|null|undefined} currentStock
 * @param {number|null|undefined} reorderLevel
 * @returns {"Not set" | "Low Stock" | "In Stock"}
 */
export function evaluateStockHealth(currentStock, reorderLevel) {
  if (reorderLevel === null || reorderLevel === undefined || reorderLevel === "" || isNaN(Number(reorderLevel))) {
    return "Not set";
  }
  const stock = Number(currentStock || 0);
  const reorder = Number(reorderLevel);
  if (stock <= reorder) {
    return "Low Stock";
  }
  return "In Stock";
}

/**
 * Standard Status Derivation for Sales and Purchases (defined ONCE):
 * Status is NEVER typed in.
 *
 * @param {Object} params
 * @param {number} params.grandTotal
 * @param {number} params.paidAmount
 * @param {string|Date} params.dueDate - YYYY-MM-DD or Date
 * @param {boolean} [params.isCancelled=false]
 * @param {string|Date} [params.asOfDate=getToday()] - Calculation date
 * @returns {"Unpaid" | "Partial" | "Paid" | "Overdue" | "Cancelled"}
 */
export function deriveTransactionStatus({
  grandTotal = 0,
  paidAmount = 0,
  dueDate = null,
  isCancelled = false,
  asOfDate = getToday(),
}) {
  if (isCancelled) {
    return TRANSACTION_STATUSES.CANCELLED;
  }

  const total = Number(grandTotal || 0);
  const paid = Number(paidAmount || 0);

  // Fully paid
  if (total > 0 && paid >= total) {
    return TRANSACTION_STATUSES.PAID;
  }

  // Check if overdue: not fully paid and dueDate < asOfDate
  if (dueDate) {
    const dueStr = typeof dueDate === "string" ? dueDate.slice(0, 10) : new Date(dueDate).toISOString().slice(0, 10);
    const asOfStr = typeof asOfDate === "string" ? asOfDate.slice(0, 10) : new Date(asOfDate).toISOString().slice(0, 10);
    if (dueStr < asOfStr && paid < total) {
      return TRANSACTION_STATUSES.OVERDUE;
    }
  }

  // Partially paid
  if (paid > 0 && paid < total) {
    return TRANSACTION_STATUSES.PARTIAL;
  }

  // Unpaid
  return TRANSACTION_STATUSES.UNPAID;
}

/**
 * Normalizes legacy client type strings to canonical enum
 */
export function canonicalClientType(rawType) {
  if (!rawType) return CLIENT_TYPES.FARMER;
  const s = String(rawType).trim().toLowerCase();
  if (s.includes("feed")) return CLIENT_TYPES.FEED_SHOP;
  if (s.includes("dairy")) return CLIENT_TYPES.DAIRY;
  if (s.includes("farmer")) return CLIENT_TYPES.FARMER;
  return CLIENT_TYPES.FEED_SHOP;
}

/**
 * Normalizes legacy vendor category strings to canonical enum
 */
export function canonicalVendorType(rawCategory) {
  if (!rawCategory) return VENDOR_TYPES.FEED_MANUFACTURER;
  const s = String(rawCategory).trim().toLowerCase();
  if (s.includes("feed")) return VENDOR_TYPES.FEED_MANUFACTURER;
  if (s.includes("dairy")) return VENDOR_TYPES.DAIRY_PROCESSOR;
  if (s.includes("raw") || s.includes("suppl")) return VENDOR_TYPES.RAW_MATERIALS;
  return VENDOR_TYPES.FEED_MANUFACTURER;
}

/**
 * Normalizes product category strings to canonical enum
 */
export function canonicalProductCategory(rawCategory) {
  if (!rawCategory) return PRODUCT_CATEGORIES.ANIMAL_FEED;
  const s = String(rawCategory).trim().toLowerCase();
  if (s.includes("dairy") || s.includes("milk")) return PRODUCT_CATEGORIES.DAIRY;
  return PRODUCT_CATEGORIES.ANIMAL_FEED;
}
