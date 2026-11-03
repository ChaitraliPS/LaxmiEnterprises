import { calculateCurrentStock } from "../constants/erpConstants";

export { calculateCurrentStock };

/**
 * Stock Calculation Service for Laxmi Enterprises ERP
 * Provides precise, transparent stock accounting & audit math for Products & Inventory.
 *
 * Specific Mathematical Formula (Single Source of Truth):
 *   Current Stock = Opening Stock + Inward Received - Outward Dispatched
 *
 * NOTE: There is NO reserved stock in this system.
 */

/**
 * Calculates the exact stock breakdown and current available stock for a product.
 * @param {Object} product - Product record
 * @param {Object} [inventoryItem] - Matching warehouse inventory item (optional)
 * @returns {Object} Calculated stock breakdown metrics and step-by-step audit
 */
export function calculateProductStock(product = {}, inventoryItem = null) {
  const openingStock = Math.max(0, Number(product.openingStock ?? inventoryItem?.openingStock ?? product.extraData?.openingStock ?? 0));

  // Inward received stock: determine true cumulative inward from product and linked inventory
  const pIn = Number(product.inwardStock);
  const pInAlt = Number(product.in);
  const invIn = inventoryItem && !isNaN(Number(inventoryItem.inwardStock ?? inventoryItem.in)) ? Number(inventoryItem.inwardStock ?? inventoryItem.in) : NaN;

  let inwardStock = 0;
  if (product.inwardStock !== undefined && product.inwardStock !== null && product.inwardStock !== "" && !isNaN(pIn)) {
    inwardStock = pIn;
  } else if (product.in !== undefined && product.in !== null && product.in !== "" && !isNaN(pInAlt)) {
    inwardStock = pInAlt;
  } else if (!isNaN(invIn)) {
    inwardStock = invIn;
  }
  inwardStock = Math.max(0, inwardStock);

  // Outward dispatched stock: prioritize product.outwardStock, fallback to inventoryItem.out
  let outwardStock = Number(product.outwardStock ?? product.out);
  if (isNaN(outwardStock) || outwardStock === undefined) {
    if (inventoryItem && !isNaN(Number(inventoryItem.outwardStock ?? inventoryItem.out))) {
      outwardStock = Number(inventoryItem.outwardStock ?? inventoryItem.out);
    } else {
      outwardStock = 0;
    }
  }
  outwardStock = Math.max(0, outwardStock);

  // Single Source of Truth Stock Equation: Opening + Inward - Outward
  const grossInward = openingStock + inwardStock;
  const currentAvailableStock = calculateCurrentStock({
    opening: openingStock,
    inward: inwardStock,
    outward: outwardStock,
  });

  // Safety threshold & reorder level analysis
  const hasReorder = product.reorderLevel !== undefined && product.reorderLevel !== null && product.reorderLevel !== "";
  const minStock = hasReorder ? Number(product.reorderLevel) : null;
  const bufferMargin = hasReorder ? currentAvailableStock - minStock : null;

  // Inventory Asset Valuation at COST (NOT selling price!)
  const rawCostPrice = Number(product.costPrice ?? product.purchasePrice);
  const costPrice = !isNaN(rawCostPrice) && rawCostPrice > 0 ? rawCostPrice : 0;
  const rawSellingPrice = Number(product.price ?? product.sellingPrice);
  const sellingPrice = !isNaN(rawSellingPrice) && rawSellingPrice > 0 ? rawSellingPrice : 0;
  const valuation = currentAvailableStock * costPrice;

  // Stock Status categorization using canonical evaluateStockHealth logic
  let status = "Not set";
  let statusColor = "var(--text-muted)";
  let statusBadge = "muted";
  if (!hasReorder) {
    status = "Not set";
    statusColor = "var(--text-muted)";
    statusBadge = "muted";
  } else if (currentAvailableStock <= 0) {
    status = "Out of Stock";
    statusColor = "var(--danger)";
    statusBadge = "danger";
  } else if (currentAvailableStock <= minStock) {
    status = "Low Stock";
    statusColor = "var(--warning)";
    statusBadge = "warning";
  } else {
    status = "In Stock";
    statusColor = "var(--success)";
    statusBadge = "success";
  }

  // Turnover / Fulfillment Rate
  const turnoverPercent = grossInward > 0 ? Math.min(100, Math.round((outwardStock / grossInward) * 100)) : 0;

  // Step-by-Step Ledger Audit Steps (NO RESERVED STOCK)
  const auditSteps = [
    {
      step: 1,
      label: "Opening Stock (Initial Base Balance)",
      sign: "base",
      quantity: openingStock,
      description: "Initial registered warehouse baseline stock on hand"
    },
    {
      step: 2,
      label: "Inward Procured (+ Received Stock)",
      sign: "+",
      quantity: inwardStock,
      description: "Total inward shipments received from suppliers and purchase procurement"
    },
    {
      step: 3,
      label: "Gross Physical Inward Total",
      sign: "=",
      quantity: grossInward,
      description: "Total cumulative units brought into warehouse (Opening + Inward)"
    },
    {
      step: 4,
      label: "Outward Dispatched (- Billed Sales)",
      sign: "-",
      quantity: outwardStock,
      description: "Total customer orders fulfilled, billed tax invoices & outward dispatches"
    },
    {
      step: 5,
      label: "Current Available Stock",
      sign: "=",
      quantity: currentAvailableStock,
      description: "Specific net physical stock immediately available for new sale orders"
    }
  ];

  const formulaText = `(${openingStock} Opening + ${inwardStock} Inward) - ${outwardStock} Outward = ${currentAvailableStock} Available`;

  return {
    openingStock,
    inwardStock,
    outwardStock,
    grossInward,
    currentAvailableStock,
    minStock,
    bufferMargin,
    unitPrice: costPrice,
    costPrice,
    sellingPrice,
    valuation,
    status,
    statusColor,
    statusBadge,
    turnoverPercent,
    auditSteps,
    formulaText,
    isLinkedToInventory: !!inventoryItem,
    inventoryId: inventoryItem?.id || null,
    inventoryLocation: inventoryItem?.location || "Main Warehouse"
  };
}

/**
 * Recalculates simulated stock based on hypothetical adjustments.
 */
export function simulateStock(baseOpening, baseInward, baseOutward, addInward = 0, addOutward = 0) {
  const newInward = Math.max(0, Number(baseInward || 0) + Number(addInward || 0));
  const newOutward = Math.max(0, Number(baseOutward || 0) + Number(addOutward || 0));
  const newAvailable = calculateCurrentStock({
    opening: baseOpening,
    inward: newInward,
    outward: newOutward,
  });
  return {
    newInward,
    newOutward,
    newAvailable,
    diff: newAvailable - calculateCurrentStock({ opening: baseOpening, inward: baseInward, outward: baseOutward }),
  };
}
