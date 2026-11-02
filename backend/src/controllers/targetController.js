import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getTargets, updateTarget, bulkUpdateTargets } from "../services/targetService.js";

export const listTargets = asyncHandler(async (req, res) => {
  const { fiscalYear } = req.query;
  const targets = await getTargets({ fiscalYear });
  return ApiResponse.success(res, targets, "Targets retrieved successfully");
});

export const saveTarget = asyncHandler(async (req, res) => {
  const { fiscalYear, quarter, targetAmount, notes } = req.body;
  const target = await updateTarget({ fiscalYear, quarter, targetAmount, notes });
  return ApiResponse.success(res, target, "Target updated successfully");
});

export const saveBulkTargets = asyncHandler(async (req, res) => {
  const list = Array.isArray(req.body) ? req.body : req.body.targets || [];
  const updated = await bulkUpdateTargets(list);
  return ApiResponse.success(res, updated, "Targets saved successfully");
});

