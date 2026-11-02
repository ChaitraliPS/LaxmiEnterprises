import { Router } from "express";
import {
  getPurchases,
  getPurchaseById,
  createPurchase,
  updatePurchase,
  recordVendorPayment,
  deletePurchase,
} from "../controllers/purchaseController.js";

const router = Router();

router.get("/", getPurchases);
router.get("/:id", getPurchaseById);
router.post("/", createPurchase);
router.put("/:id", updatePurchase);
router.post("/:id/payment", recordVendorPayment);
router.delete("/:id", deletePurchase);

export default router;
