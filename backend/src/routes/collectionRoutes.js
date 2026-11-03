import { Router } from "express";
import { Collection, Invoice, Client, Payment } from "../models/index.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Op } from "sequelize";

const router = Router();

/**
 * GET /collections
 * List all collection entries, optionally filtered by invoiceNumber or clientId
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { invoiceNumber, clientId, status } = req.query;
    const where = {};
    if (invoiceNumber) where.invoiceNumber = invoiceNumber;
    if (clientId) where.clientId = clientId;
    if (status && status !== "All") where.status = status;

    const collections = await Collection.findAll({
      where,
      include: [
        { model: Invoice, as: "invoice", attributes: ["grandTotal", "paidAmount", "balanceDue", "status"] },
        { model: Payment, as: "payment", attributes: ["paymentNumber", "paymentMode", "paymentDate"] },
      ],
      order: [["paymentDate", "DESC"], ["createdAt", "DESC"]],
    });

    const totalCollected = collections
      .filter((c) => c.status !== "Cancelled")
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    return ApiResponse.success(
      res,
      {
        collections: collections.map((c) => c.toJSON()),
        count: collections.length,
        totalCollected,
      },
      "Collections retrieved successfully"
    );
  })
);

export default router;

