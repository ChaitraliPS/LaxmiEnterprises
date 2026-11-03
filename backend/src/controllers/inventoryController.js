import { Inventory } from "../models/Inventory.js";
import { Product } from "../models/Product.js";
import { StockMovement } from "../models/StockMovement.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getStockHealth } from "../services/metrics/stockMetrics.js";
import { applyStockChange } from "../utils/stockSync.js";
import { getToday, calculateCurrentStock } from "../constants/erpConstants.js";
import { sequelize } from "../config/db.js";

/**
 * Get inventory overview with per-unit totals and product health
 * Shared service ensures identical numbers with Products page.
 */
export const getInventory = asyncHandler(async (req, res) => {
  const healthData = await getStockHealth(getToday());
  return ApiResponse.success(res, healthData, "Inventory records retrieved successfully");
});

/**
 * Returns movement ledger history
 * Entry ID is the real movement ID (not product ID)
 */
export const getStockMovements = asyncHandler(async (req, res) => {
  const { productId } = req.query;
  const whereClause = {};
  if (productId) {
    whereClause.productId = productId;
  }

  const movements = await StockMovement.findAll({
    where: whereClause,
    include: [{ model: Product, as: "product", attributes: ["name", "category", "unitOfMeasure"] }],
    order: [["movementDate", "DESC"], ["id", "DESC"]],
  });

  const formatted = movements.map((m) => {
    const json = m.toJSON();
    return {
      id: m.id,
      entryId: `MOV-${String(m.id).padStart(5, "0")}`,
      movementId: m.id,
      productId: m.productId,
      productName: m.product?.name || m.productId,
      movementType: m.movementType || m.type,
      direction: m.direction || (Number(m.quantityChange || 0) >= 0 ? "IN" : "OUT"),
      quantity: Number(m.quantity || Math.abs(Number(m.quantityChange || 0))),
      unit: m.product?.unitOfMeasure || "Bags",
      warehouseLocation: m.warehouseLocation || "Godown Bay A-1",
      referenceType: m.referenceType,
      referenceId: m.referenceId || m.reference || "",
      movementDate: m.movementDate || m.date,
      createdBy: m.createdBy || "System",
      notes: m.notes || "",
    };
  });

  return ApiResponse.success(res, formatted, "Stock movements retrieved successfully");
});

/**
 * Record a stock movement directly (inward / outward)
 */
export const recordStockMovement = asyncHandler(async (req, res) => {
  const { productId, adjustment, quantity, movementType, warehouseLocation, reason, notes, reference } = req.body;

  if (!productId) {
    throw ApiError.badRequest("productId is required");
  }

  // Parse inputs with Number() so strings like "5" are never concatenated ("50" + "5" = "505")
  let rawQty;
  if (quantity !== undefined && quantity !== null && String(quantity).trim() !== "") {
    rawQty = Number(quantity);
  } else if (adjustment !== undefined && adjustment !== null && String(adjustment).trim() !== "") {
    rawQty = Math.abs(Number(adjustment));
  } else {
    throw ApiError.badRequest("Quantity is required");
  }

  // Validate on SERVER: quantity must be a positive integer
  if (isNaN(rawQty) || !Number.isInteger(rawQty) || rawQty <= 0) {
    throw ApiError.badRequest("Quantity must be a positive integer");
  }

  const isOut = String(movementType || "").toLowerCase() === "outward" ||
    String(movementType || "").toUpperCase().includes("OUT") ||
    (adjustment !== undefined && Number(adjustment) < 0);

  const delta = isOut ? -rawQty : rawQty;
  const mType = movementType
    ? (movementType === "inward" ? "ADJUSTMENT_IN" : movementType === "outward" ? "ADJUSTMENT_OUT" : movementType)
    : (delta > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT");

  const t = await sequelize.transaction();
  try {
    const result = await applyStockChange(productId, delta, {
      warehouseLocation,
      movementType: mType,
      referenceType: "MANUAL",
      reference: reference || reason || notes || "Stock Movement Entry",
      notes: notes || reason || "",
      transaction: t,
    });
    await t.commit();
    return ApiResponse.created(res, result, `Stock movement of ${delta > 0 ? "+" : ""}${delta} recorded successfully`);
  } catch (err) {
    await t.rollback();
    throw err;
  }
});

/**
 * Adjust stock: +inward / -outward
 */
export const adjustStock = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { adjustment, warehouseLocation, reason, movementType } = req.body;

  if (adjustment === undefined || adjustment === null || String(adjustment).trim() === "") {
    throw ApiError.badRequest("adjustment must be a non-zero number (+inward / -outward)");
  }

  const rawQty = Math.abs(Number(adjustment));
  if (isNaN(rawQty) || !Number.isInteger(rawQty) || rawQty <= 0) {
    throw ApiError.badRequest("Quantity must be a positive integer");
  }

  const isOut = String(movementType || "").toLowerCase() === "outward" ||
    String(movementType || "").toUpperCase().includes("OUT") ||
    Number(adjustment) < 0;

  const qty = isOut ? -rawQty : rawQty;
  const mType = movementType || (qty > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT");

  const t = await sequelize.transaction();
  try {
    const result = await applyStockChange(productId, qty, {
      warehouseLocation,
      movementType: mType,
      referenceType: "ADJUSTMENT",
      reference: reason || "Manual stock adjustment",
      transaction: t,
    });
    await t.commit();
    return ApiResponse.success(
      res,
      result,
      `Stock ${qty > 0 ? "increased" : "decreased"} successfully`
    );
  } catch (err) {
    await t.rollback();
    throw err;
  }
});

/**
 * Update stock metadata or quantity directly
 */
export const updateStock = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { currentStock, quantity, minStockAlert, warehouseLocation, notes } = req.body;

  const inv = await Inventory.findOne({ where: { productId } });
  if (!inv) {
    throw ApiError.notFound(`Inventory record not found for product "${productId}"`);
  }

  if (minStockAlert !== undefined) inv.minStockAlert = Number(minStockAlert);
  if (warehouseLocation !== undefined) inv.warehouseLocation = warehouseLocation;

  if (currentStock !== undefined || quantity !== undefined) {
    const target = Number(currentStock ?? quantity);
    const diff = target - Number(inv.currentStock || 0);
    if (diff !== 0) {
      await applyStockChange(productId, diff, {
        movementType: diff > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
        referenceType: "ADJUSTMENT",
        reference: notes || "Direct inventory adjustment",
      });
    }
  } else {
    await inv.save();
  }

  const updated = await Inventory.findOne({ where: { productId } });
  return ApiResponse.success(res, updated, "Inventory updated successfully");
});