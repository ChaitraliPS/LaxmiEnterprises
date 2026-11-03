import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  getExpensesList,
  getExpenseSummary,
  createExpense,
  updateExpense,
  deleteExpense,
} from "../services/expenseService.js";
import { getToday } from "../constants/erpConstants.js";

/**
 * GET /api/expenses
 * List expenses with pagination, search, category, and date range filters
 */
export const getExpenses = asyncHandler(async (req, res) => {
  const {
    fiscalYear,
    startDate,
    endDate,
    category,
    search,
    limit,
    offset,
    sortBy,
    sortOrder,
  } = req.query;

  const result = await getExpensesList({
    fiscalYear,
    startDate,
    endDate,
    category,
    search,
    limit,
    offset,
    sortBy,
    sortOrder,
  });

  return ApiResponse.success(res, result, "Expenses retrieved successfully");
});

/**
 * GET /api/expenses/summary
 * Aggregated summary with totals, by-category and monthly breakdown
 */
export const getExpenseSummaryStats = asyncHandler(async (req, res) => {
  const { fiscalYear, startDate, endDate, date } = req.query;

  const summary = await getExpenseSummary({
    fiscalYear: fiscalYear || "fy",
    startDate,
    endDate,
    asOfDate: date ? new Date(date) : getToday(),
  });

  return ApiResponse.success(res, summary, "Expense summary retrieved successfully");
});

/**
 * POST /api/expenses
 * Create a new expense record
 */
export const createExpenseHandler = asyncHandler(async (req, res) => {
  const user = req.user?.name || req.user?.email || "Admin";
  const expenseData = {
    ...req.body,
    createdBy: user,
  };

  const created = await createExpense(expenseData);
  return ApiResponse.created(res, created, `Expense ${created.expenseNumber} created successfully`);
});

/**
 * PUT /api/expenses/:id
 * Update an existing expense record
 */
export const updateExpenseHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await updateExpense(id, req.body);
  return ApiResponse.success(res, updated, `Expense ${updated.expenseNumber || id} updated successfully`);
});

/**
 * DELETE /api/expenses/:id
 * Delete an expense record
 */
export const deleteExpenseHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deleted = await deleteExpense(id);
  return ApiResponse.success(res, deleted, `Expense ${deleted.expenseNumber || id} deleted successfully`);
});
