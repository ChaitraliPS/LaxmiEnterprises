import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  getRevenueSummary,
  getQuarterlyBreakdown,
  get12MonthCashFlow,
  getCategoryTurnover,
} from "../services/revenueService.js";

export const getRevenueStats = asyncHandler(async (req, res) => {
  const { fiscalYear, date } = req.query;
  const summary = await getRevenueSummary({
    referenceDate: date ? new Date(date) : new Date(),
    fiscalYear,
  });
  return ApiResponse.success(res, summary, "Revenue statistics retrieved");
});

export const getQuarterlyStats = asyncHandler(async (req, res) => {
  const { fiscalYear, date } = req.query;
  const breakdown = await getQuarterlyBreakdown({
    referenceDate: date ? new Date(date) : new Date(),
    fiscalYear,
  });
  return ApiResponse.success(res, breakdown, "Quarterly breakdown retrieved");
});

export const getCashFlowStats = asyncHandler(async (req, res) => {
  const { fiscalYear } = req.query;
  const series = await get12MonthCashFlow({ fiscalYear });
  return ApiResponse.success(res, series, "12-Month cash flow retrieved");
});

export const getCategoryStats = asyncHandler(async (req, res) => {
  const { fiscalYear } = req.query;
  const categories = await getCategoryTurnover({ fiscalYear });
  return ApiResponse.success(res, categories, "Category turnover retrieved");
});

