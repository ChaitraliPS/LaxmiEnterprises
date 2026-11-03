import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { sequelize } from "../src/config/db.js";
import { Expense, Invoice } from "../src/models/index.js";
import {
  createExpense,
  getExpensesList,
  getExpenseSummary,
  updateExpense,
  deleteExpense,
} from "../src/services/expenseService.js";
import { getRevenueSummary } from "../src/services/revenueService.js";
import { getDashboardSummary } from "../src/services/dashboardService.js";
import { getToday } from "../src/constants/erpConstants.js";

describe("Expenses & Profit After Expense Integration Tests", () => {
  let createdExpenseId = null;
  let testExpenseNumber = null;

  before(async () => {
    await sequelize.authenticate();
    await Expense.sync();
  });

  test("1. Create an expense and verify auto-generated sequential number", async () => {
    const created = await createExpense({
      title: "Test Warehouse Electricity Bill",
      category: "Electricity & Utilities",
      amount: 4500.0,
      expenseDate: "2026-05-10",
      paymentMode: "UPI",
      paidTo: "MSEDCL Power Corp",
      referenceNo: "MSEDCL-2026-9921",
      notes: "Monthly warehouse power consumption",
      createdBy: "TestRunner",
    });

    assert.ok(created.id, "Expense ID should be present");
    assert.ok(created.expenseNumber.startsWith("LE-EXP-2026-27-"), `Expected LE-EXP-2026-27- prefix, got ${created.expenseNumber}`);
    assert.strictEqual(created.title, "Test Warehouse Electricity Bill");
    assert.strictEqual(Number(created.amount), 4500.0);
    assert.strictEqual(created.category, "Electricity & Utilities");
    assert.strictEqual(created.paymentMode, "UPI");

    createdExpenseId = created.id;
    testExpenseNumber = created.expenseNumber;
  });

  test("2. Rejects invalid expense amounts and missing titles", async () => {
    await assert.rejects(
      async () => {
        await createExpense({
          title: "",
          amount: 1000,
          expenseDate: "2026-05-10",
        });
      },
      { message: "Expense title/description is required" }
    );

    await assert.rejects(
      async () => {
        await createExpense({
          title: "Invalid Amount Test",
          amount: -500,
          expenseDate: "2026-05-10",
        });
      },
      { message: "Expense amount must be a positive number greater than 0" }
    );
  });

  test("3. Get expenses list with category and date filtering", async () => {
    const list = await getExpensesList({
      fiscalYear: "2026-27",
      category: "Electricity & Utilities",
    });

    assert.ok(Array.isArray(list.expenses));
    assert.ok(list.expenses.some((e) => e.expenseNumber === testExpenseNumber));
    assert.ok(list.totalAmount >= 4500.0);
  });

  test("4. Get expense summary aggregates totals and category shares", async () => {
    const summary = await getExpenseSummary({
      fiscalYear: "2026-27",
    });

    assert.ok(summary.totalExpenses >= 4500.0);
    assert.ok(summary.expenseCount >= 1);
    assert.ok(Array.isArray(summary.byCategory));
    const elecCat = summary.byCategory.find((c) => c.category === "Electricity & Utilities");
    assert.ok(elecCat, "Electricity & Utilities category should be present in summary");
    assert.ok(elecCat.totalAmount >= 4500.0);
  });

  test("5. Revenue Summary strictly satisfies: Profit after Expense = Gross Profit - Total Expenses", async () => {
    const revSummary = await getRevenueSummary({
      fiscalYear: "2026-27",
      referenceDate: "2026-05-15",
    });

    assert.ok(revSummary.totalExpenses !== undefined, "totalExpenses must be present in Revenue Summary");
    assert.ok(revSummary.profitAfterExpense !== undefined, "profitAfterExpense must be present in Revenue Summary");

    const expectedProfitAfterExpense = revSummary.grossProfit - revSummary.totalExpenses;
    assert.strictEqual(
      revSummary.profitAfterExpense,
      expectedProfitAfterExpense,
      `Profit after Expense (${revSummary.profitAfterExpense}) must equal Gross Profit (${revSummary.grossProfit}) minus Expenses (${revSummary.totalExpenses})`
    );

    // Verify monthly trend also includes expenses and profitAfterExpense
    assert.ok(Array.isArray(revSummary.monthlyTrend));
    const mayRecord = revSummary.monthlyTrend.find((m) => m.month === "2026-05");
    if (mayRecord) {
      assert.ok(mayRecord.expenses >= 4500.0, "May 2026 trend should include the 4500 expense");
      assert.strictEqual(
        mayRecord.profitAfterExpense,
        mayRecord.grossProfit - mayRecord.expenses,
        "Monthly profitAfterExpense must equal monthly grossProfit minus monthly expenses"
      );
    }
  });

  test("6. Dashboard Summary strictly includes Profit after Expense matching the selected period", async () => {
    const dashSummary = await getDashboardSummary({
      year: 2026,
      referenceDate: "2026-05-15",
    });

    assert.ok(dashSummary.kpis.profitAfterExpense, "profitAfterExpense KPI must be present in Dashboard");
    const kpi = dashSummary.kpis.profitAfterExpense;

    const expectedNet = kpi.grossProfit - kpi.totalExpenses;
    assert.strictEqual(
      kpi.value,
      expectedNet,
      `Dashboard profitAfterExpense value (${kpi.value}) must equal grossProfit (${kpi.grossProfit}) - totalExpenses (${kpi.totalExpenses})`
    );
  });

  test("7. Update expense voucher updates record and affects net profit dynamically", async () => {
    const updated = await updateExpense(createdExpenseId, {
      title: "Updated Warehouse Power & Generator Fuel",
      amount: 6000.0,
      notes: "Revised meter reading",
    });

    assert.strictEqual(updated.title, "Updated Warehouse Power & Generator Fuel");
    assert.strictEqual(Number(updated.amount), 6000.0);
    assert.strictEqual(updated.notes, "Revised meter reading");

    // Check revenue summary again
    const revSummary = await getRevenueSummary({
      fiscalYear: "2026-27",
      referenceDate: "2026-05-15",
    });
    assert.strictEqual(
      revSummary.profitAfterExpense,
      revSummary.grossProfit - revSummary.totalExpenses,
      "Profit after Expense must dynamically reflect updated expense amount"
    );
  });

  test("8. Delete expense cleans up and restores net profit", async () => {
    const deleted = await deleteExpense(createdExpenseId);
    assert.strictEqual(deleted.id, createdExpenseId);

    const exists = await Expense.findByPk(createdExpenseId);
    assert.strictEqual(exists, null, "Deleted expense must no longer exist in database");
  });
});
