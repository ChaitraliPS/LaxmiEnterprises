import { Product } from "../models/Product.js";
import { Inventory } from "../models/Inventory.js";
import { StockMovement } from "../models/StockMovement.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getStockHealth } from "../services/metrics/stockMetrics.js";
import { getToday, evaluateStockHealth, canonicalProductCategory } from "../constants/erpConstants.js";
import { Op } from "sequelize";

/**
 * Get all products (reading stock directly from Inventory table as single source of truth)
 */
export const getProducts = asyncHandler(async (req, res) => {
  const healthData = await getStockHealth(getToday());
  const healthMap = new Map(healthData.products.map((p) => [p.productId, p]));

  const products = await Product.findAll({
    where: { isActive: true },
    order: [["name", "ASC"]],
  });

  const payload = products.map((prod) => {
    const json = prod.toJSON();
    const metrics = healthMap.get(prod.productId);

    const balance = metrics ? metrics.currentBalance : Number(json.stock ?? json.extraData?.stock ?? 0);
    const valAtCost = metrics ? metrics.valuationAtCost : balance * Number(prod.costPrice || 0);

    return {
      ...json,
      stock: balance,
      currentStock: balance,
      inventoryValue: valAtCost,
      valuationAtCost: valAtCost,
      unitOfMeasure: prod.unitOfMeasure || prod.unit || "Bags",
      reorderLevel: prod.reorderLevel !== null ? Number(prod.reorderLevel) : null,
      stockStatus: evaluateStockHealth(balance, prod.reorderLevel),
    };
  });

  return ApiResponse.success(res, payload, "Products retrieved successfully");
});

/**
 * Create a new product (+ linked inventory).
 * If created with an initial quantity, sets starting current stock and records first inward entry.
 * No separate opening field.
 */
export const createProduct = asyncHandler(async (req, res) => {
  const inputData = { ...req.body };

  if (!inputData.productId && inputData.id) {
    inputData.productId = String(inputData.id);
  }
  if (!inputData.productId) {
    const count = await Product.count();
    inputData.productId = `PR-${String(count + 1).padStart(3, "0")}`;
  }
  delete inputData.id;

  const existing = await Product.findOne({ where: { productId: inputData.productId } });
  if (existing) {
    throw ApiError.badRequest(`Product ID ${inputData.productId} already exists`);
  }

  // Canonical category
  const canonicalCat = canonicalProductCategory(inputData.category);
  const unit = inputData.unitOfMeasure || inputData.unit || (canonicalCat === "Dairy" ? "Liters" : "Bags");
  const costPrice = Number(inputData.costPrice ?? inputData.purchasePrice ?? 0);
  const sellingPrice = Number(inputData.sellingPrice ?? inputData.price ?? 0);
  const reorderLevel =
    inputData.reorderLevel !== undefined && inputData.reorderLevel !== null && inputData.reorderLevel !== ""
      ? Number(inputData.reorderLevel)
      : null;
  const warehouseLocation =
    inputData.warehouseLocation || (canonicalCat === "Dairy" ? "Cold Silo Tank 1" : "Godown Bay A-1");

  const rawStarting = Number(inputData.initialStock ?? inputData.quantity ?? inputData.stock ?? 0);
  const startingStock = !isNaN(rawStarting) && rawStarting > 0 ? (Number.isInteger(rawStarting) ? rawStarting : Math.floor(rawStarting)) : 0;

  const extraData = {
    ...(inputData.extraData || {}),
    stock: startingStock,
    minStock: reorderLevel,
  };
  delete extraData.openingStock;
  delete extraData.inwardStock;
  delete extraData.outwardStock;
  delete extraData.reservedStock;

  const product = await Product.create({
    productId: inputData.productId,
    name: inputData.name,
    category: canonicalCat,
    sku: inputData.sku || "",
    hsnCode: inputData.hsnCode || "",
    unit,
    unitOfMeasure: unit,
    costPrice,
    purchasePrice: costPrice,
    sellingPrice,
    gstRate: Number(inputData.gstRate ?? (canonicalCat === "Dairy" ? 0 : 5)),
    reorderLevel,
    warehouseLocation,
    description: inputData.description || "",
    isActive: true,
    extraData,
  });

  // Always ensure Inventory table row exists for catalog products
  let inv = await Inventory.findOne({ where: { productId: product.productId } });
  if (!inv) {
    inv = await Inventory.create({
      productId: product.productId,
      productName: product.name,
      category: product.category,
      unit: product.unitOfMeasure,
      currentStock: startingStock,
      minStockAlert: reorderLevel || 10,
      warehouseLocation,
    });
  } else {
    inv.currentStock = startingStock;
    await inv.save();
  }

  // Treat initial quantity as the first inward entry in the log for audit history
  if (startingStock > 0) {
    await StockMovement.create({
      productId: product.productId,
      movementType: "INWARD",
      quantity: startingStock,
      direction: "IN",
      quantityChange: startingStock,
      stockBefore: 0,
      stockAfter: startingStock,
      referenceType: "INITIAL_STOCK",
      referenceId: "INITIAL-STOCK",
      warehouseLocation,
      movementDate: new Date(),
      notes: `Initial inward received for ${product.name}`,
    });
  }

  return ApiResponse.created(res, product, "Product created successfully");
});

/**
 * Update an existing product
 * Products page does NOT edit stock; updates product details only.
 */
export const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findOne({
    where: { productId: id },
  });

  if (!product) {
    throw ApiError.notFound(`Product not found with id: ${id}`);
  }

  const body = { ...req.body };
  delete body.id;
  delete body.productId;
  // Products page must not edit stock. Stock is changed only in Inventory.
  delete body.stock;
  delete body.currentStock;
  delete body.openingStock;
  delete body.inwardStock;
  delete body.outwardStock;

  if (body.category) {
    body.category = canonicalProductCategory(body.category);
  }
  if (body.costPrice !== undefined) {
    body.costPrice = Number(body.costPrice);
    body.purchasePrice = Number(body.costPrice);
  }
  if (body.sellingPrice !== undefined) {
    body.sellingPrice = Number(body.sellingPrice);
  }
  if (body.unitOfMeasure) {
    body.unit = body.unitOfMeasure;
  }
  if (body.reorderLevel !== undefined) {
    body.reorderLevel = body.reorderLevel !== null && body.reorderLevel !== "" ? Number(body.reorderLevel) : null;
  }

  await product.update(body);

  // Keep Inventory metadata (name, category, unit, location, reorderLevel) in sync
  const inv = await Inventory.findOne({ where: { productId: id } });
  if (inv) {
    await inv.update({
      productName: product.name,
      category: product.category,
      unit: product.unitOfMeasure,
      warehouseLocation: product.warehouseLocation || inv.warehouseLocation,
      minStockAlert: product.reorderLevel !== null ? Number(product.reorderLevel) : inv.minStockAlert,
    });
  }

  const updated = await Product.findOne({ where: { productId: id } });
  return ApiResponse.success(res, updated, "Product updated successfully");
});

/**
 * Soft delete / deactivate a product
 */
export const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findOne({
    where: {
      [Op.or]: [{ productId: id }, ...(isNaN(id) ? [] : [{ id: Number(id) }])],
    },
  });

  if (!product) {
    throw ApiError.notFound(`Product not found with id: ${id}`);
  }

  product.isActive = false;
  await product.save();

  return ApiResponse.success(res, { productId: product.productId, isActive: false }, "Product deactivated successfully");
});
