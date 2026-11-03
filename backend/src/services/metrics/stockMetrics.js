import { Op } from "sequelize";
import { StockMovement, Product, Inventory } from "../../models/index.js";
import { formatISTDateString } from "./dateRangeHelper.js";
import { getToday, evaluateStockHealth } from "../../constants/erpConstants.js";

/**
 * Returns exact stock balance for a product from the movement ledger as of a date/period
 * Stock balance = sum(IN) - sum(OUT) = openingStock + inwardStock - outwardStock
 *
 * @param {string} productId
 * @param {string|Date} [asOfDate=getToday()] - End of period / balance date
 * @param {string|Date} [periodStart=null] - Start of period. If provided, all movements before this are opening balance
 */
export async function getStockBalance(productId, asOfDate = getToday(), periodStart = null) {
  const asOfStr = formatISTDateString(asOfDate);
  const endUTC = new Date(`${asOfStr}T23:59:59.999+05:30`);
  const startUTC = periodStart ? new Date(periodStart) : null;

  const movements = await StockMovement.findAll({
    where: {
      productId,
      movementDate: { [Op.lte]: endUTC },
    },
    attributes: ["quantity", "direction", "quantityChange", "movementType", "movementDate", "id"],
    order: [["movementDate", "ASC"], ["id", "ASC"]],
  });

  // Fetch product definition for baseline opening stock
  const prod = await Product.findOne({
    where: { productId },
    attributes: ["productId", "name", "category", "unitOfMeasure", "unit", "costPrice", "sellingPrice", "reorderLevel", "warehouseLocation", "extraData"],
  });

  const baselineOpening = Number(prod?.extraData?.openingStock || 0);

  let totalIn = 0;
  let totalInward = 0;
  let openingStock = 0;
  let totalOut = 0;
  let hasExplicitOpeningInLedger = false;

  for (const m of movements) {
    const qty = Number(m.quantity || Math.abs(Number(m.quantityChange || 0)));
    const dir = m.direction || (Number(m.quantityChange || 0) >= 0 ? "IN" : "OUT");
    const mType = String(m.movementType || "").toUpperCase();
    const mDate = m.movementDate ? new Date(m.movementDate) : new Date();

    const isPriorToPeriod = startUTC ? mDate < startUTC : false;

    if (mType === "OPENING" || isPriorToPeriod) {
      if (mType === "OPENING") hasExplicitOpeningInLedger = true;
      if (dir === "IN") {
        openingStock += qty;
        totalIn += qty;
      } else {
        openingStock -= qty;
        totalOut += qty;
      }
    } else {
      if (dir === "IN") {
        totalInward += qty;
        totalIn += qty;
      } else {
        totalOut += qty;
      }
    }
  }

  // If the product has a baseline opening stock that was not recorded as an explicit OPENING movement in the ledger
  if (!hasExplicitOpeningInLedger && baselineOpening > 0) {
    openingStock += baselineOpening;
    totalIn += baselineOpening;
  }

  // If no movements exist at all, check fallback from Inventory / Product
  if (movements.length === 0 && openingStock === 0) {
    const inv = await Inventory.findOne({ where: { productId }, attributes: ["currentStock"] });
    const fallbackBal = Number(inv?.currentStock ?? prod?.extraData?.stock ?? 0);
    if (fallbackBal > 0) {
      openingStock = fallbackBal;
      totalIn = fallbackBal;
    }
  }

  const balance = Math.max(0, openingStock + totalInward - totalOut);

  return {
    productId,
    balance: Math.round(balance * 100) / 100,
    totalIn: Math.round(totalIn * 100) / 100,
    totalInward: Math.round(totalInward * 100) / 100,
    openingStock: Math.round(openingStock * 100) / 100,
    totalOut: Math.round(totalOut * 100) / 100,
    asOfDate: asOfStr,
    hasMovements: movements.length > 0 || openingStock > 0,
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
    const { balance, totalIn, totalInward, openingStock, totalOut, hasMovements } = await getStockBalance(pId, asOfDate);
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
      totalInward,
      openingStock,
      totalOut,
      hasMovements,
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

