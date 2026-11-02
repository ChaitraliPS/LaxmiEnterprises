import { Op } from "sequelize";
import { Vendor } from "../models/Vendor.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getVendorPayables } from "../services/metrics/purchaseMetrics.js";
import { getToday, canonicalVendorType } from "../constants/erpConstants.js";

/**
 * Get all vendors with real purchase dues from purchases ledger
 */
export const getVendors = asyncHandler(async (req, res) => {
  const { category, search } = req.query;
  const where = {};

  if (category && category !== "All") {
    where.category = category;
  }

  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    where[Op.or] = [
      { name: { [Op.like]: q } },
      { companyName: { [Op.like]: q } },
      { vendorId: { [Op.like]: q } },
      { phone: { [Op.like]: q } },
      { contactPerson: { [Op.like]: q } },
      { city: { [Op.like]: q } },
      { village: { [Op.like]: q } },
      { gstin: { [Op.like]: q } },
    ];
  }

  const [vendors, payablesData] = await Promise.all([
    Vendor.findAll({ where, order: [["vendorId", "ASC"]] }),
    getVendorPayables(getToday()),
  ]);

  const payMap = new Map(payablesData.vendorBreakdown.map((v) => [v.vendorId, v]));

  const payload = vendors.map((v) => {
    const json = v.toJSON();
    const metrics = payMap.get(v.vendorId);

    const totalBilled = metrics ? metrics.totalBilled : Number(v.totalPurchases || 0);
    const balanceDue = metrics ? metrics.balanceDue : Number(v.outstandingPayable || 0);
    const billCount = metrics ? metrics.billCount : Number(v.totalOrders || 0);

    return {
      ...json,
      category: canonicalVendorType(v.category),
      totalPurchases: totalBilled,
      totalBilled,
      outstandingPayable: balanceDue,
      pendingDues: balanceDue,
      totalOrders: billCount,
    };
  });

  return ApiResponse.success(res, payload, "Vendors retrieved successfully");
});

/**
 * Get single vendor by vendorId
 */
export const getVendorById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const vendor = await Vendor.findOne({
    where: {
      [Op.or]: [{ vendorId: id }, ...(isNaN(id) ? [] : [{ id: Number(id) }])],
    },
  });

  if (!vendor) {
    throw ApiError.notFound(`Vendor not found with identifier: ${id}`);
  }

  const payablesData = await getVendorPayables(getToday());
  const metrics = payablesData.vendorBreakdown.find((v) => v.vendorId === vendor.vendorId);

  const json = vendor.toJSON();
  return ApiResponse.success(
    res,
    {
      ...json,
      category: canonicalVendorType(vendor.category),
      totalPurchases: metrics ? metrics.totalBilled : Number(vendor.totalPurchases || 0),
      outstandingPayable: metrics ? metrics.balanceDue : Number(vendor.outstandingPayable || 0),
      totalOrders: metrics ? metrics.billCount : Number(vendor.totalOrders || 0),
    },
    "Vendor retrieved successfully"
  );
});

/**
 * Create a new vendor
 */
export const createVendor = asyncHandler(async (req, res) => {
  const vendorData = { ...req.body };

  if (!vendorData.name || !vendorData.name.trim()) {
    throw ApiError.badRequest("Vendor name is required");
  }

  if (!vendorData.vendorId) {
    const count = await Vendor.count();
    vendorData.vendorId = `VN-${String(count + 1).padStart(3, "0")}`;
  }

  const existing = await Vendor.findOne({ where: { vendorId: vendorData.vendorId } });
  if (existing) {
    throw ApiError.badRequest(`Vendor ID ${vendorData.vendorId} already exists`);
  }

  vendorData.category = canonicalVendorType(vendorData.category);

  const vendor = await Vendor.create(vendorData);
  return ApiResponse.created(res, vendor, "Vendor registered successfully");
});

/**
 * Update an existing vendor
 */
export const updateVendor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const vendor = await Vendor.findOne({
    where: {
      [Op.or]: [{ vendorId: id }, ...(isNaN(id) ? [] : [{ id: Number(id) }])],
    },
  });

  if (!vendor) {
    throw ApiError.notFound(`Vendor not found with identifier: ${id}`);
  }

  const body = { ...req.body };
  if (body.category) {
    body.category = canonicalVendorType(body.category);
  }

  await vendor.update(body);
  return ApiResponse.success(res, vendor, "Vendor updated successfully");
});

/**
 * Delete a vendor
 */
export const deleteVendor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const vendor = await Vendor.findOne({
    where: {
      [Op.or]: [{ vendorId: id }, ...(isNaN(id) ? [] : [{ id: Number(id) }])],
    },
  });

  if (!vendor) {
    throw ApiError.notFound(`Vendor not found with identifier: ${id}`);
  }

  await vendor.destroy();
  return ApiResponse.success(res, null, "Vendor deleted successfully");
});
