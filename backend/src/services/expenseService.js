import { Op } from "sequelize";
import { sequelize } from "../config/db.js";
import { Expense } from "../models/index.js";
import { resolveDateRange, formatISTDateString } from "./metrics/dateRangeHelper.js";
import { generateExpenseNumber } from "../utils/numberSequence.js";
import { getToday } from "../constants/erpConstants.js";
import { ApiError } from "../utils/apiError.js";

/**
 * Returns filtered list of expenses with aggregated totals
 */
export async function getExpensesList({
  fiscalYear = null,
  startDate = null,
  endDate = null,
  category = null,
  search = null,
  limit = null,
  offset = null,
  sortBy = "expenseDate",
  sortOrder = "DESC",
} = {}) {
  const whereClause = {};

  // Date range resolution
  if (fiscalYear || startDate || endDate) {
    const rangeParam = (startDate && endDate) ? { startDate, endDate } : (fiscalYear || "all");
    const { startDate: s, endDate: e, isAllTime } = resolveDateRange(rangeParam, getToday());
    if (!isAllTime) {
      whereClause.expenseDate = { [Op.between]: [s, e] };
    }
  }

  // Category filter
  if (category && category !== "All" && category !== "all") {
    whereClause.category = category;
  }

  // Search filter
  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    whereClause[Op.or] = [
      { expenseNumber: { [Op.like]: q } },
      { title: { [Op.like]: q } },
      { paidTo: { [Op.like]: q } },
      { referenceNo: { [Op.like]: q } },
      { notes: { [Op.like]: q } },
    ];
  }

  const validSortCols = ["expenseDate", "amount", "title", "category", "createdAt"];
  const sortCol = validSortCols.includes(sortBy) ? sortBy : "expenseDate";
  const direction = String(sortOrder).toUpperCase() === "ASC" ? "ASC" : "DESC";

  const order = [
    [sortCol, direction],
    ["id", direction],
  ];

  const queryOpts = {
    where: whereClause,
    order,
  };

  if (limit && Number(limit) > 0) {
    queryOpts.limit = Number(limit);
    if (offset && Number(offset) >= 0) {
      queryOpts.offset = Number(offset);
    }
  }

  const { rows, count } = await Expense.findAndCountAll(queryOpts);

  // Total amount matching filter (without limit/offset)
  const totalAmountResult = await Expense.sum("amount", { where: whereClause });
  const totalAmount = Number(totalAmountResult || 0);

  return {
    expenses: rows.map((e) => e.toJSON()),
    totalCount: count,
    totalAmount,
  };
}

/**
 * Returns aggregated expense summary including category and monthly breakdown
 */
export async function getExpenseSummary({
  fiscalYear = "fy",
  startDate = null,
  endDate = null,
  asOfDate = getToday(),
} = {}) {
  const rangeParam = (startDate && endDate) ? { startDate, endDate } : fiscalYear;
  const { startDate: s, endDate: e, isAllTime, label } = resolveDateRange(rangeParam, asOfDate);

  const whereClause = {};
  if (!isAllTime) {
    whereClause.expenseDate = { [Op.between]: [s, e] };
  }

  const expenses = await Expense.findAll({
    where: whereClause,
    order: [["expenseDate", "ASC"]],
  });

  let totalExpenses = 0;
  const categoryMap = {};
  const monthlyMap = {};

  for (const exp of expenses) {
    const amt = Number(exp.amount || 0);
    totalExpenses += amt;

    // Category grouping
    const cat = exp.category || "Miscellaneous";
    if (!categoryMap[cat]) {
      categoryMap[cat] = {
        category: cat,
        totalAmount: 0,
        count: 0,
        sharePct: 0,
      };
    }
    categoryMap[cat].totalAmount += amt;
    categoryMap[cat].count += 1;

    // Monthly grouping (YYYY-MM)
    const ym = (exp.expenseDate || "").slice(0, 7);
    if (ym) {
      if (!monthlyMap[ym]) {
        const [y, m] = ym.split("-").map(Number);
        const mName = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "short" });
        monthlyMap[ym] = {
          month: ym,
          monthName: `${mName} ${y}`,
          totalAmount: 0,
          count: 0,
        };
      }
      monthlyMap[ym].totalAmount += amt;
      monthlyMap[ym].count += 1;
    }
  }

  // Calculate percentage shares
  const byCategory = Object.values(categoryMap).map((c) => ({
    ...c,
    sharePct: totalExpenses > 0 ? Math.round((c.totalAmount / totalExpenses) * 1000) / 10 : 0,
  })).sort((a, b) => b.totalAmount - a.totalAmount);

  const monthlyBreakdown = Object.values(monthlyMap);

  return {
    periodLabel: label,
    startDate: s,
    endDate: e,
    totalExpenses,
    expenseCount: expenses.length,
    averageExpense: expenses.length > 0 ? Math.round((totalExpenses / expenses.length) * 100) / 100 : 0,
    byCategory,
    monthlyBreakdown,
  };
}

/**
 * Creates a new expense with sequential numbering
 */
export async function createExpense({
  title,
  category = "Miscellaneous",
  amount,
  expenseDate = null,
  paymentMode = "Cash",
  paidTo = null,
  referenceNo = null,
  notes = null,
  createdBy = "Admin",
} = {}) {
  if (!title || !title.trim()) {
    throw new ApiError(400, "Expense title/description is required");
  }

  const parsedAmount = Number(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new ApiError(400, "Expense amount must be a positive number greater than 0");
  }

  const transactionDate = formatISTDateString(expenseDate || getToday());

  return await sequelize.transaction(async (t) => {
    const expenseNumber = await generateExpenseNumber(t, transactionDate);

    const expense = await Expense.create(
      {
        expenseNumber,
        title: title.trim(),
        category: category?.trim() || "Miscellaneous",
        amount: parsedAmount,
        expenseDate: transactionDate,
        paymentMode: paymentMode?.trim() || "Cash",
        paidTo: paidTo?.trim() || null,
        referenceNo: referenceNo?.trim() || null,
        notes: notes?.trim() || null,
        createdBy: createdBy || "Admin",
      },
      { transaction: t }
    );

    return expense.toJSON();
  });
}

/**
 * Updates an existing expense
 */
export async function updateExpense(idOrNumber, updateData = {}) {
  const isNumeric = !isNaN(Number(idOrNumber)) && Number(idOrNumber) > 0;
  const where = isNumeric ? { id: Number(idOrNumber) } : { expenseNumber: String(idOrNumber) };

  const expense = await Expense.findOne({ where });
  if (!expense) {
    throw new ApiError(404, `Expense record '${idOrNumber}' not found`);
  }

  if (updateData.title !== undefined) {
    if (!updateData.title || !updateData.title.trim()) {
      throw new ApiError(400, "Expense title cannot be empty");
    }
    expense.title = updateData.title.trim();
  }

  if (updateData.amount !== undefined) {
    const amt = Number(updateData.amount);
    if (isNaN(amt) || amt <= 0) {
      throw new ApiError(400, "Expense amount must be a positive number");
    }
    expense.amount = amt;
  }

  if (updateData.category !== undefined) {
    expense.category = updateData.category?.trim() || "Miscellaneous";
  }

  if (updateData.expenseDate !== undefined) {
    expense.expenseDate = formatISTDateString(updateData.expenseDate);
  }

  if (updateData.paymentMode !== undefined) {
    expense.paymentMode = updateData.paymentMode?.trim() || "Cash";
  }

  if (updateData.paidTo !== undefined) {
    expense.paidTo = updateData.paidTo ? updateData.paidTo.trim() : null;
  }

  if (updateData.referenceNo !== undefined) {
    expense.referenceNo = updateData.referenceNo ? updateData.referenceNo.trim() : null;
  }

  if (updateData.notes !== undefined) {
    expense.notes = updateData.notes ? updateData.notes.trim() : null;
  }

  await expense.save();
  return expense.toJSON();
}

/**
 * Deletes an existing expense
 */
export async function deleteExpense(idOrNumber) {
  const isNumeric = !isNaN(Number(idOrNumber)) && Number(idOrNumber) > 0;
  const where = isNumeric ? { id: Number(idOrNumber) } : { expenseNumber: String(idOrNumber) };

  const expense = await Expense.findOne({ where });
  if (!expense) {
    throw new ApiError(404, `Expense record '${idOrNumber}' not found`);
  }

  const snapshot = expense.toJSON();
  await expense.destroy();
  return snapshot;
}
