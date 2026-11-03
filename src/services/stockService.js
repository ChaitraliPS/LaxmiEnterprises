/**
 * Stock Calculation Service for Laxmi Enterprises ERP
 * Provides precise, transparent stock accounting & audit math for Products & Inventory.
 *
 * Specific Mathematical Formula:
 *   Current Available Stock = (Opening Stock + Total Inward Received) - Total Outward Dispatched - Reserved Stock
 */

/**
 * Calculates the exact stock breakdown and current available stock for a product.
 * @param {Object} product - Product record
 * @param {Object} [inventoryItem] - Matching warehouse inventory item (optional)
 * @returns {Object} Calculated stock breakdown metrics and step-by-step audit
 */
export function calculateProductStock(product = {}, inventoryItem = null) {
  const openingStock = Math.max(0, Number(product.openingStock) || 0);

  // Inward received stock: determine true cumulative inward from product and linked inventory
  const pIn = Number(product.inwardStock);
  const pStock = Number(product.stock);
  const invIn = inventoryItem && !isNaN(Number(inventoryItem.in)) ? Number(inventoryItem.in) : NaN;
  const invStock = inventoryItem && !isNaN(Number(inventoryItem.stock ?? inventoryItem.currentStock)) ? Number(inventoryItem.stock ?? inventoryItem.currentStock) : NaN;

  const hasExplicitInward =
    product.inwardStock !== undefined && product.inwardStock !== null && product.inwardStock !== "" && !isNaN(pIn);

  let inwardStock = 0;
  if (hasExplicitInward) {
    inwardStock = pIn;
  } else if (!isNaN(invIn)) {
    inwardStock = invIn;
  } else if (openingStock === 0) {
    if (!isNaN(pStock) && pStock > 0) {
      inwardStock = pStock;
    } else if (!isNaN(invStock) && invStock > 0) {
      inwardStock = invStock;
    }
  }
  inwardStock = Math.max(0, inwardStock);

  // Outward dispatched stock: prioritize product.outwardStock, fallback to inventoryItem.out
  let outwardStock = Number(product.outwardStock);
  if (isNaN(outwardStock) || outwardStock === undefined) {
    if (inventoryItem && !isNaN(Number(inventoryItem.out))) {
      outwardStock = Number(inventoryItem.out);
    } else {
      outwardStock = 0;
    }
  }
  outwardStock = Math.max(0, outwardStock);

  // Reserved or damaged / quarantined stock
  const reservedStock = Math.max(0, Number(product.reservedStock) || 0);

  // Specific Mathematical Calculation
  const grossInward = openingStock + inwardStock;
  const totalDeductions = outwardStock + reservedStock;
  const currentAvailableStock = Math.max(0, grossInward - totalDeductions);

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

  // Step-by-Step Ledger Audit Steps
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
      label: "Reserved Stock (- Quarantine / Hold)",
      sign: "-",
      quantity: reservedStock,
      description: "Allocated customer orders, damaged stock, or quality assurance hold"
    },
    {
      step: 6,
      label: "Current Available Stock",
      sign: "=",
      quantity: currentAvailableStock,
      description: "Specific net physical stock immediately available for new sale orders"
    }
  ];

  const formulaText = `(${openingStock} Opening + ${inwardStock} Inward) - ${outwardStock} Outward - ${reservedStock} Reserved = ${currentAvailableStock} Available`;

  return {
    openingStock,
    inwardStock,
    outwardStock,
    reservedStock,
    grossInward,
    totalDeductions,
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
export function simulateStock(baseOpening, baseInward, baseOutward, baseReserved, addInward = 0, addOutward = 0) {
  const newInward = Math.max(0, baseInward + Number(addInward || 0));
  const newOutward = Math.max(0, baseOutward + Number(addOutward || 0));
  const newAvailable = Math.max(0, (baseOpening + newInward) - newOutward - baseReserved);
  return {
    newInward,
    newOutward,
    newAvailable,
    diff: newAvailable - ((baseOpening + baseInward) - baseOutward - baseReserved)
  };
}
