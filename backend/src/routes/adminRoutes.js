import { Router } from "express";
import { getConsistencyReport } from "../controllers/adminController.js";

const router = Router();

router.get("/consistency-check", getConsistencyReport);

export default router;

