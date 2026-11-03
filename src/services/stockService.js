import { calculateNewStock, calculateCurrentStock, evaluateStockHealth, isStockAvailable } from "../constants/erpConstants";

export { calculateNewStock, calculateCurrentStock, isStockAvailable };

/**
 * Stock Service for Laxmi Enterprises ERP
 * Inventory is the SINGLE source of truth for stock.
 * Current stock is one stored value per product in inventory.
 *
 * STOCK RULE (applies everywhere):
 * New Stock = Current Stock + Inward Received - Outward Dispatched
 * - Inward: add the quantity to the product's current stock.
 * - Outward: subtract the quantity from the product's current stock.
 * - The result is saved as the product's new current stock.
 */
export function calculateProductStock(product = {}, inventoryItem = null) {
  // Current stock is read strictly from inventory as the single source of truth
  const currentStock = Math.max(
    0,
    Number(inventoryItem?.currentStock ?? inventoryItem?.stock ?? product.currentStock ?? product.stock ?? 0)
  );

  const hasReorder = product.reorderLevel !== undefined && product.reorderLevel !== null && product.reorderLevel !== "";
  const minStock = hasReorder ? Number(product.reorderLevel) : null;
  const bufferMargin = hasReorder ? currentStock - minStock : null;

  // Inventory Asset Valuation at COST (NOT selling price!)
  const rawCostPrice = Number(product.costPrice ?? product.purchasePrice);
  const costPrice = !isNaN(rawCostPrice) && rawCostPrice > 0 ? rawCostPrice : 0;
  const rawSellingPrice = Number(product.price ?? product.sellingPrice);
  const sellingPrice = !isNaN(rawSellingPrice) && rawSellingPrice > 0 ? rawSellingPrice : 0;
  const valuation = currentStock * costPrice;

  // Stock Status categorization
  let status = "Not set";
  let statusColor = "var(--text-muted)";
  let statusBadge = "muted";
  if (!hasReorder) {
    status = "Not set";
    statusColor = "var(--text-muted)";
    statusBadge = "muted";
  } else if (currentStock <= 0) {
    status = "Out of Stock";
    statusColor = "var(--danger)";
    statusBadge = "danger";
  } else if (currentStock <= minStock) {
    status = "Low Stock";
    statusColor = "var(--warning)";
    statusBadge = "warning";
  } else {
    status = "In Stock";
    statusColor = "var(--success)";
    statusBadge = "success";
  }

  return {
    currentStock,
    currentAvailableStock: currentStock,
    minStock,
    bufferMargin,
    unitPrice: costPrice,
    costPrice,
    sellingPrice,
    valuation,
    status,
    statusColor,
    statusBadge,
    isAvailable: currentStock > 0,
    isLinkedToInventory: !!inventoryItem,
    inventoryId: inventoryItem?.id || null,
    inventoryLocation: inventoryItem?.location || inventoryItem?.warehouseLocation || product.warehouseLocation || "Main Warehouse",
  };
}
