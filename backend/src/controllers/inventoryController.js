import { Inventory } from "../models/Inventory.js";
import { Product } from "../models/Product.js";
import { StockMovement } from "../models/StockMovement.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getStockHealth } from "../services/metrics/stockMetrics.js";
import { updateStock as updateInventoryStock } from "../utils/stockSync.js";
import { getToday } from "../constants/erpConstants.js";
import { sequelize } from "../config/db.js";

/**
 * Get inventory overview with per-unit totals and product health
 * Inventory is the SINGLE source of truth for stock.
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
      stockBefore: Number(m.stockBefore || 0),
      stockAfter: Number(m.stockAfter || 0),
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
 * Uses the single shared updateStock function.
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
    throw ApiError.badRequest("Quantity must be a positive integer greater than 0");
  }

  const isOut = String(movementType || "").toLowerCase() === "outward" ||
    String(movementType || "").toUpperCase().includes("OUT") ||
    (adjustment !== undefined && Number(adjustment) < 0);

  const result = await updateInventoryStock({
    productId,
    type: isOut ? "outward" : "inward",
    quantity: rawQty,
    warehouseLocation,
    referenceType: "MANUAL",
    reference: reference || reason || notes || "Stock Movement Entry",
    notes: notes || reason || "",
  });

  return ApiResponse.created(res, result, `Stock movement of ${isOut ? "-" : "+"}${rawQty} recorded successfully`);
});

/**
 * Adjust stock: +inward / -outward
 * Uses the single shared updateStock function.
 */
export const adjustStock = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { adjustment, quantity, warehouseLocation, reason, movementType } = req.body;

  const raw = quantity !== undefined ? quantity : adjustment;
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    throw ApiError.badRequest("Quantity or adjustment is required");
  }

  const rawQty = Math.abs(Number(raw));
  if (isNaN(rawQty) || !Number.isInteger(rawQty) || rawQty <= 0) {
    throw ApiError.badRequest("Quantity must be a positive integer greater than 0");
  }

  const isOut = String(movementType || "").toLowerCase() === "outward" ||
    String(movementType || "").toUpperCase().includes("OUT") ||
    Number(adjustment) < 0;

  const result = await updateInventoryStock({
    productId,
    type: isOut ? "outward" : "inward",
    quantity: rawQty,
    warehouseLocation,
    referenceType: "ADJUSTMENT",
    reference: reason || "Manual stock adjustment",
    notes: reason || "",
  });

  return ApiResponse.success(
    res,
    result,
    `Stock ${isOut ? "decreased" : "increased"} successfully`
  );
});

/**
 * Update stock metadata directly (e.g. minStockAlert, warehouseLocation)
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
      await updateInventoryStock({
        productId,
        type: diff > 0 ? "inward" : "outward",
        quantity: Math.abs(diff),
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