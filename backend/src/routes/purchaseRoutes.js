import { Router } from "express";
import {
  getPurchases,
  getPurchaseById,
  createPurchase,
  updatePurchase,
  recordVendorPayment,
  updateVendorPayment,
  deleteVendorPayment,
  deletePurchase,
} from "../controllers/purchaseController.js";

const router = Router();

router.get("/", getPurchases);
router.get("/:id", getPurchaseById);
router.post("/", createPurchase);
router.put("/:id", updatePurchase);
router.post("/:id/payment", recordVendorPayment);
router.post("/:id/payments", recordVendorPayment);
router.put("/:id/payments/:paymentId", updateVendorPayment);
router.delete("/:id/payments/:paymentId", deleteVendorPayment);
router.delete("/:id", deletePurchase);

export default router;
