import { Router } from "express";
import {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  recordPayment,
  updatePayment,
  deletePayment,
  deleteInvoice,
} from "../controllers/invoiceController.js";

const router = Router();

router.get("/", getInvoices);
router.get("/:id", getInvoiceById);
router.post("/", createInvoice);
router.put("/:id", updateInvoice);
router.post("/:id/payment", recordPayment);
router.put("/:id/payments/:paymentId", updatePayment);
router.delete("/:id/payments/:paymentId", deletePayment);
router.delete("/:id", deleteInvoice);

export default router;
