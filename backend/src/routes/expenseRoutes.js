import { Router } from "express";
import {
  getExpenses,
  getExpenseSummaryStats,
  createExpenseHandler,
  updateExpenseHandler,
  deleteExpenseHandler,
} from "../controllers/expenseController.js";

const router = Router();

router.get("/summary", getExpenseSummaryStats);
router.get("/", getExpenses);
router.post("/", createExpenseHandler);
router.put("/:id", updateExpenseHandler);
router.delete("/:id", deleteExpenseHandler);

export default router;
