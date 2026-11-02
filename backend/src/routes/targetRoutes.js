import { Router } from "express";
import { listTargets, saveTarget, saveBulkTargets } from "../controllers/targetController.js";

const router = Router();

router.get("/", listTargets);
router.post("/", saveTarget);
router.put("/", saveTarget);
router.post("/bulk", saveBulkTargets);

export default router;

