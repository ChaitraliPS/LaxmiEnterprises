import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { runConsistencyCheck } from "../services/consistencyService.js";
import { getToday } from "../constants/erpConstants.js";

/**
 * Controller endpoint for ERP System Consistency Check
 */
export const getConsistencyReport = asyncHandler(async (req, res) => {
  const { date } = req.query;
  const asOf = date || getToday();
  const report = await runConsistencyCheck(asOf);

  return ApiResponse.success(res, report, `ERP Consistency Check executed: ${report.passedCount}/${report.totalChecks} checks passed`);
});

