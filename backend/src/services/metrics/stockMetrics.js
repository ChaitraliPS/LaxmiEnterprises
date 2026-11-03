import { StockMovement, Product, Inventory } from "../../models/index.js";
import { formatISTDateString } from "./dateRangeHelper.js";
import { getToday, evaluateStockHealth } from "../../constants/erpConstants.js";

/**
 * Returns exact stock balance for a product directly from Inventory (Single Source of Truth).
 * Does not calculate stock from date ranges or summing history.
 *
 * @param {string} productId
 * @param {string|Date} [asOfDate=getToday()]
 */
export async function getStockBalance(productId, asOfDate = getToday()) {
  const asOfStr = formatISTDateString(asOfDate);

  const inv = await Inventory.findOne({ where: { productId } });
  const prod = await Product.findOne({
    where: { productId },
    attributes: ["productId", "name", "category", "unitOfMeasure", "unit", "costPrice", "sellingPrice", "reorderLevel", "warehouseLocation", "extraData"],
  });

  const balance = inv ? Number(inv.currentStock || 0) : Number(prod?.extraData?.stock || 0);

  return {
    productId,
    balance: Math.round(balance * 100) / 100,
    currentStock: Math.round(balance * 100) / 100,
    asOfDate: asOfStr,
  };
}

/**
 * Returns Inventory Valuation at COST (sum of currentStock * costPrice)
 * Current stock is read directly from Inventory table.
 */
export async function getInventoryValue(asOfDate = getToday()) {
  const asOfStr = formatISTDateString(asOfDate);
  const products = await Product.findAll({
    where: { isActive: true },
  });

  const inventories = await Inventory.findAll();
  const invMap = new Map(inventories.map((i) => [i.productId, i]));

  let totalValueAtCost = 0;
  let totalValueAtSelling = 0;
  const productValuations = [];

  for (const p of products) {
    const pId = p.productId;
    const inv = invMap.get(pId);
    const balance = inv ? Number(inv.currentStock || 0) : Number(p.extraData?.stock || 0);
    const cp = Number(p.costPrice || 0);
    const sp = Number(p.sellingPrice || 0);

    const valAtCost = balance * cp;
    const valAtSelling = balance * sp;

    totalValueAtCost += valAtCost;
    totalValueAtSelling += valAtSelling;

    productValuations.push({
      productId: pId,
      name: p.name,
      category: p.category,
      unit: p.unitOfMeasure || p.unit || "Bags",
      warehouseLocation: inv?.warehouseLocation || p.warehouseLocation,
      currentBalance: balance,
      currentStock: balance,
      costPrice: cp,
      sellingPrice: sp,
      valuationAtCost: Math.round(valAtCost * 100) / 100,
      valuationAtSelling: Math.round(valAtSelling * 100) / 100,
      reorderLevel: p.reorderLevel !== null ? Number(p.reorderLevel) : null,
      stockStatus: evaluateStockHealth(balance, p.reorderLevel),
    });
  }

  return {
    asOfDate: asOfStr,
    totalInventoryValueAtCost: Math.round(totalValueAtCost * 100) / 100,
    totalInventoryValueAtSelling: Math.round(totalValueAtSelling * 100) / 100,
    products: productValuations,
  };
}

/**
 * Returns comprehensive stock health, inventory metrics, and unit-wise summaries
 * Single source of truth is Inventory.currentStock.
 */
export async function getStockHealth(asOfDate = getToday()) {
  const valData = await getInventoryValue(asOfDate);

  // Group balances per unit of measure
  const unitsSummary = {};
  for (const item of valData.products) {
    const u = item.unit || "Units";
    if (!unitsSummary[u]) {
      unitsSummary[u] = {
        unit: u,
        totalBalance: 0,
        productCount: 0,
      };
    }
    unitsSummary[u].totalBalance += item.currentBalance;
    unitsSummary[u].productCount += 1;
  }

  // Count stock health statuses
  const counts = {
    inStock: 0,
    lowStock: 0,
    outOfStock: 0,
    notSet: 0,
    totalProducts: valData.products.length,
  };

  for (const p of valData.products) {
    if (p.stockStatus === "In Stock") counts.inStock += 1;
    else if (p.stockStatus === "Low Stock") counts.lowStock += 1;
    else if (p.stockStatus === "Out of Stock") counts.outOfStock += 1;
    else counts.notSet += 1;
  }

  return {
    asOfDate: valData.asOfDate,
    totalInventoryValue: valData.totalInventoryValueAtCost,
    products: valData.products,
    unitsSummary: Object.values(unitsSummary),
    healthCounts: counts,
  };
}
