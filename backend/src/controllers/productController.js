import { Product } from "../models/Product.js";
import { Inventory } from "../models/Inventory.js";
import { StockMovement } from "../models/StockMovement.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getStockHealth, getStockBalance } from "../services/metrics/stockMetrics.js";
import { applyStockChange } from "../utils/stockSync.js";
import { getToday, evaluateStockHealth, canonicalProductCategory } from "../constants/erpConstants.js";

/**
 * Get all products (calling shared metrics service for exact ledger in/out and valuation)
 */
export const getProducts = asyncHandler(async (req, res) => {
  const healthData = await getStockHealth(getToday());
  const healthMap = new Map(healthData.products.map((p) => [p.productId, p]));

  const products = await Product.findAll({
    order: [["name", "ASC"]],
  });

  const payload = products.map((prod) => {
    const json = prod.toJSON();
    const metrics = healthMap.get(prod.productId);

    const balance = metrics ? metrics.currentBalance : 0;
    const totalIn = metrics ? metrics.totalIn : 0;
    const totalOut = metrics ? metrics.totalOut : 0;
    const valAtCost = metrics ? metrics.valuationAtCost : balance * Number(prod.costPrice || 0);

    return {
      ...json,
      stock: balance,
      currentStock: balance,
      in: totalIn,
      inwardStock: totalIn,
      out: totalOut,
      outwardStock: totalOut,
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
 * Create a new product (+ linked inventory & opening stock movement if applicable)
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
  const reorderLevel = inputData.reorderLevel !== undefined && inputData.reorderLevel !== null && inputData.reorderLevel !== ""
    ? Number(inputData.reorderLevel)
    : null;
  const warehouseLocation = inputData.warehouseLocation || (canonicalCat === "Dairy" ? "Cold Silo Tank 1" : "Godown Bay A-1");

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
  });

  const openingQty = Number(inputData.openingStock ?? inputData.stock ?? 0);
  if (openingQty > 0) {
    await applyStockChange(product.productId, openingQty, {
      movementType: "OPENING",
      referenceType: "OPENING",
      reference: "INITIAL-STOCK",
      warehouseLocation,
      date: new Date(),
    });
  }

  return ApiResponse.created(res, product, "Product created successfully");
});

/**
 * Update an existing product
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