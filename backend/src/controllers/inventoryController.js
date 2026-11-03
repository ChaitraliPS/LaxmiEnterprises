import { Inventory } from "../models/Inventory.js";
import { Product } from "../models/Product.js";
import { StockMovement } from "../models/StockMovement.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getStockHealth } from "../services/metrics/stockMetrics.js";
import { applyStockChange } from "../utils/stockSync.js";
import { getToday } from "../constants/erpConstants.js";

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

  let delta = 0;
  if (adjustment !== undefined && !isNaN(Number(adjustment))) {
    delta = Number(adjustment);
  } else if (quantity !== undefined && !isNaN(Number(quantity))) {
    const isOut = String(movementType || "").toLowerCase() === "outward" || String(movementType || "").toUpperCase().includes("OUT");
    delta = isOut ? -Math.abs(Number(quantity)) : Math.abs(Number(quantity));
  }

  if (delta === 0) {
    throw ApiError.badRequest("Adjustment quantity must be a non-zero number (+inward / -outward)");
  }

  const mType = movementType
    ? (movementType === "inward" ? "ADJUSTMENT_IN" : movementType === "outward" ? "ADJUSTMENT_OUT" : movementType)
    : (delta > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT");

  const result = await applyStockChange(productId, delta, {
    warehouseLocation,
    movementType: mType,
    referenceType: "MANUAL",
    reference: reference || reason || notes || "Stock Movement Entry",
    notes: notes || reason || "",
  });

  return ApiResponse.created(res, result, `Stock movement of ${delta > 0 ? "+" : ""}${delta} recorded successfully`);
});

/**
 * Adjust stock: +inward / -outward
 */
export const adjustStock = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { adjustment, warehouseLocation, reason, movementType } = req.body;

  const qty = Number(adjustment);
  if (isNaN(qty) || qty === 0) {
    throw ApiError.badRequest("adjustment must be a non-zero number (+inward / -outward)");
  }

  const mType = movementType || (qty > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT");
  const result = await applyStockChange(productId, qty, {
    warehouseLocation,
    movementType: mType,
    referenceType: "ADJUSTMENT",
    reference: reason || "Manual stock adjustment",
  });

  return ApiResponse.success(
    res,
    result,
    `Stock ${qty > 0 ? "increased" : "decreased"} successfully`
  );
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