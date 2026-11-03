import { Inventory } from "../models/Inventory.js";
import { Product } from "../models/Product.js";
import { StockMovement } from "../models/StockMovement.js";
import { ApiError } from "./apiError.js";
import { sequelize } from "../config/db.js";
import { getToday } from "../constants/erpConstants.js";

/**
 * Shared Single Source of Truth Stock Mutation Engine for Laxmi Enterprises ERP.
 *
 * STOCK RULE (applies everywhere):
 * New Stock = Current Stock + Inward Received - Outward Dispatched
 * - Inward: add the quantity to the product's current stock.
 * - Outward: subtract the quantity from the product's current stock.
 * - The result is saved as the product's new current stock in Inventory.
 *
 * Requirements:
 * 1. Convert quantity with Number(); must be a positive integer.
 * 2. Inward: new_stock = current_stock + quantity.
 * 3. Outward: reject if quantity > current_stock; otherwise new_stock = current_stock - quantity.
 *    Stock must never go negative.
 * 4. Run in a database transaction, re-read current stock inside the transaction,
 *    and use row locks (t.LOCK.UPDATE) so two simultaneous requests cannot corrupt stock.
 * 5. Save a transaction log row (product, type, quantity, stock before, stock after, timestamp)
 *    for history only. The log must NOT be used to calculate current stock.
 * 6. Return the new current stock from the server.
 *
 * @param {Object} params
 * @param {string} params.productId - Product SKU / identifier
 * @param {'inward'|'outward'|'IN'|'OUT'|string} params.type - Movement type ('inward' or 'outward')
 * @param {number|string} params.quantity - Positive integer quantity
 * @param {string} [params.warehouseLocation] - Warehouse bay or silo location
 * @param {string} [params.referenceType="MANUAL"] - INVOICE, PURCHASE, ADJUSTMENT, MANUAL, RETURN
 * @param {string} [params.reference=""] - Invoice number, bill ID, or adjustment note
 * @param {string} [params.notes=""] - Transaction notes
 * @param {string} [params.createdBy="System"] - User or system actor
 * @param {Date|string} [params.date] - Optional transaction timestamp
 * @param {import("sequelize").Transaction} [params.transaction] - Optional active DB transaction
 * @returns {Promise<Object>} Object containing new current stock, stockBefore, stockAfter, and movement ID
 */
export async function updateStock({
  productId,
  type,
  quantity,
  warehouseLocation,
  referenceType = "MANUAL",
  reference = "",
  notes = "",
  createdBy = "System",
  date,
  transaction,
} = {}) {
  if (!productId) {
    throw ApiError.badRequest("productId is required for stock updates.");
  }

  // 1. Convert quantity with Number(); must be a positive integer
  const qty = Number(quantity);
  if (isNaN(qty) || !Number.isInteger(qty) || qty <= 0) {
    throw ApiError.badRequest("Quantity must be a positive integer greater than 0");
  }

  // Determine direction: inward vs outward
  const normType = String(type || "").toLowerCase().trim();
  let isOut = false;
  if (
    normType === "outward" ||
    normType === "out" ||
    normType.includes("out") ||
    normType === "sale_out" ||
    normType === "adjustment_out"
  ) {
    isOut = true;
  } else if (
    normType === "inward" ||
    normType === "in" ||
    normType.includes("in") ||
    normType === "purchase_in" ||
    normType === "adjustment_in" ||
    normType === "return"
  ) {
    isOut = false;
  } else {
    throw ApiError.badRequest(`Invalid movement type "${type}". Must be 'inward' or 'outward'.`);
  }

  const ownTransaction = !transaction;
  const t = transaction || (await sequelize.transaction());

  try {
    // 2. Lock Product and Inventory rows inside the transaction
    const prod = await Product.findOne({
      where: { productId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!prod) {
      throw ApiError.notFound(`Product with ID "${productId}" not found in catalogue.`);
    }

    let inv = await Inventory.findOne({
      where: { productId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    const loc =
      warehouseLocation ||
      prod.warehouseLocation ||
      (prod.category === "Dairy" ? "Cold Silo Tank 1" : "Godown Bay A-1");

    if (!inv) {
      inv = await Inventory.create(
        {
          productId: prod.productId,
          productName: prod.name,
          category: prod.category,
          unit: prod.unitOfMeasure || prod.unit || "Bags",
          currentStock: 0,
          minStockAlert: prod.reorderLevel || 10,
          warehouseLocation: loc,
        },
        { transaction: t }
      );
    }

    // 3. Re-read current stock directly from Inventory (single source of truth)
    const currentStock = Number(inv.currentStock || 0);

    // 4. Inward: new_stock = current_stock + quantity
    //    Outward: reject if quantity > current_stock; otherwise new_stock = current_stock - quantity
    let newStock;
    if (isOut) {
      if (qty > currentStock) {
        const uom = prod.unitOfMeasure || prod.unit || "units";
        throw ApiError.badRequest(
          `Insufficient stock for "${prod.name}" (${productId}): Available balance is ${currentStock} ${uom}, requested outward dispatch is ${qty} ${uom}. Stock cannot be negative.`
        );
      }
      newStock = currentStock - qty;
    } else {
      newStock = currentStock + qty;
    }

    const effectiveDate = date
      ? new Date(date)
      : process.env.ANCHOR_DATE || process.env.TEST_ANCHOR_DATE
      ? new Date(`${getToday()}T12:00:00.000+05:30`)
      : new Date();

    // 5. Atomically save the new current stock in Inventory
    inv.currentStock = newStock;
    inv.warehouseLocation = loc;
    inv.lastUpdated = effectiveDate;
    await inv.save({ transaction: t });

    // 6. Keep Product.extraData synchronized with Inventory.currentStock and purge legacy opening fields
    const extra = { ...(prod.extraData || {}) };
    delete extra.openingStock;
    delete extra.inwardStock;
    delete extra.outwardStock;
    delete extra.reservedStock;
    extra.stock = newStock;
    prod.extraData = extra;
    await prod.save({ transaction: t });

    // 7. Save a transaction log row for history only (NOT used to calculate stock)
    const movementType = isOut
      ? normType === "sale_out"
        ? "SALE_OUT"
        : "OUTWARD"
      : normType === "purchase_in"
      ? "PURCHASE_IN"
      : normType === "return"
      ? "RETURN"
      : "INWARD";

    const movement = await StockMovement.create(
      {
        productId,
        movementType,
        direction: isOut ? "OUT" : "IN",
        quantity: qty,
        quantityChange: isOut ? -qty : qty,
        stockBefore: currentStock,
        stockAfter: newStock,
        referenceType: referenceType || movementType,
        referenceId: reference || "",
        reference: reference || "",
        movementDate: effectiveDate,
        date: effectiveDate,
        warehouseLocation: loc,
        createdBy: createdBy || "System",
        notes:
          notes ||
          `${isOut ? "Outward dispatch" : "Inward receipt"} of ${qty} ${
            prod.unitOfMeasure || "units"
          }. Stock: ${currentStock} -> ${newStock}`,
      },
      { transaction: t }
    );

    if (ownTransaction) {
      await t.commit();
    }

    return {
      success: true,
      productId,
      type: isOut ? "outward" : "inward",
      quantity: qty,
      stockBefore: currentStock,
      stockAfter: newStock,
      currentStock: newStock,
      newStock,
      balance: newStock,
      previousBalance: currentStock,
      newBalance: newStock,
      movementId: movement.id,
      unit: prod.unitOfMeasure || prod.unit || "Bags",
      timestamp: effectiveDate,
    };
  } catch (err) {
    if (ownTransaction) {
      await t.rollback();
    }
    throw err;
  }
}

/**
 * Backwards-compatible adapter for existing callers of applyStockChange.
 * Fully routes through updateStock so that all modifications use the exact same atomic transaction logic.
 */
export async function applyStockChange(
  productId,
  delta,
  {
    location,
    warehouseLocation,
    type,
    movementType,
    referenceType = "MANUAL",
    reference = "",
    notes = "",
    date,
    createdBy = "System",
    transaction,
  } = {}
) {
  const numDelta = Number(delta);
  if (isNaN(numDelta) || numDelta === 0) {
    const inv = await Inventory.findOne({ where: { productId } });
    const cur = Number(inv?.currentStock || 0);
    return {
      balance: cur,
      currentStock: cur,
      previousBalance: cur,
      newBalance: cur,
      applied: 0,
    };
  }

  const isOut = numDelta < 0;
  const qty = Math.abs(numDelta);
  const resolvedType = isOut ? "outward" : "inward";

  const res = await updateStock({
    productId,
    type: resolvedType,
    quantity: qty,
    warehouseLocation: warehouseLocation || location,
    referenceType: referenceType || movementType || type,
    reference: reference || notes || "",
    notes,
    createdBy,
    date,
    transaction,
  });

  return {
    movementId: res.movementId,
    previousBalance: res.stockBefore,
    newBalance: res.currentStock,
    currentStock: res.currentStock,
    balance: res.currentStock,
    applied: numDelta,
  };
}

/**
 * Ensure inventory rows exist for all catalog products and purge any lingering opening fields.
 * Current stock in inventory is preserved as the single source of truth.
 */
export async function backfillInventory() {
  try {
    const products = await Product.findAll();
    for (const prod of products) {
      const pId = prod.productId;
      const initialStock = Math.max(0, Number(prod.extraData?.stock ?? 0));

      let inv = await Inventory.findOne({ where: { productId: pId } });
      if (!inv) {
        inv = await Inventory.create({
          productId: pId,
          productName: prod.name,
          category: prod.category,
          unit: prod.unitOfMeasure || prod.unit || "Bags",
          currentStock: initialStock,
          minStockAlert: prod.reorderLevel || 10,
          warehouseLocation:
            prod.warehouseLocation || (prod.category === "Dairy" ? "Cold Silo Tank 1" : "Godown Bay A-1"),
        });
      }

      // Purge legacy opening/reserved stock from Product extraData
      const extra = { ...(prod.extraData || {}) };
      delete extra.openingStock;
      delete extra.inwardStock;
      delete extra.outwardStock;
      delete extra.reservedStock;
      extra.stock = Number(inv.currentStock || 0);
      prod.extraData = extra;
      await prod.save();
    }
  } catch (err) {
    console.warn("⚠️ backfillInventory warning:", err.message);
  }
}

/**
 * Normalizes an inventory and product pair into a standardized inventory view
 */
export function toInventoryView(inventoryItem, product) {
  const inv =
    inventoryItem && typeof inventoryItem.toJSON === "function"
      ? inventoryItem.toJSON()
      : inventoryItem || {};
  const prod =
    product && typeof product.toJSON === "function" ? product.toJSON() : product || {};
  const curStock = Number(inv.currentStock ?? prod.stock ?? 0);
  return {
    ...inv,
    productId: prod.productId || inv.productId,
    productName: prod.name || inv.productName,
    category: prod.category || inv.category,
    unit: prod.unitOfMeasure || prod.unit || inv.unit || "Bags",
    currentStock: curStock,
    stock: curStock,
    costPrice: Number(prod.costPrice || 0),
    sellingPrice: Number(prod.sellingPrice || 0),
    reorderLevel: prod.reorderLevel !== undefined ? prod.reorderLevel : inv.minStockAlert,
  };
}
