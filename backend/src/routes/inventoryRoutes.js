import { Router } from "express";
import { getInventory, getStockMovements, updateStock, adjustStock, recordStockMovement } from "../controllers/inventoryController.js";

const router = Router();

router.get("/", getInventory);
router.get("/movements", getStockMovements);
router.post("/movements", recordStockMovement);
router.put("/:productId", updateStock);
router.post("/:productId/adjust", adjustStock);

export default router;
