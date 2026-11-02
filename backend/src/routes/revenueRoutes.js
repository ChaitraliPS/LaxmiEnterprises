import { Router } from "express";
import {
  getRevenueStats,
  getQuarterlyStats,
  getCashFlowStats,
  getCategoryStats,
} from "../controllers/revenueController.js";

const router = Router();

router.get("/summary", getRevenueStats);
router.get("/quarterly", getQuarterlyStats);
router.get("/cash-flow", getCashFlowStats);
router.get("/categories", getCategoryStats);

export default router;

