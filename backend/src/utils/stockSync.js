import { Inventory } from "../models/Inventory.js";
import { Product } from "../models/Product.js";
import { StockMovement } from "../models/StockMovement.js";
import { ApiError } from "./apiError.js";

/**
 * Executes a transactional stock change.
 * - Enforces movement ledger integrity: writes StockMovement record with direction and quantity.
 * - Blocks negative stock: throws ApiError.badRequest if outward quantity exceeds available balance.
 * - Updates cached Inventory.currentStock strictly within the same DB transaction.
 *
 * @param {string} productId
 * @param {number} delta - Positive for IN, Negative for OUT
 * @param {Object} options
 * @param {string} [options.movementType] - OPENING, PURCHASE_IN, SALE_OUT, ADJUSTMENT_IN, ADJUSTMENT_OUT, RETURN
 * @param {string} [options.referenceType] - INVOICE, PURCHASE, ADJUSTMENT, OPENING
 * @param {string} [options.reference] - Transaction reference ID (invoice/bill ID)
 * @param {string} [options.warehouseLocation] - Warehouse or bay location
 * @param {Date} [options.date] - Transaction timestamp
 * @param {string} [options.createdBy="System"]
 * @param {import("sequelize").Transaction} options.transaction
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
    date = new Date(),
    createdBy = "System",
    transaction,
  } = {}
) {
  const qty = Number(delta) || 0;
  if (qty === 0) return { balance: 0, applied: 0 };

  const prod = await Product.findOne({ where: { productId }, transaction });
  if (!prod) {
    throw ApiError.notFound(`Product with ID "${productId}" not found in catalogue.`);
  }

  let inv = await Inventory.findOne({ where: { productId }, transaction });
  const loc = warehouseLocation || location || prod.warehouseLocation || (prod.category === "Dairy" ? "Cold Silo Tank 1" : "Godown Bay A-1");

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
      { transaction }
    );
  }

  // Calculate current ledger balance from movements
  const movements = await StockMovement.findAll({
    where: { productId },
    attributes: ["quantity", "direction", "quantityChange", "movementType"],
    transaction,
  });

  const hasOpening = movements.some(m => String(m.movementType || "").toUpperCase() === "OPENING");
  const baselineOpening = Number(prod?.extraData?.openingStock ?? (movements.length === 0 ? (inv?.currentStock || prod?.extraData?.stock || 0) : 0));

  let currentLedgerBalance = 0;
  for (const m of movements) {
    const mQty = Number(m.quantity || Math.abs(Number(m.quantityChange || 0)));
    const mDir = m.direction || (Number(m.quantityChange || 0) >= 0 ? "IN" : "OUT");
    currentLedgerBalance += mDir === "IN" ? mQty : -mQty;
  }

  const direction = qty > 0 ? "IN" : "OUT";
  const absQty = Math.abs(qty);
  let resolvedMovementType = movementType || type;
  if (!resolvedMovementType) {
    resolvedMovementType = direction === "IN" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT";
  }

  const effectiveDate = date
    ? new Date(date)
    : (process.env.ANCHOR_DATE ? new Date(`${process.env.ANCHOR_DATE}T12:00:00.000+05:30`) : new Date());

  // If no explicit OPENING movement exists in the ledger and product has an initial baseline opening stock,
  // backfill the OPENING movement into the ledger now to preserve full audit trail
  if (!hasOpening && baselineOpening > 0 && resolvedMovementType !== "OPENING") {
    const initialDate = prod.createdAt ? new Date(new Date(prod.createdAt).getTime() - 1000) : new Date(effectiveDate.getTime() - 60000);
    await StockMovement.create(
      {
        productId,
        quantity: baselineOpening,
        direction: "IN",
        movementType: "OPENING",
        referenceType: "OPENING",
        referenceId: "INITIAL-STOCK",
        movementDate: initialDate,
        warehouseLocation: loc,
        createdBy: "System",
        quantityChange: baselineOpening,
        type: "OPENING",
        reference: "Initial opening stock baseline",
        notes: `Opening stock baseline for ${prod.name}`,
      },
      { transaction }
    );
    currentLedgerBalance += baselineOpening;
  }

  // Block the transaction if stock would become negative
  const resultingBalance = currentLedgerBalance + qty;
  if (resultingBalance < 0) {
    const unit = prod.unitOfMeasure || prod.unit || "units";
    throw ApiError.badRequest(
      `Insufficient stock for "${prod.name}" (${productId}): Available balance is ${currentLedgerBalance} ${unit}, requested outward transfer is ${Math.abs(qty)} ${unit}. Stock cannot be negative.`
    );
  }

  // Write StockMovement ledger entry
  const movement = await StockMovement.create(
    {
      productId,
      quantity: absQty,
      direction,
      movementType: resolvedMovementType,
      referenceType: referenceType || resolvedMovementType,
      referenceId: reference || "",
      movementDate: effectiveDate,
      warehouseLocation: loc,
      createdBy: createdBy || "System",
      quantityChange: qty,
      type: resolvedMovementType,
      reference: reference || "",
      date: effectiveDate,
      notes: `${direction} movement of ${absQty} ${prod.unitOfMeasure || "units"} (Reference: ${reference})`,
    },
    { transaction }
  );

  // Update cached inventory column in the same transaction
  inv.currentStock = resultingBalance;
  inv.warehouseLocation = loc;
  inv.lastUpdated = effectiveDate;
  await inv.save({ transaction });

  // Keep Product metadata/extraData in sync
  if (prod) {
    const extra = { ...(prod.extraData || {}) };
    extra.stock = resultingBalance;
    if (resolvedMovementType === "OPENING") {
      extra.openingStock = Math.abs(qty);
    } else if (direction === "IN") {
      extra.inwardStock = (Number(extra.inwardStock) || 0) + Math.abs(qty);
    } else {
      extra.outwardStock = (Number(extra.outwardStock) || 0) + Math.abs(qty);
    }
    if (baselineOpening > 0 && !extra.openingStock) {
      extra.openingStock = baselineOpening;
    }
    prod.extraData = extra;
    await prod.save({ transaction });
  }

  return {
    movementId: movement.id,
    previousBalance: currentLedgerBalance,
    newBalance: resultingBalance,
    applied: qty,
  };
}

/**
 * Ensure inventory rows exist for all catalog products and backfill initial movements
 */
export async function backfillInventory() {
  try {
    const products = await Product.findAll();
    for (const prod of products) {
      const pId = prod.productId;
      const initialStock = Number(prod.extraData?.stock ?? prod.extraData?.openingStock ?? 0);

      let inv = await Inventory.findOne({ where: { productId: pId } });
      if (!inv) {
        inv = await Inventory.create({
          productId: pId,
          productName: prod.name,
          category: prod.category,
          unit: prod.unitOfMeasure || prod.unit || "Bags",
          currentStock: initialStock,
          minStockAlert: prod.reorderLevel || 10,
          warehouseLocation: prod.warehouseLocation || (prod.category === "Dairy" ? "Cold Silo Tank 1" : "Godown Bay A-1"),
        });
      }

      // Check if any movements exist for this product
      const movements = await StockMovement.findAll({ where: { productId: pId } });
      const hasOpening = movements.some(m => String(m.movementType || "").toUpperCase() === "OPENING");
      const registeredOpening = Number(prod.extraData?.openingStock || 0);
      const effectiveOpening = registeredOpening > 0 ? registeredOpening : (movements.length === 0 ? initialStock : 0);

      if (!hasOpening && effectiveOpening > 0) {
        const initialDate = prod.createdAt ? new Date(new Date(prod.createdAt).getTime() - 1000) : new Date(Date.now() - 60000);
        await StockMovement.create({
          productId: pId,
          movementType: "OPENING",
          quantity: effectiveOpening,
          direction: "IN",
          referenceType: "OPENING",
          referenceId: "INITIAL-STOCK",
          warehouseLocation: inv.warehouseLocation || prod.warehouseLocation || "Godown Bay A-1",
          movementDate: initialDate,
          quantityChange: effectiveOpening,
          notes: `Automatic initial opening stock baseline backfill for ${prod.name}`,
        });
        console.log(`⚡ Backfilled opening stock of ${effectiveOpening} for ${prod.name} (${pId})`);
      }

      // Re-fetch all movements to enforce complete ledger truth
      const allMovements = await StockMovement.findAll({ where: { productId: pId } });
      let ledgerBal = 0;
      let openingTotal = 0;
      let inTotal = 0;
      let outTotal = 0;
      for (const m of allMovements) {
        const qty = Number(m.quantity || Math.abs(Number(m.quantityChange || 0)));
        const dir = m.direction || (Number(m.quantityChange || 0) >= 0 ? "IN" : "OUT");
        const mType = String(m.movementType || "").toUpperCase();
        if (dir === "IN") {
          ledgerBal += qty;
          if (mType === "OPENING") {
            openingTotal += qty;
          } else {
            inTotal += qty;
          }
        } else {
          ledgerBal -= qty;
          outTotal += qty;
        }
      }

      // Fallback if opening movement was missing
      if (openingTotal === 0 && registeredOpening > 0) {
        openingTotal = registeredOpening;
        ledgerBal += registeredOpening;
      }

      if (Number(inv.currentStock) !== ledgerBal) {
        inv.currentStock = ledgerBal;
        await inv.save();
      }
      prod.extraData = {
        ...(prod.extraData || {}),
        stock: ledgerBal,
        openingStock: openingTotal,
        inwardStock: inTotal,
        outwardStock: outTotal,
      };
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
  const inv = inventoryItem && typeof inventoryItem.toJSON === "function" ? inventoryItem.toJSON() : (inventoryItem || {});
  const prod = product && typeof product.toJSON === "function" ? product.toJSON() : (product || {});
  return {
    ...inv,
    productId: prod.productId || inv.productId,
    productName: prod.name || inv.productName,
    category: prod.category || inv.category,
    unit: prod.unitOfMeasure || prod.unit || inv.unit || "Bags",
    costPrice: Number(prod.costPrice || 0),
    sellingPrice: Number(prod.sellingPrice || 0),
    reorderLevel: prod.reorderLevel !== undefined ? prod.reorderLevel : inv.minStockAlert,
  };
}
