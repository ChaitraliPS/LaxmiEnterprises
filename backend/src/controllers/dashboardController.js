import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getDashboardSummary } from "../services/dashboardService.js";

/**
 * Get aggregated ERP KPIs for executive dashboard
 * Fully computed from database records with real MoM comparisons
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
  const { year, date } = req.query;
  const summary = await getDashboardSummary({
    referenceDate: date ? new Date(date) : new Date(),
    year,
  });

  return ApiResponse.success(res, summary, "Dashboard statistics retrieved");
});
