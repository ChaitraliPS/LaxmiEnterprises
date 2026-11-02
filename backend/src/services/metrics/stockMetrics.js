import { Op } from "sequelize";
import { StockMovement, Product } from "../../models/index.js";
import { formatISTDateString } from "./dateRangeHelper.js";
import { getToday, evaluateStockHealth } from "../../constants/erpConstants.js";

/**
 * Returns exact stock balance for a product from the movement ledger as of a date
 * Stock balance = sum(IN) - sum(OUT)
 */
export async function getStockBalance(productId, asOfDate = getToday()) {
  const asOfStr = formatISTDateString(asOfDate);
  const endUTC = new Date(`${asOfStr}T23:59:59.999+05:30`);

  const movements = await StockMovement.findAll({
    where: {
      productId,
      movementDate: { [Op.lte]: endUTC },
    },
    attributes: ["quantity", "direction", "quantityChange"],
  });

  let balance = 0;
  let totalIn = 0;
  let totalOut = 0;

  for (const m of movements) {
    const qty = Number(m.quantity || Math.abs(Number(m.quantityChange || 0)));
    const dir = m.direction || (Number(m.quantityChange || 0) >= 0 ? "IN" : "OUT");

    if (dir === "IN") {
      totalIn += qty;
      balance += qty;
    } else {
      totalOut += qty;
      balance -= qty;
    }
  }

  return {
    productId,
    balance: Math.round(balance * 100) / 100,
    totalIn: Math.round(totalIn * 100) / 100,
    totalOut: Math.round(totalOut * 100) / 100,
    asOfDate: asOfStr,
  };
}

/**
 * Returns Inventory Valuation at COST (sum of balance * costPrice)
 * NOT selling price!
 */
export async function getInventoryValue(asOfDate = getToday()) {
  const asOfStr = formatISTDateString(asOfDate);
  const products = await Product.findAll({
    where: { isActive: true },
  });

  let totalValueAtCost = 0;
  let totalValueAtSelling = 0;
  const productValuations = [];

  for (const p of products) {
    const pId = p.productId;
    const { balance, totalIn, totalOut } = await getStockBalance(pId, asOfDate);
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
      warehouseLocation: p.warehouseLocation,
      currentBalance: balance,
      totalIn,
      totalOut,
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
 * Returns comprehensive stock health, movement cards, and unit-wise summaries
 */
export async function getStockHealth(asOfDate = getToday(), periodRange = null) {
  const valData = await getInventoryValue(asOfDate);

  // Group balances and movements per unit of measure
  const unitsSummary = {};
  let totalMovementsIn = 0;
  let totalMovementsOut = 0;

  for (const item of valData.products) {
    const u = item.unit || "Units";
    if (!unitsSummary[u]) {
      unitsSummary[u] = {
        unit: u,
        totalBalance: 0,
        totalIn: 0,
        totalOut: 0,
        productCount: 0,
      };
    }
    unitsSummary[u].totalBalance += item.currentBalance;
    unitsSummary[u].totalIn += item.totalIn;
    unitsSummary[u].totalOut += item.totalOut;
    unitsSummary[u].productCount += 1;

    totalMovementsIn += item.totalIn;
    totalMovementsOut += item.totalOut;
  }

  // Count stock health statuses
  const counts = {
    inStock: 0,
    lowStock: 0,
    notSet: 0,
    totalProducts: valData.products.length,
  };

  for (const p of valData.products) {
    if (p.stockStatus === "In Stock") counts.inStock += 1;
    else if (p.stockStatus === "Low Stock") counts.lowStock += 1;
    else counts.notSet += 1;
  }

  return {
    asOfDate: valData.asOfDate,
    totalInventoryValue: valData.totalInventoryValueAtCost,
    products: valData.products,
    unitsSummary: Object.values(unitsSummary),
    totalInward: totalMovementsIn,
    totalOutward: totalMovementsOut,
    healthCounts: counts,
  };
}

